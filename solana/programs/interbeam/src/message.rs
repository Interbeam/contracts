use crate::error::InterbeamError;
use anchor_lang::{AnchorDeserialize, AnchorSerialize};
use std::convert::TryFrom;
use std::io;
use wormhole_anchor_sdk::token_bridge;

#[allow(non_camel_case_types)]
#[repr(u8)] // Solidity enum is at uint8
#[derive(Clone, Copy)]
pub enum InterbeamMessageTypeEnum {
    SOLEND,
    MARGINFI,
    ORCA,
    ORCA_WHIRLPOOL,
    RAYDIUM,
    JITO,
}

impl TryFrom<u8> for InterbeamMessageTypeEnum {
    type Error = InterbeamError;

    fn try_from(v: u8) -> std::result::Result<InterbeamMessageTypeEnum, InterbeamError> {
        match v {
            x if x == InterbeamMessageTypeEnum::SOLEND as u8 => {
                Ok(InterbeamMessageTypeEnum::SOLEND)
            }
            x if x == InterbeamMessageTypeEnum::MARGINFI as u8 => {
                Ok(InterbeamMessageTypeEnum::MARGINFI)
            }
            x if x == InterbeamMessageTypeEnum::ORCA as u8 => Ok(InterbeamMessageTypeEnum::ORCA),
            x if x == InterbeamMessageTypeEnum::ORCA_WHIRLPOOL as u8 => {
                Ok(InterbeamMessageTypeEnum::ORCA_WHIRLPOOL)
            }
            x if x == InterbeamMessageTypeEnum::RAYDIUM as u8 => {
                Ok(InterbeamMessageTypeEnum::RAYDIUM)
            }
            x if x == InterbeamMessageTypeEnum::JITO as u8 => Ok(InterbeamMessageTypeEnum::JITO),
            _ => Err(InterbeamError::InvalidMessageType),
        }
    }
}

// TODO: payload
#[derive(Clone, Copy)]
pub struct InterbeamMessage {
    pub chain_id: u16,
    pub message_type: InterbeamMessageTypeEnum,
    pub token_a: [u8; 32],
    pub token_b: [u8; 32],
    pub amount_token_a: [u8; 32],
    pub amount_token_b: [u8; 32],
    pub amount_usdc: [u8; 32],
    pub sender: [u8; 32],
    pub recipient: [u8; 32],
    pub payload_size: u16,
    // payload: [u8],
}

// TODO: fix this to match deseriailization spec below
impl AnchorSerialize for InterbeamMessage {
    fn serialize<W: io::Write>(&self, writer: &mut W) -> io::Result<()> {
        match self {
            InterbeamMessage {
                chain_id,
                message_type,
                token_a,
                token_b,
                amount_token_a,
                amount_token_b,
                amount_usdc,
                sender,
                recipient,
                payload_size,
                // payload,
            } => {
                chain_id.serialize(writer)?;

                if let Err(err) = (*message_type as u8).serialize(writer) {
                    // eprintln!("Error serializing message_type: {:?}", err);
                    return Err(err);
                }

                token_a.serialize(writer)?;
                token_b.serialize(writer)?;
                amount_token_a.serialize(writer)?;
                amount_token_b.serialize(writer)?;
                amount_usdc.serialize(writer)?;
                sender.serialize(writer)?;
                recipient.serialize(writer)?;
                payload_size.serialize(writer)?;

                Ok(())
            }
        }
    }
}

