#!/bin/bash

NODE_VERSION=$(node -v)
NODE_VERSION=$(echo "$NODE_VERSION" | sed -En 's/v([0-9]+)\..*/\1/p')

if [[ $NODE_VERSION -lt 18 ]]; then
  echo -n "Your node version is not supported. Please use at least node 18."; echo;
  exit 1;
fi

if [[ ! -d lively.server ]]; then
  echo -n "lively.next packages doesn't seem to be properly installed yet. Please run ./update.sh"; echo;
  exit 1;
fi

lv_next_dir=$PWD

. $lv_next_dir/scripts/lively-next-flatn-env.sh
lively_next_flatn_env $lv_next_dir

cd lively.server;

node --no-warnings --dns-result-order ipv4first \
  --experimental-loader $lv_next_dir/flatn/resolver.mjs \
  bin/start-server.js \
  --root-directory $lv_next_dir \
  --config $lv_next_dir/config.js \
