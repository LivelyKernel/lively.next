#!/bin/bash

set -v

target_package=$1
lv_next_dir=$PWD

function travis_marker {
    start_or_end=$1
    if [[ -n "${TRAVIS}" ]]; then
	echo -en "travis_fold:${start_or_end}:${target_package}\n"
    fi
}

travis_marker "start"

if [[ ! -d "${lv_next_dir}/${target_package}" ]]; then
    echo "Cannot find lively package: ${target_package}. Testing failed."
    echo -en "travis_fold:end:${target_package}\n"
    exit 1
fi

. $lv_next_dir/scripts/lively-next-flatn-env.sh
lively_next_flatn_env $lv_next_dir

pushd $lv_next_dir/mocha-es6/
[[ ! -d node_modules ]] && npm install
pushd bin/
ln -sf mocha-es6.js mocha-es6
export PATH=$PWD:$PATH
popd
popd

cd $target_package;
npm test
code=$?
travis_marker "end"
exit $code
