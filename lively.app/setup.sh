#!/bin/bash
# Install the pinned workspace graph, then fetch NW.js only for desktop setup.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BUN="${BUN_PATH:-$(command -v bun 2>/dev/null || true)}"

if [ ! -x "$BUN" ]; then
  echo "Bun 1.4.2 not found. Set BUN_PATH or install the pinned version."
  exit 1
fi
if [ "$("$BUN" --version)" != "1.4.2" ]; then
  echo "Expected Bun 1.4.2 at $BUN, found $("$BUN" --version)."
  exit 1
fi
if [ ! -f "$ROOT_DIR/bun.lock" ]; then
  echo "Missing $ROOT_DIR/bun.lock"
  exit 1
fi

cd "$ROOT_DIR"
export PUPPETEER_CACHE_DIR="$ROOT_DIR/.puppeteer-browser-cache"
"$BUN" install --frozen-lockfile

NW_PACKAGE_DIR=$(node -p 'require("node:fs").realpathSync(process.argv[1])' "$SCRIPT_DIR/node_modules/nw")
(
  cd "$NW_PACKAGE_DIR"
  node --input-type=module <<'NODE'
import fs from 'node:fs';
import { findpath } from './src/index.js';
const binary = await findpath();
if (!fs.existsSync(binary)) await import('./src/postinstall.js');
fs.accessSync(binary, fs.constants.X_OK);
NODE
)

NW_BIN="$SCRIPT_DIR/node_modules/.bin/nw"
[ -x "$NW_BIN" ] || NW_BIN="$ROOT_DIR/node_modules/.bin/nw"
if [ ! -x "$NW_BIN" ]; then
  echo "Bun installed the workspace, but the NW.js launcher is missing."
  exit 1
fi
echo "NW.js is ready at $NW_BIN"
