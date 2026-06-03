#!/bin/bash
set -e

source ~/.nvm/nvm.sh
nvm use 20

npm --prefix functions run build
firebase deploy --only functions
