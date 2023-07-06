#!/bin/bash

# curl -so- https://raw.githubusercontent.com/LivelyKernel/lively.installer/main/web-install.sh | bash

lv_next_dir=$PWD

./scripts/node_version_checker.sh || exit 1

export PATH=$lv_next_dir:$lv_next_dir/flatn/bin:$PATH
export FLATN_PACKAGE_DIRS=
export FLATN_PACKAGE_COLLECTION_DIRS=$lv_next_dir/lively.next-node_modules
eval $(node -p 'let PWD=process.cwd();let packages = JSON.parse(require("fs").readFileSync(PWD+"/lively.installer/packages-config.json")).map(ea => require("path").join(PWD, ea.name));`export FLATN_DEV_PACKAGE_DIRS=${packages.join(":")}`')                                                              
mkdir lively.next-node_modules
mkdir esm_cache
mkdir local_projects

node --no-experimental-fetch --no-warnings --experimental-loader $lv_next_dir/flatn/resolver.mjs \
     lively.installer/bin/install.cjs $PWD \

if [[ -z "${CI}" ]];
then
  env CI=true npm --prefix $lv_next_dir/lively.freezer/ run build-landing-page
fi
env CI=true npm --prefix $lv_next_dir/lively.freezer/ run build-loading-screen
