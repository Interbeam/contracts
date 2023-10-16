// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

import "forge-std/Test.sol";
import "forge-std/console2.sol";

import {BaseSetup} from "./utils/BaseSetup.sol";

import {AaveV3Adapter} from "../contracts/AaveV3Adapter.sol";
import {Interbeam} from "../contracts/Interbeam.sol";
import {UniSwapper} from "../contracts/UniSwapper.sol";
import {IPool} from "../contracts/interfaces/aave/IPool.sol";
import {IPoolAddressesProvider} from "../contracts/interfaces/aave/IPoolAddressesProvider.sol";
import {VaaKey} from "../contracts/interfaces/wormhole/IWormholeRelayer.sol";
import "../contracts/wormhole/WormholeUtils.sol";

contract AaveV3AdapterTest is BaseSetup {
    IPool private aavePool;
    AaveV3Adapter private aaveAdapter;

    UniSwapper private uniSwapper;
    Interbeam private interbeam;

    function setUp() public virtual override {
        BaseSetup.setUp();

        address uniV3Router = address(0xE592427A0AEce92De3Edee1F18E0157C05861564);
        address coreBridgeAddress = address(0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B);
        address tokenBridgeAddress = address(0x3ee18B2214AFF97000D974cf647E7C347E8fa585);
        address poolAddressProvider = address(0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e);

        uniSwapper = new UniSwapper(uniV3Router);

        interbeam = new Interbeam(
            coreBridgeAddress,
            tokenBridgeAddress,
            address(USDC),
            2 // ethereum wormhole chain ID
        );

        aavePool = IPool(IPoolAddressesProvider(poolAddressProvider).getPool());
        aaveAdapter = new AaveV3Adapter(
            poolAddressProvider,
            address(uniSwapper),
            address(interbeam),
            address(WETH),
            address(USDC)
        );

        interbeam.registerAdapter(address(aaveAdapter));

        util.mintUSDC(alice, 100_000e6);

        vm.label(address(this), "AaveV3AdapterTest");
        vm.label(address(aaveAdapter), "AaveAdapter");
        vm.label(address(aavePool), "AavePool");
        vm.label(address(uniSwapper), "UniSwapper");
        vm.label(address(interbeam), "Interbeam");

        vm.label(address(0x7EfFD7b47Bfd17e52fB7559d3f924201b9DbfF3d), "AToken Implementation");
        vm.label(uniV3Router, "UniV3Router");
        vm.label(coreBridgeAddress, "Wormhole Core Bridge (Proxy)");
        vm.label(address(0x3c3d457f1522D3540AB3325Aa5f1864E34cBA9D0), "Wormhole Core Bridge (Impl)");
        vm.label(tokenBridgeAddress, "Wormhole Token Bridge (Proxy)");
        vm.label(address(0x299b4F6066d231521d11FAE8331fb1A4fe794F58), "Wormhole Token Bridge (Impl)");
    }

    function test_Withdraw() public {
        uint256 depositAmount = 100e6;
        uint256 withdrawAmount = 50e6;

        vm.startPrank(alice);

        // Approve to deposit USDC into Aave Pool
        USDC.approve(address(aavePool), type(uint256).max);
        aavePool.deposit(address(USDC), depositAmount, alice, 0);

        {
            (Vm.CallerMode callerMode, address msgSender, ) = vm.readCallers();
            // assertEq(uint256(callerMode), uint256(Vm.CallerMode.Prank));
            assertEq(msgSender, alice);
        }

        // Transfer AToken from alice to aaveAdapter,
        aUSDC.transfer(address(aaveAdapter), withdrawAmount);

        vm.stopPrank();

        vm.prank(address(aaveAdapter));
        uint256 amountWithdrawn = aavePool.withdraw(address(USDC), withdrawAmount, address(this));

        assert(withdrawAmount == amountWithdrawn);
    }

    function test_Beam2marginfi_USDC() public {
        uint256 depositAmount = 100e6;
        uint256 withdrawAmount = 50e6;

        vm.startPrank(alice);

        // Approve to deposit USDC into Aave Pool
        USDC.approve(address(aavePool), type(uint256).max);
        aavePool.deposit(address(USDC), depositAmount, alice, 0);

        {
            (Vm.CallerMode callerMode, address msgSender, ) = vm.readCallers();
            // assertEq(uint256(callerMode), uint256(Vm.CallerMode.Prank));
            assertEq(msgSender, alice);
        }

        // Approve to transfer aToken from alice to aaveAdapter
        aUSDC.approve(address(aaveAdapter), type(uint256).max);

        VaaKey memory vaaKey = aaveAdapter.beam2marginfi(
            address(USDC),
            address(aUSDC),
            withdrawAmount,
            3000,
            toWormholeFormat(address(0))
        );

        console2.log("vaaKey.emitterAddress, vaaKey.chainId, vaaKey.sequence");
        console2.logBytes32(vaaKey.emitterAddress);
        console2.log(vaaKey.chainId);
        console2.log(vaaKey.sequence);

        vm.stopPrank();
    }

    function test_Beam2marginfi_WETH() public {
        uint256 depositAmount = 2 ether;
        uint256 withdrawAmount = 1 ether;

        vm.startPrank(alice);

        WETH.deposit{value: depositAmount}();

        // Approve to deposit WETH into Aave Pool
        WETH.approve(address(aavePool), type(uint256).max);
        aavePool.deposit(address(WETH), depositAmount, alice, 0);

        {
            (Vm.CallerMode callerMode, address msgSender, ) = vm.readCallers();
            // assertEq(uint256(callerMode), uint256(Vm.CallerMode.Prank));
            assertEq(msgSender, alice);
        }

        // Approve to transfer aToken from alice to aaveAdapter
        aWETH.approve(address(aaveAdapter), type(uint256).max);

        VaaKey memory vaaKey = aaveAdapter.beam2marginfi(
            address(WETH),
            address(aWETH),
            withdrawAmount,
            3000,
            toWormholeFormat(address(0))
        );

        console2.log("vaaKey.emitterAddress, vaaKey.chainId, vaaKey.sequence");
        console2.logBytes32(vaaKey.emitterAddress);
        console2.log(vaaKey.chainId);
        console2.log(vaaKey.sequence);

        vm.stopPrank();
    }
}
