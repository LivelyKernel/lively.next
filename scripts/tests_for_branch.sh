#!/bin/bash
# Use correct branch to merge into or main to be able to run it locally. 
if [ -z "${GITHUB_BASE_REF}" ];
then
    GITHUB_BASE_REF='main'
fi
# https://stackoverflow.com/a/39296583/4418325
CHANGED_FILES=$(git diff --name-only origin/$GITHUB_BASE_REF...)

# Use -E for MacOS-compatible lazy evaluation
# to ensure that we only match lively core **directories** and not files that include lively in their name 
RELEVANT_CHANGED_FILES="$(grep -E 'lively\..+?\/.+' <<< "$CHANGED_FILES")"
# Check if any file was affected, otherwise we need to explicitly tell `test.sh`
if [ -z "${RELEVANT_CHANGED_FILES}" ];
then
    CHANGED_FOLDERS='none'
else
    CHANGED_FOLDERS="$(dirname $RELEVANT_CHANGED_FILES)"
fi
# Echo to force output into a single string.
echo $(sort -u <<< "$CHANGED_FOLDERS")