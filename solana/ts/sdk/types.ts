// NOTE: Enum values must match the ones in the SVM & EVM contracts
export enum InterbeamMessageType {
  SOLEND,
  MARGINFI,
  ORCA,
  ORCA_WHIRLPOOL,
  RAYDIUM,
  JITO
}

export type InterbeamMessage = {
  messageLength: number
  chainId: number
  messageType: InterbeamMessageType
  tokenA: Buffer
  tokenB: Buffer
  amountTokenA: Buffer
  amountTokenB: Buffer
  amountUSDC: Buffer
  sender: Buffer
  recipient: Buffer
  payloadSize: number
  payloadData: Buffer
}