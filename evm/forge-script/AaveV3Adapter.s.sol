// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

import "forge-std/Script.sol";

import {AaveV3Adapter} from "../contracts/AaveV3Adapter.sol";
import {Interbeam} from "../contracts/Interbeam.sol";
import {UniSwapper} from "../contracts/UniSwapper.sol";
import {IPool} from "../contracts/interfaces/aave/IPool.sol";
import {IPoolAddressesProvider} from "../contracts/interfaces/aave/IPoolAddressesProvider.sol";

import {ScriptHelper} from "./ScriptHelper.sol";

contract DeployAaveV3Adapter is ScriptHelper {
    IPool private aavePool;
    AaveV3Adapter private aaveAdapter;

    UniSwapper private uniSwapper;
    Interbeam private interbeam;

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

        if (block.chainid == 137) {
            uniSwapper = UniSwapper(address(0x34A7046F1F750812d6fE2efcf1606fa196e797a3));
            interbeam = Interbeam(address(0x4C636eFcA2Bf1F94096d0D3f89854231563f8F39));
        } else if (block.chainid == 42161) {
            uniSwapper = UniSwapper(address(0x34A7046F1F750812d6fE2efcf1606fa196e797a3));
            interbeam = Interbeam(address(0x9e0e006f30519E30eBbc3bE81e8C81c7FEcA3aa3));
        } else {
            revert("Interbeam: chain not supported yet");
        }

        vm.startBroadcast();

        aavePool = IPool(IPoolAddressesProvider(poolAddressProvider).getPool());
        aaveAdapter = new AaveV3Adapter(
            poolAddressProvider,
            address(uniSwapper),
            address(interbeam),
            nativeToken,
            usdc
        );

        interbeam.registerAdapter(address(aaveAdapter));

        // interbeam.setTargetSolanaAddress(SOLANA_INTERBEAM_ADDRESS);

        vm.stopBroadcast();
    }
}
