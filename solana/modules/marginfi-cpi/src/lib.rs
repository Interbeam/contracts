anchor_lang::declare_id!("MFv2hWf31Z9kbCa1snEPYctwafyhdvnV7FZnsebVacA");

// anchor_gen::generate_cpi_interface!(
//     idl_path = "src/idl.json",
//     zero_copy(
//         MarginfiGroup,
//         MarginfiAccount,
//         UTPAccountConfig,
//         WrappedI80F48,
//         UTPConfig,
//         Bank,
//     ),
//     packed(MarginfiGroup, MarginfiAccount, UTPAccountConfig, Bank)
// );
anchor_gen::generate_cpi_crate!("src/idl.json");

// impl Default for state::MarginfiGroup {
//     fn default() -> Self {
//         Self {
//             admin: Default::default(),
//             bank: Default::default(),
//             paused: false,
//             reserved_space: [0; 384],
//         }
//     }
// }
