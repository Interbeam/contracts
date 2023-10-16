#!/bin/bash

set -e # exit if any error occurs

GIT_ROOT_DIR=$(git rev-parse --show-toplevel)
PRGM_DIR="${GIT_ROOT_DIR}/solana"

anchor deploy -p interbeam --provider.cluster l --program-keypair "${PRGM_DIR}/.keypair/beamSCX2hEqX9quugQLmze1oZfejyAkA8CfKb9rTkb6.json"
