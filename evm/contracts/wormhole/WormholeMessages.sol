// SPDX-License-Identifier: Apache 2
pragma solidity >=0.8.0;

import {BytesLib} from "../libs/BytesLib.sol";

import {WormholeStructs} from "./WormholeStructs.sol";

contract WormholeMessages is WormholeStructs {
    using BytesLib for bytes;

    /**
     * @notice Encodes the InterbeamMessage struct into bytes
     * @param parsedMessage InterbeamMessage struct with arbitrary message
     * @return encodedMessage InterbeamMessage encoded into bytes
     */
    function encodeMessage(InterbeamMessage memory parsedMessage) public pure returns (bytes memory encodedMessage) {
        // Convert message string to bytes so that we can use the .length attribute.
        // The length of the arbitrary messages needs to be encoded in the message
        // so that the corresponding decode function can decode the message properly.
        //
        // We use `encodePacked` to pack the message into bytes without padding.
        bytes memory encodedMessagePayload = abi.encodePacked(
            parsedMessage.chainId,
            parsedMessage.messageType,
            parsedMessage.tokenA,
            parsedMessage.tokenB,
            parsedMessage.amountTokenA,
            parsedMessage.amountTokenB,
            parsedMessage.amountUSDC,
            parsedMessage.sender,
            parsedMessage.recipient,
            parsedMessage.payloadSize,
            parsedMessage.payload
        );

        // return the encoded message
        encodedMessage = abi.encodePacked(
            uint16(encodedMessagePayload.length), // message length
            encodedMessagePayload // the enconded message to be read
        );
    }

    /**
     * @notice Decodes bytes into InterbeamMessage struct
     * @dev Verifies the payloadID
     * @param encodedMessage encoded arbitrary message
     * @return parsedMessage InterbeamMessage struct with arbitrary message
     */
    function decodeMessage(bytes memory encodedMessage) public pure returns (InterbeamMessage memory parsedMessage) {
        // starting index for byte parsing
        uint256 index = 0;

        // parse the message string length (which is encoded as a uint16 in the last step of `encodeMessage`)
        // uint16 messageLength = encodedMessage.toUint16(index);
        index += 2;

        parsedMessage.chainId = encodedMessage.toUint16(index);
        index += 2;

        // Enum size: https://docs.soliditylang.org/en/v0.8.0/types.html#enums
        // `InterbeamMessageType` signature is uint8
        parsedMessage.messageType = InterbeamMessageType(encodedMessage.toUint8(index));
        index += 1;

        parsedMessage.tokenA = encodedMessage.toBytes32(index);
        index += 32;

        parsedMessage.tokenB = encodedMessage.toBytes32(index);
        index += 32;

        parsedMessage.amountTokenA = encodedMessage.toUint256(index);
        index += 32;

        parsedMessage.amountTokenB = encodedMessage.toUint256(index);
        index += 32;

        parsedMessage.amountUSDC = encodedMessage.toUint256(index);
        index += 32;

        parsedMessage.sender = encodedMessage.toBytes32(index);
        index += 32;

        parsedMessage.recipient = encodedMessage.toBytes32(index);
        index += 32;

        parsedMessage.payloadSize = encodedMessage.toUint16(index);
        index += 2;

        parsedMessage.payload = encodedMessage.slice(index, parsedMessage.payloadSize);
        index += parsedMessage.payloadSize;

        // confirm that the message was the expected length
        require(index == encodedMessage.length, "Invalid message length");
    }
}
