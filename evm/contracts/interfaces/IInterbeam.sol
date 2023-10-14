// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

import {VaaKey} from "../interfaces/wormhole/IWormholeRelayer.sol";
import {WormholeStructs} from "../wormhole/WormholeStructs.sol";

interface IInterbeam {
    function beamMessage(
        // address token,
        uint256 amount,
        WormholeStructs.InterbeamMessage memory message
    ) external payable returns (VaaKey memory);

    function registerAdapter(address adapter) external;

    function unregisterAdapter(address adapter) external;

    function setTargetSolanaAddress(bytes32 _targetSolanaAddress) external;
}
