#!/bin/bash
. ../scripts/lively-next-flatn-env.sh
lively_next_flatn_env "$(dirname "$(pwd)")"
node --no-warnings --experimental-import-meta-resolve --experimental-loader ./resolver.mjs tools/build-cjs.mjs