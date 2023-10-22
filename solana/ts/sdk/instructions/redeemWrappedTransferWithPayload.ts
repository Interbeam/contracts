import {
  CHAIN_ID_ETH,
  ChainId,
  isBytes,
  ParsedTokenTransferVaa,
  parseTokenTransferVaa,
  SignedVaa,
  tryHexToNativeAssetString
} from '@certusone/wormhole-sdk'
import { CompleteTransferWrappedWithPayloadCpiAccounts } from '@certusone/wormhole-sdk/lib/cjs/solana'
import { deriveClaimKey, derivePostedVaaKey } from '@certusone/wormhole-sdk/lib/cjs/solana/wormhole'
import {
  deriveEndpointKey,
  deriveMintAuthorityKey,
  deriveRedeemerAccountKey,
  deriveTokenBridgeConfigKey,
  deriveWrappedMetaKey,
  deriveWrappedMintKey
} from '@certusone/wormhole-sdk/lib/cjs/solana/tokenBridge'
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token'
import {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
  PublicKeyInitData,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction
} from '@solana/web3.js'
import { BigNumber } from 'ethers'
import * as gaxios from 'gaxios'

import {
  deriveForeignContractKey,
  deriveTmpTokenAccountKey,
  deriveRedeemerConfigKey
} from '../accounts'
import { createInterbeamProgramInterface } from '../program'
import { InterbeamMessage } from '../types'
import { getSwapDataForUSDCet2USDC } from '../swap/jupiter'
import { SVM_USDC, SVM_USDC_WORMHOLE_FROM_ETH } from '../consts-svm'
import { getAddressLookupTableAccounts } from '../swap/jup-helpers'
import { PAYER_KEYPAIR } from '../../tests/helpers'

