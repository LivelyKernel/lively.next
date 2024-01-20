export const buildScriptShell = `#!/bin/bash

. ../../scripts/lively-next-env.sh
lively_next_env "$(dirname "$(dirname "$(pwd)")")"
export FLATN_DEV_PACKAGE_DIRS=$FLATN_DEV_PACKAGE_DIRS:$(pwd);
node --no-experimental-fetch --no-warnings --experimental-import-meta-resolve --experimental-loader ../../flatn/resolver.mjs ./tools/build.mjs
`