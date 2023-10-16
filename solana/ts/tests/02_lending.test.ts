import {
  CHAINS,
  CHAIN_ID_ETH,
  tryNativeToHexString,
  tryNativeToUint8Array
} from '@certusone/wormhole-sdk'
import * as mock from '@certusone/wormhole-sdk/lib/cjs/mock'
import { deriveWrappedMintKey } from '@certusone/wormhole-sdk/lib/cjs/solana/tokenBridge'
import { AnchorProvider } from '@coral-xyz/anchor'
import NodeWallet from '@coral-xyz/anchor/dist/cjs/nodewallet'
import {
  getConfig as getMarginfiConfig,
  MarginfiAccountWrapper,
  MarginfiClient
} from '@mrgnlabs/marginfi-client-v2'
import { Mint, getAssociatedTokenAddressSync, getMint } from '@solana/spl-token'
import { PublicKey, VersionedTransaction } from '@solana/web3.js'
import { expect, use as chaiUse } from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { ethers } from 'ethers'

import * as interbeamSvm from '../sdk'
import * as interbeamBroadcastEthereum from '../sdk/broadcast/ethereum/aave-v3-adapter.json'
import {
  INTERBEAM_PID_LOCAL,
  PAYER_KEYPAIR,
  RELAYER_KEYPAIR,
  WORMHOLE_CONTRACTS,
  TOKEN_BRIDGE_PID,
  ETH_USDC_ADDRESS,
  boilerPlateReduction,
  LOCAL_CONNECTION,
  ETH_aUSDC_ADDRESS
} from './helpers'
import {
  AaveV3Adapter__factory,
  IAToken__factory,
  IPool,
  IPool__factory,
  IUSDC__factory
} from '../sdk/types-typechain'
import { formatWormholeMessageFromReceipt } from '../sdk/utils-evm'
import {
  createAddressLookupTableIx,
  createAndMintToAssociatedTokenAccount,
  createRedeemWrappedTransferWithPayloadTx,
  decodeTransferMessagePayload,
  extendAddressLookupTableIx,
  initializeInterbeamBoilerplate,
  createAddressLookupTable
} from '../sdk/utils-svm'
import { getQuote, getSwapTx } from '../sdk/swap/jupiter'

chaiUse(chaiAsPromised)

const ETHEREUM_TOKEN_BRIDGE_ADDRESS = WORMHOLE_CONTRACTS.ethereum.token_bridge