impl AnchorDeserialize for InterbeamMessage {
    fn deserialize(buf: &mut &[u8]) -> io::Result<Self> {
        //
        // NOTE: Solidity struct uses BE encoding, so we need to swap some bytes to LE for Borsh `deserialize`.
        //

        // let msg_len = u16::from_be_bytes(<[u8; 2]>::try_from(&buf[0..2]).unwrap()) as usize;
        let msg_len = {
            let mut out = [0u8; 2];
            out.copy_from_slice(&buf[0..2]);
            u16::from_be_bytes(out) as usize
        };

        // sub 2 because we already consumed the first 2 bytes (buf now points at the 3rd byte)
        // require!(msg_len == buf.len() - 2, InterbeamError::InvalidMessageLength);
        assert_eq!(msg_len, buf.len() - 2, "Invalid message length");
        // if msg_len != buf.len() - 2 {
        //     return Err(io::Error::new(
        //         io::ErrorKind::InvalidInput,
        //         "invalid message length",
        //     ));
        // }

        let chain_id = u16::from_be_bytes(<[u8; 2]>::try_from(&buf[2..4]).unwrap());

        let message_type = buf[4].try_into().unwrap();

        let mut token_a = [0u8; 32];
        token_a.copy_from_slice(&buf[5..37]);

        let mut token_b = [0u8; 32];
        token_b.copy_from_slice(&buf[37..69]);

        let mut amount_token_a = [0u8; 32];
        amount_token_a.copy_from_slice(&buf[69..101]);

        let mut amount_token_b = [0u8; 32];
        amount_token_b.copy_from_slice(&buf[101..133]);

        let mut amount_usdc = [0u8; 32];
        amount_usdc.copy_from_slice(&buf[133..165]);

        let mut sender = [0u8; 32];
        sender.copy_from_slice(&buf[165..197]);

        let mut recipient = [0u8; 32];
        recipient.copy_from_slice(&buf[197..229]);

        let payload_size = u16::from_be_bytes(<[u8; 2]>::try_from(&buf[229..231]).unwrap());

        // TODO: validate payload length against payload_size

        // msg!("chain_id: {:?}", chain_id);
        // msg!("token_a: {:?}", token_a);
        // msg!("token_b: {:?}", token_b);
        // msg!("amount_token_a: {:?}", amount_token_a);
        // msg!("amount_token_b: {:?}", amount_token_b);
        // msg!("sender: {:?}", sender);
        // msg!("recipient: {:?}", recipient);

        Ok(InterbeamMessage {
            chain_id,
            message_type,
            token_a,
            token_b,
            amount_token_a,
            amount_token_b,
            amount_usdc,
            sender,
            recipient,
            // NOTE: <type>::deserialize(&mut &buf[x..y]) updates the buffer to point at the remaining bytes.
            // token_a: <[u8; 32]>::deserialize(&mut &buf[5..37])?,
            // token_b: <[u8; 32]>::deserialize(&mut &buf[0..32])?,
            // amount_token_a: <[u8; 32]>::deserialize(&mut &buf[0..32])?,
            // amount_token_b: <[u8; 32]>::deserialize(&mut &buf[0..32])?,
            // amount_usdc: <[u8; 32]>::deserialize(&mut &buf[0..32])?,
            // sender: <[u8; 32]>::deserialize(&mut &buf[0..32])?,
            // recipient: <[u8; 32]>::deserialize(&mut &buf[0..32])?,
            payload_size,
        })
    }

    fn deserialize_reader<R: io::Read>(reader: &mut R) -> io::Result<Self> {
        let mut buf = Vec::new();
        reader.read_to_end(&mut buf)?;
        Self::deserialize(&mut buf.as_slice())
    }
}

pub type PostedInterbeamMessage = token_bridge::PostedTransferWith<InterbeamMessage>;

// #[cfg(test)]
// pub mod test {
//     use super::*;
//     use anchor_lang::prelude::{Pubkey, Result};
//     use std::mem::size_of;

//     #[test]
//     fn test_message_alive() -> Result<()> {
//         let recipient = Pubkey::new_unique().to_bytes();
//         let msg = InterbeamMessage::Hello { recipient };

//         // Serialize program ID above.
//         let mut encoded = Vec::new();
//         msg.serialize(&mut encoded)?;

//         assert_eq!(encoded.len(), size_of::<[u8; 32]>() + size_of::<u8>());

//         // Verify Payload ID.
//         assert_eq!(encoded[0], PAYLOAD_ID_HELLO);

//         // Verify Program ID.
//         let mut encoded_recipient = [0u8; 32];
//         encoded_recipient.copy_from_slice(&encoded[1..33]);
//         assert_eq!(encoded_recipient, recipient);

//         // Now deserialize the encoded message.
//         let InterbeamMessage::Hello {
//             recipient: decoded_recipient,
//         } = InterbeamMessage::deserialize(&mut encoded.as_slice())?;
//         assert_eq!(decoded_recipient, recipient);

//         Ok(())
//     }
// }
