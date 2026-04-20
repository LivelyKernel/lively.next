#!/bin/bash
# Launch lively.next as an NW.js desktop app.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
NW_VERSION="${LIVELY_NW_VERSION:-0.110.1}"
FLAVOR="${LIVELY_NW_FLAVOR:-sdk}"

PLATFORM="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$PLATFORM" in darwin) PLATFORM="osx" ;; esac
case "$ARCH" in x86_64) ARCH="x64" ;; aarch64|arm64) ARCH="arm64" ;; esac

NW_DIR_NAME="nwjs-${FLAVOR}-v${NW_VERSION}-${PLATFORM}-${ARCH}"
NW_PKG_DIR="$ROOT_DIR/lively.next-node_modules/nw/${NW_VERSION}-${FLAVOR}"

if [ "$PLATFORM" = "osx" ]; then
  NW_BIN="$NW_PKG_DIR/$NW_DIR_NAME/nwjs.app/Contents/MacOS/nwjs"
else
  NW_BIN="$NW_PKG_DIR/$NW_DIR_NAME/nw"
fi

if [ ! -x "$NW_BIN" ]; then
  echo "NW.js binary not found. Run: cd lively.app && bash setup.sh"
  exit 1
fi

# Set up flatn environment (FLATN_* vars, PATH).
# NODE_OPTIONS must be unset — ESM loader hooks crash NW.js's Blink renderer.
# The server child process handles its own --experimental-loader flag.
. "$ROOT_DIR/scripts/lively-next-env.sh"
lively_next_env "$ROOT_DIR"
unset NODE_OPTIONS

exec "$NW_BIN" "$SCRIPT_DIR" "$@"
