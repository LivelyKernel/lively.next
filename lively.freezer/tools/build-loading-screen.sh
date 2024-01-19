#!/bin/bash
. ../scripts/lively-next-env.sh
lively_next_env "$(dirname "$(pwd)")"
export FLATN_DEV_PACKAGE_DIRS=$FLATN_DEV_PACKAGE_DIRS:$(pwd);
node --no-warnings --no-experimental-fetch --experimental-import-meta-resolve --experimental-loader ../flatn/resolver.mjs ./tools/build.loading-screen.mjs
