#!/bin/bash
# Build a standalone, double-clickable lively.next desktop app.
#
# Produces a self-contained directory (and optional .tar.gz) that runs on any
# machine without requiring the monorepo, nvm, or any PATH setup.
#
# Bundle layout:
#   dist/lively.next-<platform>-<arch>/
#     nw                       NW.js binary (entrypoint)
#     lib/*, *.pak, ...        NW.js runtime files
#     package.json             NW.js manifest (derived from lively.app/package.json)
#     boot.html                Loading screen
#     desktop/                 start-server.cjs + watchdog.cjs + server-config.js
#     app/                     Monorepo content needed at runtime
#     node/bin/node            Standalone Node.js (for the server child process)
#     lively-next.desktop      Linux application launcher
#     launch.sh                Cross-platform launcher shim

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ROOT_DIR="$(cd "$APP_DIR/.." && pwd)"
NW_VERSION="0.110.1"
NODE_VERSION="25.6.1"

PLATFORM="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$PLATFORM" in darwin) PLATFORM="osx" ;; esac
case "$ARCH"     in x86_64) ARCH="x64" ;; aarch64|arm64) ARCH="arm64" ;; esac

# Use Normal build for distribution (smaller, no DevTools overhead).
# Override to "sdk" with FLAVOR=sdk env var for debug builds.
FLAVOR="${FLAVOR:-normal}"
BUNDLE_NAME="lively.next-${PLATFORM}-${ARCH}"
DIST_DIR="$ROOT_DIR/dist"
BUNDLE="$DIST_DIR/$BUNDLE_NAME"

ORANGE='\033[1;38;5;208m'
NC='\033[0m'
section() { echo ""; echo -e "${ORANGE}── $1 ──${NC}"; }
step() { echo "   $1"; }

section "Preparing bundle dir: $BUNDLE"
rm -rf "$BUNDLE"
mkdir -p "$BUNDLE"

# ---------------------------------------------------------------------------
# 1. NW.js runtime
# ---------------------------------------------------------------------------
section "Fetching NW.js ${FLAVOR} v${NW_VERSION} for ${PLATFORM}-${ARCH}"

NW_DIR_NAME="nwjs${FLAVOR:+-$FLAVOR}-v${NW_VERSION}-${PLATFORM}-${ARCH}"
# Normal flavor tarball is named "nwjs-vX-..." without the "-normal" infix
if [ "$FLAVOR" = "normal" ]; then
  NW_DIR_NAME="nwjs-v${NW_VERSION}-${PLATFORM}-${ARCH}"
fi
NW_CACHE="$ROOT_DIR/lively.next-node_modules/nw/${NW_VERSION}-${FLAVOR}"
NW_EXTRACTED="$NW_CACHE/$NW_DIR_NAME"

if [ ! -d "$NW_EXTRACTED" ]; then
  step "Downloading NW.js tarball..."
  mkdir -p "$NW_CACHE"
  EXT="tar.gz"; [ "$PLATFORM" = "osx" ] && EXT="zip"
  [ "$PLATFORM" = "win" ] && EXT="zip"
  URL="https://dl.nwjs.io/v${NW_VERSION}/${NW_DIR_NAME}.${EXT}"
  curl -L --progress-bar -o "/tmp/${NW_DIR_NAME}.${EXT}" "$URL"
  if [ "$EXT" = "tar.gz" ]; then
    tar xzf "/tmp/${NW_DIR_NAME}.${EXT}" -C "$NW_CACHE"
  else
    unzip -q -o "/tmp/${NW_DIR_NAME}.${EXT}" -d "$NW_CACHE"
  fi
  rm "/tmp/${NW_DIR_NAME}.${EXT}"
fi

