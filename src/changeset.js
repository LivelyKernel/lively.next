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

  `${packageAddress}/refs/heads/${changeSetName}`

which points to a git tree holding the changes made to the package.
(git trees link to objects and other trees for sub-directories)

By keeping changes as git tree, it is easy to create a commit for a
changeset and push this commit as new branch/pull request to GitHub.

All changesets in the current browser session are found by looking
for these refs for each registered pacakge.

*/

import { arr } from 'lively.lang';
import { mixins, modes, promisify } from 'js-git-browser';
import { gitHubToken } from './github-integration.js';
import { gitInterface } from '../index.js';

const repoForPackage = {};

async function gitURLForPackage(pkg) { // PackageAddress -> string?
  const packageConfig = `${pkg}/package.json`;
  const conf = await System.import(packageConfig);
  if (!conf || !conf.repository) return null;
  const url = conf.repository.url || conf.repository,
        match = url.match(/github.com[:\/](.*?)(?:\.git)?$/);
  if (!match) return null;
  return match[1];
}

async function repositoryForPackage(pkg) { // PackageAddress -> Repository?
  if (pkg in repoForPackage) {
    return repoForPackage[pkg];
  }
  const remote = {},
        repo = {},
        url = await gitURLForPackage(pkg);

  if (url === null) return null;
  mixins.github(remote, url, await gitHubToken());
  mixins.readCombiner(remote);
  await new Promise((resolve, reject) => {
    mixins.indexed.init(err => err ? reject(err) : resolve());
  });
  mixins.indexed(repo, pkg);
  mixins.sync(repo, remote);
  mixins.fallthrough(repo, remote);
  mixins.createTree(repo);
  mixins.memCache(repo);
  mixins.readCombiner(repo);
  mixins.walkers(repo);
  mixins.formats(repo);
  promisify(repo);
  return repoForPackage[pkg] = repo;
}

async function fileHashes(repo, tree) { // Repository, Tree -> {[RelPath]: Hash}
  const treeStream = await repo.treeWalk(tree),
        files = {};
  let obj;
  while (obj = await treeStream.read()) {
    if (obj.mode !== modes.file) continue;
    files[obj.path] = obj.hash;
  }
  return files;
}

class Branch {
  constructor(name, pkg, tree) {
    this.name = name;
    this.pkg = pkg;
    this.tree = tree;
  }

  async fileExists(relPath) { // RelPath -> boolean?
    const repo = await repositoryForPackage(this.pkg);
    if (repo === null) return null;
    const files = await fileHashes(repo, this.tree);
    return !!files[relPath];
  }

  async getFileContent(relPath) { // RelPath -> string?
    const repo = await repositoryForPackage(this.pkg);
    if (repo === null) return null;
    const files = await fileHashes(repo, this.tree);
    if (!files[relPath]) return null;
    return await repo.loadAs("text", files[relPath]);
  }

  async setFileContent(relPath, content) { // string, string -> ()
    //TODO
  }

  evaluate() {
    //TODO
  }
}

let current = undefined; // undefined (uninitialized) | null (none) | ChangeSet
let changesets = undefined; // undefined (uninitialized) | Array<ChangeSet>

class ChangeSet {

  constructor(name, pkgs) {
    // string, Array<{pkg: PackageAddress, hash}> -> ChangeSet
    this.name = name;
    this.branches = pkgs.map(pkg => new Branch(name, pkg.pkg, pkg.tree));
  }

  resolve(path) { // Path -> [Branch, RelPath] | [null, null]
    const mod = gitInterface.getModule(path),
          pkg = mod.package().address,
          branch = this.branches.find(b => b.pkg === pkg);
    if (!branch) return [null, null];
    return [branch, mod.pathInPackage().replace(/^\.\//, '/')];
  }

  fileExists(path) { // Path -> boolean?
    const [branch, relPath] = this.resolve(path);
    if (!branch) return null;
    return branch.fileExists(relPath);
  }

  getFileContent(path) { // Path -> string?
    const [branch, relPath] = this.resolve(path);
    if (!branch) return null;
    return branch.getFileContent(relPath);
  }

  setFileContent(path, content) { // Path, string -> boolean
    const [branch, relPath] = this.resolve(path);
    if (!branch) return false;
    branch.setFileContent(relPath, content);
    return true;
  }

  evaluate() {
    this.branches.forEach(b => b.evaluate());
  }

  setCurrent() {
    current = this;
    window.localStorage.setItem('lively.changesets/current', this.name);
  }

  pushToGithub() {
    //TODO
  }

  pullFromGithub() {
    //TODO
  }

  toFile() {
    //TODO
  }

  fromFile() {
    //TODO
  }
}

function localChangeSetsOf(db, pkg) {
  // IndexedDB, Package -> Promise<Array<{cs: ChangeSetName, tree: Hash, pkg: PackageAddress}>>
  return new Promise((resolve, reject) => {
    const key = pkg.address,
          trans = db.transaction(["refs"], "readonly"),
          store = trans.objectStore("refs"),
          request = store.getAll(window.IDBKeyRange.bound(`${key}/heads/`, `${key}/headsZ`));
    request.onsuccess = evt => resolve(evt.target.result);
    request.onerror = evt => reject(new Error(evt.value));
  }).then(keys => keys.map(({path, hash}) => {
    const pathParts = path.split('/');
    return {cs: pathParts[pathParts.length - 1], tree: hash, pkg: pkg.address};
  }));
}

export async function createChangeSet(name) { // ChangeSetName => ChangeSet
  const cs = new ChangeSet(name, []);
  (await localChangeSets()).push(cs);
  return cs;
}

export async function localChangeSets() { // () => Array<ChangeSet>
  if (changesets !== undefined) return changesets;
  const db = await new Promise((resolve, reject) => {
    const req = window.indexedDB.open("tedit", 1);
    req.onsuccess = evt => resolve(evt.target.result);
    req.onerror = err => reject(err);
  });
  const allChangeSets = [];
  const packages = gitInterface.getPackages();
  for (let i = 0; i < packages.length; i++) {
    arr.pushAll(allChangeSets, await localChangeSetsOf(db, packages[i]));
  }
  const groups = arr.groupBy(allChangeSets, ({cs}) => cs);
  return changesets = Object.keys(groups).map(name => new ChangeSet(name, groups[name]));
}

export async function currentChangeSet() { // () -> ChangeSet?
  if (current !== undefined) return current;
  const csName = window.localStorage.getItem('lively.changesets/current');
  const cs = this.localChangeSets().find(cs => cs.name === csName);
  return current = (cs === undefined ? null : cs);
}
