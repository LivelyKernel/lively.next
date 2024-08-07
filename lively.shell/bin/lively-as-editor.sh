#!/usr/bin/env bash

FILE=$1
DIR=`dirname $0`
UNAME=$(uname | tr '[:upper:]' '[:lower:]')
[ $UNAME = "darwin" ] && IS_DARWIN=1
[ $UNAME = "linux" ] && IS_LINUX=1

if [ -z "$WORKSPACE_LK" ]; then
  export WORKSPACE_LK=$(dirname $DIR)
fi


if [ "${FILE:0:1}" != "/" ]; then
  if [ $IS_DARWIN ]; then
    FILE="$PWD/$FILE";
  elif [ $IS_LINUX ]; then
    FILE=$(readlink -f $FILE);
  fi
fi

RESOLVER=$(node -e "console.log(require.resolve('flatn/resolver.mjs'))") 
node --no-warnings --experimental-loader $RESOLVER --dns-result-order ipv4first $DIR/lively-as-editor.js "$FILE"
