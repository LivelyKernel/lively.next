#!/usr/bin/python3
# This script checks whether or not the below defined artifacts (`need_to_check_deps`) are up to date.
# An artifact is up to date if its dependecies have not been altered since the last build.
# This is checked on a commit basis and should be satisfied before a PR is merged into the main branch.
# This script assumes that it will be executed from the base of a lively.next repository!

import json
from sultan.api import Sultan
import os

# branch against which to diff changes
target_branch_name = "main"
# mapping from package -> build artifact of the package
# packages in this dictionary are checked to be up to date (i.e. last build newer than latest change in package dependencies)
need_to_check_deps = {"lively.installer": "/bin/install.cjs", "flatn": "/flatn-cjs.js"}
# flag used to check if the script should fail (i.e. at least one dependent needs to be rebuild)
fail = False
modified_files = []
for dependant in need_to_check_deps:
    # flag to determine if this specific dependent is ok, just for nicer output
    single_fail = False
    print(f"🏗️  Checking build status of {dependant}")
    with open(f"{dependant}/package.json") as f:
        data = json.load(f)
        deps = data["dependencies"]
        # we only care about changes in our own code
        in_house_deps = [dep for dep in deps if "lively" in dep]
        in_house_deps.append(dependant)
        # check if some of the files we depend on have been changed
        with Sultan.load(logging=False) as s:
            modified_files = (
                s.git(f"diff --name-only origin/{target_branch_name}").run().stdout
            )
            if not modified_files:
                print(f"✅ Build of {dependant} is up to date!\n")
                continue
            modified_deps = [
                file
                for file in modified_files
                if any(dep + "/" in file for dep in in_house_deps)
            ]
            if not modified_deps:
                print(f"✅ Build of {dependant} is up to date!\n")
                continue
            # Figure out the last commit that changed all modified dependencies
            # https://stackoverflow.com/a/32774290
            commits_of_dep_modification = [
                s.git(f"rev-list -1 HEAD {file}").run().stdout for file in modified_deps
            ]
            commits_of_dep_modification = [
                commit for arr in commits_of_dep_modification for commit in arr
            ]
            commits_of_dep_modification = list(set(commits_of_dep_modification))
            # Figure out last commit in which we rebuilt
            commit_of_build = (
                s.git(f"rev-list -1 HEAD {dependant}{need_to_check_deps[dependant]}")
                .run()
                .stdout[0]
            )
            for commit in commits_of_dep_modification:
                # We use `os` instead of `sultan` here, since `sultan` does not allow for failing commands...
                # This figures out if `commit_of_build` is an ancestor of `commit`
                # See https://git-scm.com/docs/git-rev-list
                # In this case, we built after modifying the dependency, all is well.
                # If this is not the case, we need to rebuild.
                # The return value of `os.system()` is a bit weird. 256 means bash return code 1.
                # See https://stackoverflow.com/a/35362488
                test = os.system(
                    f"git rev-list {commit_of_build} | grep {commit} > /dev/null"
                )
                if test == 256:
                    print(f"❌ {dependant} needs to be rebuild!")
                    print(
                        f"ℹ️  Try running `npm run build` in {dependant}'s directory.\n"
                    )
                    fail = True
                    single_fail = True
                    break
            if not single_fail:
                print(f"✅ Build of {dependant} is up to date!\n")

if fail:
    exit(1)
else:
    print("")
    print("✅ All internal builds are up to date!")
    print()

# Below are blocks that check the integrity of each altered build file.
# Only files that were rebuild in this PR are tested.

# installer and flatn are tested together, since the install process uses flatn anyway
# and rebuilding flatn would require a sucessfull install
if any(("install.cjs" in file or "flatn-cjs.js" in file) for file in modified_files):
    test = os.system("./install.sh >/dev/null 2>&1")
    if test == 256:
        print("❌ New installer/flatn build is corrupt.")
        exit(1)
    else:
        print("✅ New installer/flatn build works.")
else:
    print("🏃 Builds have not been modified, no need to run them.")
