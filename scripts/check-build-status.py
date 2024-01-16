#!/usr/bin/python3
# This script checks whether or not the below defined artifacts (`need_to_check_deps`) are up to date.
# An artifact is up to date if the checksum of its build on the current state of the repository are the same as the checksum of the committed version.
# This script assumes that it will be executed from the base of a lively.next repository!
# Be aware, that this script might run build processes. It is assumed, that this is done in CI and any resulting file changes are thus discarded!
# If you run this locally, the contents of your repository might change!

import json
from sultan.api import Sultan
import os

# branch against which to diff changes
target_branch_name = "main"
# mapping from package -> build artifact of the package
# packages in this dictionary are checked to be up to date (i.e. last build newer than latest change in package dependencies)
artifacts_to_check = ["flatn/flatn-cjs.js"]
# flag used to check if the script should fail (i.e. at least one dependent needs to be rebuild)
fail = False
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
