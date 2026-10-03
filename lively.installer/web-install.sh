#!/usr/bin/env bash
set -e

LIVELY_NEXT_REPO="${LIVELY_NEXT_REPO:-https://github.com/LivelyKernel/lively.next.git}"
LIVELY_NEXT_VERSION="${LIVELY_NEXT_VERSION:-main}"
LIVELY_NEXT_DIR="${LIVELY_NEXT_DIR:-$PWD/lively.next}"

if [ -f "$PWD/package.json" ] && [ -d "$PWD/lively.installer" ]; then
  LIVELY_NEXT_DIR="$PWD"
elif [ -d "$LIVELY_NEXT_DIR/.git" ]; then
  git -C "$LIVELY_NEXT_DIR" fetch origin "$LIVELY_NEXT_VERSION"
  git -C "$LIVELY_NEXT_DIR" checkout "$LIVELY_NEXT_VERSION"
  git -C "$LIVELY_NEXT_DIR" pull --ff-only origin "$LIVELY_NEXT_VERSION"
else
  git clone --branch "$LIVELY_NEXT_VERSION" "$LIVELY_NEXT_REPO" "$LIVELY_NEXT_DIR"
fi

cd "$LIVELY_NEXT_DIR"
exec ./install.sh "$@"
