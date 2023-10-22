// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

import "forge-std/Script.sol";

abstract contract ScriptHelper is Script {
	function getInitData()
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
        // Wormhole addresses from https://docs.wormhole.com/wormhole/reference/constants
        // USDC address from https://www.circle.com/en/usdc/developers#usdc-multichain
        // Uniswap address from https://docs.uniswap.org/contracts/v3/reference/deployments
        if (block.chainid == 1) {
            // Ethereum
            uniV3Router = address(0xE592427A0AEce92De3Edee1F18E0157C05861564);
            coreBridgeAddress = address(0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B);
            tokenBridgeAddress = address(0x3ee18B2214AFF97000D974cf647E7C347E8fa585);
            poolAddressProvider = address(0x2f39d218133AFaB8F2B819B1066c7E434Ad94E9e);
            nativeToken = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
            usdc = address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
            wormholeChainId = 2;
        } else if (block.chainid == 137) {
            uniV3Router = address(0xE592427A0AEce92De3Edee1F18E0157C05861564);
            coreBridgeAddress = address(0x7A4B5a56256163F07b2C80A7cA55aBE66c4ec4d7);
            tokenBridgeAddress = address(0x5a58505a96D1dbf8dF91cB21B54419FC36e93fdE);
            poolAddressProvider = address(0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb);
            nativeToken = address(0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270); // wmatic
            // usdc = address(0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359); // official USDC
            usdc = address(0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174); // USDC.e
            wormholeChainId = 5;
        } else if (block.chainid == 42161) {
            uniV3Router = address(0xE592427A0AEce92De3Edee1F18E0157C05861564);
            coreBridgeAddress = address(0xa5f208e072434bC67592E4C49C1B991BA79BCA46);
            tokenBridgeAddress = address(0x0b2402144Bb366A632D14B83F244D2e0e21bD39c);
            poolAddressProvider = address(0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb);
            nativeToken = address(0x82aF49447D8a07e3bd95BD0d56f35241523fBab1);
            usdc = address(0xaf88d065e77c8cC2239327C5EDb3A432268e5831);
            wormholeChainId = 23;
        } else {
            revert("Interbeam: chain not supported yet");
        }
    }
}