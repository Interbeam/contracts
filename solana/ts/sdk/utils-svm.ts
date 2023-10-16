import { ChainId, ParsedTokenTransferVaa } from '@certusone/wormhole-sdk'
import { AnchorProvider, BN } from '@coral-xyz/anchor'
import {
  AccountLayout,
  AuthorityType,
  Mint,
  NATIVE_MINT,
  TOKEN_PROGRAM_ID,
  createApproveInstruction,
  createAssociatedTokenAccountInstruction,
  createBurnInstruction,
  createInitializeAccount3Instruction,
  createInitializeMintInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  createTransferInstruction,
  getAccount,
  getAssociatedTokenAddressSync
} from '@solana/spl-token'
import {
  AddressLookupTableAccount,
  AddressLookupTableProgram,
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  MessageV0,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  sendAndConfirmTransaction
} from '@solana/web3.js'

import * as interbeam from './'
import {
  CORE_BRIDGE_PID,
  INTERBEAM_PID_LOCAL,
  TOKEN_BRIDGE_PID,
  WORMHOLE_CONTRACTS
} from '../tests/helpers'
import { InterbeamMessage, InterbeamMessageType } from './types'
import { SystemProgram, Transaction } from '@solana/web3.js'

const ETHEREUM_TOKEN_BRIDGE_ADDRESS = WORMHOLE_CONTRACTS.ethereum.token_bridge

export function initializeInterbeamBoilerplate(connection: Connection, payer: Keypair) {
  // Set a relayer fee of 0.1%
  // Note: This can be overwritten using update_relayer_fee instruction.
  const relayerFee = 100_000
  const relayerFeePrecision = 100_000_000

  const createInitializeInterbeamIx = (opts?: {
    relayerFee?: number
    relayerFeePrecision?: number
  }) =>
    interbeam.createInitializeInstruction(
      connection,
      INTERBEAM_PID_LOCAL,
      payer.publicKey,
      TOKEN_BRIDGE_PID,
      CORE_BRIDGE_PID,
      opts?.relayerFee ?? relayerFee,
      opts?.relayerFeePrecision ?? relayerFeePrecision
    )

  const getTokenBalance = async (tokenAccount: PublicKey) =>
    (await getAccount(connection, tokenAccount)).amount

  return {
    connection,
    payer,
    relayerFee,
    relayerFeePrecision,
    createInitializeInterbeamIx,
    getTokenBalance
  }
}

export function createRegisterForeignContractIx(opts: {
  connection: Connection
  sender: PublicKey | Keypair
  contractAddress: Buffer
  foreignChain: ChainId
}) {
  return interbeam.createRegisterForeignContractInstruction(
    opts.connection,
    INTERBEAM_PID_LOCAL,
    opts.sender instanceof Keypair ? opts.sender.publicKey : opts.sender,
    TOKEN_BRIDGE_PID,
    opts.foreignChain,
    opts.contractAddress,
    ETHEREUM_TOKEN_BRIDGE_ADDRESS
  )
}

// export function createRedeemNativeTransferWithPayloadIx(opts: {
//   sender: PublicKey
//   signedMsg: Buffer
//   connection: Connection
//   payloadParser: (parsed: ParsedTokenTransferVaa) => InterbeamMessage
// }) {
//   return interbeam.createRedeemNativeTransferWithPayloadInstruction(
//     opts.connection,
//     INTERBEAM_PID_LOCAL,
//     opts.sender,
//     TOKEN_BRIDGE_PID,
//     CORE_BRIDGE_PID,
//     opts.signedMsg,
//     opts.payloadParser
//   )
// }

export function createRedeemWrappedTransferWithPayloadTx(opts: {
  sender: PublicKey
  signedMsg: Buffer
  connection: Connection
  payloadParser: (parsed: ParsedTokenTransferVaa) => InterbeamMessage
}) {
  return interbeam.createRedeemWrappedTransferWithPayloadTx(
    opts.connection,
    INTERBEAM_PID_LOCAL,
    opts.sender,
    TOKEN_BRIDGE_PID,
    CORE_BRIDGE_PID,
    opts.signedMsg,
    opts.payloadParser
  )
}

// export const getWormholeSequence = async () =>
//   (await wormhole.getProgramSequenceTracker(connection, TOKEN_BRIDGE_PID, CORE_BRIDGE_PID)).value() + 1n

// export const verifyWormholeMessage = async (sequence: bigint) => {
//   const payload = parseTokenTransferPayload(
//     (
//       await wormhole.getPostedMessage(
//         connection,
//         interbeam.deriveTokenTransferMessageKey(INTERBEAM_PID_LOCAL, sequence)
//       )
//     ).message.payload
//   ).tokenTransferPayload
// }