step "Copying NW.js runtime into bundle..."
cp -r "$NW_EXTRACTED"/* "$BUNDLE/"

# Chromium ships ~50 locale .pak files (~120MB). Keep only what the user wants.
# Override with LOCALES="en-US fr de" etc. Set LOCALES=all to keep everything.
LOCALES="${LOCALES:-en-US}"
if [ "$LOCALES" != "all" ] && [ -d "$BUNDLE/locales" ]; then
  step "Stripping locales (keeping: $LOCALES)..."
  cd "$BUNDLE/locales"
  for f in *; do
    keep=0
    for want in $LOCALES; do
      case "$f" in
        "${want}.pak"|"${want}.pak.info") keep=1 ;;
      esac
    done
    [ $keep -eq 0 ] && rm -f "$f"
  done
  cd "$ROOT_DIR"
fi

# ---------------------------------------------------------------------------
# 2. Standalone Node.js (for the server subprocess)
# ---------------------------------------------------------------------------
section "Fetching standalone Node.js v${NODE_VERSION}"

NODE_ARCHIVE_BASE="node-v${NODE_VERSION}-${PLATFORM}-${ARCH}"
# Node's Linux tarballs use "linux" not "osx"; macOS uses "darwin"
NODE_PLATFORM="$PLATFORM"
[ "$PLATFORM" = "osx" ] && NODE_PLATFORM="darwin"
NODE_ARCHIVE="node-v${NODE_VERSION}-${NODE_PLATFORM}-${ARCH}"
NODE_CACHE="$ROOT_DIR/dist/.node-cache/${NODE_VERSION}-${NODE_PLATFORM}-${ARCH}"

if [ ! -x "$NODE_CACHE/bin/node" ]; then
  step "Downloading Node.js binary..."
  mkdir -p "$NODE_CACHE"
  EXT="tar.xz"; [ "$PLATFORM" = "win" ] && EXT="zip"
  URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_ARCHIVE}.${EXT}"
  curl -L --progress-bar -o "/tmp/${NODE_ARCHIVE}.${EXT}" "$URL"
  tar xJf "/tmp/${NODE_ARCHIVE}.${EXT}" -C "$NODE_CACHE" --strip-components=1
  rm "/tmp/${NODE_ARCHIVE}.${EXT}"
fi

step "Copying Node.js binary into bundle..."
mkdir -p "$BUNDLE/node/bin"
cp "$NODE_CACHE/bin/node" "$BUNDLE/node/bin/node"

# ---------------------------------------------------------------------------
# 3. App manifest + desktop/ scripts + boot.html
# ---------------------------------------------------------------------------
section "Copying app manifest and scripts"

# Use lively.app's package.json as the NW.js manifest, but with:
#   - main: boot.html (at bundle root, not desktop/boot.html)
#   - node-main: desktop/start-server.cjs
#   - remove dependencies / devDependencies / exports (bundle doesn't need flatn)
node - <<EOF > "$BUNDLE/package.json"
const pj = JSON.parse(require('fs').readFileSync("$APP_DIR/package.json", 'utf8'));
delete pj.dependencies;
delete pj.exports;
delete pj.scripts;
pj.main = 'boot.html';
pj['node-main'] = 'desktop/start-server.cjs';
console.log(JSON.stringify(pj, null, 2));
EOF

cp "$APP_DIR/desktop/boot.html" "$BUNDLE/boot.html"
mkdir -p "$BUNDLE/desktop"
cp "$APP_DIR/desktop/start-server.cjs" "$BUNDLE/desktop/"
cp "$APP_DIR/desktop/watchdog.cjs"     "$BUNDLE/desktop/"
cp "$APP_DIR/desktop/server-config.js" "$BUNDLE/desktop/"

# ---------------------------------------------------------------------------
# 4. Monorepo content (→ bundle/app/)
# ---------------------------------------------------------------------------
section "Copying lively.next source + node_modules into bundle/app/"

APP_SRC="$BUNDLE/app"
mkdir -p "$APP_SRC"

# Use rsync to copy with excludes. Things we DON'T want in the bundle:
#   - .git, .claude, node's build cache, esm_cache, tmp, etc.
#   - nw package (NW.js is already at bundle root)
#   - swc-plugin/target (540MB Rust build artifacts)
#   - swc-plugin source (we only need the built .wasm)
#   - lively.next-node_modules/nw-* (NW.js duplication)
#   - lively.headless chrome-data-dir (runtime cache)
#   - dist/ (recursion!)
# Strip wrong-platform native bindings from node_modules. Each prebuilt
# binding is 30-300MB — huge win on any given target platform.
NATIVE_EXCLUDES=()
case "$PLATFORM-$ARCH" in
  linux-x64)
    NATIVE_EXCLUDES+=(
      '@swc__SLASH__core-darwin-arm64/'
      '@swc__SLASH__core-darwin-x64/'
      '@swc__SLASH__core-linux-arm64-gnu/'
      '@swc__SLASH__core-linux-arm64-musl/'
      '@swc__SLASH__core-win32-x64-msvc/'
      '@rollup__SLASH__rollup-darwin-arm64/'
      '@rollup__SLASH__rollup-darwin-x64/'
      '@rollup__SLASH__rollup-linux-arm64-*/'
      '@rollup__SLASH__rollup-win32-*/'
    ) ;;
  osx-arm64|darwin-arm64)
    NATIVE_EXCLUDES+=(
      '@swc__SLASH__core-linux-*/'
      '@swc__SLASH__core-darwin-x64/'
      '@swc__SLASH__core-win32-x64-msvc/'
      '@rollup__SLASH__rollup-linux-*/'
      '@rollup__SLASH__rollup-darwin-x64/'
      '@rollup__SLASH__rollup-win32-*/'
    ) ;;
esac

