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
PROJECT_FOLDER_CREATED=$?
# When we just created the local_projects folder, the partsbin inside cannot exist.
if (( PROJECT_FOLDER_CREATED == 0 ));
then
  git clone https://github.com/LivelyKernel/partsbin ./local_projects/LivelyKernel--partsbin
  echo "Downloaded up-to-date version of lively.nexts partsbin"
else
  cd local_projects
  if [ -d "LivelyKernel--partsbin" ];
  # `partsbin` exists, we need to update the repository, while preservering its local state.
  then
    echo "Found an existing lively.next partsbin"
    cd LivelyKernel--partsbin
    currentBranchName=$(git rev-parse --abbrev-ref HEAD)
    stashOutput=$(git stash)
    git checkout main
    git pull origin main --ff-only
    git checkout "$currentBranchName"
    # https://stackoverflow.com/a/12973694/4418325
    stashOutputWithoutWhiteSpace=$(echo "$stashOutput" | xargs)
    if [ "$stashOutputWithoutWhiteSpace" != "No local changes to save" ];
    then
      git stash pop
    fi
    echo "Updated existing lively.next partsbin"
    cd ..
  else
    # `partsbin` does not exist yet, we can just clone it.
    git clone https://github.com/LivelyKernel/partsbin LivelyKernel--partsbin
    echo "Downloaded up-to-date version of lively.nexts partsbin"
  fi
  cd ..
fi

node --no-experimental-fetch --no-warnings --experimental-loader $lv_next_dir/flatn/resolver.mjs \
     lively.installer/bin/install.cjs $PWD \

if [ "$1" = "--freezer-only" ];
then 
  exit
fi

if [ -z "${CI}" ];
then
  env CI=true npm --prefix $lv_next_dir/lively.freezer/ run build-landing-page
fi

env CI=true npm --prefix $lv_next_dir/lively.freezer/ run build-loading-screen
