#!/bin/bash
./scripts/node_version_checker.sh || exit 1

if [[ ! -d lively.server ]]; then
  echo -n "lively.next packages do not seem to be properly installed yet. Please run ./install.sh"; echo;
  exit 1;
fi

lv_next_dir=$PWD

config_file="$lv_next_dir/config.js"
if [ ! -f "$config_file" ]; then
  config_file="$lv_next_dir/lively.installer/assets/config.js"
fi

cd "$lv_next_dir/lively.server" || exit 1

options=(
  --no-warnings
  --dns-result-order ipv4first
  --experimental-import-meta-resolve
  bin/start-server.js
  --root-directory "$lv_next_dir"
  --config "$config_file"
)

if [ "$1" = "--debug" ]; then
  options=(--inspect "${options[@]}")
  port="${2:-}"
else
  port="${1:-}"
fi
if [ -n "$port" ]; then
  options+=(--port "$port")
fi

# https://stackoverflow.com/a/5947802/4418325 for colored output.
RED='\033[0;31m'
NC='\033[0m'
# https://stackoverflow.com/a/677212/4418325 for POSIX compliant check if executable exists.
if command -v entr &> /dev/null
then
  export ENTR_SUPPORT=1
else
  export ENTR_SUPPORT=0
  echo -e "${RED}\`entr\` is not installed. Hot-reloading of files changed outside of \`lively.next\` will be disabled.${NC}"
fi
node "${options[@]}"
