#!/bin/bash


if [[ ! -d lively.server ]]; then
  echo -n "lively.next packages doesn't seem to be properly installed yet. Please run ./update.sh"
  exit 1;
fi

modules_dir=$PWD

cd lively.server;

node bin/start-server.js \
  -p 9011 --hostname 0.0.0.0 \
  --root-directory $modules_dir