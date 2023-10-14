import { ChainId, ParsedTokenTransferVaa } from '@certusone/wormhole-sdk'
import { getAccount } from '@solana/spl-token'
import { Connection, Keypair, PublicKey } from '@solana/web3.js'

import * as interbeam from '.'
import {
  CORE_BRIDGE_PID,
  INTERBEAM_PID_LOCAL,
  TOKEN_BRIDGE_PID,
  WORMHOLE_CONTRACTS
} from '../tests/helpers'
import { InterbeamMessage, InterbeamMessageType } from './types'

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

export function createRedeemTransferWithPayloadIx(opts: {
  sender: PublicKey
  signedMsg: Buffer
  connection: Connection
  payloadParser: (parsed: ParsedTokenTransferVaa) => InterbeamMessage
  isNative?: boolean
}) {
  return (
    opts.isNative
      ? interbeam.createRedeemNativeTransferWithPayloadInstruction
      : interbeam.createRedeemWrappedTransferWithPayloadInstruction
  )(
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
