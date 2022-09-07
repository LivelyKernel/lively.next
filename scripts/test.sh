#!/bin/bash
# Just a small wrapper script so that it is easier to run a test-suite locally,
# without worrying about the --dns-result-order stuff below
# call like "./test.sh lively.package"

node --dns-result-order ipv4first ./scripts/test.js "$1"