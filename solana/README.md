# Modification of Wormhole Scaffolding Solana

Uses `pnpm` which generates `pnpm-lock.yaml`, specified in Makefile's `node_modules` command. If you use `npm`, replace `pnpm-lock.yaml` in Makefile with `package-lock.json`.

`wormhole-anchor-sdk` was modified to add implement `fn deserialize_reader<R>(_: &mut R) -> std::result::Result<Self, std::io::Error>` for `AnchorDeserialize` trait.