export async function createRedeemWrappedTransferWithPayloadAndSwapTx(
  connection: Connection,
  programId: PublicKeyInitData,
  payer: PublicKeyInitData,
  tokenBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  wormholeMessage: SignedVaa | ParsedTokenTransferVaa,
  payloadParser: (parsed: ParsedTokenTransferVaa) => InterbeamMessage
): Promise<[Transaction, VersionedTransaction]> {
  const program = createInterbeamProgramInterface(connection, programId)

  const parsed = isBytes(wormholeMessage) ? parseTokenTransferVaa(wormholeMessage) : wormholeMessage

  const wrappedMint = deriveWrappedMintKey(
    tokenBridgeProgramId,
    parsed.tokenChain,
    parsed.tokenAddress
  )

  const tmpTokenAccount = deriveTmpTokenAccountKey(programId, wrappedMint)
  const tokenBridgeAccounts = getCompleteTransferWrappedWithPayloadCpiAccounts(
    tokenBridgeProgramId,
    wormholeProgramId,
    payer,
    parsed,
    tmpTokenAccount
  )

  // console.log(`parsed.tokenTransferPayload length: ${parsed.tokenTransferPayload.length}`)

  const parsedPayload = payloadParser(parsed)
  const recipient = new PublicKey(parsedPayload.recipient)
  const recipientTokenAccount = getAssociatedTokenAddressSync(wrappedMint, recipient) // USDCet

  console.log('redeem wrapped transfer with payload')
  console.log(
    '  tokenAddress',
    tryHexToNativeAssetString(parsed.tokenAddress.toString('hex'), CHAIN_ID_ETH)
  )
  console.log('  wrappedMint', wrappedMint.toBase58())
  console.log('  payer', tokenBridgeAccounts.payer.toBase58())
  console.log('  recipient', recipient.toBase58())
  console.log('  recipientTokenAccount', recipientTokenAccount.toBase58())

  const programTokenAccountUSDC = getAssociatedTokenAddressSync(
    SVM_USDC,
    new PublicKey(programId),
    true
  )

  // console.log(parsedPayload.messageLength.toString())
  // console.log(parsedPayload.messageType.toString())
  // console.log(parsedPayload.chainId.toString())
  // console.log(parsedPayload.amountUSDC.toString('hex'))
  // console.log(parsedPayload.amountTokenA.toString('hex'))
  // console.log(parsedPayload.amountTokenB.toString('hex'))

  const { computeBudgetIxs, setupIxs, swapIx, swapAccounts, swapData, addressLookupTableAccounts } =
    await getSwapDataForUSDCet2USDC({
      connection,
      tmpTokenAccountUSDCet: tmpTokenAccount,
      programTokenAccountUSDC,
      // TODO: check against really large conversions, potential overflow
      amount: BigNumber.from(parsedPayload.amountUSDC).toNumber()
    })
  console.log(swapData.length, swapData.byteLength, swapData)

  const redeemWrappedTransferWithPayloadIx = await program.methods
    .redeemWrappedTransferWithPayload({ vaaHash: [...parsed.hash], jupiterSwapData: swapData })
    .accounts({
      config: deriveRedeemerConfigKey(programId),
      foreignContract: deriveForeignContractKey(programId, parsed.emitterChain as ChainId),
      tmpTokenAccount,
      recipientTokenAccount,
      recipient,
      payer: new PublicKey(payer),
      payerTokenAccount: getAssociatedTokenAddressSync(wrappedMint, new PublicKey(payer)),
      tokenBridgeProgram: new PublicKey(tokenBridgeProgramId),
      ...tokenBridgeAccounts
      // jupiterProgram: new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4')
    })
    .remainingAccounts(swapAccounts)
    .instruction()

  // const instructions = [...computeBudgetIxs, setupIxs]

  const txPre = new TransactionMessage({
    payerKey: new PublicKey(payer),
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    instructions: [...computeBudgetIxs, ...setupIxs]
  }).compileToLegacyMessage()

  const txRedeem = new TransactionMessage({
    payerKey: new PublicKey(payer),
    recentBlockhash: (await connection.getLatestBlockhash()).blockhash,
    instructions: [redeemWrappedTransferWithPayloadIx]
  }).compileToV0Message(addressLookupTableAccounts)
  // const txRedeem = new Transaction().add(redeemWrappedTransferWithPayloadIx)

  // const serialized = txRedeem.serialize({
  //   verifySignatures: false,
  //   requireAllSignatures: false
  // })
  // const size = serialized.length + 1 + txRedeem.signatures.length * 64
  // console.log('serialized size', size)

  // return [txRedeem]

  return [new Transaction(txPre), new VersionedTransaction(txRedeem)]

  // try {
  //   await provider.simulate(transaction, [wallet.payer])

  //   const txID = await provider.sendAndConfirm(transaction, [wallet.payer])
  //   console.log({ txID })
  // } catch (e) {
  //   console.log({ simulationResponse: e.simulationResponse })
  // }
}

