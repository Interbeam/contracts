import { Program, Provider } from '@coral-xyz/anchor'
import { Connection, PublicKeyInitData, PublicKey } from '@solana/web3.js'

import InterbeamIDL from '../../target/idl/interbeam.json'
import { Interbeam } from '../../target/types/interbeam'

export function createInterbeamProgramInterface(
  connection: Connection,
  programId: PublicKeyInitData,
  payer?: PublicKeyInitData
): Program<Interbeam> {
  const provider: Provider = {
    connection,
    publicKey: payer == undefined ? undefined : new PublicKey(payer)
  }
  return new Program<Interbeam>(InterbeamIDL as any, new PublicKey(programId), provider)
}
