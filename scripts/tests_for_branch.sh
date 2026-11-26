#!/bin/bash
# Select changed packages, including top-level lively packages with tests outside the workspaces,
# and all workspace packages that depend on them (see affected-tests.cjs).
node "$(dirname "$0")/affected-tests.cjs"
