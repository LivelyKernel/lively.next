#!/usr/bin/env bash

DIR="$(cd "$(dirname "$0")" && pwd)"
UNAME=$(uname | tr '[:upper:]' '[:lower:]')
[ $UNAME = "darwin" ] && IS_DARWIN=1
[ $UNAME = "linux" ] && IS_LINUX=1

if [ -z "$WORKSPACE_LK" ]; then
  export WORKSPACE_LK="$(cd "$DIR/.." && pwd)"
fi

node --no-warnings --experimental-import-meta-resolve --dns-result-order ipv4first "$WORKSPACE_LK/bin/send-to-lively.js" "$@"
