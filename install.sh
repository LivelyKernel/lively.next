#!/bin/bash

# curl -so- https://raw.githubusercontent.com/LivelyKernel/lively.installer/main/web-install.sh | bash

lv_next_dir=$PWD

NODE_VERSION=$(node -v)
NODE_VERSION=$(echo "$NODE_VERSION" | sed -En 's/v([0-9]+)\..*/\1/p')

if [[ $NODE_VERSION -lt 18 ]]; then
  echo -n 'your node version is not supported. please use node 18.X.'; echo;
  exit 1;
fi

if [[ $NODE_VERSION -ge 19 ]]; then
  echo -n 'your node version is too new, and has known issues. Please use 18.X.'; echo;
  exit 1;
fi

export PATH=$lv_next_dir:$lv_next_dir/flatn/bin:$PATH
export FLATN_PACKAGE_DIRS=
export FLATN_PACKAGE_COLLECTION_DIRS=$lv_next_dir/lively.next-node_modules
eval $(node -p 'let PWD=process.cwd();let packages = JSON.parse(require("fs").readFileSync(PWD+"/lively.installer/packages-config.json")).map(ea => require("path").join(PWD, ea.name));`export FLATN_DEV_PACKAGE_DIRS=${packages.join(":")}`')                                                              
mkdir lively.next-node_modules
mkdir esm_cache

node --no-experimental-fetch --inspect --no-warnings --experimental-loader $lv_next_dir/flatn/resolver.mjs \
     lively.installer/bin/install.cjs $PWD \

if [ ! "$CI" ];
then
  npm --prefix $lv_next_dir/lively.freezer/ run build-landing-page
fi
npm --prefix $lv_next_dir/lively.freezer/ run build-loading-screen
