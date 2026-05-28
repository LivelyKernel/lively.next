#!/usr/bin/env bash

FILE=$1
DIR="$(cd "$(dirname "$0")" && pwd)"
UNAME=$(uname | tr '[:upper:]' '[:lower:]')
[ $UNAME = "darwin" ] && IS_DARWIN=1
[ $UNAME = "linux" ] && IS_LINUX=1

if [ -z "$WORKSPACE_LK" ]; then
  export WORKSPACE_LK="$(cd "$DIR/.." && pwd)"
fi


if [ "${FILE:0:1}" != "/" ]; then
  if [ $IS_DARWIN ]; then
    FILE="$PWD/$FILE";
  elif [ $IS_LINUX ]; then
    FILE=$(readlink -f $FILE);
  fi
fi

ROOT_DIR="$(cd "$WORKSPACE_LK/.." && pwd)"
RESOLVER="$ROOT_DIR/flatn/resolver.mjs"

node --no-warnings --experimental-loader "$RESOLVER" --dns-result-order ipv4first "$DIR/lively-as-editor.js" "$FILE"
