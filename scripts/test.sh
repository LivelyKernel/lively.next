#!/bin/bash
# This script can be used to run tests outside of a lively.next environment. It is used for the CI pipelines for lively.next and its projects.
# It either executes all tests present in the test folders of the packages specified in `testfiles` (defaulting to all lively core packages),
# or all tests in the single package given as a parameter when executing this script.
# It is not possible to run multiple explicitly specified packages (except when modifying the below array).
# As this script supports either running locally or inside of a GitHub Action environment, this leaves us with four cases:
# (1) Testing the lively core a) in CI b) locally or (1) Testing one specific package a) in CI or b) locally.
# In case (1), we provicde some summary statistics at the end of our test run and put them, as well as further information in markdown format, in a file called `test_output_clean.md` for later consumption.
# In the cases a) we add some GitHub Actions output formatting hints as well as providing markdown to be rendered in the summary section of the action run.
# In cases b), we provide more lean, human readable output meant for reading consumtion in a shell. 
# For Linux systems, this script requires `ss` to run. On Mac, netstat is required instead.
# On mac, make sure to have `gsed` installed.

TESTED_PACKAGES=0
ALL_TESTS=0
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
    echo '# Tests for `lively.next` 🧪' >>  test_output.md
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
    echo "Found a running lively server on port 9011 that will be used for testing."
  else
    STARTED_SERVER=1
    echo "No local lively server was found on port 9011. Starting a server on port 9011 to run tests on."
    # start a new lively.next server
    ./start-server.sh > /dev/null 2>&1 &
    # wait until server is guaranteed to be running
    sleep 30 
  fi
fi

for package in "${testfiles[@]}"; do
  echo ''
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

  # Parse summary parts and adjust env variables for overall stats.
  # For perl magic see: https://stackoverflow.com/a/16658690
  green=$(echo "$output" | perl -nle'print $& while m{(?<=SUMMARY-passed:)\d+}g')
  red=$(echo "$output" | perl -nle'print $& while m{(?<=SUMMARY-failed:)\d+}g')
  skipped=$(echo "$output" | perl -nle'print $& while m{(?<=SUMMARY-skipped:)\d+}g')
  ((GREEN_TESTS+=green))
  ((RED_TESTS+=red))
  ((SKIPPED_TESTS+=skipped))

  if [ "$CI" ]; 
  then
    pkill -f lively.*start
  fi
done

if [ "$STARTED_SERVER" = "1" ];
then
    pkill -f -n lively.*start
fi

((ALL_TESTS=GREEN_TESTS + RED_TESTS + SKIPPED_TESTS))
if [ ! "$1" ];
then
  ((GREEN_PERCENTAGES=GREEN_TESTS*100/ALL_TESTS))
  ((RED_PERCENTAGES=RED_TESTS*100/ALL_TESTS))
  ((SKIPPED_PERCENTAGES=SKIPPED_TESTS*100/ALL_TESTS))
  if [ "$CI" ];
  then
    {
      echo ''
      echo '## Summary Statistics';
      echo "- Executed $ALL_TESTS tests in $TESTED_PACKAGES packages.";
      echo "- ✅ $GREEN_TESTS (≈$GREEN_PERCENTAGES %) passed.";
      echo "- ❌ $RED_TESTS (≈$RED_PERCENTAGES %) failed.";
      echo "- ⏩ $SKIPPED_TESTS (≈$SKIPPED_PERCENTAGES %) skipped."
    } >> test_output.md
  else
    echo ''
    echo 'Summary Statistics'
    echo ''
    echo "- Executed $ALL_TESTS tests in $TESTED_PACKAGES packages."
    echo "- ✅ $GREEN_TESTS (≈$GREEN_PERCENTAGES %) passed."
    echo "- ❌ $RED_TESTS (≈$RED_PERCENTAGES %) failed."
    echo "- ⏩ $SKIPPED_TESTS (≈$SKIPPED_PERCENTAGES %) skipped."
  fi
fi
if [ -f "failing.txt" ]; then
    cat failing.txt >> test_output.md
fi

if [ "$CI" ];
then
  sed 's/✅/<g-emoji class="g-emoji" alias="white_check_mark" fallback-src="https:\/\/github.githubassets.com\/images\/icons\/emoji\/unicode\/2705.png"><img class="emoji" alt="white_check_mark" src="https:\/\/github.githubassets.com\/images\/icons\/emoji\/unicode\/2705.png" width="20" height="20"><\/g-emoji>/g' test_output.md |
  sed 's/🧪/<g-emoji class="g-emoji" alias="test_tube" fallback-src="https:\/\/github.githubassets.com\/images\/icons\/emoji\/unicode\/1f9ea.png"><img class="emoji" alt="test_tube" src="https:\/\/github.githubassets.com\/images\/icons\/emoji\/unicode\/1f9ea.png" width="20" height="20"><\/g-emoji>/g' |
  sed 's/⏩/<g-emoji class="g-emoji" alias="fast_forward" fallback-src="https:\/\/github.githubassets.com\/images\/icons\/emoji\/unicode\/23e9.png"><img class="emoji" alt="fast_forward" src="https:\/\/github.githubassets.com\/images\/icons\/emoji\/unicode\/23e9.png" width="20" height="20"><\/g-emoji>/g' |
  sed 's/❌/<g-emoji class="g-emoji" alias="x" fallback-src="https:\/\/github.githubassets.com\/images\/icons\/emoji\/unicode\/274c.png"><img class="emoji" alt="x" src="https:\/\/github.githubassets.com\/images\/icons\/emoji\/unicode\/274c.png" width="20" height="20"><\/g-emoji>/g' |
  sed 's/ℹ️/<g-emoji class="g-emoji" alias="information_source" fallback-src="https:\/\/github.githubassets.com\/images\/icons\/emoji\/unicode\/2139.png"><img class="emoji" alt="information_source" src="https:\/\/github.githubassets.com\/images\/icons\/emoji\/unicode\/2139.png" width="20" height="20"><\/g-emoji>/g' |
  sed 's/📦/<g-emoji class="g-emoji" alias="package" fallback-src="https:\/\/github.githubassets.com\/images\/icons\/emoji\/unicode\/1f4e6.png"><img class="emoji" alt="package" src="https:\/\/github.githubassets.com\/images\/icons\/emoji\/unicode\/1f4e6.png" width="20" height="20"><\/g-emoji>/g' > test_output_clean.md
fi

if ((RED_TESTS > 0 || ALL_TESTS == 0)); 
then
  exit 1
else 
  exit 0
fi
