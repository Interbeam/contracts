// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

import "forge-std/Script.sol";

import {AaveV3Adapter} from "../contracts/AaveV3Adapter.sol";
import {Interbeam} from "../contracts/Interbeam.sol";
import {UniSwapper} from "../contracts/UniSwapper.sol";
import {IPool} from "../contracts/interfaces/aave/IPool.sol";
import {IPoolAddressesProvider} from "../contracts/interfaces/aave/IPoolAddressesProvider.sol";

contract DeployAaveV3Adapter is Script {
    IPool private aavePool;
    AaveV3Adapter private aaveAdapter;

    UniSwapper private uniSwapper;
    Interbeam private interbeam;

    // Swap out to diff address on non-testing deployments
    // => 0x + INTERBEAM_PID_LOCAL.toBuffer().toString('hex')
    bytes32 public constant SOLANA_INTERBEAM_ADDRESS =
        bytes32(0x08e03ddd98360471381c64f67f899b9d08670f784a908a7b46abf90000000000);

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
        ) = getAddresses();

        // uniSwapper = new UniSwapper(uniV3Router);
        // interbeam = new Interbeam(
        //     coreBridgeAddress,
        //     tokenBridgeAddress,
        //     usdc,
        //     wormholeChainId // ethereum wormhole chain ID
        // );
        uniSwapper = UniSwapper(address(0x34A7046F1F750812d6fE2efcf1606fa196e797a3));
        interbeam = Interbeam(address(0x4C636eFcA2Bf1F94096d0D3f89854231563f8F39));

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

    function getAddresses()
        public
        view
        returns (
            address uniV3Router,
            address coreBridgeAddress,
            address tokenBridgeAddress,
            address poolAddressProvider,
            address nativeToken, // wrapped, e.g. WETH, WAVAX
            address usdc,
            uint16 wormholeChainId
        )
    {
        if (block.chainid == 1) {
            // Ethereum
            uniV3Router = address(0xE592427A0AEce92De3Edee1F18E0157C05861564);
            coreBridgeAddress = address(0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B);
            tokenBridgeAddress = address(0x3ee18B2214AFF97000D974cf647E7C347E8fa585);
            poolAddressProvider = address(0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e);
            nativeToken = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
            usdc = address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
            wormholeChainId = 2;
        } else if (block.chainid == 42161) {
            uniV3Router = address(0xE592427A0AEce92De3Edee1F18E0157C05861564);
            coreBridgeAddress = address(0xa5f208e072434bC67592E4C49C1B991BA79BCA46);
            tokenBridgeAddress = address(0x0b2402144Bb366A632D14B83F244D2e0e21bD39c);
            poolAddressProvider = address(0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb);
            nativeToken = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
            usdc = address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
            wormholeChainId = 23;
        } else {
            revert("UniswapLpScript: chain not supported");
        }
    }
}