export function decodeTransferMessagePayload(payload: Buffer): InterbeamMessage {
  // NOTE: EVM uses big endian
  let index = 0

  const messageLength = payload.readUint16BE(index)
  index += 2

  const chainId = payload.readUint16BE(index)
  index += 2

  const messageType = payload.readUint8(index) as InterbeamMessageType
  index += 1

  // EVM address in Wormhole format
  const tokenA = payload.subarray(index, index + 32)
  index += 32

  // EVM address in Wormhole format
  const tokenB = payload.subarray(index, index + 32)
  index += 32

  const amountTokenA = payload.subarray(index, index + 32)
  index += 32

  const amountTokenB = payload.subarray(index, index + 32)
  index += 32

  const amountUSDC = payload.subarray(index, index + 32)
  index += 32

  // EVM address in Wormhole format
  const sender = payload.subarray(index, index + 32)
  index += 32

  // SVM address in Wormhole format
  const recipient = payload.subarray(index, index + 32)
  index += 32

  const payloadSize = payload.readUint16BE(index)
  index += 2

  const payloadData = payload.subarray(index, index + payloadSize)
  index += payloadSize

  // console.log('decoded recipient', new PublicKey(recipient).toBase58())

  return {
    messageLength,
    chainId,
    messageType,
    tokenA,
    tokenB,
    amountTokenA,
    amountTokenB,
    amountUSDC,
    sender,
    recipient,
    payloadSize,
    payloadData
  }
}

export async function createAddressLookupTableIx(connection: Connection, payer: Keypair) {
  const [lookupTableIx, lookupTableAddress] = AddressLookupTableProgram.createLookupTable({
    authority: payer.publicKey,
    payer: payer.publicKey,
    recentSlot: await connection.getSlot()
  })
  return [lookupTableIx, lookupTableAddress] as [TransactionInstruction, PublicKey]
}

export async function extendAddressLookupTableIx(
  payer: Keypair,
  lookupTableAddress: PublicKey,
  addressList: PublicKey[]
) {
  return AddressLookupTableProgram.extendLookupTable({
    addresses: addressList,
    authority: payer.publicKey,
    lookupTable: lookupTableAddress,
    payer: payer.publicKey
  })
}

// ALT = Address Lookup Table
export async function createAddressLookupTable(
  connection: Connection,
  payer: Keypair,
  addressList: PublicKey[]
) {
  const [createTableIx, lookupTableAddress] = await createAddressLookupTableIx(connection, payer)
  const extendTableIx = await extendAddressLookupTableIx(payer, lookupTableAddress, addressList)

  console.log(createTableIx)
  console.log('>>', lookupTableAddress.toBase58())

  // const message = new TransactionMessage({
  //   instructions: [lookupTableIx, extendTableIx],
  //   payerKey: payer.publicKey,
  //   recentBlockhash: (await connection.getLatestBlockhash()).blockhash
  // }).compileToV0Message()

  // const tx = new VersionedTransaction(message)
  // tx.sign([payer])

  // await connection.sendTransaction(tx)

  const tx = new Transaction()
  tx.add(createTableIx)

  await sendAndConfirmTransaction(connection, tx, [payer], {
    commitment: 'finalized'
  })
  console.log('ALT created')

  // .add(extendTableIx)

  return lookupTableAddress
}

// export async function sendTxALT(
//   connection: Connection,
//   payer: Keypair,
//   ixs: TransactionInstruction[],
//   lookupTable?: AddressLookupTableAccount
// ) {
//   let message: MessageV0

//   if (lookupTable) {
//     message = new TransactionMessage({
//       instructions: ixs,
//       payerKey: payer.publicKey,
//       recentBlockhash: (await connection.getLatestBlockhash()).blockhash
//     }).compileToV0Message([lookupTable])
//   } else {
//     message = new TransactionMessage({
//       instructions: ixs,
//       payerKey: payer.publicKey,
//       recentBlockhash: (await connection.getLatestBlockhash()).blockhash
//     }).compileToV0Message()
//   }

//   const tx = new VersionedTransaction(message)
//   tx.sign([payer])

//   return await connection.sendTransaction(tx)
// }

export async function createMint(
  provider: AnchorProvider,
  authority?: PublicKey
): Promise<PublicKey> {
  if (authority === undefined) {
    authority = provider.wallet.publicKey
  }
  const mint = Keypair.generate()
  const instructions = await createMintInstructions(provider, authority, mint.publicKey)

  const tx = new Transaction()
  tx.add(...instructions)

  await provider.sendAndConfirm(tx, [mint], { commitment: 'confirmed' })

  return mint.publicKey
}

