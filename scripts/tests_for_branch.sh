#!/bin/bash
# Use correct branch to merge into or main to be able to run it locally. 
if [ -z "${GITHUB_BASE_REF}" ];
then
    GITHUB_BASE_REF='main'
fi
# https://stackoverflow.com/a/39296583/4418325
CHANGED_FILES=$(git diff --name-only origin/$GITHUB_BASE_REF...)

# Use -E for MacOS-compatible lazy evaluation
# to ensure that we only match lively core **directories** and not files that include lively in their name.
# Use `cut` to only collect the first part of each path, yielding top-level lively packages.
# This might make it so that the script needs to be called from inside the lively.next folder - for CI its ok.
CHANGED_FOLDERS="$(grep -E 'lively\..+?\/.+' <<< "$CHANGED_FILES" | cut -d "/" -f1)"
# Check if any file was affected, otherwise we need to explicitly tell `test.sh`
if [ -z "${CHANGED_FOLDERS}" ];
then
    CHANGED_FOLDERS='none'
fi
# Echo to force output into a single string.
echo $(sort -u <<< "$CHANGED_FOLDERS")