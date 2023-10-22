use anchor_lang::prelude::*;

pub use error::*;
pub use instructions::*;
pub use message::*;
pub use state::*;

pub mod error;
pub mod instructions;
pub mod message;
pub mod state;

// cfg_if::cfg_if! {
//   if #[cfg(feature = "mainnet")] {
//       declare_id!("beamSCX2hEqX9quugQLmze1oZfejyAkA8CfKb9rTkb6");
//   } else if #[cfg(feature = "devnet")] {
//       declare_id!("beamSCX2hEqX9quugQLmze1oZfejyAkA8CfKb9rTkb6");
//   } else {
//       declare_id!("beam111111111111111111111111111111111111111");
//   }
// }

#[cfg(feature = "mainnet")]
declare_id!("beamSCX2hEqX9quugQLmze1oZfejyAkA8CfKb9rTkb6");

// #[cfg(feature = "devnet")]
// declare_id!("beamSCX2hEqX9quugQLmze1oZfejyAkA8CfKb9rTkb6");

#[cfg(not(feature = "mainnet"))]
declare_id!("beam111111111111111111111111111111111111111");

pub mod jupiter {
    solana_program::declare_id!("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
}

#[program]
pub mod interbeam {
    use super::*;

    /// This instruction can be used to generate your program's config.
    /// And for convenience, we will store Wormhole-related PDAs in the
    /// config so we can verify these accounts with a simple == constraint.
    pub fn initialize(ctx: Context<Initialize>, params: InitializeParams) -> Result<()> {
        instructions::initialize(ctx, &params)
    }

    /// This instruction registers a new foreign contract (from another
    /// network) and saves the emitter information in a ForeignEmitter account.
    /// This instruction is owner-only, meaning that only the owner of the
    /// program (defined in the [Config] account) can add and update foreign
    /// contracts.
    ///
    /// # Arguments
    ///
    /// * `ctx`     - `RegisterForeignContract` context
    /// * `chain`   - Wormhole Chain ID
    /// * `address` - Wormhole Emitter Address
    pub fn register_foreign_contract(
        ctx: Context<RegisterForeignContract>,
        params: RegisterForeignContractParams,
    ) -> Result<()> {
        instructions::register_foreign_contract(ctx, &params)
    }

    pub fn update_relayer_fee(
        ctx: Context<UpdateRelayerFee>,
        params: UpdateRelayerFeeParams,
    ) -> Result<()> {
        instructions::update_relayer_fee(ctx, &params)
    }

    // pub fn redeem_native_transfer_with_payload(
    //     ctx: Context<RedeemNativeTransferWithPayload>,
    //     params: RedeemNativeTransferWithPayloadParams,
    // ) -> Result<()> {
    //     instructions::redeem_native_transfer_with_payload(ctx, &params)
    // }

    pub fn redeem_wrapped_transfer_with_payload(
        ctx: Context<RedeemWrappedTransferWithPayload>,
        params: RedeemWrappedTransferWithPayloadParams,
    ) -> Result<()> {
        instructions::redeem_wrapped_transfer_with_payload(ctx, &params)
    }
}
