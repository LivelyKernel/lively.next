#!/usr/bin/env bash
set -euo pipefail

cd /workspace

# Keep generated dependency and cache directories in the bind-mounted checkout.
# This makes first-run work visible and reusable from the host while still
# allowing the image to provide all runtime tools.
mkdir -p \
  .puppeteer-browser-cache \
  custom-npm-modules \
  esm_cache \
  lively.next-node_modules \
  local_projects \
  snapshots \
  tmp

# Purpose: Seed a generated file from the repository default when it is absent.
# Args: $1 default source path, $2 target path in the bind-mounted checkout.
# Returns: 0 after copying or intentionally leaving the existing target alone.
seed_file() {
  local source="$1"
  local target="$2"

  if [ ! -e "$target" ] && [ -e "$source" ]; then
    cp "$source" "$target"
  fi
}

# Purpose: Ensure the server has the baseline config/assets expected by boot.
# Args: None.
# Returns: 0 after all seed files have been considered.
seed_defaults() {
  seed_file lively.installer/assets/config.js config.js
  seed_file lively.installer/assets/localconfig.js localconfig.js
  seed_file lively.morphic/assets/favicon.ico favicon.ico
}

# Purpose: Check whether a directory exists and contains at least one entry.
# Args: $1 directory path.
# Returns: 0 when the directory is non-empty, 1 otherwise.
has_entries() {
  local dir="$1"
  [ -d "$dir" ] && [ -n "$(find "$dir" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]
}

# Purpose: Decide whether the mounted checkout still needs the project install.
# Args: None.
# Returns: 0 when install artifacts are missing, 1 when startup can skip install.
needs_install() {
  # The install writes into host-visible ignored directories. Checking for the
  # dependency tree, class runtime, and freezer bundle keeps later container
  # starts fast without hiding broken or incomplete first-run state.
  if ! has_entries lively.next-node_modules; then
    return 0
  fi

  if [ ! -f lively.classes/build/runtime.js ]; then
    return 0
  fi

  if [ ! -d lively.freezer/loading-screen ]; then
    return 0
  fi

  return 1
}

seed_defaults

if needs_install; then
  echo "Installing lively.next dependencies and generated artifacts..."
  bash ./install.sh
else
  echo "Install artifacts found; skipping install."
fi

# Install can create or overwrite supporting assets, so seed once more before
# starting the server to make a fresh bind mount and a reused bind mount behave
# the same way.
seed_defaults

exec bash ./start-server.sh 9011
