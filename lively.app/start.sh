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

NW_ARGS=()
if [ "${LIVELY_APP_HEADLESS:-}" = "1" ]; then
  NW_ARGS+=(--headless=new --disable-gpu)
fi

exec "$NW_BIN" "${NW_ARGS[@]}" "$SCRIPT_DIR" "$@"
