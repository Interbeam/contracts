use anchor_lang::prelude::*;
use wormhole_anchor_sdk::{token_bridge, wormhole};

use crate::{
    error::InterbeamError,
    state::{ForeignContract, SenderConfig},
};

/// AKA `b"tmp"`.
pub const SEED_PREFIX_TMP: &[u8; 3] = b"tmp";

#[derive(Accounts)]
#[instruction(params: RegisterForeignContractParams)]
pub struct RegisterForeignContract<'info> {
    #[account(mut)]
    /// Owner of the program set in the [`SenderConfig`] account. Signer for
    /// creating [`ForeignContract`] account.
    pub owner: Signer<'info>,

    #[account(
        has_one = owner @ InterbeamError::OwnerOnly,
        seeds = [SenderConfig::SEED_PREFIX],
        bump
    )]
    /// Sender Config account. This program requires that the `owner` specified
    /// in the context equals the pubkey specified in this account. Read-only.
    pub config: Box<Account<'info, SenderConfig>>,

    #[account(
        init_if_needed,
        payer = owner,
        seeds = [
            ForeignContract::SEED_PREFIX,
            &params.chain.to_le_bytes()[..]
        ],
        bump,
        space = ForeignContract::MAXIMUM_SIZE
    )]
    /// Foreign Contract account. Create this account if an emitter has not been
    /// registered yet for this Wormhole chain ID. If there already is a
    /// contract address saved in this account, overwrite it.
    pub foreign_contract: Box<Account<'info, ForeignContract>>,

    #[account(
        seeds = [
            &params.chain.to_be_bytes(),
            token_bridge_foreign_endpoint.emitter_address.as_ref()
        ],
        bump,
        seeds::program = token_bridge_program
    )]
    /// Token Bridge foreign endpoint. This account should really be one
    /// endpoint per chain, but Token Bridge's PDA allows for multiple
    /// endpoints for each chain. We store the proper endpoint for the
    /// emitter chain.
    pub token_bridge_foreign_endpoint: Account<'info, token_bridge::EndpointRegistration>,

    /// Token Bridge program.
    pub token_bridge_program: Program<'info, token_bridge::program::TokenBridge>,

    /// System program.
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct RegisterForeignContractParams {
    chain: u16,
    address: [u8; 32],
}

pub fn register_foreign_contract(
    ctx: Context<RegisterForeignContract>,
    params: &RegisterForeignContractParams,
) -> Result<()> {
    // Foreign emitter cannot share the same Wormhole Chain ID as the
    // Solana Wormhole program's. And cannot register a zero address.
    require!(
        params.chain > 0
            && params.chain != wormhole::CHAIN_ID_SOLANA
            && !params.address.iter().all(|&x| x == 0),
        InterbeamError::InvalidForeignContract,
    );

    // Save the emitter info into the ForeignEmitter account.
    let emitter = &mut ctx.accounts.foreign_contract;
    emitter.chain = params.chain;
    emitter.address = params.address;
    emitter.token_bridge_foreign_endpoint = ctx.accounts.token_bridge_foreign_endpoint.key();

    // Done.
    Ok(())
}
