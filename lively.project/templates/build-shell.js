export const buildScriptShell = `#!/bin/bash
echo "⏰: $(date +%F_%T)"
while [ "$#" -gt 0 ]; do
  case "$1" in
    --verbose) verbose="--verbose"; shift 1;;
    -*) echo "unknown option: $1" >&2; exit 1;;
  esac
done
node ../../lively.project/package-install.mjs "$(pwd)" || exit 1
node --no-warnings --experimental-import-meta-resolve ./tools/build.mjs $verbose
`
