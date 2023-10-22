import { CHAINS, CONTRACTS, tryNativeToUint8Array } from '@certusone/wormhole-sdk'
import { AnchorProvider, Wallet as AnchorWallet } from '@coral-xyz/anchor'
import { bs58 } from '@coral-xyz/anchor/dist/cjs/utils/bytes'
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js'
import dotenv from 'dotenv'

import * as interbeam from './sdk'

dotenv.config()

const NETWORK = 'MAINNET'
const WORMHOLE_CONTRACTS = CONTRACTS[NETWORK]

const MAINNET_CONNECTION = new Connection('https://api.mainnet-beta.solana.com', 'processed')

const SVM_PROGRAM_MAINNET = new PublicKey('beamSCX2hEqX9quugQLmze1oZfejyAkA8CfKb9rTkb6')

async function main() {
  const svmPayer = Keypair.fromSecretKey(bs58.decode(process.env.SVM_PAYER_SECRET_KEY))
  const svmPayerWallet = new AnchorWallet(svmPayer)

  const relayerFee = 0
  const relayerFeePrecision = 100_000_000

  const initIx = await interbeam.createInitializeInstruction(
    MAINNET_CONNECTION,
    SVM_PROGRAM_MAINNET,
    svmPayer.publicKey,
    WORMHOLE_CONTRACTS.solana.token_bridge,
    WORMHOLE_CONTRACTS.solana.core,
    relayerFee,
    relayerFeePrecision
  )

  const registerFcIxs = await Promise.all(
    // NOTE! Contract address is `Interbeam` address, not adapter!
    [
      // {
      //   chain: CHAINS.arbitrum,
      //   contractAddress: '0x9e0e006f30519E30eBbc3bE81e8C81c7FEcA3aa3',
      //   tokenBridge: WORMHOLE_CONTRACTS.arbitrum.token_bridge
      // },
      {
        chain: CHAINS.polygon,
        contractAddress: '0x4C636eFcA2Bf1F94096d0D3f89854231563f8F39',
        tokenBridge: WORMHOLE_CONTRACTS.polygon.token_bridge
      }
    ].map(
      async (fc) =>
        await interbeam.createRegisterForeignContractInstruction(
          MAINNET_CONNECTION,
          SVM_PROGRAM_MAINNET,
          svmPayer.publicKey,
          WORMHOLE_CONTRACTS.solana.token_bridge,
          fc.chain,
          Buffer.from(tryNativeToUint8Array(fc.contractAddress, fc.chain)),
          fc.tokenBridge
        )
    )
  )

  const provider = new AnchorProvider(MAINNET_CONNECTION, svmPayerWallet, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed'
  })

  const recentBlockhash = (await MAINNET_CONNECTION.getLatestBlockhash()).blockhash

  const initTx = new Transaction().add(initIx)
  initTx.recentBlockhash = recentBlockhash
  initTx.feePayer = svmPayer.publicKey

  const registerFcSignedTxs = await Promise.all(
    registerFcIxs.map(async (ix) => {
      const tx = new Transaction().add(ix)
      tx.recentBlockhash = recentBlockhash
      tx.feePayer = svmPayer.publicKey
      return await svmPayerWallet.signTransaction(tx)
    })
  )

  // SKIP if only registering foreign contracts
  // const initSignedTx = await svmPayerWallet.signTransaction(initTx)
  // const initTxSig = await provider.sendAndConfirm(initSignedTx, [svmPayer])
  // console.log('init tx sig', initTxSig)

  const registerFcSigs = await Promise.all(
    registerFcSignedTxs.map(async (tx) => await provider.sendAndConfirm(tx, [svmPayer]))
  )
  console.log('register fc txs', registerFcSigs)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .then(() => process.exit(0))
