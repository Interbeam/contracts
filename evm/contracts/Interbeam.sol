// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

import {Ownable} from "oz/access/Ownable.sol";
import {IERC20} from "oz/token/ERC20/IERC20.sol";
import {ReentrancyGuard} from "oz/utils/ReentrancyGuard.sol";

import {IInterbeam} from "./interfaces/IInterbeam.sol";
import {ITokenBridge} from "./interfaces/wormhole/ITokenBridge.sol";
import {IWormhole} from "./interfaces/wormhole/IWormhole.sol";
import {VaaKey} from "./interfaces/wormhole/IWormholeRelayer.sol";
import {BytesLib} from "./libs/BytesLib.sol";
import {WormholeGetters} from "./wormhole/WormholeGetters.sol";
import {WormholeMessages} from "./wormhole/WormholeMessages.sol";
import "./wormhole/WormholeUtils.sol";

//
// NOTE: Currently, automatic relaying is not supported for Solana :(
//       Once it's supported, follow https://github.com/wormhole-foundation/hello-wormhole/blob/main/src/HelloWormhole.sol
//

contract Interbeam is IInterbeam, Ownable, ReentrancyGuard, WormholeGetters, WormholeMessages {
    using BytesLib for bytes;

    uint256 public constant BRIDGE_GAS_LIMIT = 100_000;

    ITokenBridge public immutable tokenBridge;

    IERC20 public immutable USDC;

    bytes32 public targetSolanaAddress;

    mapping(address => bool) public adapters;

    // mapping(address => uint256) private _bridgedAmountsUsdc;

    uint32 private _nonce;

    constructor(
        address _coreBridgeAddress, // Wormhole core bridge address
        address _tokenBridgeAddress, // Wormhole token bridge address
        address _usdc, // USDC address
        uint16 _chainId // Wormhole-compatible chain ID of this contract
    ) Ownable(msg.sender) {
        USDC = IERC20(_usdc);

        // Wormhole configs
        setWormhole(_coreBridgeAddress);
        setChainId(_chainId);
        setWormholeFinality(200); // instant finality in testnets/devnets

        tokenBridge = ITokenBridge(_tokenBridgeAddress);
    }

    modifier onlyAdapter() {
        require(adapters[msg.sender], "Only adapter");
        _;
    }

    function registerAdapter(address adapter) public onlyOwner {
        adapters[adapter] = true;
    }

    function unregisterAdapter(address adapter) public onlyOwner {
        adapters[adapter] = false;
    }

    function setTargetSolanaAddress(bytes32 _targetSolanaAddress) public onlyOwner {
        targetSolanaAddress = _targetSolanaAddress;
    }

    /// @dev Lock LP position and bridge data to Solana via Wormhole.
    ///      Must be called by the owner of the LP position, with this contract approved for the LP
    ///      position (set as `operator`).
    ///
    /// @dev The fee growth & tokens owed data is NOT bridged for brevity, thus the accrued fees are
    ///      locked in EVM while tokens are bridged.
    function beamMessage(
        // address token,
        uint256 amount,
        InterbeamMessage memory message
    ) public payable onlyAdapter nonReentrant returns (VaaKey memory) {
        message.chainId = chainId();

        bytes memory encodedMessage = encodeMessage(message);

        // enforce a max size for the arbitrary message
        require(encodedMessage.length < type(uint16).max, "Message too large");

        IERC20 usdc = USDC; // save SSLOAD
        // address sender = fromWormholeFormat(message.sender);

        // Transfer amount of token from adapter to this contract for bridging (on behalf of user msg.sender)
        require(usdc.balanceOf(msg.sender) >= amount, "Insufficient token balance");
        require(usdc.allowance(msg.sender, address(this)) >= amount, "Insufficient token allowance");
        usdc.transferFrom(msg.sender, address(this), amount);

        // _bridgedAmountsUsdc[sender] += amount;

        uint256 wormholeFee = wormhole().messageFee();
        // Confirm that the caller has sent enough value to pay for the Wormhole message fee.
        require(msg.value == wormholeFee, "Insufficient value");

        usdc.approve(address(tokenBridge), amount);

        uint64 sequence = tokenBridge.transferTokensWithPayload{value: wormholeFee}(
            address(USDC),
            message.amountUSDC,
            1, // Solana
            targetSolanaAddress,
            _nonce,
            encodedMessage
        );

        // positions[tokenId].sequence = _sendMessage(message);

        ++_nonce;

        return VaaKey({emitterAddress: toWormholeFormat(address(tokenBridge)), chainId: chainId(), sequence: sequence});
    }
}
