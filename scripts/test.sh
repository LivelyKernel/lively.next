#!/bin/bash

target_package=$1
lv_next_dir=$PWD

if [[ ! -d "${lv_next_dir}/${target_package}" ]]; then
  echo "Cannot find lively package: ${target_package}. Testing failed."
  exit 1
fi

. $lv_next_dir/scripts/lively-next-flatn-env.sh
lively_next_flatn_env $lv_next_dir

pushd $lv_next_dir/mocha-es6/
if [[ ! -d node_modules ]]; then
    npm install
fi
pushd bin/
ln -sf mocha-es6.js mocha-es6
export PATH=$PWD:$PATH
popd
popd

cd $target_package;
npm test
