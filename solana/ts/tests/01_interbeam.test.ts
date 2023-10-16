import {
  CHAINS,
  CHAIN_ID_ETH,
  ChainId,
  parseTokenTransferPayload,
  parseTokenTransferVaa,
  tryNativeToHexString,
  tryNativeToUint8Array
} from '@certusone/wormhole-sdk'
import * as mock from '@certusone/wormhole-sdk/lib/cjs/mock'
import { getTokenBridgeDerivedAccounts } from '@certusone/wormhole-sdk/lib/cjs/solana'
import * as wormhole from '@certusone/wormhole-sdk/lib/cjs/solana/wormhole'
import { deriveWrappedMintKey } from '@certusone/wormhole-sdk/lib/cjs/solana/tokenBridge'
import { Connection, PublicKey } from '@solana/web3.js'
import { getAccount, getAssociatedTokenAddressSync } from '@solana/spl-token'
import { expect, use as chaiUse } from 'chai'
import chaiAsPromised from 'chai-as-promised'

import * as interbeam from '../sdk'

import {
  INTERBEAM_PID_LOCAL,
  LOCALHOST,
  PAYER_KEYPAIR,
  RELAYER_KEYPAIR,
  WORMHOLE_CONTRACTS,
  CORE_BRIDGE_PID,
  TOKEN_BRIDGE_PID,
  ETH_USDC_ADDRESS,
  MINTS_WITH_DECIMALS,
  deriveMaliciousTokenBridgeEndpointKey,
  programIdFromEnvVar,
  boilerPlateReduction,
  LOCAL_CONNECTION
} from './helpers'
import {
  createRedeemWrappedTransferWithPayloadTx,
  decodeTransferMessagePayload,
  initializeInterbeamBoilerplate
} from '../sdk/utils-svm'

chaiUse(chaiAsPromised)

const ETHEREUM_TOKEN_BRIDGE_ADDRESS = WORMHOLE_CONTRACTS.ethereum.token_bridge

