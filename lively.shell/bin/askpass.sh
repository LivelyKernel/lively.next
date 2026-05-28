#!/usr/bin/env bash

PASSWORD_QUERY=$1
DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -z "$WORKSPACE_LK" ]; then
  export WORKSPACE_LK="$(cd "$DIR/.." && pwd)"
fi
ROOT_DIR="$(cd "$WORKSPACE_LK/.." && pwd)"
RESOLVER="$ROOT_DIR/flatn/resolver.mjs"

node --no-warnings --experimental-loader "$RESOLVER" --dns-result-order ipv4first "$WORKSPACE_LK/bin/askpass.js" "$PASSWORD_QUERY"
