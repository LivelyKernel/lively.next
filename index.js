/*
Database for Browser-Local ChangeSets
-------------------------------------

lively.modules knows about all currently registered packages:

  type PackageAddress = string;

  type Package = { address: PackageAddress, ... };

  System.getPackages() => Array<Package>

A ChangeSet has a name, a set of packages that are affected by it,
and optionally a base change set:

  type ChangeSetName = string;

  type ChangeSet = { name: ChangeSetName, packages: Array<PackageAddress>, base: ChangeSetName? };

The head of the currently active chain of changesets is stored in localStorage

  localStorage.getItem("lively.changesets/current") => ChangeSetName

The actual changes are stored as git refs and objects in the IndexedDB

Refs such as branches:

  refs : GitRef -> GitHash
  (e.g. "heads/master" - fc340a00be0)

Objects such as blobs, trees and commits:

  objects : GitHash -> hash/content/etc
  (e.g. fc340a00be0 -> "this is my file content")

If a package is affected by a change set, there exists a git ref named

  `${packageAddress}/heads/${changeSetName}`

which points to a git tree holding the changes made to the package.
(git trees link to objects and other trees for sub-directories)

By keeping changes as git tree, it is easy to create a commit for a
changeset and push this commit as new branch/pull request to GitHub.

All changesets in the current browser session are found by looking
for these refs for each registered pacakge.

*/

import { Interface } from "lively-system-interface";
import LocalGitSystem from "./src/system.js";

export const gitInterface = new Interface(new LocalGitSystem());