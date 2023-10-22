# Interbeam Contracts

## Instructions

(in order)

CLI tab 1:
```bash
cd evm && pnpm i
make anvil
```

CLI tab 2:
```bash
cd evm
make deploy-anvil-aave && make cp-broadcast-eth-aave
make gen-types && make cp-types
```

CLI tab 3:
```bash
cd svm && pnpm i
MINT_AUTHORITY=your_account_pubkey python ts/load-mint-accounts.py
NETWORK=devnet make integration-test
```
