#!/bin/bash
while [ "$#" -gt 0 ]; do
  case "$1" in
    --verbose) verbose="--verbose"; shift 1;;
    -*) echo "unknown option: $1" >&2; exit 1;;
  esac
done
node --no-warnings --experimental-import-meta-resolve ./tools/build.unified.mjs $verbose