describe(' 1: Interbeam', function () {
  const connection = LOCAL_CONNECTION
  // payer is also the recipient in all tests
  const payer = PAYER_KEYPAIR
  const relayer = RELAYER_KEYPAIR

  const {
    guardianSign,
    postSignedMsgAsVaaOnSolana,
    expectIxToSucceed,
    expectTxToSucceed,
    expectVersionedTxToSucceed
  } = boilerPlateReduction(connection, payer)

  const foreignChain = CHAINS.ethereum
  const foreignContractAddress = Buffer.alloc(32, 'deadbeef', 'hex')
  const unregisteredContractAddress = Buffer.alloc(32, 'deafbeef', 'hex')
  const foreignTokenBridge = new mock.MockEthereumTokenBridge(ETHEREUM_TOKEN_BRIDGE_ADDRESS, 200)
  const program = interbeam.createInterbeamProgramInterface(connection, INTERBEAM_PID_LOCAL)

  const { relayerFee, relayerFeePrecision, createInitializeInterbeamIx, getTokenBalance } =
    initializeInterbeamBoilerplate(connection, payer)

  describe('Initialize Program', function () {
    it('Initialize Program', async function () {
      await expectIxToSucceed(createInitializeInterbeamIx())

      const senderConfigData = await interbeam.getSenderConfigData(connection, INTERBEAM_PID_LOCAL)
      expect(senderConfigData.owner).deep.equals(payer.publicKey)
      expect(senderConfigData.finality).equals(0)

      const tokenBridgeAccounts = getTokenBridgeDerivedAccounts(
        INTERBEAM_PID_LOCAL,
        TOKEN_BRIDGE_PID,
        CORE_BRIDGE_PID
      )

      ;(
        [
          ['config', 'tokenBridgeConfig'],
          ['authoritySigner', 'tokenBridgeAuthoritySigner'],
          ['custodySigner', 'tokenBridgeCustodySigner'],
          ['wormholeBridge', 'wormholeBridge'],
          ['emitter', 'tokenBridgeEmitter'],
          ['wormholeFeeCollector', 'wormholeFeeCollector'],
          ['sequence', 'tokenBridgeSequence']
        ] as [keyof typeof senderConfigData.tokenBridge, keyof typeof tokenBridgeAccounts][]
      ).forEach(([lhs, rhs]) =>
        expect(senderConfigData.tokenBridge[lhs]).deep.equals(tokenBridgeAccounts[rhs])
      )

      const redeemerConfigData = await interbeam.getRedeemerConfigData(
        connection,
        INTERBEAM_PID_LOCAL
      )
      expect(redeemerConfigData.owner).deep.equals(payer.publicKey)
      expect(redeemerConfigData.relayerFee).equals(relayerFee)
      expect(redeemerConfigData.relayerFeePrecision).equals(relayerFeePrecision)
      ;(
        [
          ['config', 'tokenBridgeConfig'],
          ['custodySigner', 'tokenBridgeCustodySigner'],
          ['mintAuthority', 'tokenBridgeMintAuthority']
        ] as [keyof typeof redeemerConfigData.tokenBridge, keyof typeof tokenBridgeAccounts][]
      ).forEach(([lhs, rhs]) =>
        expect(redeemerConfigData.tokenBridge[lhs]).deep.equals(tokenBridgeAccounts[rhs])
      )
    })
  })

  describe('Update Relayer Fee', function () {
    // Set a relayer fee of 0.1%
    const relayerFee = 100_000
    const relayerFeePrecision = 100_000_000
    const createUpdateRelayerFeeIx = (opts?: {
      sender?: PublicKey
      relayerFee?: number
      relayerFeePrecision?: number
    }) =>
      interbeam.createUpdateRelayerFeeInstruction(
        connection,
        INTERBEAM_PID_LOCAL,
        opts?.sender ?? payer.publicKey,
        opts?.relayerFee ?? relayerFee,
        opts?.relayerFeePrecision ?? relayerFeePrecision
      )

    it('Update Relayer Fee', async function () {
      await expectIxToSucceed(createUpdateRelayerFeeIx())

      const redeemerConfigData = await interbeam.getRedeemerConfigData(
        connection,
        INTERBEAM_PID_LOCAL
      )
      expect(redeemerConfigData.relayerFee).equals(relayerFee)
      expect(redeemerConfigData.relayerFeePrecision).equals(relayerFeePrecision)
    })
  })

  describe('Register Foreign Emitter', function () {
    const createRegisterForeignContractIx = (opts?: {
      sender?: PublicKey
      contractAddress?: Buffer
    }) =>
      interbeam.createRegisterForeignContractInstruction(
        connection,
        INTERBEAM_PID_LOCAL,
        opts?.sender ?? payer.publicKey,
        TOKEN_BRIDGE_PID,
        foreignChain,
        opts?.contractAddress ?? foreignContractAddress,
        ETHEREUM_TOKEN_BRIDGE_ADDRESS
      )

    ;[Buffer.alloc(32, 'fbadc0de', 'hex'), foreignContractAddress].forEach((contractAddress) =>
      it(`Register ${
        contractAddress === foreignContractAddress ? 'Final' : 'Random'
      } Address`, async function () {
        await expectIxToSucceed(createRegisterForeignContractIx({ contractAddress }))

        const { chain, address } = await interbeam.getForeignContractData(
          connection,
          INTERBEAM_PID_LOCAL,
          foreignChain
        )
        expect(chain).equals(foreignChain)
        expect(address).deep.equals(contractAddress)
      })
    )
  })

  const batchId = 0
  const sendAmount = 31337n //we are sending once

  const verifyTmpTokenAccountDoesNotExist = async (mint: PublicKey) => {
    const tmpTokenAccountKey = interbeam.deriveTmpTokenAccountKey(INTERBEAM_PID_LOCAL, mint)
    await expect(getAccount(connection, tmpTokenAccountKey)).to.be.rejected
  }

  ;(
    [
      // [
      //   false,
      //   18,
      //   tryNativeToHexString(ETH_WETH_ADDRESS, foreignChain),
      //   deriveWrappedMintKey(TOKEN_BRIDGE_PID, foreignChain, ETH_WETH_ADDRESS) // WETHet (Wormhole) on SVM
      // ]
      [
        false,
        6,
        tryNativeToHexString(ETH_USDC_ADDRESS, foreignChain),
        deriveWrappedMintKey(TOKEN_BRIDGE_PID, foreignChain, ETH_USDC_ADDRESS) // USDCet (Wormhole) on SVM
      ]
      // ...Array.from(MINTS_WITH_DECIMALS.entries()).map(
      //   ([decimals, { publicKey }]): [boolean, number, string, PublicKey] => [
      //     true,
      //     decimals,
      //     publicKey.toBuffer().toString('hex'),
      //     publicKey
      //   ]
      // )
    ] as [boolean, number, string, PublicKey][]
  ).forEach(([isNative, decimals, tokenAddress, mint]) => {
    describe(`For ${isNative ? 'Native' : 'Wrapped'} With ${decimals} Decimals`, function () {
      // We treat amount as if it was specified with a precision of 8 decimals
      const truncation = isNative ? 10n ** BigInt(decimals - 8) : 1n
      //we send once, but we receive twice, hence /2, and w also have to adjust for truncation
      const receiveAmount = (sendAmount / 2n / truncation) * truncation

      // ;[payer, relayer].forEach((sender) => {
      ;[payer].forEach((sender) => {
        const isSelfRelay = sender === payer

        describe(`Receive Tokens With Payload (via ${
          isSelfRelay ? 'self-relay' : 'relayer'
        })`, function () {
          const publishAndSign = (opts?: { foreignContractAddress?: Buffer }) => {
            const tokenTransferPayload = (() => {
              // dummy data

              const payloadSize = 0

              const buf = Buffer.alloc(231 + payloadSize)

              buf.writeUInt16BE(229 + payloadSize, 0) // message len (exluding this field)
              buf.writeUInt16BE(foreignChain, 2) // chainId
              buf.writeUInt8(1, 4) // messageType
              Buffer.from(tryNativeToUint8Array(ETH_USDC_ADDRESS, CHAIN_ID_ETH)).copy(buf, 5) // tokenA
              Buffer.from(tryNativeToUint8Array(ETH_USDC_ADDRESS, CHAIN_ID_ETH)).copy(buf, 37) // tokenB
              // => receiveAmount pad to: 0x000...0003d34 => 15668
              Buffer.alloc(32, receiveAmount.toString(16).padStart(64, '0'), 'hex').copy(buf, 69) // amountTokenA
              Buffer.alloc(32, receiveAmount.toString(16).padStart(64, '0'), 'hex').copy(buf, 101) // amountTokenB
              Buffer.alloc(32, receiveAmount.toString(16).padStart(64, '0'), 'hex').copy(buf, 133) // amountUSDC
              sender.publicKey.toBuffer().copy(buf, 165) // sender
              payer.publicKey.toBuffer().copy(buf, 197) // recipient (is payer)
              buf.writeUInt16BE(payloadSize, 229) // payloadSize
              // empty payload

              return buf
            })()

            const published = foreignTokenBridge.publishTransferTokensWithPayload(
              tokenAddress,
              isNative ? CHAINS.solana : foreignChain, // tokenChain
              receiveAmount / truncation, //adjust for decimals
              CHAINS.solana, // recipientChain
              INTERBEAM_PID_LOCAL.toBuffer().toString('hex'),
              opts?.foreignContractAddress ?? foreignContractAddress,
              tokenTransferPayload,
              batchId
            )
            published[51] = 3

            return guardianSign(published)
          }

          //got call it here so the nonce increases (signedMsg is different between tests)
          const signedMsg = publishAndSign()

          it('Post Wormhole Message', async function () {
            await expect(postSignedMsgAsVaaOnSolana(signedMsg, sender)).to.be.fulfilled
          })

          it('Receive Tokens With Payload', async function () {
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
            // await expectVersionedTxToSucceed(txs[1], sender)

            const balancesChange = await Promise.all(
              tokenAccounts.map(async (acc, i) => (await getTokenBalance(acc)) - balancesBefore[i])
            )

            if (isSelfRelay) {
              expect(balancesChange[0]).equals(receiveAmount)
            } else {
              const { relayerFee, relayerFeePrecision } = await interbeam.getRedeemerConfigData(
                connection,
                INTERBEAM_PID_LOCAL
              )
              const relayerAmount =
                (BigInt(relayerFee) * receiveAmount) / BigInt(relayerFeePrecision)
              expect(balancesChange[0]).equals(receiveAmount - relayerAmount)
              expect(balancesChange[1]).equals(relayerAmount)
            }

            await verifyTmpTokenAccountDoesNotExist(mint)
          })
        })
      })
    })
  })
})
