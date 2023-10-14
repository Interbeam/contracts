use anchor_lang::prelude::*;

use crate::{error::InterbeamError, state::RedeemerConfig};

#[derive(Accounts)]
pub struct UpdateRelayerFee<'info> {
    #[account(mut)]
    /// CHECK: Owner of the program set in the [`RedeemerConfig`] account.
    pub owner: UncheckedAccount<'info>,

    #[account(
        mut,
        has_one = owner @ InterbeamError::OwnerOnly,
        seeds = [RedeemerConfig::SEED_PREFIX],
        bump
    )]
    /// Redeemer Config account. This program requires that the `owner`
    /// specified in the context equals the pubkey specified in this account.
    /// Mutable.
    pub config: Box<Account<'info, RedeemerConfig>>,

    /// System program.
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct UpdateRelayerFeeParams {
    relayer_fee: u32,
    relayer_fee_precision: u32,
}

pub fn update_relayer_fee(
    ctx: Context<UpdateRelayerFee>,
    params: &UpdateRelayerFeeParams,
) -> Result<()> {
    require!(
        params.relayer_fee < params.relayer_fee_precision,
        InterbeamError::InvalidRelayerFee,
    );

    let config = &mut ctx.accounts.config;
    config.relayer_fee = params.relayer_fee;
    config.relayer_fee_precision = params.relayer_fee_precision;

    // Done.
    Ok(())
}
