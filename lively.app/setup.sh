#!/bin/bash
# Downloads the NW.js SDK binary into the flatn package directory.
# Run this after `flatn install` if the nw postinstall failed
# (common because nw's JS decompression deps don't resolve in flatn layout).
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
NW_VERSION="0.110.1"
FLAVOR="sdk"
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

if [ -x "$NW_PKG_DIR/$NW_DIR_NAME/nw" ] || [ -x "$NW_PKG_DIR/$NW_DIR_NAME/nwjs.app/Contents/MacOS/nwjs" ]; then
  echo "NW.js binary already present at $NW_PKG_DIR/$NW_DIR_NAME"
  exit 0
fi

EXT="tar.gz"
[ "$PLATFORM" = "osx" ] && EXT="zip"

ARCHIVE="${NW_DIR_NAME}.${EXT}"
URL="https://dl.nwjs.io/v${NW_VERSION}/${ARCHIVE}"

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
echo "NW.js SDK v${NW_VERSION} ready at $NW_PKG_DIR/$NW_DIR_NAME"
