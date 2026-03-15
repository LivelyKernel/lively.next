#!/bin/bash

# curl -so- https://raw.githubusercontent.com/LivelyKernel/lively.installer/main/web-install.sh | bash

lv_next_dir=$PWD

./scripts/node_version_checker.sh || exit 1

# --- Check external dependencies ---
echo "Checking external dependencies..."

# Check for bun (required for fast package install)
if command -v bun >/dev/null 2>&1; then
  export BUN_PATH=$(command -v bun)
  echo "  bun: $(bun --version) (${BUN_PATH})"
elif [ -f "$HOME/.bun/bin/bun" ]; then
  export BUN_PATH="$HOME/.bun/bin/bun"
  echo "  bun: $($BUN_PATH --version) (${BUN_PATH})"
else
  echo "  bun: NOT FOUND - using slow sequential flatn download"
  echo "        Install bun for ~50x faster installs: curl -fsSL https://bun.sh/install | bash"
fi

# Check for Rust toolchain (needed to build SWC plugin)
PREBUILT_WASM=$lv_next_dir/lively.freezer/swc-plugin/lively_swc_plugin.wasm
if command -v cargo >/dev/null 2>&1 && command -v rustup >/dev/null 2>&1; then
  echo "  rust: $(rustc --version 2>/dev/null || echo 'available')"
  if ! rustup target list --installed 2>/dev/null | grep -q "^wasm32-wasip1$"; then
    echo "        wasm32-wasip1 target not installed (will be added during build)"
  fi
elif [ -f "$PREBUILT_WASM" ]; then
  echo "  rust: not installed (using pre-built SWC WASM plugin)"
elif [ -n "${CI}" ]; then
  echo "  rust: not installed (CI will use pre-built plugin if available)"
else
  echo "  rust: NOT FOUND - required to build SWC plugin"
  echo "        Install Rust: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  echo "        Or ensure pre-built plugin exists at: $PREBUILT_WASM"
  exit 1
fi

echo ""

export PATH=$lv_next_dir:$lv_next_dir/flatn/bin:$PATH
export PUPPETEER_CACHE_DIR=$lv_next_dir/.puppeteer-browser-cache
export FLATN_PACKAGE_DIRS=
export FLATN_PACKAGE_COLLECTION_DIRS=$lv_next_dir/lively.next-node_modules
eval $(node -p 'let PWD=process.cwd();let packages = JSON.parse(require("fs").readFileSync(PWD+"/lively.installer/packages-config.json")).map(ea => require("path").join(PWD, ea.name));`export FLATN_DEV_PACKAGE_DIRS=${packages.join(":")}`')
mkdir lively.next-node_modules
mkdir snapshots
mkdir esm_cache
mkdir local_projects
mkdir .puppeteer-browser-cache
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

# set the options for all of the following node invocations
export NODE_OPTIONS="--no-warnings --experimental-modules --loader $lv_next_dir/flatn/resolver.mjs";

node lively.installer/install-with-node.js $PWD \

env CI=true npm --prefix $lv_next_dir/lively.classes/ run build

if [ "$1" = "--freezer-only" ];
then 
  exit
fi

# Build SWC plugin (Rust availability already checked above)
if [ -n "${CI}" ] && [ -f "$PREBUILT_WASM" ]; then
  echo "Pre-built SWC WASM plugin found, skipping build in CI."
elif command -v cargo >/dev/null 2>&1; then
  if ! rustup target list --installed | grep -q "^wasm32-wasip1$"; then
    echo "Installing Rust target wasm32-wasip1..."
    rustup target add wasm32-wasip1 || exit 1
  fi
  echo "Building lively.freezer SWC plugin..."
  env CI=true npm --prefix $lv_next_dir/lively.freezer/ run build-swc-plugin || exit 1
else
  echo "Using pre-built SWC WASM plugin."
fi

if [ -z "${CI}" ];
then
  echo "Building lively.freezer via unified SWC pipeline..."
  env CI=true npm --prefix $lv_next_dir/lively.freezer/ run build-unified
else
  echo "Building lively.freezer loading screen via SWC pipeline..."
  env CI=true npm --prefix $lv_next_dir/lively.freezer/ run build-loading-screen
fi
