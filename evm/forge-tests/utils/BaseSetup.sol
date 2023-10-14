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

    IERC20 internal WBTC = IERC20(0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599);
    IWETH internal WETH = IWETH(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    IERC20 internal DAI = IERC20(0x6B175474E89094C44Da98b954EedeAC495271d0F);
    IERC20 internal USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);

    // Aave interest-bearing tokens
    // aTOKENv2 => Aave V2 ETH aTOKEN
    // aTOKEN => Aave V3 ETH aTOKEN
    IAToken internal aWBTC = IAToken(0x5Ee5bf7ae06D1Be5997A1A72006FE6C607eC6DE8);
    IAToken internal aWETH = IAToken(0x4d5F47FA6A74757f35C14fD3a6Ef8E3C9BC514E8);
    // IAToken internal aDAIv2 = IAToken(0x028171bCA77440897B824Ca71D1c56caC55b68A3);
    IAToken internal aDAI = IAToken(0x018008bfb33d285247A21d44E50697654f754e63);
    // IAToken internal aUSDCv2 = IAToken(0xBcca60bB61934080951369a648Fb03DF4F96263C);
    IAToken internal aUSDC = IAToken(0x98C23E9d8f34FEFb1B7BD6a91B7FF122F4e16F5c);
    // IAToken internal aUSDT = IAToken(0x23878914EFE38d27C4D67Ab83ed1b93A74D4086a);

    address payable[] internal users;
    address internal alice;
    address internal bob;

    function setUp() public virtual {
        util = new Util(address(USDC));
        users = util.createUsers(2);

        alice = users[0];
        vm.label(alice, "Alice");

        bob = users[1];
        vm.label(bob, "Bob");

        vm.label(address(WBTC), "WBTC");
        vm.label(address(WETH), "WETH");
        vm.label(address(DAI), "DAI");
        vm.label(address(USDC), "USDC");

        vm.label(address(aWBTC), "aWBTC");
        vm.label(address(aWETH), "aWETH");
        vm.label(address(aDAI), "aDAI");
        vm.label(address(aUSDC), "aUSDC");
    }
}
