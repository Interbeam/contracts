pub use foreign_contract::*;
pub use redeemer_config::*;
pub use sender_config::*;

pub mod foreign_contract;
pub mod redeemer_config;
pub mod sender_config;

#[derive(Clone)]
pub struct Jupiter;

impl anchor_lang::Id for Jupiter {
    fn id() -> anchor_lang::prelude::Pubkey {
        crate::jupiter::id()
    }
}
