#!/usr/bin/env bash

PASSWORD_QUERY=$1
DIR=${WORKSPACE_LK-"$0/../.."}
RESOLVER=$(node -e "console.log(require.resolve('flatn/resolver.mjs'))") 
node --no-warnings --experimental-loader $RESOLVER --dns-result-order ipv4first $DIR/bin/askpass.js $PASSWORD_QUERY
