#!/bin/bash

debug=''
trap './start-server.sh "$debug"' TERM
if [ "$1" = "--debug" ]; then
  debug='--debug'
  ./start-server.sh --debug
fi
./start-server.sh