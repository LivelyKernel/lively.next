import { arr } from 'lively.lang';
import { emit } from 'lively.notifications';

import { gitInterface } from '../index.js';
import Branch from "./branch.js";


let current; // null (none) | ChangeSet
let changesets; // undefined (uninitialized) | Array<ChangeSet>

class ChangeSet {

  constructor(name, pkgs) {
    // string, Array<{pkg: PackageAddress}> -> ChangeSet
    this.name = name;
    this.branches = pkgs.map(pkg => new Branch(name, pkg.pkg));
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
  
  async createBranch(path) { // Path -> Branch?
    const mod = gitInterface.getModule(path),
          pkg = mod.package().address,
          branch = new Branch(this.name, pkg);
    await branch.createFrom("master");
    this.branches.push(branch);
    return branch;
  }

  async setFileContent(path, content) { // Path, string -> boolean
    let [branch, relPath] = this.resolve(path);
    if (!branch) {
      await this.createBranch(path);
      return this.setFileContent(path, content);
    }
    emit("lively.changesets/changed", {changeset: this.name, path: relPath});
    return branch.setFileContent(relPath, content);
  }

  evaluate() {
    this.branches.forEach(b => b.evaluate());
  }

  pushToGithub() {
    //TODO
  }

  pullFromGithub() {
    //TODO
  }

  async fromObject(obj) {
    this.name = obj["."];
    this.branches = await Promise.all(
      Object.keys(obj)
      .filter(pkg => pkg !== ".")
      .map(pkg => new Branch(this.name, pkg))
      .map(b => b.fromObject(obj[b.pkg])));
    return this;
  }
  
  async toObject() {
    const result = {};
    for (let branch of this.branches) {
      result[branch.pkg] = await branch.toObject();
    }
    result["."] = this.name;
    return result;
  }
  
  async delete() {
    if (this === current) {
      setCurrentChangeSet(null);
    }
    changesets = changesets.filter(cs => cs !== this);
    const db = await new Promise((resolve, reject) => {
      const req = window.indexedDB.open("tedit", 1);
      req.onsuccess = evt => resolve(evt.target.result);
      req.onerror = err => reject(err);
    });
    for (let branch of this.branches) {
      await branch.delete(db);
    }
    emit("lively.changesets/deleted", {changeset: this.name});
  }
  
  isCurrent() { // -> bool
    return this === current;
  }
  
  setCurrent() { // -> Promise
    return setCurrentChangeSet(this.name);
  }
  
  toString() { // -> String
    return `ChangeSet(${this.name})`;
  }
}

function localChangeSetsOf(db, pkg) {
  // IndexedDB, Package -> Promise<Array<{cs: ChangeSetName, tree: Hash, pkg: PackageAddress}>>
  return new Promise((resolve, reject) => {
    const key = pkg.address,
          trans = db.transaction(["refs"], "readonly"),
          store = trans.objectStore("refs"),
          request = store.getAll(window.IDBKeyRange.bound(`${key}/refs/heads.`, `${key}/refs/heads:`));
    request.onsuccess = evt => resolve(evt.target.result);
    request.onerror = evt => reject(new Error(evt.value));
  }).then(keys => keys.map(({path}) => {
    const pathParts = path.split('/'),
          cs = pathParts[pathParts.length - 1];
    return {cs, pkg: pkg.address};
  }));
}

export async function createChangeSet(name) { // ChangeSetName => ChangeSet
  const cs = new ChangeSet(name, []);
  (await localChangeSets()).push(cs);
  emit("lively.changesets/added", {changeset: name});
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
  for (let pkg of packages) {
    arr.pushAll(allChangeSets, await localChangeSetsOf(db, pkg));
  }
  const groups = arr.groupBy(allChangeSets, ({cs}) => cs);
  return changesets = Object.keys(groups).map(name => new ChangeSet(name, groups[name]));
}

export function currentChangeSet() { // () -> ChangeSet?
  return current;
}

export async function setCurrentChangeSet(csName) { // ChangeSetName? -> ChangeSet
  const old = currentChangeSet();
  if (!csName) {
    current = null;
  } else {
    const cs = (await localChangeSets()).find(cs => cs.name === csName);
    current = cs;
  }
  emit("lively.changesets/switchedcurrent", {
    changeset: csName || null,
    before: old ? old.name : null
  });
}
