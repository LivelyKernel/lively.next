#!/bin/bash
./scripts/node_version_checker.sh || exit 1

if [[ ! -d lively.server ]]; then
  echo -n "lively.next packages do not seem to be properly installed yet. Please run ./install.sh"; echo;
  exit 1;
fi

lv_next_dir=$PWD

. $lv_next_dir/scripts/lively-next-env.sh
lively_next_env $lv_next_dir

cd lively.server;

options="--no-warnings --dns-result-order ipv4first \
         --experimental-loader $lv_next_dir/flatn/resolver.mjs \
         bin/start-server.js \
         --root-directory $lv_next_dir \
         --config $lv_next_dir/config.js"

if [ "$1" = "--debug" ]; then
  options="--inspect $options"
fi

if [ "$1" != "--debug" ] && [ -n "$1" ]; then
  options="$options --port $1"
fi

if [ -n "$2" ]; then
  options="$options --port $2"
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
node $options
