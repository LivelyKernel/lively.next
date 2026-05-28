#!/bin/bash

# curl -so- https://raw.githubusercontent.com/LivelyKernel/lively.installer/main/web-install.sh | bash

lv_next_dir=$PWD

# ── Logging helpers ──
ORANGE='\033[1;38;5;208m'
NC='\033[0m'
section()  { echo ""; echo -e "${ORANGE}── $1 ──${NC}"; }
step()     { echo "   $1"; }
info()     { echo "   $1"; }
success()  { echo "   $1  done"; }
warn()     { echo "   [!] $1"; }
error()    { echo "   [ERROR] $1"; }

print_bun_install_instructions() {
  info "  Bun is required for supported installs."
  info "  Install Bun with:"
  info "    curl -fsSL https://bun.sh/install | bash"
  info "  Then restart your terminal and verify with:"
  info "    bun --version"
}

print_rust_install_instructions() {
  info "  Rust is required for supported installs."
  if [ "$(uname -s)" = "Darwin" ]; then
    info "  On macOS, install the Apple command line tools first:"
    info "    xcode-select --install"
  fi
  info "  Install Rust with:"
  info "    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  info "  Then restart your terminal and verify with:"
  info "    rustc --version"
  info "    cargo --version"
}

echo ""
echo "lively.next installer"
echo "====================="

# ── Check node version ──
./scripts/node_version_checker.sh || exit 1

section "Checking dependencies"
step "node:  $(node --version)"

# Check for bun (required for supported package install)
if command -v bun >/dev/null 2>&1; then
  export BUN_PATH=$(command -v bun)
  step "bun:   $(bun --version)"
elif [ -x "$HOME/.bun/bin/bun" ]; then
  export BUN_PATH="$HOME/.bun/bin/bun"
  export PATH="$HOME/.bun/bin:$PATH"
  step "bun:   $($BUN_PATH --version)"
else
  error "bun not found"
  print_bun_install_instructions
  exit 1
fi

# Check for Rust toolchain (needed to build SWC plugin)
if command -v cargo >/dev/null 2>&1 && command -v rustc >/dev/null 2>&1 && command -v rustup >/dev/null 2>&1; then
  step "rust:  $(rustc --version 2>/dev/null | sed 's/rustc //')"
  if ! rustup target list --installed 2>/dev/null | grep -q "^wasm32-wasip1$"; then
    info "  wasm32-wasip1 target will be added during build"
  fi
else
  error "Rust toolchain not found"
  print_rust_install_instructions
  exit 1
fi

export PATH=$lv_next_dir:$lv_next_dir/flatn/bin:$PATH
export PUPPETEER_CACHE_DIR=$lv_next_dir/.puppeteer-browser-cache
export FLATN_PACKAGE_DIRS=
export FLATN_PACKAGE_COLLECTION_DIRS=$lv_next_dir/lively.next-node_modules
eval $(node -p 'let PWD=process.cwd();let packages = JSON.parse(require("fs").readFileSync(PWD+"/lively.installer/packages-config.json")).map(ea => require("path").join(PWD, ea.name));`export FLATN_DEV_PACKAGE_DIRS=${packages.join(":")}`')

section "Preparing directories"
mkdir -p lively.next-node_modules snapshots esm_cache local_projects .puppeteer-browser-cache 2>/dev/null

# Partsbin setup
if [ ! -d "local_projects/LivelyKernel--partsbin" ]; then
  step "Cloning partsbin..."
  git clone --quiet https://github.com/LivelyKernel/partsbin ./local_projects/LivelyKernel--partsbin
  step "Partsbin downloaded"
else
  step "Updating partsbin..."
  cd local_projects/LivelyKernel--partsbin
  currentBranchName=$(git rev-parse --abbrev-ref HEAD)
  stashOutput=$(git stash 2>/dev/null)
  git checkout main --quiet 2>/dev/null
  git pull origin main --ff-only --quiet 2>/dev/null
  git checkout "$currentBranchName" --quiet 2>/dev/null
  stashOutputWithoutWhiteSpace=$(echo "$stashOutput" | xargs)
  if [ "$stashOutputWithoutWhiteSpace" != "No local changes to save" ]; then
    git stash pop --quiet 2>/dev/null
  fi
  cd ../..
  step "Partsbin up to date"
fi

# set the options for all of the following node invocations
export NODE_OPTIONS="--no-warnings --experimental-modules --loader $lv_next_dir/flatn/resolver.mjs";

section "Installing packages"
node lively.installer/install-with-node.js $PWD \

section "Building class runtime"
step "Compiling lively.classes runtime..."
env CI=true npm --silent --prefix $lv_next_dir/lively.classes/ run build
step "Class runtime built"

if [ "$1" = "--freezer-only" ];
then
  exit
fi

section "Building SWC plugin"
if ! rustup target list --installed | grep -q "^wasm32-wasip1$"; then
  step "Adding Rust target wasm32-wasip1..."
  rustup target add wasm32-wasip1 || exit 1
fi
step "Compiling WASM plugin..."
env CI=true npm --silent --prefix $lv_next_dir/lively.freezer/ run build-swc-plugin || exit 1
step "SWC plugin built"

section "Building freezer bundles"
if [ -z "${CI}" ]; then
  step "Building unified bundle (landing page + loading screen)..."
  env CI=true npm --silent --prefix $lv_next_dir/lively.freezer/ run build-unified
else
  step "Building loading screen..."
  env CI=true npm --silent --prefix $lv_next_dir/lively.freezer/ run build-loading-screen
fi

if [ -d "$lv_next_dir/lively.app" ] && [ "$1" != "--no-desktop" ]; then
  section "Setting up lively.app desktop binary"
  # The `nw` npm package's postinstall can't decompress through flatn's flat
  # layout, so we download the NW.js SDK directly.
  if bash "$lv_next_dir/lively.app/setup.sh"; then
    step "NW.js SDK ready (launch the desktop app with: bash lively.app/start.sh)"
  else
    warn "lively.app setup failed — the web server still works, but the desktop app won't launch"
  fi
fi

echo ""
echo "Done! Start the server with ./start-server.sh"
echo "Or launch the desktop app with ./lively.app/start.sh"
echo ""
