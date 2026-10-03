#!/usr/bin/env bash

PASSWORD_QUERY=$1
DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -z "$WORKSPACE_LK" ]; then
  export WORKSPACE_LK="$(cd "$DIR/.." && pwd)"
fi
node --no-warnings --experimental-import-meta-resolve --dns-result-order ipv4first "$WORKSPACE_LK/bin/askpass.js" "$PASSWORD_QUERY"
