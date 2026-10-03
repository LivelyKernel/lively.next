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
if [ -n "${BUN_PATH:-}" ]; then
  if [ ! -x "$BUN_PATH" ]; then
    error "BUN_PATH is not executable: $BUN_PATH"
    exit 1
  fi
elif command -v bun >/dev/null 2>&1; then
  BUN_PATH=$(command -v bun)
elif [ -x "$HOME/.bun/bin/bun" ]; then
  BUN_PATH="$HOME/.bun/bin/bun"
else
  error "bun not found"
  print_bun_install_instructions
  exit 1
fi
bun_version=$("$BUN_PATH" --version)
if [ "$bun_version" != "1.4.2" ]; then
  error "Bun 1.4.2 is required (found $bun_version)"
  exit 1
fi
step "bun:   $bun_version"
export BUN_PATH

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

export PUPPETEER_CACHE_DIR="${PUPPETEER_CACHE_DIR:-$lv_next_dir/.puppeteer-browser-cache}"

section "Preparing directories"
mkdir -p snapshots esm_cache local_projects "$PUPPETEER_CACHE_DIR" 2>/dev/null

section "Installing packages"
if [ ! -f bun.lock ]; then
  error "bun.lock is required for a reproducible install"
  exit 1
fi
if ! "$BUN_PATH" install --frozen-lockfile; then
  error "Package installation failed"
  exit 1
fi

partsbin_dir="$lv_next_dir/local_projects/LivelyKernel--partsbin"
partsbin_seed="$lv_next_dir/lively.installer/assets/partsbin-seed"
if [ ! -e "$partsbin_dir" ]; then
  read -r partsbin_revision < "$partsbin_seed/revision"
  partsbin_staging=$(mktemp -d "$partsbin_dir.installing.XXXXXX")
  step "Provisioning partsbin at $partsbin_revision..."
  if ! git init --quiet "$partsbin_staging" ||
     ! git -C "$partsbin_staging" remote add origin https://github.com/LivelyKernel/partsbin.git ||
     ! git -C "$partsbin_staging" fetch --quiet --depth 1 origin "$partsbin_revision" ||
     ! git -C "$partsbin_staging" checkout --quiet --detach FETCH_HEAD; then
    rm -rf -- "$partsbin_staging"
    error "Partsbin checkout failed"
    exit 1
  fi
  cp "$partsbin_seed/package.json" "$partsbin_seed/bun.lock" "$partsbin_staging/"
  if ! mv "$partsbin_staging" "$partsbin_dir"; then
    rm -rf -- "$partsbin_staging"
    error "Partsbin checkout could not be installed"
    exit 1
  fi
  if ! node "$lv_next_dir/lively.project/package-install.mjs" "$partsbin_dir" ||
     ! node "$lv_next_dir/scripts/cache-browser-dependencies.mjs" "$partsbin_dir"; then
    rm -rf -- "$partsbin_dir"
    error "Partsbin dependency installation failed"
    exit 1
  fi
  step "Partsbin provisioned from its pinned seed"
else
  step "Leaving existing partsbin checkout unchanged"
  info "  Update it explicitly with lively.project/package-install.mjs --update."
fi

if ! node --experimental-import-meta-resolve lively.installer/install-with-node.js "$PWD"; then
  error "Lively setup failed"
  exit 1
fi

section "Building class runtime"
step "Compiling lively.classes runtime..."
if ! env CI=true "$BUN_PATH" run --cwd "$lv_next_dir/lively.classes" build; then
  error "Class runtime build failed"
  exit 1
fi
step "Class runtime built"

if [ "$1" = "--freezer-only" ];
then
  exit
fi

section "Installing Puppeteer browser"
step "Preparing Chrome for headless tests..."
node "$(node -p "require.resolve('puppeteer/install.mjs')")" || exit 1
node <<'NODE' || exit 1
const fs = require('fs');
const puppeteer = require('puppeteer');
const executable = puppeteer.executablePath();
if (!fs.existsSync(executable)) {
  throw new Error(`Puppeteer browser executable does not exist: ${executable}`);
}
console.log(`   Puppeteer Chrome ready at ${executable}`);
NODE

section "Building SWC plugin"
if ! rustup target list --installed | grep -q "^wasm32-wasip1$"; then
  step "Adding Rust target wasm32-wasip1..."
  rustup target add wasm32-wasip1 || exit 1
fi
step "Compiling WASM plugin..."
env CI=true "$BUN_PATH" run --cwd "$lv_next_dir/lively.freezer" build-swc-plugin || exit 1
step "SWC plugin built"

section "Building freezer bundles"
if [ -z "${CI}" ]; then
  step "Building unified bundle (landing page + loading screen)..."
  if ! env CI=true "$BUN_PATH" run --cwd "$lv_next_dir/lively.freezer" build-unified; then
    error "Freezer bundle build failed"
    exit 1
  fi
else
  step "Building loading screen..."
  if ! env CI=true "$BUN_PATH" run --cwd "$lv_next_dir/lively.freezer" build-loading-screen; then
    error "Loading screen build failed"
    exit 1
  fi
fi

if [ -d "$lv_next_dir/lively.app" ] && [ "$1" != "--no-desktop" ]; then
  section "Setting up lively.app desktop binary"
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
