#!/bin/bash

lv_next_dir=$PWD
. $lv_next_dir/scripts/lively-next-env.sh
lively_next_env $lv_next_dir
node --no-experimental-fetch --no-warnings --experimental-import-meta-resolve --experimental-loader ./flatn/resolver.mjs ./scripts/check_boot.js
