#!/usr/bin/env bash

./scripts/test.sh lively.lang
./scripts/test.sh lively.resources
./scripts/test.sh lively.bindings
./scripts/test.sh lively.notifications
./scripts/test.sh lively.classes
./scripts/test.sh lively.serializer2
./scripts/test.sh lively.storage

./scripts/test.sh lively.ast
./scripts/test.sh lively.source-transform
./scripts/test.sh lively.vm
./scripts/test.sh lively.modules
./scripts/test.sh lively-system-interface

./scripts/test.sh lively.graphics
./scripts/test.sh lively.morphic
./scripts/test.sh lively.components
./scripts/test.sh lively.ide
./scripts/test.sh lively.halos

./scripts/test.sh lively.user
./scripts/test.sh lively.2lively
./scripts/test.sh lively.sync

./scripts/test.sh lively.changesets
./scripts/test.sh lively.git

./scripts/test.sh lively.server
./scripts/test.sh lively.shell

./scripts/test.sh lively.collab

# no tests:
# ./scripts/test.sh lively.traits
# ./scripts/test.sh lively.freezer
# ./scripts/test.sh lively.headless
# ./scripts/test.sh lively.keyboard
# ./scripts/test.sh lively.mirror
