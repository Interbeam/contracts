// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

import {console2} from "forge-std/console2.sol";

import {IERC20} from "oz/token/ERC20/IERC20.sol";

import {IInterbeam} from "./interfaces/IInterbeam.sol";
import {IUniSwapper} from "./interfaces/IUniSwapper.sol";
import {IAToken} from "./interfaces/aave/IAToken.sol";
import {IPool} from "./interfaces/aave/IPool.sol";
import {IPoolAddressesProvider} from "./interfaces/aave/IPoolAddressesProvider.sol";
import {VaaKey} from "./interfaces/wormhole/IWormholeRelayer.sol";
import {WormholeStructs} from "./wormhole/WormholeStructs.sol";
import "./wormhole/WormholeUtils.sol";

// All parent contracts must be OZ upgradeable-compatible
contract AaveV3Adapter {
    /// @dev Aave pool address, acquired from the Aave address provider (getPool)
    IPool public aavePool;

    IUniSwapper public uniSwapper;

    IInterbeam public interbeam;

    /// @dev (Wrapped) Native Gas Token (e.g. WETH, WMATIC, WAVAX, etc.)
    IERC20 public nativeToken;

    IERC20 public USDC;

    constructor(
        // address _oracle,
        address _aavePoolAddressProvider,
        address _uniSwapper,
        address _interbeam,
        address _nativeToken,
        address _usdc
    ) {
        // oracle = AaveOracle(_oracle);
        aavePool = IPool(IPoolAddressesProvider(_aavePoolAddressProvider).getPool());
        uniSwapper = IUniSwapper(_uniSwapper);
        interbeam = IInterbeam(_interbeam);
        nativeToken = IERC20(_nativeToken);
        USDC = IERC20(_usdc);
    }

    /// @dev Direct withdrawal from Aave pool doesn't work because it burns AToken of msg.sender (this contract),
    ///      so we must transfer AToken from msg.sender to this contract, then withdraw from this contract.
    ///      https://aave.notion.site/LendingPool-990bd1490c2a4a038c139c974835332b#6ebce8d2821f438582e0447ee5dc6507
    function beam2marginfi(
        address asset,
        address aToken,
        uint256 _amount,
        uint24 swapPoolFee,
        bytes32 recipientOnSolana
    ) public returns (VaaKey memory) {
        require(asset == IAToken(aToken).UNDERLYING_ASSET_ADDRESS(), "Invalid AToken");
        require(IAToken(aToken).balanceOf(msg.sender) >= _amount, "Insufficient AToken balance");
        // require(IAToken(aToken).allowance(msg.sender, address(this)) >= _amount, "Insufficient AToken allowance");

        IAToken(aToken).transferFrom(msg.sender, address(this), _amount);

        // Instead of sending to msg.sender, send to this contract for bridging.
        // This reduces user's approval by one because approval for bridging is done by this contract.
        uint256 amount = aavePool.withdraw(asset, _amount, address(this));
        uint256 amountInUSDC;

        if (asset != address(USDC)) {
            // TODO: multi-hop
            amountInUSDC = uniSwapper.swapExactInputSingleHopV3(asset, address(USDC), swapPoolFee, amount);
        } else {
            amountInUSDC = amount;
        }

        USDC.approve(address(interbeam), amountInUSDC);

        // console2.log("amount", amount);
        return interbeam.beamMessage(
            // address(USDC),
            amount,
            WormholeStructs.InterbeamMessage({
                chainId: 0, // overwrriten in interbeam.beamMessage
                messageType: WormholeStructs.InterbeamMessageType.MARGINFI,
                tokenA: toWormholeFormat(asset),
                tokenB: toWormholeFormat(asset),
                amountTokenA: amount,
                amountTokenB: amount,
                amountUSDC: amountInUSDC,
                sender: toWormholeFormat(msg.sender),
                recipient: recipientOnSolana,
                payloadSize: 0,
                payload: ""
            })
        );
    }
}
