#!/bin/bash
. ../scripts/lively-next-flatn-env.sh
lively_next_flatn_env "$(dirname "$(pwd)")"
export FLATN_DEV_PACKAGE_DIRS=$FLATN_DEV_PACKAGE_DIRS:$(pwd);
node --no-experimental-fetch --no-warnings --experimental-import-meta-resolve --experimental-loader ../flatn/resolver.mjs ./tools/build-runtime.mjs
