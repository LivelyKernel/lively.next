#!/bin/bash


if [[ ! -d lively.server ]]; then
  echo -n "lively.next packages doesn't seem to be properly installed yet. Please run ./update.sh"
  exit 1;
fi


lv_next_dir=$PWD

export PATH=$lv_next_dir/flatn/bin:$PATH
export FLATN_PACKAGE_DIRS=
export FLATN_PACKAGE_COLLECTION_DIRS=$lv_next_dir/lively.next-node_modules:$lv_next_dir/custom-npm-modules
eval $(node -p 'let PWD=process.cwd();let packages = JSON.parse(require("fs").readFileSync(PWD+"/lively.installer/packages-config.json")).map(ea => require("path").join(PWD, ea.name));`export FLATN_DEV_PACKAGE_DIRS=${packages.join(":")}`')

cd lively.server;

node bin/start-server.js \
  --root-directory $lv_next_dir \
  --config $lv_next_dir/config.js
