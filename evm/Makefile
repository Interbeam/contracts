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

cp-abis :; rm -rf ../../website/src/abis && mkdir -p ../../website/src/abis && cp -r ./abi/** ../../website/src/abis/

# solhint should be installed globally
lint :; solhint contracts/**/*.sol && solhint contracts/*.sol

get-usdc-slots :; cast storage --etherscan-api-key ${ETHERSCAN_API_KEY} --chain 1 --rpc-url ${ETHEREUM_MAINNET_RPC} 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
# => masterMinter: slot 8, offset 0, bytes 20

anvil :; anvil --fork-url ${ETHEREUM_MAINNET_RPC} -m 'test test test test test test test test test test test junk'

# This is the private key of account from the mnemonic from the "make anvil" command
deploy-anvil-aave :; @forge script forge-script/AaveV3Adapter.s.sol:DeployAaveV3Adapter --rpc-url http://localhost:8545  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 --broadcast -vvvv

cp-broadcast-eth-aave :; mkdir -p ../solana/ts/sdk/broadcast/ethereum && cp ./broadcast/AaveV3Adapter.s.sol/1/run-latest.json ../solana/ts/sdk/broadcast/ethereum/aave-v3-adapter.json


deploy-arbitrum-aave :; @forge script forge-script/AaveV3Adapter.s.sol:DeployAaveV3Adapter --optimize --rpc-url $(ARBITRUM_MAINNET_RPC) --private-key $(DEPLOYER_PRIVATE_KEY) --broadcast --slow --with-gas-price 110000000 -vvvv

#
# Verification make commands fail because $(cast ...) returns an extra double-quote, which I'm lazy to remove XD
# So, copy the verification command below and run it in CLI, make sure the etherscan api key is set!
#

verify-arbitrum-interbeam :; forge verify-contract --chain arbitrum --etherscan-api-key ${ARBISCAN_API_KEY} --watch --constructor-args $(cast abi-encode "constructor(address, address, address, uint16)" "0xa5f208e072434bC67592E4C49C1B991BA79BCA46" "0x0b2402144Bb366A632D14B83F244D2e0e21bD39c" "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" "2") 0x4C636eFcA2Bf1F94096d0D3f89854231563f8F39 contracts/Interbeam.sol:Interbeam
verify-arbitrum-uniswapper :; forge verify-contract --chain arbitrum --etherscan-api-key ${ARBISCAN_API_KEY} --watch --constructor-args $(cast abi-encode "constructor(address)" "0xE592427A0AEce92De3Edee1F18E0157C05861564") 0x34A7046F1F750812d6fE2efcf1606fa196e797a3 contracts/UniSwapper.sol:UniSwapper
verify-arbitrum-aave :; forge verify-contract --chain arbitrum --etherscan-api-key ${ARBISCAN_API_KEY} --watch --constructor-args $(cast abi-encode "constructor(address, address, address, address, address)" "0xa97684ead0e402dC232d5A977953DF7ECBaB3CDb" "0x34A7046F1F750812d6fE2efcf1606fa196e797a3" "0x4C636eFcA2Bf1F94096d0D3f89854231563f8F39" "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48") 0x333bBC1E9dCCd8fD19B12c6aE82d0cfA220Ce031 contracts/AaveV3Adapter.sol:AaveV3Adapter