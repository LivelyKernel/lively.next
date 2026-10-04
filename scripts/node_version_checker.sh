#!/bin/bash

NODE_VERSION=$(node -v)
if [ "$NODE_VERSION" != "v24.20.0" ]; then
  echo "Your node version is not supported. Please use Node.js 24.20.0 (found $NODE_VERSION)."
  exit 1
fi