export async function createMintInstructions(
  provider: AnchorProvider,
  authority: PublicKey,
  mint: PublicKey
) {
  let instructions = [
    SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey: mint,
      space: 82,
      lamports: await provider.connection.getMinimumBalanceForRentExemption(82),
      programId: TOKEN_PROGRAM_ID
    }),
    createInitializeMintInstruction(mint, 0, authority, null)
  ]
  return instructions
}

export async function createTokenAccount(
  provider: AnchorProvider,
  mint: PublicKey,
  owner: PublicKey
) {
  const tokenAccount = Keypair.generate()
  const tx = new Transaction()
  tx.add(...(await createTokenAccountInstrs(provider, tokenAccount.publicKey, mint, owner)))
  await provider.sendAndConfirm(tx, [tokenAccount], { commitment: 'confirmed' })
  return tokenAccount.publicKey
}

export async function createAssociatedTokenAccount(
  provider: AnchorProvider,
  mint: PublicKey,
  owner: PublicKey,
  payer: PublicKey,
  allowOwnerOffCurve: boolean = true
) {
  const ataAddress = getAssociatedTokenAddressSync(mint, owner, allowOwnerOffCurve)
  const instr = createAssociatedTokenAccountInstruction(payer, ataAddress, owner, mint)
  const tx = new Transaction()
  tx.add(instr)
  await provider.sendAndConfirm(tx, [], { commitment: 'confirmed' })
  return ataAddress
}

async function createTokenAccountInstrs(
  provider: AnchorProvider,
  newAccountPubkey: PublicKey,
  mint: PublicKey,
  owner: PublicKey,
  lamports?: number
) {
  if (lamports === undefined) {
    lamports = await provider.connection.getMinimumBalanceForRentExemption(165)
  }
  return [
    SystemProgram.createAccount({
      fromPubkey: provider.wallet.publicKey,
      newAccountPubkey,
      space: 165,
      lamports,
      programId: TOKEN_PROGRAM_ID
    }),
    createInitializeAccount3Instruction(newAccountPubkey, mint, owner)
  ]
}

/**
 * Mints tokens to the specified destination token account.
 * @param provider An anchor AnchorProvider object used to send transactions
 * @param mint Mint address of the token
 * @param destination Destination token account to receive tokens
 * @param amount Number of tokens to mint
 */
export async function mintToDestination(
  provider: AnchorProvider,
  mint: PublicKey,
  destination: PublicKey,
  amount: number | BN
): Promise<string> {
  const tx = new Transaction()
  const amountVal = amount instanceof BN ? BigInt(amount.toString()) : amount
  tx.add(createMintToInstruction(mint, destination, provider.wallet.publicKey, amountVal))
  return provider.sendAndConfirm(tx, [], { commitment: 'confirmed' })
}

/**
 * Creates a token account for the mint and mints the specified amount of tokens into the token account.
 * The caller is assumed to be the mint authority.
 * @param provider An anchor AnchorProvider object used to send transactions
 * @param mint The mint address of the token
 * @param amount Number of tokens to mint to the newly created token account
 */
export async function createAndMintToTokenAccount(
  provider: AnchorProvider,
  mint: PublicKey,
  amount: number | BN
): Promise<PublicKey> {
  const tokenAccount = await createTokenAccount(provider, mint, provider.wallet.publicKey)
  await mintToDestination(provider, mint, tokenAccount, new BN(amount.toString()))
  return tokenAccount
}

/**
 * Get or Create an associated token account for the specified token mint and owner.
 * Then, mint the specified amount of token into the created or retrieved associated token account.
 *
 * @param provider
 * @param mint
 * @param amount Amount to mint without decimals multipled. For example, 100 to mint 100 SOL.
 * @param destinationWallet Receiver of the tokens. Defaults to the provider's wallet.
 * @param payer Pays for transactions and rent. Defaults to the provider's wallet.
 * @returns
 */
