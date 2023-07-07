#!/bin/bash

currentBranch=$(git branch --show-current)

if [ "$currentBranch" != "main" ]; then
    echo "🛑 Auto-Updating is only supported on main!"
    exit 1
fi

echo "💾 Saving local changes if any."
stashOutput=$(git stash)
# https://stackoverflow.com/a/12973694/4418325
stashOutputWithoutWhiteSpace=$(echo "$stashOutput" | xargs)

echo "🪢 Retrieving the latest lively.next version."
git pull

echo "📦 Installing latest version of lively.next."
./install.sh


if [ "$stashOutputWithoutWhiteSpace" != "No local changes to save" ]; then
    echo "💾 Restoring local changes."
    git stash pop
fi

echo "🔁 Restart lively.next server."
# We trap SIGTERM in start.sh. Since the start.sh script is sleeping once the server is launched, we need to send SIGTERM not only to that process, but to the whole process group.
# The PGID is not readily available, therefore:
# 1. List all running processes and their PGID (and other information).
# 2. Clean up the output (spaces instead of tabs).
# 3. `grep` for `start.sh` and discard unecessary lines.
# 4. Extract the PGID from the remaining information.
kill -TERM "-$( ps -efj | tr -s " " | grep -E "PGID|start.sh" | sed -n 2p | cut -d " " -f 4)"

echo "✅ lively.next has been updated!"
