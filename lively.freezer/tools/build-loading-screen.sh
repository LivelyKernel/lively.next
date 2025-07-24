#!/bin/bash
while [ "$#" -gt 0 ]; do
  case "$1" in
    --verbose) verbose="--verbose"; shift 1;;
    -*) echo "unknown option: $1" >&2; exit 1;;
  esac
done
. ../scripts/lively-next-env.sh
lively_next_env "$(dirname "$(pwd)")"
export FLATN_DEV_PACKAGE_DIRS=$FLATN_DEV_PACKAGE_DIRS:$(pwd);
node --inspect --no-warnings --no-experimental-fetch --experimental-import-meta-resolve --experimental-loader ../flatn/resolver.mjs ./tools/build.loading-screen.mjs $verbose