describe(' 2: Lending', function () {
  const connection = LOCAL_CONNECTION
  // payer is also the recipient in all tests
  const payer = PAYER_KEYPAIR
  const relayer = RELAYER_KEYPAIR

  const {
    guardianSign,
    signAndPostMsg,
    postSignedMsgAsVaaOnSolana,
    expectIxToSucceed,
    expectIxToFailWithError,
    expectTxToSucceed,
    expectVersionedTxToSucceed
  } = boilerPlateReduction(connection, payer)

  const { relayerFee, relayerFeePrecision, getTokenBalance } = initializeInterbeamBoilerplate(
    connection,
    payer
  )

  const foreignChain = CHAINS.ethereum
  const foreignContractAddress = Buffer.alloc(32, 'deadbeef', 'hex')
  const foreignTokenBridge = new mock.MockEthereumTokenBridge(ETHEREUM_TOKEN_BRIDGE_ADDRESS, 200)
  // const program = interbeamSvm.createInterbeamProgramInterface(connection, INTERBEAM_PID_LOCAL)

  const tokenAddressUsdc = tryNativeToHexString(ETH_USDC_ADDRESS, foreignChain)
  const bridgedUsdcMintKey = deriveWrappedMintKey(TOKEN_BRIDGE_PID, foreignChain, ETH_USDC_ADDRESS)
  // => A9mUU4qviSctJVPJdBJWkb28deg915LYJKrzQ19ji3FM (wormhole wrapped USDC on Solana)
  const svmUsdcMintKey = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
  let svmUsdcMint: Mint
  let svmUsdcAtaKey: PublicKey

  const tokenDecimals = 6 // on Ethereum

  const batchId = 0
  const sendAmount = 31337n //we are sending once

  const svmProvider = new AnchorProvider(connection, new NodeWallet(payer), {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed'
  })

  const evmProvider = new ethers.providers.JsonRpcProvider('http://127.0.0.1:8545')
  const evmWallet = new ethers.Wallet(
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    evmProvider
  )
  // ==> address 0: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

  const interbeamEvmAddress = interbeamBroadcastEthereum.transactions.find(
    (tx) => tx.contractName === 'Interbeam'
  ).contractAddress

  const aaveAdapterAddress = interbeamBroadcastEthereum.transactions.find(
    (tx) => tx.contractName === 'AaveV3Adapter'
  ).contractAddress

  if (!interbeamEvmAddress || !aaveAdapterAddress) {
    throw new Error('Could not find Interbeam or AaveV3Adapter address!')
  }

  const aaveV3Adapter = AaveV3Adapter__factory.connect(aaveAdapterAddress, evmWallet)

  const evmUsdcToken = IUSDC__factory.connect(ETH_USDC_ADDRESS, evmWallet)
  // `from` in https://etherscan.io/advanced-filter?fadd=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48&tadd=0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48&txntype=0&mtd=0x40c10f19%7eMint
  const evmUsdcMinterAddress = '0x5b6122c109b78c6755486966148c1d70a50a47d7'

  const aUsdcToken = IAToken__factory.connect(ETH_aUSDC_ADDRESS, evmWallet)

  let aavePool: IPool

  before(async function () {
    const aavePoolAddress = await aaveV3Adapter.aavePool()
    aavePool = IPool__factory.connect(aavePoolAddress, evmWallet)

    svmUsdcMint = await getMint(connection, svmUsdcMintKey)

    svmUsdcAtaKey = await createAndMintToAssociatedTokenAccount(
      svmProvider,
      svmUsdcMint,
      100_000e6, // mint 100k USDC
      payer.publicKey,
      payer.publicKey
    )
  })

  const usdcDepositAmount = ethers.BigNumber.from(100e6)
  const usdcWithdrawAmount = ethers.BigNumber.from(50e6)
  const txOptions = { gasLimit: 3_000_000 }

  describe('Setup: Interbeam program', function () {
    it('Register Interbeam EVM as Foreign Emitter on SVM', async function () {
      // Note that AaveV3Adapter uses Interbeam under the hood to send message
      const foreignContractAddress = Buffer.from(
        tryNativeToUint8Array(interbeamEvmAddress, foreignChain)
      )

      await expectIxToSucceed(
        interbeamSvm.createRegisterForeignContractInstruction(
          connection,
          INTERBEAM_PID_LOCAL,
          payer.publicKey,
          TOKEN_BRIDGE_PID,
          foreignChain,
          foreignContractAddress,
          ETHEREUM_TOKEN_BRIDGE_ADDRESS
        )
      )

      const { chain, address } = await interbeamSvm.getForeignContractData(
        connection,
        INTERBEAM_PID_LOCAL,
        foreignChain
      )
      expect(chain).equals(foreignChain)
      expect(address).deep.equals(foreignContractAddress)
    })
  })

  describe('Setup: EVM tokens', function () {
    it('Airdrop USDC on EVM', async function () {
      // First, mint some ETH to USDC minter

      // console.log('amount', ethers.utils.parseEther('100').toHexString())
      // await evmProvider.send('anvil_setBalance', [
      //   '0xE982615d461DD5cD06575BbeA87624fda4e3de17',
      //   '0x' + ethers.utils.parseEther('100').toHexString() // 100 ETH
      // ])

      // transfer some ETH from evmWallet to USDC minter
      await evmWallet
        .sendTransaction({
          from: evmWallet.address,
          to: evmUsdcMinterAddress,
          value: ethers.utils.parseEther('100'),
          gasLimit: txOptions.gasLimit
        })
        .then(async (tx) => await tx.wait())

      // Impersonate as USDC minter
      await evmProvider.send('anvil_impersonateAccount', [evmUsdcMinterAddress])
      const usdcMintingToken = evmUsdcToken.connect(evmProvider.getSigner(evmUsdcMinterAddress))

      const evmUsdcTokenBalanceBefore = await usdcMintingToken.balanceOf(evmWallet.address)

      await usdcMintingToken
        .mint(evmWallet.address, usdcDepositAmount, txOptions)
        .then(async (tx) => await tx.wait())

      await evmProvider.send('anvil_stopImpersonatingAccount', [evmUsdcMinterAddress])

      const evmUsdcTokenBalanceChange = (await usdcMintingToken.balanceOf(evmWallet.address)).sub(
        evmUsdcTokenBalanceBefore
      )
      // console.log('usdcTokenBalance', usdcTokenBalance.toLocaleString())

      expect(evmUsdcTokenBalanceChange.eq(usdcDepositAmount)).to.be.true
    })
  })

  // describe('Setup: SVM Address Lookup Table', function () {
  //   it('Create & Extend Address Lookup Table', async function () {

  //     const lookupTableAddress = await createAddressLookupTable(
  //       connection,
  //       payer,
  //       [
  //         '4qp6Fx6tnZkY5Wropq9wUYgtFxXKwE6viZxFHg3rdAG8', // Marginfi V2 margin_group
  //         '2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB', // Marginfi V2 bank USDC
  //         '7jaiZR5Sk8hdYN9MxTpczTcwbWpb5WEoxSANuUwveuat' // Marginfi V2 bank liquidity vault USDC
  //       ].map((x) => new PublicKey(x))
  //     )

  //     const lookupTableAccount = await connection
  //       .getAddressLookupTable(lookupTableAddress)
  //       .then((res) => res.value)

  //     console.log('🧾 Verifying Addresses in the Lookup Table...')

  //     for (let i = 0; i < lookupTableAccount.state.addresses.length; i++) {
  //       const address = lookupTableAccount.state.addresses[i]
  //       console.log('Address', i + 1, address.toBase58())
  //     }
  //   })
  // })

  describe('Aave (EVM) to Marginfi (SVM)', function () {
    let mfiClient: MarginfiClient
    let mfiAccount: MarginfiAccountWrapper

    let signedMsg: Buffer
    let unsignedMessages: Buffer[]

    describe('EVM steps', function () {
      it('Sign Wormhole Message on EVM', async function () {
        await evmUsdcToken
          .approve(aavePool.address, ethers.constants.MaxUint256, txOptions)
          .then(async (tx) => await tx.wait())

        await aUsdcToken
          .approve(aaveV3Adapter.address, ethers.constants.MaxUint256, txOptions)
          .then(async (tx) => await tx.wait())

        await aavePool
          .deposit(ETH_USDC_ADDRESS, usdcDepositAmount, evmWallet.address, 0, txOptions)
          .then(async (tx) => await tx.wait())

        const receipt = (await aaveV3Adapter
          .beam2marginfi(
            ETH_USDC_ADDRESS,
            ETH_aUSDC_ADDRESS,
            usdcWithdrawAmount,
            3000,
            '0x' + tryNativeToHexString(payer.publicKey.toBase58(), 'solana'), // getEmitterAddressSolana(payer.publicKey)
            txOptions
          )
          .then(async (tx) => await tx.wait())
          .catch((msg) => {
            // should not happen
            console.log(msg)
            return null
          })) as ethers.providers.TransactionReceipt | null

        expect(receipt).is.not.null
        // console.log(receipt.logs)

        unsignedMessages = await formatWormholeMessageFromReceipt(receipt, CHAIN_ID_ETH)
        expect(unsignedMessages.length).to.equal(1) // only one message
      })

      it('Post Wormhole Message on SVM', async function () {
        // guardianSign(unsignedMessages[0])
        signedMsg = await expect(signAndPostMsg(unsignedMessages[0])).to.be.fulfilled
      })
    })

    describe('SVM steps', function () {
      let bankUsdc: ReturnType<typeof mfiClient.getBankByMint>

      // amount for Marginfi should be non-decimal-exponentiated
      const depositAmount = usdcDepositAmount.div(1e6).toNumber()

      it('Receive USDC with Payload on SVM', async function () {
        const sender = payer // todo: add relayer as well
        const isSelfRelay = sender === payer

        const mint = deriveWrappedMintKey(TOKEN_BRIDGE_PID, foreignChain, ETH_USDC_ADDRESS)

        const tokenAccounts = (isSelfRelay ? [payer] : [payer, relayer]).map((kp) =>
          getAssociatedTokenAddressSync(mint, kp.publicKey)
        )

        const balancesBefore = await Promise.all(tokenAccounts.map(getTokenBalance))

        const txs = await createRedeemWrappedTransferWithPayloadTx({
          sender: sender.publicKey,
          signedMsg,
          connection,
          payloadParser: (parsed) => decodeTransferMessagePayload(parsed.tokenTransferPayload)
        })

        await expectTxToSucceed(txs[0], sender)
        // await expectTxToSucceed(txs[1], sender)

        const balancesChange = await Promise.all(
          tokenAccounts.map(async (acc, i) => (await getTokenBalance(acc)) - balancesBefore[i])
        )

        // console.log('balancesChange', balancesChange)

        // if (isSelfRelay) {
        //   expect(balancesChange[0]).equals(receiveAmount)
        // } else {
        //   const { relayerFee, relayerFeePrecision } = await interbeamSvm.getRedeemerConfigData(
        //     connection,
        //     INTERBEAM_PID_LOCAL
        //   )
        //   const relayerAmount = (BigInt(relayerFee) * receiveAmount) / BigInt(relayerFeePrecision)
        //   expect(balancesChange[0]).equals(receiveAmount - relayerAmount)
        //   expect(balancesChange[1]).equals(relayerAmount)
        // }

        // await verifyTmpTokenAccountDoesNotExist(mint)
      })

      it.skip('Swap USDCet to USDC', async function () {
        const quoteResponse = await getQuote(bridgedUsdcMintKey, svmUsdcMintKey, depositAmount)

        const payerUsdcAtaKey = getAssociatedTokenAddressSync(svmUsdcMintKey, payer.publicKey)
        const balanceBefore = await getTokenBalance(payerUsdcAtaKey)

        const swapTransaction = await getSwapTx(payer.publicKey, payerUsdcAtaKey, quoteResponse)
        // console.dir(swapTransaction, { depth: null })

        // Sign & Execute the swap transaction
        swapTransaction.sign([payer])
        const txid = await connection.sendRawTransaction(swapTransaction.serialize(), {
          skipPreflight: true,
          maxRetries: 2
        })
        await connection.confirmTransaction(txid)

        const balanceChange = (await getTokenBalance(payerUsdcAtaKey)) - balanceBefore
        console.log('balanceChange', balanceChange)
      })

      it('Marginfi: Create account', async function () {
        const config = getMarginfiConfig('production')
        mfiClient = await MarginfiClient.fetch(config, new NodeWallet(payer), connection)

        mfiAccount = await mfiClient.createMarginfiAccount()
        // => const mfiAccount = await MarginfiAccount.fetch(mfiAccount.address, client)

        // const programAddresses = await mfiClient.getAllProgramAccountAddresses(
        //   MarginfiAccountType.MarginfiGroup
        // )
        // console.log(`marginfi addresses for payer ${payer.publicKey.toBase58()}`)
        // console.log(`marginfi account authority: ${mfiAccount.authority.toBase58()}`)
        // console.log(programAddresses.map((key) => key.toBase58()))

        // const group = mfiAccount.group
        // console.log('group', group)

        bankUsdc = mfiClient.getBankByMint(svmUsdcMintKey)
        // => const bankUsdc = mfiClient.getBankByPk('2s37akK2eyBbp8DZgCm7RtsaEz8eJP3Nxd4urLHQv7yB')
        expect(bankUsdc).to.exist

        const userTokenAtaPk = getAssociatedTokenAddressSync(
          svmUsdcMintKey,
          mfiAccount.authority,
          true
        )
        expect(userTokenAtaPk.equals(svmUsdcAtaKey)).to.be.true
      })

      it('Marginfi: Deposit USDC', async function () {
        await mfiAccount.deposit(depositAmount, bankUsdc.address)
        await mfiAccount.reload()

        // console.log(mfiClient.oraclePrices)
        expect(mfiAccount.activeBalances.length).to.be.greaterThan(0)

        const mfiUsdcBalance = mfiAccount.getBalance(bankUsdc.address)
        expect(mfiUsdcBalance.active).to.be.true
        expect(mfiUsdcBalance.assetShares.gt(0)).to.be.true
        // expect(mfiUsdcBalance.liabilityShares).to.be.equal(0)
        // expect(mfiUsdcBalance.emissionsOutstanding).to.be.equal(0)

        const priceInfo = mfiClient.getOraclePriceByBank(bankUsdc.address)
        expect(priceInfo).to.exist

        const { assets, liabilities } = mfiUsdcBalance.getUsdValueWithPriceBias(bankUsdc, priceInfo)
        console.log(
          `Balance for ${bankUsdc.mint.toBase58()} (bank: ${mfiUsdcBalance.bankPk.toBase58()})`
        )
        console.log(`  deposits:    ${assets}`)
        console.log(`  assetShares: ${mfiUsdcBalance.assetShares.toString()}`)
        // console.log(`  borrows:  ${liabilities}`)

        // mfiAccount.activeBalances.forEach((balance) => {
        //   const bank = mfiClient.getBankByPk(balance.bankPk)
        //   if (!bank) throw Error(`Bank ${balance.bankPk.toBase58()} not found`)

        //   const priceInfo = mfiClient.getOraclePriceByBank(balance.bankPk)
        //   if (!priceInfo)
        //     throw Error(`Price oracle for Bank ${balance.bankPk.toBase58()} not found`)

        //   const { assets, liabilities } = balance.getUsdValueWithPriceBias(bank, priceInfo)
        //   console.log(
        //     `Balance for ${bank.mint.toBase58()} (${balance.bankPk.toBase58()}) deposits: ${assets}, borrows: ${liabilities}`
        //   )
        // })
      })

      // it('Withdraw USDC', async function () {
      //   const prevBalance = mfiAccount.getBalance(bankUsdc.address)
      //   expect(prevBalance.active).to.be.true

      //   await mfiAccount.withdraw(depositAmount, bankUsdc.address)
      //   await mfiAccount.reload()

      //   const newBalance = mfiAccount.getBalance(bankUsdc.address)
      //   const priceInfo = mfiClient.getOraclePriceByBank(bankUsdc.address)

      //   const { assets } = newBalance.getUsdValueWithPriceBias(bankUsdc, priceInfo)
      //   expect(assets.lt(1)).to.be.true

      //   console.log(
      //     `Balance for ${bankUsdc.mint.toBase58()} (bank: ${newBalance.bankPk.toBase58()})`
      //   )
      //   console.log(`  deposits:    ${assets}`)
      //   console.log(`  assetShares: ${newBalance.assetShares.toString()}`)
      // })
    })
  })

  // describe(`For Wrapped USDC With ${tokenDecimals} Decimals`, function () {
  //   const truncation = 1n
  //   // we send once, but we receive twice, hence /2, and w also have to adjust for truncation
  //   const receiveAmount = (sendAmount / 2n / truncation) * truncation

  //   const publishAndSign = (opts?: { foreignContractAddress?: Buffer }) => {
  //     const tokenTransferPayload = (() => {
  //       const buf = Buffer.alloc(33)
  //       buf.writeUInt8(1, 0) // payload ID
  //       payer.publicKey.toBuffer().copy(buf, 1) // payer is always recipient
  //       return buf
  //     })()

  //     const published = foreignTokenBridge.publishTransferTokensWithPayload(
  //       tokenAddressUsdc,
  //       foreignChain, // tokenChain
  //       receiveAmount / truncation, //adjust for decimals
  //       CHAINS.solana, // recipientChain
  //       INTERBEAM_PID_LOCAL.toBuffer().toString('hex'),
  //       opts?.foreignContractAddress ?? foreignContractAddress,
  //       tokenTransferPayload,
  //       batchId
  //     )
  //     published[51] = 3

  //     return guardianSign(published)
  //   }

  //   const createRedeemTransferWithPayloadIx = (sender: PublicKey, signedMsg: Buffer) =>
  //     interbeamSvm.createRedeemWrappedTransferWithPayloadInstruction(
  //       connection,
  //       INTERBEAM_PID_LOCAL,
  //       sender,
  //       TOKEN_BRIDGE_PID,
  //       CORE_BRIDGE_PID,
  //       signedMsg
  //     )

  //   ;[payer, relayer].forEach((sender) => {
  //     const isSelfRelay = sender === payer

  //     describe(`Receive Tokens With Payload (via ${
  //       isSelfRelay ? 'self-relay' : 'relayer'
  //     })`, function () {
  //       //got call it here so the nonce increases (signedMsg is different between tests)
  //       const signedMsg = publishAndSign()

  //       it('Post Wormhole Message', async function () {
  //         await expect(postSignedMsgAsVaaOnSolana(signedMsg, sender)).to.be.fulfilled
  //       })

  //       it('Receive Tokens With Payload', async function () {
  //         const tokenAccounts = (isSelfRelay ? [payer] : [payer, relayer]).map((kp) =>
  //           getAssociatedTokenAddressSync(tokenMintPubkey, kp.publicKey)
  //         )

  //         const balancesBefore = await Promise.all(tokenAccounts.map(getTokenBalance))
  //         await expectIxToSucceed(
  //           createRedeemTransferWithPayloadIx(sender.publicKey, signedMsg),
  //           sender
  //         )
  //         const balancesChange = await Promise.all(
  //           tokenAccounts.map(async (acc, i) => (await getTokenBalance(acc)) - balancesBefore[i])
  //         )

  //         if (isSelfRelay) {
  //           expect(balancesChange[0]).equals(receiveAmount)
  //         } else {
  //           const { relayerFee, relayerFeePrecision } = await interbeamSvm.getRedeemerConfigData(
  //             connection,
  //             INTERBEAM_PID_LOCAL
  //           )
  //           const relayerAmount = (BigInt(relayerFee) * receiveAmount) / BigInt(relayerFeePrecision)
  //           expect(balancesChange[0]).equals(receiveAmount - relayerAmount)
  //           expect(balancesChange[1]).equals(relayerAmount)
  //         }

  //         await verifyTmpTokenAccountDoesNotExist(tokenMintPubkey)
  //       })
  //     })
  //   })
  // })
})
