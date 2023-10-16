#!/bin/bash

GIT_ROOT_DIR=$(git rev-parse --show-toplevel)
PRGM_DIR="${GIT_ROOT_DIR}/solana"

WEBSITE_DIR="${GIT_ROOT_DIR}/../website"
WEB_TARGET_DIR="${WEBSITE_DIR}/src/target"

mkdir -p "${WEB_TARGET_DIR}/idl"
mkdir -p "${WEB_TARGET_DIR}/types"

# Copy types & IDL
cp -r ${PRGM_DIR}/target/idl/* "${WEB_TARGET_DIR}/idl/"
cp -r ${PRGM_DIR}/target/types/* "${WEB_TARGET_DIR}/types/"