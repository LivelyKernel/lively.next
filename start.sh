#!/bin/bash

# See https://stackoverflow.com/a/31443098/4418325.
while [ "$#" -gt 0 ]; do
  case "$1" in
    -p) port="$2"; shift 2;;
    -d) debug="--debug"; shift 1;;

    --port=*) port="${1#*=}"; shift 1;;
    --debug) debug="--debug"; shift 1;;
    
    -*) echo "unknown option: $1" >&2; exit 1;;
  esac
done

./scripts/node_version_checker.sh || exit 1

# The path to your start.sh script
START_SCRIPT_PATH="./start-server.sh"

# This function is called when the script receives a SIGTERM signal
handle_sigterm() {
  echo "Received SIGTERM, will restart"
}

# This function is called when the script receives a SIGINT signal (Ctrl+C)
handle_sigint() {
  echo "Received SIGINT, will exit"
  exit 1
}

# Trap SIGTERM and SIGINT signals, and specify the functions to handle them
trap 'handle_sigterm' SIGTERM
trap 'handle_sigint' SIGINT

while true
do
  bash "$START_SCRIPT_PATH" "$debug" "$port"
  sleep 1
done
