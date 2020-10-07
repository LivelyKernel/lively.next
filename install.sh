#!/bin/bash

# curl -so- https://raw.githubusercontent.com/LivelyKernel/lively.installer/master/web-install.sh | bash

lv_next_dir=$PWD

export PATH=$lv_next_dir/flatn/bin:$PATH
export FLATN_PACKAGE_DIRS=
export FLATN_PACKAGE_COLLECTION_DIRS=$lv_next_dir/lively.next-node_modules:$lv_next_dir/custom-npm-modules
eval $(node -p 'let PWD=process.cwd();let packages = JSON.parse(require("fs").readFileSync(PWD+"/lively.installer/packages-config.json")).map(ea => require("path").join(PWD, ea.name));`export FLATN_DEV_PACKAGE_DIRS=${packages.join(":")}`')                                                              

node lively.installer/install-with-node.js $PWD
