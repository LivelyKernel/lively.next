#!/bin/bash
. ../scripts/lively-next-env.sh
lively_next_env "$(dirname "$(pwd)")"
node --no-warnings --experimental-import-meta-resolve --experimental-loader ./resolver.mjs tools/build-cjs.mjs