step "Syncing monorepo (this may take a minute)..."
EXCLUDES=(
  # Anchored (root-relative) excludes — avoid stripping legit nested dirs
  # like systemjs/0.21.6/dist/ which IS the package source.
  --exclude='/.git/'
  --exclude='/.claude/'
  --exclude='/.github/'
  --exclude='/dist/'
  --exclude='/esm_cache/'
  --exclude='/tmp/'
  --exclude='/.module_cache/'
  --exclude='/local_projects/'
  # Only strip top-level node_modules (if any); leave lively.next-node_modules alone
  --exclude='/node_modules/'
  --exclude='**/.cachedImportMap.json'
  # Rust build artifacts (SWC plugin is already compiled to .wasm)
  --exclude='/lively.freezer/swc-plugin/target/'
  --exclude='/lively.freezer/swc-plugin/src/'
  --exclude='/lively.freezer/swc-plugin/Cargo.*'
  # NW.js duplication (we copy the binary separately at bundle root)
  --exclude='/lively.next-node_modules/nw/'
  # Puppeteer — desktop bundle excludes plugins that need it
  --exclude='/lively.next-node_modules/puppeteer*/'
  --exclude='/lively.next-node_modules/@puppeteer*/'
  # Strip lively.headless' chrome data cache (runtime), but keep its sources
  # — the server's library-snapshot step tars the package directory.
  --exclude='/lively.headless/chrome-data-dir/'
  # Dev artifacts
  --exclude='/lively.app/dist/'
  --exclude='/lively.app/boot.log'
  # Tests/examples/docs inside dependencies (these ARE safe to match anywhere
  # inside lively.next-node_modules because those are the package sources).
  --exclude='lively.next-node_modules/**/test/'
  --exclude='lively.next-node_modules/**/tests/'
  --exclude='lively.next-node_modules/**/__tests__/'
  --exclude='lively.next-node_modules/**/example/'
  --exclude='lively.next-node_modules/**/examples/'
  --exclude='lively.next-node_modules/**/docs/'
  --exclude='lively.next-node_modules/**/*.md'
  --exclude='lively.next-node_modules/**/*.markdown'
  --exclude='lively.next-node_modules/**/*.map'
  --exclude='lively.next-node_modules/**/.bin/'
  --exclude='lively.next-node_modules/**/CHANGELOG*'
)
for pattern in "${NATIVE_EXCLUDES[@]}"; do
  EXCLUDES+=(--exclude="lively.next-node_modules/$pattern")
done

rsync -a --delete "${EXCLUDES[@]}" "$ROOT_DIR/" "$APP_SRC/"

# ---------------------------------------------------------------------------
# 5. Launcher scripts + .desktop file
# ---------------------------------------------------------------------------
section "Creating launchers"

# Cross-platform shim launcher. Users who prefer to run from a terminal can
# execute this directly; it exec's the NW.js binary on itself.
cat > "$BUNDLE/launch.sh" <<'EOF'
#!/bin/bash
BUNDLE_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ "$(uname -s)" = "Darwin" ]; then
  exec "$BUNDLE_DIR/nwjs.app/Contents/MacOS/nwjs" "$BUNDLE_DIR"
else
  exec "$BUNDLE_DIR/nw" "$BUNDLE_DIR"
fi
EOF
chmod +x "$BUNDLE/launch.sh"

if [ "$PLATFORM" = "linux" ]; then
  # A freedesktop .desktop file. Users can either double-click it in their
  # file manager (most GNOME/KDE file managers support this) or copy it to
  # ~/.local/share/applications/ to get a menu entry + icon.
  cat > "$BUNDLE/lively-next.desktop" <<EOF
[Desktop Entry]
Type=Application
Version=1.0
Name=lively.next
Comment=Live, interactive development environment
Exec=%k/../launch.sh
Icon=%k/../icon.png
Terminal=false
Categories=Development;IDE;
StartupWMClass=lively.next
EOF
  chmod +x "$BUNDLE/lively-next.desktop"

  # Placeholder icon (user can replace). Without %k, Exec= uses an absolute
  # path after install. For in-place double-clicking we rely on the user
  # having the bundle extracted where they want it.
  if [ ! -f "$BUNDLE/icon.png" ] && [ -f "$APP_DIR/icon.png" ]; then
    cp "$APP_DIR/icon.png" "$BUNDLE/icon.png"
  fi
fi

# ---------------------------------------------------------------------------
# 6. Report
# ---------------------------------------------------------------------------
section "Bundle complete"
step "Location: $BUNDLE"
step "Size:     $(du -sh "$BUNDLE" | cut -f1)"
step ""
step "Run:"
step "  $BUNDLE/launch.sh     # terminal-friendly"
if [ "$PLATFORM" = "linux" ]; then
  step "  double-click $BUNDLE/lively-next.desktop from your file manager"
fi

if [ "${PACK:-}" = "1" ]; then
  step ""
  step "Packing tar.gz..."
  tar czf "$DIST_DIR/${BUNDLE_NAME}.tar.gz" -C "$DIST_DIR" "$BUNDLE_NAME"
  step "Archive: $DIST_DIR/${BUNDLE_NAME}.tar.gz ($(du -sh "$DIST_DIR/${BUNDLE_NAME}.tar.gz" | cut -f1))"
fi