export async function createAndMintToAssociatedTokenAccount(
  provider: AnchorProvider,
  mint: Mint,
  amount: number | BN,
  destinationWallet?: PublicKey,
  payer?: PublicKey
): Promise<PublicKey> {
  const destinationWalletKey = destinationWallet ? destinationWallet : provider.wallet.publicKey
  const payerKey = payer ? payer : provider.wallet.publicKey
  const amountWithDecimals = new BN(amount).mul(new BN(10 ** mint.decimals))

  // Workaround For SOL - just create a wSOL account to satisfy the rest of the test building pipeline.
  // Tests who want to test with SOL will have to request their own airdrop.
  if (mint.address === NATIVE_MINT) {
    //   const rentExemption = await provider.connection.getMinimumBalanceForRentExemption(
    //     AccountLayout.span,
    //     'confirmed'
    //   )
    //   const txBuilder = new TransactionBuilder(provider.connection, provider.wallet)
    //   const { address: tokenAccount, ...ix } = TokenUtil.createWrappedNativeAccountInstruction(
    //     destinationWalletKey,
    //     amountWithDecimals,
    //     rentExemption
    //   )
    //   txBuilder.addInstruction({ ...ix, cleanupInstructions: [] })

    //   try {
    //     await txBuilder.buildAndExecute()
    //   } catch (err) {
    //     // ignore error as the error is likely that the account already exists
    //   }

    //   return tokenAccount

    throw new Error('createAndMintToAssociatedTokenAccount does not support SOL yet.')
  }

  const tokenAccounts = await provider.connection.getParsedTokenAccountsByOwner(
    destinationWalletKey,
    {
      programId: TOKEN_PROGRAM_ID
    }
  )

  let tokenAccount = tokenAccounts.value
    .map((account) => {
      if (account.account.data.parsed.info.mint === mint.address.toString()) {
        return account.pubkey
      }
    })
    .filter(Boolean)[0]

  if (!tokenAccount) {
    tokenAccount = await createAssociatedTokenAccount(
      provider,
      mint.address,
      destinationWalletKey,
      payerKey
    )
  }

  await mintToDestination(provider, mint.address, tokenAccount!, amountWithDecimals)
  return tokenAccount!
}

export async function getTokenBalance(provider: AnchorProvider, vault: PublicKey) {
  return (await provider.connection.getTokenAccountBalance(vault, 'confirmed')).value.amount
}

export async function approveToken(
  provider: AnchorProvider,
  tokenAccount: PublicKey,
  delegate: PublicKey,
  amount: number | BN,
  owner?: Keypair
) {
  const tx = new Transaction()
  const amountVal = amount instanceof BN ? BigInt(amount.toString()) : amount
  tx.add(
    createApproveInstruction(
      tokenAccount,
      delegate,
      owner?.publicKey || provider.wallet.publicKey,
      amountVal
    )
  )
  return provider.sendAndConfirm(tx, !!owner ? [owner] : [], {
    commitment: 'confirmed'
  })
}

export async function setAuthority(
  provider: AnchorProvider,
  tokenAccount: PublicKey,
  newAuthority: PublicKey,
  authorityType: AuthorityType,
  authority: Keypair
) {
  const tx = new Transaction()
  tx.add(
    createSetAuthorityInstruction(tokenAccount, authority.publicKey, authorityType, newAuthority)
  )

  return provider.sendAndConfirm(tx, [authority], { commitment: 'confirmed' })
}

export async function transferToken(
  provider: AnchorProvider,
  source: PublicKey,
  destination: PublicKey,
  amount: number
) {
  const tx = new Transaction()
  tx.add(createTransferInstruction(source, destination, provider.wallet.publicKey, amount))
  return provider.sendAndConfirm(tx, [], { commitment: 'confirmed' })
}

export async function burnToken(
  provider: AnchorProvider,
  account: PublicKey,
  mint: PublicKey,
  amount: number | BN,
  owner?: PublicKey
) {
  const ownerKey = owner ?? provider.wallet.publicKey
  const tx = new Transaction()
  const amountVal = amount instanceof BN ? BigInt(amount.toString()) : amount
  tx.add(createBurnInstruction(account, mint, ownerKey, amountVal))
  return provider.sendAndConfirm(tx, [], { commitment: 'confirmed' })
}

export async function createAndMintToManyATAs(
  provider: AnchorProvider,
  mints: Mint[],
  amount: number | BN,
  funder?: PublicKey
): Promise<PublicKey[]> {
  return Promise.all(
    mints.map((mint) =>
      createAndMintToAssociatedTokenAccount(provider, mint, amount, funder, funder)
    )
  )
}

type RequestAirdropOpts = {
  amount?: number // in SOL
  receiver?: PublicKey
}

export async function requestAirdrop(
  provider: AnchorProvider,
  opts?: RequestAirdropOpts
): Promise<void> {
  const numSol = opts?.amount || 1_000
  const receiver = opts?.receiver || provider.wallet.publicKey

  const signature = await provider.connection.requestAirdrop(receiver, numSol * LAMPORTS_PER_SOL)
  const latestBlockhash = await provider.connection.getLatestBlockhash()
  await provider.connection.confirmTransaction({
    signature,
    ...latestBlockhash
  })
}
