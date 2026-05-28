#!/bin/bash
# Downloads the NW.js SDK binary into the flatn package directory.
# Run this after `flatn install` if the nw postinstall failed
# (common because nw's JS decompression deps don't resolve in flatn layout).
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
NW_VERSION="${LIVELY_NW_VERSION:-0.111.1}"
FLAVOR="${LIVELY_NW_FLAVOR:-sdk}"
NW_DOWNLOAD_BASE="${LIVELY_NW_DOWNLOAD_BASE:-https://dl.nwjs.io/live-build/v0.111.1-04292210-39517e80d}"
PLATFORM="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

# Map to NW.js naming
case "$PLATFORM" in
  darwin) PLATFORM="osx" ;;
  linux)  PLATFORM="linux" ;;
  *)      echo "Unsupported platform: $PLATFORM"; exit 1 ;;
esac

case "$ARCH" in
  x86_64)  ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *)       echo "Unsupported arch: $ARCH"; exit 1 ;;
esac

NW_PKG_DIR="$ROOT_DIR/lively.next-node_modules/nw/${NW_VERSION}-${FLAVOR}"
NW_DIR_NAME="nwjs-${FLAVOR}-v${NW_VERSION}-${PLATFORM}-${ARCH}"
EXT="tar.gz"
[ "$PLATFORM" = "osx" ] && EXT="zip"
ARCHIVE="${NW_DIR_NAME}.${EXT}"
URL="${NW_DOWNLOAD_BASE}/${ARCHIVE}"
MARKER_FILE="$NW_PKG_DIR/.download-url"

if [ -x "$NW_PKG_DIR/$NW_DIR_NAME/nw" ] || [ -x "$NW_PKG_DIR/$NW_DIR_NAME/nwjs.app/Contents/MacOS/nwjs" ]; then
  if [ -f "$MARKER_FILE" ] && [ "$(cat "$MARKER_FILE")" = "$URL" ]; then
    echo "NW.js binary already present at $NW_PKG_DIR/$NW_DIR_NAME"
    exit 0
  fi
  echo "NW.js binary already present but download source changed; refreshing..."
  rm -rf "$NW_PKG_DIR/$NW_DIR_NAME"
fi

echo "Downloading NW.js SDK v${NW_VERSION} for ${PLATFORM}-${ARCH}..."
curl -L --progress-bar -o "/tmp/${ARCHIVE}" "$URL"

echo "Extracting to $NW_PKG_DIR..."
mkdir -p "$NW_PKG_DIR"
if [ "$EXT" = "tar.gz" ]; then
  tar xzf "/tmp/${ARCHIVE}" -C "$NW_PKG_DIR"
else
  unzip -q -o "/tmp/${ARCHIVE}" -d "$NW_PKG_DIR"
fi

rm "/tmp/${ARCHIVE}"
printf '%s\n' "$URL" > "$MARKER_FILE"
echo "NW.js SDK v${NW_VERSION} ready at $NW_PKG_DIR/$NW_DIR_NAME"
