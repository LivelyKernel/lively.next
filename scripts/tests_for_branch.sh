#!/bin/bash
# Include all reverse dependencies of changed workspace packages.
node "$(dirname "$0")/affected-tests.cjs"
