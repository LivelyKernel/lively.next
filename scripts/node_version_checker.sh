#!/bin/bash

NODE_VERSION=$(node -v)
NODE_VERSION=$(echo "$NODE_VERSION" | sed -En 's/v([0-9]+)\..*/\1/p')

if [[ $NODE_VERSION -lt 18 ]]; then
  echo -n "Your node version is not supported. Please use node 18.X"; echo;
  exit 1;
fi

if [[ $NODE_VERSION -ge 19 ]]; then
  echo -n 'Your node version is not supported. Please use node 18.X.'; echo;
  exit 1;
fi
