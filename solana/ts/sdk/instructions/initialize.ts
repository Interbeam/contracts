import { Connection, PublicKey, PublicKeyInitData, TransactionInstruction } from '@solana/web3.js'
import { getTokenBridgeDerivedAccounts } from '@certusone/wormhole-sdk/lib/cjs/solana'

import { deriveSenderConfigKey, deriveRedeemerConfigKey } from '../accounts'
import { createInterbeamProgramInterface } from '../program'

export async function createInitializeInstruction(
  connection: Connection,
  programId: PublicKeyInitData,
  payer: PublicKeyInitData,
  tokenBridgeProgramId: PublicKeyInitData,
  wormholeProgramId: PublicKeyInitData,
  relayerFee: number,
  relayerFeePrecision: number
): Promise<TransactionInstruction> {
  const program = createInterbeamProgramInterface(connection, programId)
  const tokenBridgeAccounts = getTokenBridgeDerivedAccounts(
    program.programId,
    tokenBridgeProgramId,
    wormholeProgramId
  )
  return program.methods
    .initialize({ relayerFee, relayerFeePrecision })
    .accounts({
      owner: new PublicKey(payer),
      senderConfig: deriveSenderConfigKey(programId),
      redeemerConfig: deriveRedeemerConfigKey(programId),
      tokenBridgeProgram: new PublicKey(tokenBridgeProgramId),
      wormholeProgram: new PublicKey(wormholeProgramId),
      ...tokenBridgeAccounts
    })
    .instruction()
}
