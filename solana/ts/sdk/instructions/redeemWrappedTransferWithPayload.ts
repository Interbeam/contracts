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
  Connection,
  PublicKey,
  PublicKeyInitData,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction
} from '@solana/web3.js'

import {
  deriveForeignContractKey,
  deriveTmpTokenAccountKey,
  deriveRedeemerConfigKey
} from '../accounts'
import { createInterbeamProgramInterface } from '../program'
import { InterbeamMessage } from '../types'

export async function createRedeemWrappedTransferWithPayloadInstruction(
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

  // console.log(`parsed.tokenTransferPayload length: ${parsed.tokenTransferPayload.length}`)

  const parsedPayload = payloadParser(parsed)
  
  const recipient = new PublicKey(parsedPayload.recipient)

  const recipientTokenAccount = getAssociatedTokenAddressSync(wrappedMint, recipient)

  console.log('redeem wrapped transfer with payload')
  console.log(
    '  tokenAddress',
    tryHexToNativeAssetString(parsed.tokenAddress.toString('hex'), CHAIN_ID_ETH)
  )
  console.log('  wrappedMint', wrappedMint.toBase58())
  console.log('  payer', tokenBridgeAccounts.payer.toBase58())
  console.log('  recipient', recipient.toBase58())
  console.log('  recipientTokenAccount', recipientTokenAccount.toBase58())

  return program.methods
    .redeemWrappedTransferWithPayload({ vaaHash: [...parsed.hash] })
    .accounts({
      config: deriveRedeemerConfigKey(programId),
      foreignContract: deriveForeignContractKey(programId, parsed.emitterChain as ChainId),
      tmpTokenAccount,
      recipientTokenAccount,
      recipient,
      payerTokenAccount: getAssociatedTokenAddressSync(wrappedMint, new PublicKey(payer)),
      tokenBridgeProgram: new PublicKey(tokenBridgeProgramId),
      ...tokenBridgeAccounts
    })
    .instruction()
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
