import { arr, events } from 'lively.lang';

import { gitInterface } from '../index.js';
import Branch from "./branch.js";

export const notify = events.makeEmitter({});

let current = undefined; // undefined (uninitialized) | null (none) | ChangeSet
let changesets = undefined; // undefined (uninitialized) | Array<ChangeSet>

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
    notify.emit('change', {changeset: this.name});
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

  toFile() {
    //TODO
  }

  fromFile() {
    //TODO
  }
  
  async delete() {
    if (this === current) {
      current = null;
      window.localStorage.removeItem('lively.changesets/current');
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
    notify.emit('delete', {changeset: this.name});
  }
  
  setCurrent() { // -> Promise
    return setCurrentChangeSet(this.name);
  }
}

function localChangeSetsOf(db, pkg) {
  // IndexedDB, Package -> Promise<Array<{cs: ChangeSetName, tree: Hash, pkg: PackageAddress}>>
  return new Promise((resolve, reject) => {
    const key = pkg.address,
          trans = db.transaction(["refs"], "readonly"),
          store = trans.objectStore("refs"),
          request = store.getAll(window.IDBKeyRange.bound(`${key}/heads.`, `${key}/heads:`));
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
  notify.emit('add', {changeset: name});
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

export async function currentChangeSet() { // () -> ChangeSet?
  if (current !== undefined) return current;
  const csName = window.localStorage.getItem('lively.changesets/current');
  const cs = (await localChangeSets()).find(cs => cs.name === csName);
  return current = (cs === undefined ? null : cs);
}

export async function setCurrentChangeSet(csName) { // ChangeSetName -> ChangeSet
  if (!csName) {
    current = null;
    window.localStorage.removeItem('lively.changesets/current');
  } else {
    const cs = (await localChangeSets()).find(cs => cs.name === csName);
    current = cs;
    window.localStorage.setItem('lively.changesets/current', csName);
  }
  notify.emit("current", {changeset: csName || null});
}
