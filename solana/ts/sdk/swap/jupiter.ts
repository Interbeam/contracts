import { PublicKey, Connection, AccountMeta, VersionedTransaction } from '@solana/web3.js'
import * as gaxios from 'gaxios'

import { SVM_USDC, SVM_USDC_WORMHOLE_FROM_ETH } from '../consts-svm'
import {
  getAddressLookupTableAccounts,
  instructionDataToTransactionInstruction
} from './jup-helpers'

const JUPAG_API_ENDPOINT = 'https://quote-api.jup.ag/v6'

export async function getQuote(fromMint: PublicKey, toMint: PublicKey, amount: number) {
  const url = `${JUPAG_API_ENDPOINT}/quote?outputMint=${toMint.toBase58()}&inputMint=${fromMint.toBase58()}&amount=${amount}&slippage=0.5&onlyDirectRoutes=true`
  console.log('Get Quote URL', url)

  return gaxios
    .request({
      baseURL: JUPAG_API_ENDPOINT,
      url: '/quote',
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      params: {
        outputMint: toMint.toBase58(),
        inputMint: fromMint.toBase58(),
        amount,
        slippageBps: 50,
        onlyDirectRoutes: true
      }
    })
    .then((response) => {
      // console.log('quote', response.data)
      return response.data
    })
}

export async function getSwapTx(sender: PublicKey, recipientTokenAccount: PublicKey, quote: any) {
  const data = {
    quoteResponse: quote,
    userPublicKey: sender.toBase58(),
    recipientTokenAccount: recipientTokenAccount.toBase58()
  }

  return gaxios
    .request<{
      swapTransaction: string // returns base64 encoded transaction
      lastValidBlockHeight: number
    }>({
      baseURL: JUPAG_API_ENDPOINT,
      url: '/swap',
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      data: JSON.stringify(data)
    })
    .then((response) => {
      // console.dir(response, { depth: null })
      const swapTransactionBuf = Buffer.from(response.data.swapTransaction, 'base64')
      return VersionedTransaction.deserialize(swapTransactionBuf)
    })
}

export async function getSwapIx(user: PublicKey, destinationTokenAccount: PublicKey, quote: any) {
  const data = {
    quoteResponse: quote,
    userPublicKey: user.toBase58(),
    destinationTokenAccount: destinationTokenAccount.toBase58()
  }

  return gaxios
    .request<{
      computeBudgetInstructions: any[]
      setupInstructions: any[]
      swapInstruction: any
      addressLookupTableAddresses: string[]
    }>({
      baseURL: JUPAG_API_ENDPOINT,
      url: '/swap-instructions',
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      data: JSON.stringify(data)
    })
    .then((response) => {
      // console.log('swap-instructions', response.data)
      return response.data
    })
}

export async function getSwapDataForUSDCet2USDC(opts: {
  connection: Connection
  tmpTokenAccountUSDCet: PublicKey // temp USDCet token account (for bridge redemption)
  programTokenAccountUSDC: PublicKey // program USDC token account
  amount: number
}) {
  const { connection, tmpTokenAccountUSDCet, programTokenAccountUSDC, amount } = opts

  // Find the best Quote from the Jupiter API
  const quote = await getQuote(SVM_USDC_WORMHOLE_FROM_ETH, SVM_USDC, amount)
  // console.log({ quote })

  // Convert the Quote into a Swap instruction
  // const result = await getSwapIx(tmpTokenAccountUSDCet, programTokenAccountUSDC, quote)
  const result = await getSwapIx(
    new PublicKey('E6WwzparLRr5UGqydNPyUxT2HVfKiQgJdvFNib1Gg51E'),
    programTokenAccountUSDC,
    quote
  )

  // console log the full object with colors
  console.dir({ result }, { depth: null, colors: true, maxArrayLength: null, compact: false })

  if ('error' in result) {
    console.log({ result })
    throw new Error('Failed to get swap instruction')
  }

  // We have now both the instruction and the lookup table addresses.
  const {
    computeBudgetInstructions: computeBudgetPayloads, // The necessary instructions to setup the compute budget.
    swapInstruction: swapPayload, // The actual swap instruction.
    setupInstructions: setupPayload,
    addressLookupTableAddresses // The lookup table addresses that you can use if you are using versioned transaction.
  } = result

  const addressLookupTableAccounts = await getAddressLookupTableAccounts(
    connection,
    addressLookupTableAddresses
  )

  const computeBudgetIxs = computeBudgetPayloads.map(instructionDataToTransactionInstruction)
  const swapIx = instructionDataToTransactionInstruction(swapPayload)
  const setupIxs = setupPayload.map(instructionDataToTransactionInstruction)

  const swapAccounts: AccountMeta[] = []
  if (swapIx) {
    // jupiter program ID
    swapAccounts.push({
      isSigner: false,
      isWritable: false,
      pubkey: swapIx.programId
    })

    // jupiter remaining accounts
    swapAccounts.push(...swapIx.keys)
  }

  return {
    computeBudgetIxs,
    setupIxs,
    swapIx,
    swapData: swapIx.data,
    swapAccounts,
    addressLookupTableAccounts
  }
}
