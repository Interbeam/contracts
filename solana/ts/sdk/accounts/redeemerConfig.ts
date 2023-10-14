import { deriveAddress } from '@certusone/wormhole-sdk/lib/cjs/solana'
import { Connection, PublicKey, PublicKeyInitData } from '@solana/web3.js'

import { createInterbeamProgramInterface } from '../program'

export function deriveRedeemerConfigKey(programId: PublicKeyInitData) {
  return deriveAddress([Buffer.from('redeemer')], programId)
}

export interface InboundTokenBridgeAddresses {
  config: PublicKey
  custodySigner: PublicKey
  mintAuthority: PublicKey
}

export interface RedeemerConfigData {
  owner: PublicKey
  bump: number
  tokenBridge: InboundTokenBridgeAddresses
  relayerFee: number
  relayerFeePrecision: number
}

export async function getRedeemerConfigData(
  connection: Connection,
  programId: PublicKeyInitData
): Promise<RedeemerConfigData> {
  return createInterbeamProgramInterface(connection, programId).account.redeemerConfig.fetch(
    deriveRedeemerConfigKey(programId)
  ) as Promise<RedeemerConfigData>
}
