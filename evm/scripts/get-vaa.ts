import {
  getEmitterAddressEth,
  parseSequenceFromLogEth,
} from "@certusone/wormhole-sdk";
import * as dotenv from "dotenv";
import { ethers } from "ethers";

dotenv.config();

async function main() {
  const wormholeAddress = "0x0CBE91CF822c73C2315FB05100C2F714765d5c20";
  const contractAddress = "0xcf56a574fadb1f4a0d8c205942b2304f06ff142b";
  const txHash =
    "0xecb22a9e601ac9980ced0697608a725737cedd320c2a48291f3138eebc01f21c";

  const provider = new ethers.providers.JsonRpcProvider(
    process.env.MUMBAI_RPC_URL
  );
  const whChainId = 5; // Mumbai

  const txReceipt = await provider.getTransactionReceipt(txHash);

  const emitterAddr = getEmitterAddressEth(contractAddress);
  const seq = parseSequenceFromLogEth(txReceipt, wormholeAddress);

  const url = `https://wormhole-v2-testnet-api.certus.one/v1/signed_vaa/${whChainId}/${emitterAddr}/${seq}`;
  console.log("Searching for: \n", url);

  try {
    const res = await fetch(url);
    const { vaaBytes } = (await res.json()) as { vaaBytes: string };
    const vaaHex = ethers.utils.hexlify(Buffer.from(vaaBytes, "base64"));

    console.log("vaaBytes", vaaBytes);
    console.log("\n");
    console.log("vaaHex", vaaHex);
  } catch (e) {
    console.error(e);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
