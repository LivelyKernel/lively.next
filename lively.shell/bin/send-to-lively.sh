#!/usr/bin/env bash

DIR=`dirname $0`
UNAME=$(uname | tr '[:upper:]' '[:lower:]')
[ $UNAME = "darwin" ] && IS_DARWIN=1
[ $UNAME = "linux" ] && IS_LINUX=1

if [ -z "$WORKSPACE_LK" ]; then
  export WORKSPACE_LK=$(dirname $DIR)
fi

RESOLVER=$(node -e "console.log(require.resolve('flatn/resolver.mjs'))") 

node --no-warnings --experimental-loader $RESOLVER --dns-result-order ipv4first $WORKSPACE_LK/bin/send-to-lively.js $@
