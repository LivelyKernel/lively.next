#!/bin/bash
# Rasterize lively.app/assets/icon.svg into platform-specific icon bundles:
#   lively.app/assets/icon.icns  — macOS .app Contents/Resources/
#   lively.app/assets/icon.ico   — Windows .exe embedded icon
#   lively.app/assets/icon.png   — Linux / window title bar
#
# Hosts:
#   Linux  → rsvg-convert (librsvg2-bin) + png2icns (libicns-utils) +
#            ImageMagick `convert` (imagemagick)
#   macOS  → rsvg-convert (brew install librsvg) + iconutil (native) +
#            ImageMagick (brew install imagemagick)
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ASSETS="$APP_DIR/assets"
SVG="$ASSETS/icon.svg"
TMP="$ASSETS/.tmp-icons"

if [ ! -f "$SVG" ]; then
  echo "Source icon not found: $SVG"
  exit 1
fi

rm -rf "$TMP"
mkdir -p "$TMP"

SIZES="16 32 64 128 256 512 1024"

# ---- SVG → PNG (multiple sizes) -----------------------------------------
if command -v rsvg-convert >/dev/null; then
  for s in $SIZES; do
    rsvg-convert -w $s -h $s "$SVG" -o "$TMP/${s}.png"
  done
else
  echo "rsvg-convert not found — install librsvg2-bin (Linux) or librsvg (brew)"
  exit 1
fi

# ---- PNGs → macOS .icns -------------------------------------------------
if [ "$(uname -s)" = "Darwin" ] && command -v iconutil >/dev/null; then
  IS="$TMP/icon.iconset"
  mkdir -p "$IS"
  cp "$TMP/16.png"   "$IS/icon_16x16.png"
  cp "$TMP/32.png"   "$IS/icon_16x16@2x.png"
  cp "$TMP/32.png"   "$IS/icon_32x32.png"
  cp "$TMP/64.png"   "$IS/icon_32x32@2x.png"
  cp "$TMP/128.png"  "$IS/icon_128x128.png"
  cp "$TMP/256.png"  "$IS/icon_128x128@2x.png"
  cp "$TMP/256.png"  "$IS/icon_256x256.png"
  cp "$TMP/512.png"  "$IS/icon_256x256@2x.png"
  cp "$TMP/512.png"  "$IS/icon_512x512.png"
  cp "$TMP/1024.png" "$IS/icon_512x512@2x.png"
  iconutil -c icns "$IS" -o "$ASSETS/icon.icns"
  echo "Generated icon.icns via iconutil"
elif command -v png2icns >/dev/null; then
  # Linux path: png2icns only accepts specific sizes (16, 32, 48, 128, 256, 512, 1024)
  png2icns "$ASSETS/icon.icns" \
    "$TMP/16.png" "$TMP/32.png" "$TMP/128.png" \
    "$TMP/256.png" "$TMP/512.png" "$TMP/1024.png"
  echo "Generated icon.icns via png2icns"
else
  echo "No .icns generator found (iconutil on macOS, png2icns on Linux)"
fi

# ---- PNGs → Windows .ico ------------------------------------------------
if command -v magick >/dev/null; then
  magick "$TMP/16.png" "$TMP/32.png" "$TMP/64.png" \
    "$TMP/128.png" "$TMP/256.png" "$ASSETS/icon.ico"
  echo "Generated icon.ico via magick (ImageMagick 7)"
elif command -v convert >/dev/null; then
  convert "$TMP/16.png" "$TMP/32.png" "$TMP/64.png" \
    "$TMP/128.png" "$TMP/256.png" "$ASSETS/icon.ico"
  echo "Generated icon.ico via convert (ImageMagick 6)"
else
  echo "No .ico generator found (ImageMagick not installed)"
fi

# ---- PNG (Linux) --------------------------------------------------------
cp "$TMP/512.png" "$ASSETS/icon.png"

rm -rf "$TMP"
echo ""
echo "Generated:"
ls -lh "$ASSETS/icon."{icns,ico,png} 2>/dev/null || true
