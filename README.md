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
NETWORK=devnet make integration-test
```
