#!/usr/bin/python3
# This script checks whether or not the below defined artifacts (`need_to_check_deps`) are up to date.
# An artifact is up to date if the checksum of its build on the current state of the repository are the same as the checksum of the committed version.
# This script assumes that it will be executed from the base of a lively.next repository!
# Be aware, that this script might run build processes. It is assumed, that this is done in CI and any resulting file changes are thus discarded!
# If you run this locally, the contents of your repository might change!

import json
from sultan.api import Sultan
import os
import difflib
import tempfile
import subprocess

# branch against which to diff changes
target_branch_name = "main"
# mapping from package -> build artifact of the package
# packages in this dictionary are checked to be up to date (i.e. last build newer than latest change in package dependencies)
artifacts_to_check = ["flatn/flatn-cjs.js"]
# flag used to check if the script should fail (i.e. at least one dependent needs to be rebuild)
fail = False

def show_file_diff(artifact_path):
    """Show the differences between committed and newly built version of a file."""
    try:
        # Get the committed version using git show
        result = subprocess.run(
            ['git', 'show', f'HEAD:{artifact_path}'],
            capture_output=True,
            text=True,
            check=True
        )
        committed_content = result.stdout.splitlines(keepends=True)

        # Read the newly built version
        with open(artifact_path, 'r', encoding='utf-8', errors='replace') as f:
            new_content = f.readlines()

        # Generate unified diff
        diff = difflib.unified_diff(
            committed_content,
            new_content,
            fromfile=f'{artifact_path} (committed)',
            tofile=f'{artifact_path} (new build)',
            lineterm=''
        )

        print("\n📝 Differences found:")
        print("=" * 80)

        # Show diff with line limit to avoid overwhelming output
        diff_lines = list(diff)
        max_lines = 100

        for i, line in enumerate(diff_lines):
            if i >= max_lines:
                remaining = len(diff_lines) - max_lines
                print(f"\n... ({remaining} more lines of differences omitted)")
                break
            print(line)

        print("=" * 80)

    except subprocess.CalledProcessError as e:
        print(f"⚠️  Could not get committed version: {e}")
    except FileNotFoundError:
        print(f"⚠️  Could not read file: {artifact_path}")
    except Exception as e:
        print(f"⚠️  Error showing diff: {e}")
for artifact in artifacts_to_check:
    # flag to determine if this specific dependent is ok, just for nicer output
    single_fail = False
    print(f"🏗️  Checking status of {artifact}")
    with Sultan.load(logging=False) as s:
        committed_checksum = s.md5sum(f"{artifact}").run().stdout
        s.npm(f"--prefix {artifact.split('/', 1)[0]} run build").run()
        new_checksum = s.md5sum(f"{artifact}").run().stdout
        if new_checksum != committed_checksum:
            print(f"❌ {artifact} needs to be rebuild!")
            show_file_diff(artifact)
            fail = True
            single_fail = True
            break
        if not single_fail:
            print(f"✅ Build of {artifact} is up to date!\n")

if fail:
    exit(1)
else:
    print("")
    print("✅ All internal builds are up to date!")
    print()
