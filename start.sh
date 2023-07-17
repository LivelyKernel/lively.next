#!/bin/bash

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
  bash "$START_SCRIPT_PATH" "$1"
  sleep 1
done
