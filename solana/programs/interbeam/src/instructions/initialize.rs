use anchor_lang::prelude::*;
use wormhole_anchor_sdk::{token_bridge, wormhole};

use crate::{
    error::InterbeamError,
    state::{RedeemerConfig, SenderConfig},
};

/// AKA `b"bridged"`.
pub const SEED_PREFIX_BRIDGED: &[u8; 7] = b"bridged";
/// AKA `b"tmp"`.
pub const SEED_PREFIX_TMP: &[u8; 3] = b"tmp";

#[derive(Accounts)]
/// Context used to initialize program data (i.e. configs).
pub struct Initialize<'info> {
    #[account(mut)]
    /// Whoever initializes the config will be the owner of the program. Signer
    /// for creating the [`SenderConfig`] and [`RedeemerConfig`] accounts.
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        seeds = [SenderConfig::SEED_PREFIX],
        bump,
        space = SenderConfig::MAXIMUM_SIZE,
    )]
    /// Sender Config account, which saves program data useful for other
    /// instructions, specifically for outbound transfers. Also saves the payer
    /// of the [`initialize`](crate::initialize) instruction as the program's
    /// owner.
    pub sender_config: Box<Account<'info, SenderConfig>>,

    #[account(
        init,
        payer = owner,
        seeds = [RedeemerConfig::SEED_PREFIX],
        bump,
        space = RedeemerConfig::MAXIMUM_SIZE,
    )]
    /// Redeemer Config account, which saves program data useful for other
    /// instructions, specifically for inbound transfers. Also saves the payer
    /// of the [`initialize`](crate::initialize) instruction as the program's
    /// owner.
    pub redeemer_config: Box<Account<'info, RedeemerConfig>>,

    /// Wormhole program.
    pub wormhole_program: Program<'info, wormhole::program::Wormhole>,

    /// Token Bridge program.
    pub token_bridge_program: Program<'info, token_bridge::program::TokenBridge>,

    #[account(
        seeds = [token_bridge::Config::SEED_PREFIX],
        bump,
        seeds::program = token_bridge_program,
    )]
    /// Token Bridge config. Token Bridge program needs this account to
    /// invoke the Wormhole program to post messages. Even though it is a
    /// required account for redeeming token transfers, it is not actually
    /// used for completing these transfers.
    pub token_bridge_config: Account<'info, token_bridge::Config>,

    #[account(
        seeds = [token_bridge::SEED_PREFIX_AUTHORITY_SIGNER],
        bump,
        seeds::program = token_bridge_program,
    )]
    /// CHECK: Token Bridge authority signer. This isn't an account that holds
    /// data; it is purely just a signer for SPL tranfers when it is delegated
    /// spending approval for the SPL token.
    pub token_bridge_authority_signer: UncheckedAccount<'info>,

    #[account(
        seeds = [token_bridge::SEED_PREFIX_CUSTODY_SIGNER],
        bump,
        seeds::program = token_bridge_program,
    )]
    /// CHECK: Token Bridge custody signer. This isn't an account that holds
    /// data; it is purely just a signer for Token Bridge SPL tranfers.
    pub token_bridge_custody_signer: UncheckedAccount<'info>,

    #[account(
        seeds = [token_bridge::SEED_PREFIX_MINT_AUTHORITY],
        bump,
        seeds::program = token_bridge_program,
    )]
    /// CHECK: Token Bridge mint authority. This isn't an account that holds
    /// data; it is purely just a signer (SPL mint authority) for Token Bridge
    /// wrapped assets.
    pub token_bridge_mint_authority: UncheckedAccount<'info>,

    #[account(
        seeds = [wormhole::BridgeData::SEED_PREFIX],
        bump,
        seeds::program = wormhole_program,
    )]
    /// Wormhole bridge data account (a.k.a. its config).
    pub wormhole_bridge: Box<Account<'info, wormhole::BridgeData>>,

    #[account(
        seeds = [token_bridge::SEED_PREFIX_EMITTER],
        bump,
        seeds::program = token_bridge_program
    )]
    /// CHECK: Token Bridge program's emitter account. This isn't an account
    /// that holds data; it is purely just a signer for posting Wormhole
    /// messages on behalf of the Token Bridge program.
    pub token_bridge_emitter: UncheckedAccount<'info>,

    #[account(
        seeds = [wormhole::FeeCollector::SEED_PREFIX],
        bump,
        seeds::program = wormhole_program
    )]
    /// Wormhole fee collector account, which requires lamports before the
    /// program can post a message (if there is a fee). Token Bridge program
    /// handles the fee payments.
    pub wormhole_fee_collector: Account<'info, wormhole::FeeCollector>,

    #[account(
        seeds = [
            wormhole::SequenceTracker::SEED_PREFIX,
            token_bridge_emitter.key().as_ref()
        ],
        bump,
        seeds::program = wormhole_program
    )]
    /// Token Bridge emitter's sequence account. Like with all Wormhole
    /// emitters, this account keeps track of the sequence number of the last
    /// posted message.
    pub token_bridge_sequence: Account<'info, wormhole::SequenceTracker>,

    /// System program.
    pub system_program: Program<'info, System>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct InitializeParams {
    relayer_fee: u32,
    relayer_fee_precision: u32,
}

pub fn initialize(ctx: Context<Initialize>, params: &InitializeParams) -> Result<()> {
    require!(
        params.relayer_fee < params.relayer_fee_precision,
        InterbeamError::InvalidRelayerFee,
    );

    // Initialize program's sender config
    let sender_config = &mut ctx.accounts.sender_config;

    // Set the owner of the sender config (effectively the owner of the
    // program).
    sender_config.owner = ctx.accounts.owner.key();
    sender_config.bump = *ctx
        .bumps
        .get("sender_config")
        .ok_or(InterbeamError::BumpNotFound)?;

    // Set Token Bridge related addresses.
    {
        let token_bridge = &mut sender_config.token_bridge;
        token_bridge.config = ctx.accounts.token_bridge_config.key();
        token_bridge.authority_signer = ctx.accounts.token_bridge_authority_signer.key();
        token_bridge.custody_signer = ctx.accounts.token_bridge_custody_signer.key();
        token_bridge.emitter = ctx.accounts.token_bridge_emitter.key();
        token_bridge.sequence = ctx.accounts.token_bridge_sequence.key();
        token_bridge.wormhole_bridge = ctx.accounts.wormhole_bridge.key();
        token_bridge.wormhole_fee_collector = ctx.accounts.wormhole_fee_collector.key();
    }

    // Initialize program's redeemer config
    let redeemer_config = &mut ctx.accounts.redeemer_config;

    // Set the owner of the redeemer config (effectively the owner of the
    // program).
    redeemer_config.owner = ctx.accounts.owner.key();
    redeemer_config.bump = *ctx
        .bumps
        .get("redeemer_config")
        .ok_or(InterbeamError::BumpNotFound)?;
    redeemer_config.relayer_fee = params.relayer_fee;
    redeemer_config.relayer_fee_precision = params.relayer_fee_precision;

    // Set Token Bridge related addresses.
    {
        let token_bridge = &mut redeemer_config.token_bridge;
        token_bridge.config = ctx.accounts.token_bridge_config.key();
        token_bridge.custody_signer = ctx.accounts.token_bridge_custody_signer.key();
        token_bridge.mint_authority = ctx.accounts.token_bridge_mint_authority.key();
    }

    // Done.
    Ok(())
}
