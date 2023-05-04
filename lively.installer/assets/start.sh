#!/bin/bash

./scripts/node_version_checker.sh || exit 1

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
