// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

import "forge-std/Script.sol";

import {Interbeam} from "../contracts/Interbeam.sol";
import {UniSwapper} from "../contracts/UniSwapper.sol";

import {ScriptHelper} from "./ScriptHelper.sol";

contract DeployInterbeam is ScriptHelper {
    // Swap out to diff address on non-testing deployments
    // => 0x + INTERBEAM_PID_LOCAL.toBuffer().toString('hex')
    // beamSCX2hEqX9quugQLmze1oZfejyAkA8CfKb9rTkb6
    bytes32 public constant SOLANA_INTERBEAM_ADDRESS =
        bytes32(0x08e03de72a2e5f78a8d2291698445c3baf15fa2e5e4f3f6abae0bedc9df0db65);

    function setUp() public {}

    function run() public {
        (
            address uniV3Router,
            address coreBridgeAddress,
            address tokenBridgeAddress,
            address poolAddressProvider,
            address nativeToken,
            address usdc,
            uint16 wormholeChainId
        ) = getInitData();

        vm.startBroadcast();

        Interbeam interbeam = new Interbeam(
            coreBridgeAddress,
            tokenBridgeAddress,
            usdc,
            wormholeChainId // ethereum wormhole chain ID
        );

        interbeam.setTargetSolanaAddress(SOLANA_INTERBEAM_ADDRESS);

        vm.stopBroadcast();
    }
}