export async function createRedeemWrappedTransferWithPayloadIx(
  connection: Connection,
  programId: PublicKeyInitData,
  payer: PublicKeyInitData,
  tokenBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  wormholeMessage: SignedVaa | ParsedTokenTransferVaa,
  payloadParser: (parsed: ParsedTokenTransferVaa) => InterbeamMessage
): Promise<TransactionInstruction> {
  const program = createInterbeamProgramInterface(connection, programId)

  const parsed = isBytes(wormholeMessage) ? parseTokenTransferVaa(wormholeMessage) : wormholeMessage

  const wrappedMint = deriveWrappedMintKey(
    tokenBridgeProgramId,
    parsed.tokenChain,
    parsed.tokenAddress
  )

  const tmpTokenAccount = deriveTmpTokenAccountKey(programId, wrappedMint)
  const tokenBridgeAccounts = getCompleteTransferWrappedWithPayloadCpiAccounts(
    tokenBridgeProgramId,
    wormholeProgramId,
    payer,
    parsed,
    tmpTokenAccount
  )

  const parsedPayload = payloadParser(parsed)
  const recipient = new PublicKey(parsedPayload.recipient)
  const recipientTokenAccount = getAssociatedTokenAddressSync(wrappedMint, recipient) // USDCet

  // console.log('redeem wrapped transfer with payload')
  // console.log(
  //   '  tokenAddress',
  //   tryHexToNativeAssetString(parsed.tokenAddress.toString('hex'), CHAIN_ID_ETH)
  // )
  // console.log('  wrappedMint', wrappedMint.toBase58())
  // console.log('  payer', tokenBridgeAccounts.payer.toBase58())
  // console.log('  recipient', recipient.toBase58())
  // console.log('  recipientTokenAccount', recipientTokenAccount.toBase58())
  console.log('tokenBridgeAccounts', tokenBridgeAccounts)

  console.log('parsedPayload', parsedPayload)
  // console.log(parsedPayload.messageLength.toString())
  // console.log(parsedPayload.messageType.toString())
  // console.log(parsedPayload.chainId.toString())
  // console.log(parsedPayload.amountUSDC.toString('hex'))
  // console.log(parsedPayload.amountTokenA.toString('hex'))
  // console.log(parsedPayload.amountTokenB.toString('hex'))

  const redeemWrappedTransferWithPayloadIx = await program.methods
    .redeemWrappedTransferWithPayload({
      vaaHash: [...parsed.hash],
      jupiterSwapData: Buffer.alloc(0)
    })
    .accounts({
      config: deriveRedeemerConfigKey(programId),
      foreignContract: deriveForeignContractKey(programId, parsed.emitterChain as ChainId),
      tmpTokenAccount,
      recipientTokenAccount,
      recipient,
      payer: new PublicKey(payer),
      payerTokenAccount: getAssociatedTokenAddressSync(wrappedMint, new PublicKey(payer)),
      tokenBridgeProgram: new PublicKey(tokenBridgeProgramId),
      ...tokenBridgeAccounts
    })
    .instruction()

  return redeemWrappedTransferWithPayloadIx
}

// Temporary
export function getCompleteTransferWrappedWithPayloadCpiAccounts(
  tokenBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  payer: PublicKeyInitData,
  vaa: SignedVaa | ParsedTokenTransferVaa,
  toTokenAccount: PublicKeyInitData
): CompleteTransferWrappedWithPayloadCpiAccounts {
  const parsed = isBytes(vaa) ? parseTokenTransferVaa(vaa) : vaa
  const mint = deriveWrappedMintKey(tokenBridgeProgramId, parsed.tokenChain, parsed.tokenAddress)
  const cpiProgramId = new PublicKey(parsed.to)
  return {
    payer: new PublicKey(payer),
    tokenBridgeConfig: deriveTokenBridgeConfigKey(tokenBridgeProgramId),
    vaa: derivePostedVaaKey(wormholeProgramId, parsed.hash),
    tokenBridgeClaim: deriveClaimKey(
      tokenBridgeProgramId,
      parsed.emitterAddress,
      parsed.emitterChain,
      parsed.sequence
    ),
    tokenBridgeForeignEndpoint: deriveEndpointKey(
      tokenBridgeProgramId,
      parsed.emitterChain,
      parsed.emitterAddress
    ),
    toTokenAccount: new PublicKey(toTokenAccount),
    tokenBridgeRedeemer: deriveRedeemerAccountKey(cpiProgramId),
    toFeesTokenAccount: new PublicKey(toTokenAccount),
    tokenBridgeWrappedMint: mint,
    tokenBridgeWrappedMeta: deriveWrappedMetaKey(tokenBridgeProgramId, mint),
    tokenBridgeMintAuthority: deriveMintAuthorityKey(tokenBridgeProgramId),
    rent: SYSVAR_RENT_PUBKEY,
    systemProgram: SystemProgram.programId,
    tokenProgram: TOKEN_PROGRAM_ID,
    wormholeProgram: new PublicKey(wormholeProgramId)
  }
}
