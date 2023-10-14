import { deriveAddress } from '@certusone/wormhole-sdk/lib/cjs/solana'
import { Connection, PublicKey, PublicKeyInitData } from '@solana/web3.js'

import { createInterbeamProgramInterface } from '../program'

export function deriveSenderConfigKey(programId: PublicKeyInitData) {
  return deriveAddress([Buffer.from('sender')], programId)
}

export interface OutboundTokenBridgeAddresses {
  config: PublicKey
  authoritySigner: PublicKey
  custodySigner: PublicKey
  emitter: PublicKey
  sequence: PublicKey
  wormholeBridge: PublicKey
  wormholeFeeCollector: PublicKey
}

export interface SenderConfigData {
  owner: PublicKey
  bump: number
  tokenBridge: OutboundTokenBridgeAddresses
  finality: number
  relayerFee: number
}

export async function getSenderConfigData(
  connection: Connection,
  programId: PublicKeyInitData
): Promise<SenderConfigData> {
  return createInterbeamProgramInterface(connection, programId).account.senderConfig.fetch(
    deriveSenderConfigKey(programId)
  ) as Promise<SenderConfigData>
}
