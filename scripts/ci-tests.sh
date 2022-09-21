#!/bin/bash
# This script is used by the CI test running pipeline.
# It executes all tests present in the test folders of the packages specified in `testfiles`.
# It is not possible to run only some selected packages (only when modifying the below array).
# For Linux systems, this script requires `ss` to run. On Mac, netstat is required instead.
# On mac, make sure to habe `gsed` installed.

TESTED_PACKAGES=0
GREEN_TESTS=0
RED_TESTS=0
SKIPPED_TESTS=0

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
"lively.changesets"
"lively.git"
"lively.server"
"lively.shell"
"lively.collab"
"lively.traits" 
"lively.freezer"
"lively.headless"
"lively.keyboard"
)

# For not entirely clear reasons, the lively.server dies due to a socket hangup
# when testing multiple packages consecutively on a hosted GitHub Actions runner.
# Restarting the server for each package to test solves this problem.
# We also tried starting it with nohup or outside of this script (in a separate action step), all to no success.
# lh 2022-01-19

if [ ! "$CI" ];
then
  if uname | grep 'Linux' > /dev/null; then
    ACTIVE_PORTS=$(ss -lt)
  elif uname | grep 'Darwin' > /dev/null; then
    ACTIVE_PORTS=$(netstat -tunlp tcp)
  else 
    cat "Only MacOS and Linux are supported at the moment."
    exit 1
  fi

  if grep -E '(:9011|.9011)' > /dev/null <<< "$ACTIVE_PORTS"; then
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
  ((TESTED_PACKAGES++))
  if [ "$CI" ]; 
  then
    # start a new lively.next server
    ./start.sh > /dev/null 2>&1 &
    # wait until server is guaranteed to be running
    sleep 30 
  fi
  # echo output without the summary stats
  output=$(node --dns-result-order ipv4first ./scripts/test.js "$package")
  
  if uname | grep 'Linux' > /dev/null; then
    echo "$output" | sed -s -e 's/SUMMARY.*$//g'
  elif uname | grep 'Darwin' > /dev/null; then
    echo "$output" | gsed -s -e 's/SUMMARY.*$//g'
   else 
    cat "Only MacOS and Linux are supported at the moment."
    exit 1
  fi

  #parse summary parts and adjust env variables for overall stats
  # For perl magic see: https://stackoverflow.com/a/16658690
  green=$(echo "$output" | perl -nle'print $& while m{(?<=SUMMARY-passed:)\d+}g')
  red=$(echo "$output" | perl -nle'print $& while m{(?<=SUMMARY-failed:)\d+}g')
  skipped=$(echo "$output" | perl -nle'print $& while m{(?<=SUMMARY-skipped:)\d+}g')
  ((GREEN_TESTS+=green))
  ((RED_TESTS+=red))
  ((SKIPPED_TESTS+=skipped))

  if [ "$CI" ]; 
  then
    # kill the running server
    killall node
  fi
done

# print out summary statistics
read -r -d '' SUMMARY << EOM
███████ ██    ██ ███    ███ ███    ███  █████  ██████  ██    ██ 
██      ██    ██ ████  ████ ████  ████ ██   ██ ██   ██  ██  ██  
███████ ██    ██ ██ ████ ██ ██ ████ ██ ███████ ██████    ████   
     ██ ██    ██ ██  ██  ██ ██  ██  ██ ██   ██ ██   ██    ██    
███████  ██████  ██      ██ ██      ██ ██   ██ ██   ██    ██    
                                                                
                                                                
EOM
echo "$SUMMARY"
((ALL_TESTS=GREEN_TESTS + RED_TESTS + SKIPPED_TESTS))
echo "Executed $ALL_TESTS tests in $TESTED_PACKAGES packages."
((GREEN_PERCENTAGES=GREEN_TESTS*100/ALL_TESTS))
((RED_PERCENTAGES=RED_TESTS*100/ALL_TESTS))
((SKIPPED_PERCENTAGES=SKIPPED_TESTS*100/ALL_TESTS))
echo "✅ $GREEN_TESTS (≈$GREEN_PERCENTAGES %) passed."
echo "❌ $RED_TESTS (≈$RED_PERCENTAGES %) failed."
echo "⏩ $SKIPPED_TESTS (≈$SKIPPED_PERCENTAGES %) skipped."
if ((RED_TESTS > 0 || ALL_TESTS == 0)); 
then
  exit 1
else 
  exit 0
fi
