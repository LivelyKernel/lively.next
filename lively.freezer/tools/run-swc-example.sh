#!/bin/bash
. ../scripts/lively-next-env.sh
lively_next_env "$(dirname "$(pwd)")"
export FLATN_DEV_PACKAGE_DIRS=$FLATN_DEV_PACKAGE_DIRS:$(pwd);
export FLATN_DISABLE_WATCH=1
node --no-warnings --experimental-import-meta-resolve --experimental-loader ../flatn/resolver.mjs ./examples/use-swc-bundler.js
