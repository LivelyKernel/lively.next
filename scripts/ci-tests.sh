#!/bin/bash

TEST_STATUS=0

testfiles=(
"lively.lang"
"lively.resources"
"lively.bindings"
"lively.notifications"
"lively.classes"
"lively.serializer2"
"lively.storage"
"lively.ast"
"lively.source-transform"
"lively.vm"
"lively.modules"
"lively-system-interface"
"lively.graphics"
"lively.morphic"
"lively.components"
"lively.ide"
"lively.halos"
"lively.user"
"lively.2lively"
"lively.sync"
"lively.changesets"
"lively.git"
# "lively.server" needs separate test env as a node process
"lively.shell"
"lively.collab"
"lively.traits"
# "lively.freezer" cannot be loaded right now, kept around to harden the load mechanism of the test-runner
"lively.headless"
"lively.keyboard"
"lively.mirror"
)

for package in "${testfiles[@]}"; do
  # start a new lively.next server
  ./start.sh > /dev/null 2>&1 &
  # wait until server is guaranteed to be running
  sleep 30 
  node ./scripts/test.js "$package"
  # if we failed a test in `package`, remember it for when we are exiting
  if [ $? -eq 1 ];
  then TEST_STATUS=1
  fi
  # kill the running server
  killall node
done

exit $TEST_STATUS