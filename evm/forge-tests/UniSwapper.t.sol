// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

import "forge-std/Test.sol";
import "forge-std/console2.sol";

import {IERC20} from "oz/token/ERC20/IERC20.sol";

import {UniSwapper} from "../contracts/UniSwapper.sol";
import {IWETH} from "../contracts/interfaces/IWETH.sol";

contract UniSwapperTest is Test {
    IWETH private WETH = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IERC20 private DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    IERC20 private USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);

    UniSwapper private uniSwapper = new UniSwapper(address(0xE592427A0AEce92De3Edee1F18E0157C05861564));

    function setUp() public {}

    function test_SingleHop() public {
        WETH.deposit{value: 1e18}();
        WETH.approve(address(uniSwapper), 1e18);

        uint256 amountOut = uniSwapper.swapExactInputSingleHopV3(address(WETH), address(USDC), 3000, 1e18);

        assert(WETH.balanceOf(address(this)) == 0);
        assert(USDC.balanceOf(address(this)) == amountOut);
        console2.log("USDC", amountOut);
    }

    function test_MultiHop() public {
        WETH.deposit{value: 1e18}();
        WETH.approve(address(uniSwapper), 1e18);

        bytes memory path = abi.encodePacked(WETH, uint24(3000), USDC, uint24(100), DAI);

        uint256 amountOut = uniSwapper.swapExactInputMultiHopV3(path, address(WETH), 1e18);

        console2.log("DAI", amountOut);
    }
}
