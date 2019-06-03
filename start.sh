#!/bin/bash


if [[ ! -d lively.server ]]; then
  echo -n "lively.next packages doesn't seem to be properly installed yet. Please run ./update.sh"
  exit 1;
fi

lv_next_dir=$PWD

. scripts/lively-next-flatn-env.sh
lively_next_flatn_env $lv_next_dir

cd lively.server;

node bin/start-server.js \
  --root-directory $lv_next_dir \
  --config $lv_next_dir/config.js
