// SPDX-License-Identifier: Apache 2
pragma solidity >=0.8.0;

contract WormholeStructs {
    enum InterbeamMessageType {
        SOLEND,
        MARGINFI,
        ORCA,
        ORCA_WHIRLPOOL,
        RAYDIUM,
        JITO
    }

    //
    // NOTE: We don't need to care about packing slots, since we use `abi.encodePacked` to pack the message.
    //
    struct InterbeamMessage {
        // the Wormhole-compatible chain ID of origin chain
        uint16 chainId;
        // NOTE: uint8 enum
        // - if lending, then `tokenA` == `tokenB` and `amountTokenA` == `amountTokenB`
        InterbeamMessageType messageType;
        // target final token A & B address on Solana (bytes32 since address is base58 encoded)
        bytes32 tokenA;
        bytes32 tokenB;
        // original amount of token A & B (before conversion to USDC)
        uint256 amountTokenA;
        uint256 amountTokenB;
        // amount of USDC transferred (USDC is the canonical token to bridge bc of its liquidity)
        uint256 amountUSDC;
        // Sender on EVM (Wormhole format)
        bytes32 sender;
        // Recipient on Solana (Wormhole format) to guard when signing on Solana
        bytes32 recipient;
        // Arbitrary payload, e.g. LP lower & upper price and fee for Orca
        uint16 payloadSize;
        bytes payload;
    }
}
