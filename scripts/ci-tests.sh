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
"lively.freezer"
"lively.headless"
"lively.keyboard"
"lively.mirror"
)

# For not entirely clear reasons, the lively.server dies due to a socket hangup
# when testing multiple packages consecutively on a hosted GitHub Actions runner.
# Restarting the server for each package to test solves this problem.
# We also tried starting it with nohup or outside of this script (in a separate action step), all to no success.
# lh 2022-01-19

if [ ! "$CI" ];
then
  if ss -lt | grep ':9011' > /dev/null; then
    echo "Found a running lively server that will be used for testing."
  else
    echo "No local lively server was found. Start one to run tests on."
    # start a new lively.next server
    ./start.sh > /dev/null 2>&1 &
    # wait until server is guaranteed to be running
    sleep 30 
  fi
fi

for package in "${testfiles[@]}"; do
  if [ "$CI" ]; 
  then
    # start a new lively.next server
    ./start.sh > /dev/null 2>&1 &
    # wait until server is guaranteed to be running
    sleep 30 
  fi
  node ./scripts/test.js "$package"
  # if we failed a test in `package`, remember it for when we are exiting
  if [ $? -eq 1 ];
  then TEST_STATUS=1
  fi
  if [ "$CI" ]; 
  then
    # kill the running server
    killall node
  fi
done

exit $TEST_STATUS