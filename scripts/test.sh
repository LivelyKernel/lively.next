#!/bin/bash
# This script can be used to run tests outside of a lively.next environment. It is used for the CI pipelines for lively.next and its projects.
# It either executes all tests present in the test folders of the packages specified in `testfiles` (defaulting to all lively core packages),
# or all tests in the single package given as a parameter when executing this script.
# It is not possible to run multiple explicitly specified packages (except when modifying the below array).
# As this script supports either running locally or inside of a GitHub Action environment, this leaves us with four cases:
# (1) Testing the lively core a) in CI b) locally or (1) Testing one specific package a) in CI or b) locally.
# In case (1), we provicde some summary statistics at the end of our test run.
# In the cases a) we add some GitHub Actions output formatting hints as well as providing markdown to be rendered in the summary section of the action run.
# See https://github.blog/2022-05-09-supercharging-github-actions-with-job-summaries/ for further information.
# In cases b), we provide more lean, human readable output meant for reading consumtion in a shell. 
# For Linux systems, this script requires `ss` to run. On Mac, netstat is required instead.
# On mac, make sure to have `gsed` installed.

TESTED_PACKAGES=0
GREEN_TESTS=0
RED_TESTS=0
SKIPPED_TESTS=0
STARTED_SERVER=0

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

if [ "$1" ];
then
  testfiles=("$1" )
else
  if [ "$CI" ];
  then
    echo '# Tests for `lively.next` 🧪' >> "$GITHUB_STEP_SUMMARY"
  fi
fi

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
    STARTED_SERVER=1
    echo "No local lively server was found. Starting a server to run tests on."
    # start a new lively.next server
    ./start-server.sh > /dev/null 2>&1 &
    # wait until server is guaranteed to be running
    sleep 30 
  fi
fi

for package in "${testfiles[@]}"; do
  ((TESTED_PACKAGES++))
  if [ "$CI" ]; 
  then
    # start a new lively.next server
    ./start-server.sh > /dev/null 2>&1 &
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

  if [ "$CI" ] || [ "$STARTED_SERVER" = "1" ]; 
  then
    pkill start.sh
    pkill -f lively
  fi
done

if [ ! "$1" ];
then
  ((ALL_TESTS=GREEN_TESTS + RED_TESTS + SKIPPED_TESTS))
  ((GREEN_PERCENTAGES=GREEN_TESTS*100/ALL_TESTS))
  ((RED_PERCENTAGES=RED_TESTS*100/ALL_TESTS))
  ((SKIPPED_PERCENTAGES=SKIPPED_TESTS*100/ALL_TESTS))
  if [ "$CI" ];
  then
    {
      echo '## Summary Statistics';
      echo "- Executed $ALL_TESTS tests in $TESTED_PACKAGES packages.";
      echo "- ✅ $GREEN_TESTS (≈$GREEN_PERCENTAGES %) passed.";
      echo "- ❌ $RED_TESTS (≈$RED_PERCENTAGES %) failed.";
      echo "- ⏩ $SKIPPED_TESTS (≈$SKIPPED_PERCENTAGES %) skipped."
    } >> "$GITHUB_STEP_SUMMARY"
    cat summary.txt >> "$GITHUB_STEP_SUMMARY"
  else
    echo 'Summary Statistics'
    echo ''
    echo "- Executed $ALL_TESTS tests in $TESTED_PACKAGES packages."
    echo "- ✅ $GREEN_TESTS (≈$GREEN_PERCENTAGES %) passed."
    echo "- ❌ $RED_TESTS (≈$RED_PERCENTAGES %) failed."
    echo "- ⏩ $SKIPPED_TESTS (≈$SKIPPED_PERCENTAGES %) skipped."
  fi
elif [ "$CI" ];
  then
  if [ -f "failing.txt" ]; then
    cat failing.txt >> "$GITHUB_STEP_SUMMARY"
  fi
fi

if ((RED_TESTS > 0 || ALL_TESTS == 0)); 
then
  exit 1
else 
  exit 0
fi
