// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

interface IUniSwapper {
    function swapExactInputSingleHopV3(
        address tokenIn,
        address tokenOut,
        uint24 poolFee,
        uint256 amountIn
    ) external returns (uint256 amountOut);

    function swapExactInputMultiHopV3(
        bytes calldata path,
        address tokenIn,
        uint256 amountIn
    ) external returns (uint256 amountOut);
}
