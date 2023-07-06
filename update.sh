#!/bin/bash

echo "💾 Saving local changes if any."
git stash

echo "🪢 Retrieving the latest lively.next version."
# Assumes that one runs this on `main` branch. Inside of lively, we ensure that the GUI trigger is not shown in other cases.
git pull

echo "📦 Installing latest version of lively.next."
./install.sh

# If one has other stashes, they are popped regardless!
echo "💾 Restoring local changes if any."
git stash pop

echo "🔁 Restart lively.next server."
# We trap SIGTERM in start.sh. Since the start.sh script is sleeping once the server is launched, we need to send SIGTERM not only to that process, but to the whole process group.
# The PGID is not readily available, therefore:
# 1. List all running processes and their PGID (and other information).
# 2. Clean up the output (spaces instead of tabs).
# 3. `grep` for `start.sh` and discard unecessary lines.
# 4. Extract the PGID from the remaining information.
kill -TERM "-$( ps -efj | tr -s " " | grep -E "PGID|start.sh" | sed -n 2p | cut -d " " -f 4)"

echo "✅ lively.next has been updated!"
