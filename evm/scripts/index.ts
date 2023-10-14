import * as dotenv from 'dotenv'
import { ethers } from 'ethers'

import UniswaLpAbi from '../abi/UniswapLp.json'
import { TransactionResponse } from '@ethersproject/abstract-provider'

dotenv.config()

async function main() {
	const provider = new ethers.providers.JsonRpcProvider(process.env.MUMBAI_RPC_URL)

	const wallet = new ethers.Wallet(process.env.EVM_PRIVATE_KEY as string, provider)

	const contractAddress = '0xcf56a574fadb1f4a0d8c205942b2304f06ff142b'

	const contract = new ethers.Contract(contractAddress, UniswaLpAbi, wallet)

	console.log('Wormhole Bridge', await contract.wormhole())
	console.log('NFT Position Manager', await contract.NF_POSITION_MANAGER())

	const tx: TransactionResponse = await contract.lockAndSendRaw(
		0,
		'0x000000000000000000000000000000000000beef',
		'0x000000000000000000000000000000deadbeef0a',
		'0x000000000000000000000000000000deadbeef0b',
		0,
		-100,
		-200,
		10000,
		128,
		256,
		100,
		200,
		{
			gasLimit: 1_000_000,
		}
	)

	const receipt = await tx.wait()

	console.log(receipt)
}

main().catch((error) => {
	console.error(error)
	process.exit(1)
})