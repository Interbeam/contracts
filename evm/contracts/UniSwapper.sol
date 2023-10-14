// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

import {IERC20} from "oz/token/ERC20/IERC20.sol";

import {IUniSwapper} from "./interfaces/IUniSwapper.sol";
import {IWETH} from "./interfaces/IWETH.sol";
import {ISwapRouter} from "./interfaces/uniswap/ISwapRouter.sol";

contract UniSwapper is IUniSwapper {
    // e.g. Ethereum: 0xE592427A0AEce92De3Edee1F18E0157C05861564
    ISwapRouter public immutable router;

    constructor(address _swapRouter) {
        router = ISwapRouter(_swapRouter);
    }

    function swapExactInputSingleHopV3(
        address tokenIn,
        address tokenOut,
        uint24 poolFee,
        uint256 amountIn
    ) external returns (uint256 amountOut) {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(address(router), amountIn);

        ISwapRouter.ExactInputSingleParams memory params = ISwapRouter.ExactInputSingleParams({
            tokenIn: tokenIn,
            tokenOut: tokenOut,
            fee: poolFee,
            recipient: msg.sender,
            deadline: block.timestamp + 1000,
            amountIn: amountIn,
            amountOutMinimum: 0,
            sqrtPriceLimitX96: 0
        });

        amountOut = router.exactInputSingle(params);
    }

    function swapExactInputMultiHopV3(
        bytes calldata path,
        address tokenIn,
        uint256 amountIn
    ) external returns (uint256 amountOut) {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).approve(address(router), amountIn);

        ISwapRouter.ExactInputParams memory params = ISwapRouter.ExactInputParams({
            path: path,
            recipient: msg.sender,
            deadline: block.timestamp,
            amountIn: amountIn,
            amountOutMinimum: 0
        });

        amountOut = router.exactInput(params);
    }
}
