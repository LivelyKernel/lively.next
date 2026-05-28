#!/usr/bin/env bash

DIR="$(cd "$(dirname "$0")" && pwd)"
UNAME=$(uname | tr '[:upper:]' '[:lower:]')
[ $UNAME = "darwin" ] && IS_DARWIN=1
[ $UNAME = "linux" ] && IS_LINUX=1

if [ -z "$WORKSPACE_LK" ]; then
  export WORKSPACE_LK="$(cd "$DIR/.." && pwd)"
fi

ROOT_DIR="$(cd "$WORKSPACE_LK/.." && pwd)"
RESOLVER="$ROOT_DIR/flatn/resolver.mjs"

node --no-warnings --experimental-loader "$RESOLVER" --dns-result-order ipv4first "$WORKSPACE_LK/bin/send-to-lively.js" "$@"
