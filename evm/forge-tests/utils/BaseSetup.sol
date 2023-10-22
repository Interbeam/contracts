// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

import "forge-std/Test.sol";

import {IERC20} from "oz/token/ERC20/IERC20.sol";

import {Util} from "./Util.sol";

import {IAToken} from "../../contracts/interfaces/aave/IAToken.sol";
import {IWETH} from "../../contracts/interfaces/IWETH.sol";

contract BaseSetup is Test {
    // Vm internal immutable vm = Vm(HEVM_ADDRESS);

    Util internal util;

    IWETH internal WNative;
    // IERC20 internal WBTC = IERC20(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599);
    // IWETH internal WETH;
    // IERC20 internal DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    IERC20 internal USDC;
    IERC20 internal USDCe;

    // Aave interest-bearing tokens
    // aTOKENv2 => Aave V2 ETH aTOKEN
    // aTOKEN => Aave V3 ETH aTOKEN
    IAToken internal aWNative;
    // IAToken internal aWBTC = IAToken(0x5Ee5bf7ae06D1Be5997A1A72006FE6C607eC6DE8);
    // IAToken internal aWETH;
    // IAToken internal aDAIv2 = IAToken(0x028171bCA77440897B824Ca71D1c56caC55b68A3);
    // IAToken internal aDAI = IAToken(0x018008bfb33d285247A21d44E50697654f754e63);
    // IAToken internal aUSDCv2 = IAToken(0xBcca60bB61934080951369a648Fb03DF4F96263C);
    IAToken internal aUSDC;
    IAToken internal aUSDCe;
    // IAToken internal aUSDT = IAToken(0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a);

    address payable[] internal users;
    address internal alice;
    address internal bob;

    function setUp() public virtual {
        loadAddresses();

        util = new Util(address(USDC));
        users = util.createUsers(2);

        alice = users[0];
        vm.label(alice, "Alice");

        bob = users[1];
        vm.label(bob, "Bob");

        // vm.label(address(WBTC), "WBTC");
        // vm.label(address(WETH), "WETH");
        vm.label(address(WNative), "WNative");
        // vm.label(address(DAI), "DAI");
        vm.label(address(USDC), "USDC");
        vm.label(address(USDCe), "USDC.");

        // vm.label(address(aWBTC), "aWBTC");
        // vm.label(address(aWETH), "aWETH");
        vm.label(address(aWNative), "aWNative");
        // vm.label(address(aDAI), "aDAI");
        vm.label(address(aUSDC), "aUSDC");
        vm.label(address(aUSDCe), "aUSDCe");
    }

    function loadAddresses() public {
        if (block.chainid == 1) {
            // Ethereum
            WNative = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
            USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
            aWNative = IAToken(0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8);
            aUSDC = IAToken(0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c);
        } else if(block.chainid == 137) {
            // WETH = IWETH(0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619);
            WNative = IWETH(0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270);
            // USDC = IERC20(0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359); // offical USDC
            USDCe = IERC20(0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174); // bridged USDC
            USDC = USDCe;
            aWNative = IAToken(0x6d80113e533a2C0fe82EaBD35f1875DcEA89Ea97);
            // no offcial aave v3 USDC, only USDCe
            aUSDCe = IAToken(0x625E7708f30cA75bfd92586e17077590C60eb4cD);
            aUSDC = aUSDCe;
        } else if (block.chainid == 42161) {
            WNative = IWETH(0x82aF49447D8a07e3bd95BD0d56f35241523fBab1);
            USDC = IERC20(0xaf88d065e77c8cC2239327C5EDb3A432268e5831);
            aWNative = IAToken(0xe50fA9b3c56FfB159cB0FCA61F5c9D750e8128c8);
            aUSDC = IAToken(0x724dc807b04555b71ed48a6896b6F41593b8C637);
        } else {
            revert("Unsupported chain ID");
        }
    }
}
