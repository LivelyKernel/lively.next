#!/bin/bash

target_package=$1
lv_next_dir=$PWD

if [[ ! -d "${lv_next_dir}/${target_package}" ]]; then
  echo "Cannot find lively package: ${target_package}. Testing failed."
  exit 1
fi

. $lv_next_dir/scripts/lively-next-flatn-env.sh
lively_next_flatn_env $lv_next_dir

ln -sf $lv_next_dir/mocha-es6/bin/{mocha-es6.js,mocha-es6}
export PATH=$lv_next_dir/mocha-es6/bin:$PATH

cd $target_package;
npm test
