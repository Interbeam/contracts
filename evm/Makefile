# include .env
ifneq (,$(wildcard ./.env))
    include .env
    export
endif

.PHONY: all test clean deploy-anvil

all: clean remove install update build

# Clean the repo
clean  :; forge clean

# Remove modules
remove :; rm -rf .gitmodules && rm -rf .git/modules/* && rm -rf lib && touch .gitmodules && git add . && git commit -m "modules"

#install :; forge install smartcontractkit/chainlink-brownie-contracts && forge install rari-capital/solmate && forge install foundry-rs/forge-std
install :; forge install foundry-rs/forge-std --no-commit && forge install uniswap/v3-periphery@0.8 --no-commit && forge install openzeppelin/openzeppelin-contracts --no-commit && forge install wormhole-foundation/wormhole-solidity-sdk --no-commit

# Update Dependencies
update:; forge update

build:; forge build

test :; forge test 

snapshot :; forge snapshot

slither :; slither ./contracts 

format :; prettier --write contracts/**/*.sol && prettier --write contracts/*.sol

abi : abi-interbeam abi-aave-adapter abi-uniswapper abi-ierc abi-iusdc abi-ipool abi-iatoken
abi-interbeam :; forge inspect contracts/Interbeam.sol:Interbeam abi > abi/Interbeam.json
abi-aave-adapter :; forge inspect contracts/AaveV3Adapter.sol:AaveV3Adapter abi > abi/AaveV3Adapter.json
abi-uniswapper :; forge inspect contracts/UniSwapper.sol:UniSwapper abi > abi/UniSwapper.json
abi-ierc :; forge inspect contracts/interfaces/IERC20.sol:IERC20 abi > abi/IERC20.json
abi-iusdc :; forge inspect contracts/interfaces/IUSDC.sol:IUSDC abi > abi/IUSDC.json
abi-ipool :; forge inspect contracts/interfaces/aave/IPool.sol:IPool abi > abi/IPool.json
abi-iatoken :; forge inspect contracts/interfaces/aave/IAToken.sol:IAToken abi > abi/IAToken.json

gen-types :; make abi && rm -rf ./types-typechain && npx typechain --target ethers-v5 ./abi/*.json --out-dir ./types-typechain

cp-types :; rm -rf ../solana/ts/sdk/types-typechain/** && cp -r ./types-typechain/* ../solana/ts/sdk/types-typechain

# solhint should be installed globally
lint :; solhint contracts/**/*.sol && solhint contracts/*.sol

get-usdc-slots :; cast storage --etherscan-api-key ${ETHERSCAN_API_KEY} --chain 1 --rpc-url ${ETHEREUM_MAINNET_RPC} 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
# => masterMinter: slot 8, offset 0, bytes 20

anvil :; anvil --fork-url ${ETHEREUM_MAINNET_RPC} -m 'test test test test test test test test test test test junk'

# This is the private key of account from the mnemonic from the "make anvil" command
deploy-anvil-aave :; @forge script forge-script/AaveV3Adapter.s.sol:DeployAaveV3Adapter --rpc-url http://localhost:8545  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast -vvvv

cp-broadcast-eth-aave :; mkdir -p ../solana/ts/sdk/broadcast/ethereum && cp ./broadcast/AaveV3Adapter.s.sol/1/run-latest.json ../solana/ts/sdk/broadcast/ethereum/aave-v3-adapter.json
