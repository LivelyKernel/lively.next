export const buildScriptShell = `#!/bin/bash
echo "⏰: $(date +%F_%T)"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --verbose) verbose="--verbose"; shift 1;;
    -*) echo "unknown option: $1" >&2; exit 1;;
  esac
done
. ../../scripts/lively-next-env.sh
lively_next_env "$(dirname "$(dirname "$(pwd)")")"
export FLATN_DEV_PACKAGE_DIRS=$FLATN_DEV_PACKAGE_DIRS:$(pwd);
node --no-experimental-fetch --no-warnings --experimental-import-meta-resolve --experimental-loader ../../flatn/resolver.mjs ./tools/build.mjs $verbose
`
