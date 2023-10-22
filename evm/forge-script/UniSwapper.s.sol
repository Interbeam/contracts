// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

import "forge-std/Script.sol";

import {UniSwapper} from "../contracts/UniSwapper.sol";

import {ScriptHelper} from "./ScriptHelper.sol";

contract DeployUniSwapper is ScriptHelper {
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

        UniSwapper uniSwapper = new UniSwapper(uniV3Router);

        vm.stopBroadcast();
    }
}
