#!/bin/bash
# Launch lively.next as an NW.js desktop app.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

NW_BIN="$SCRIPT_DIR/node_modules/.bin/nw"
[ -x "$NW_BIN" ] || NW_BIN="$ROOT_DIR/node_modules/.bin/nw"

if [ ! -x "$NW_BIN" ]; then
  echo "NW.js launcher not found. Run: cd lively.app && bash setup.sh"
  exit 1
fi

# Resolver hooks in NODE_OPTIONS run in NW.js's renderer and crash Blink.
unset NODE_OPTIONS

# The desktop function-scope reader connects to the inspector on LIVELY_APP_CDP_PORT
# (default 9222, the port in the manifest's chromium-args).
exec "$NW_BIN" ${LIVELY_APP_CDP_PORT:+"--remote-debugging-port=$LIVELY_APP_CDP_PORT"} "$SCRIPT_DIR" "$@"
