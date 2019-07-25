#!/usr/bin/env bash


lv_next_dir=$(readlink -f ../../)

pushd $lv_next_dir
. scripts/lively-next-flatn-env.sh
lively_next_flatn_env $lv_next_dir
popd

pushd ../
node tools/build-cjs.js
popd
