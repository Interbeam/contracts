// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

import "forge-std/Test.sol";

import {IUSDC} from "../../contracts/interfaces/IUSDC.sol";

contract Util is Test {
    bytes32 internal nextUser = keccak256(abi.encodePacked("user address"));

    IUSDC internal USDC;

    constructor(address _usdc) {
        USDC = IUSDC(_usdc);

        if (block.chainid == 137) {
            // do nothing
        } else {
            // if official USDC, then configuer masterMinter
            vm.prank(USDC.masterMinter());
            USDC.configureMinter(address(this), type(uint256).max);
        }
    }

    function getNextUserAddress() external returns (address payable) {
        // bytes32 to address conversion
        address payable user = payable(address(uint160(uint256(nextUser))));
        nextUser = keccak256(abi.encodePacked(nextUser));
        return user;
    }

    // Create users with 100 ether balance
    function createUsers(uint256 userNum) external returns (address payable[] memory) {
        address payable[] memory users = new address payable[](userNum);
        for (uint256 i = 0; i < userNum; i++) {
            address payable user = this.getNextUserAddress();
            vm.deal(user, 100 ether);
            users[i] = user;
        }
        return users;
    }

    // move block.number forward by a given number of blocks
    function mineBlocks(uint256 numBlocks) external {
        uint256 targetBlock = block.number + numBlocks;
        vm.roll(targetBlock);
    }

    function mintUSDC(address recipient, uint256 amount) external {
        USDC.mint(recipient, amount);
    }
}
