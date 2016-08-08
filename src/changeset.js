import { arr } from 'lively.lang';
import { emit } from 'lively.notifications';
import { module, getPackages } from "lively.modules";

import { install, uninstall } from "../index.js";
import Branch from "./branch.js";


let current = null; // null (none) | ChangeSet
let changesets; // undefined (uninitialized) | Array<ChangeSet>

class ChangeSet {

  constructor(name, pkgs) {
    // string, Array<{pkg: PackageAddress}> -> ChangeSet
    this.name = name;
    this.branches = pkgs.map(pkg => new Branch(name, pkg.pkg));
  }
  
  resolve(path) { // Path -> [Branch, RelPath] | [null, null]
    const mod = module(path),
          pkg = mod.package().address,
          branch = this.branches.find(b => b.pkg === pkg);
    if (!branch) return [null, null];
    return [branch, mod.pathInPackage().replace(/^\.\//, '')];
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
    const pkg = module(path).package().address,
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
      await setCurrentChangeSet(null);
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
  const db = await new Promise((resolve, reject) => {
    const req = window.indexedDB.open("tedit", 1);
    req.onsuccess = evt => resolve(evt.target.result);
    req.onerror = err => reject(err);
  });
  const branches = [];
  for (let pkg of getPackages()) {
    const k = await new Promise((resolve, reject) => {
      const trans = db.transaction(["refs"], "readonly"),
            store = trans.objectStore("refs"),
            request = store.get(`${pkg.address}/refs/heads/${name}`);
      request.onsuccess = evt => resolve(evt.target.result);
      request.onerror = evt => reject(new Error(evt.value));
    });
    if (k) branches.push({pkg: pkg.address});
  }
  const cs = new ChangeSet(name, branches);
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
  for (let pkg of getPackages()) {
    arr.pushAll(allChangeSets, await localChangeSetsOf(db, pkg));
  }
  const groups = arr.groupBy(allChangeSets, ({cs}) => cs);
  return changesets = Object.keys(groups).map(name => new ChangeSet(name, groups[name]));
}

export function currentChangeSet() { // () -> ChangeSet?
  return current;
}

async function switchPackage(pkg, prev, next) {
  // PackageAddress, ChangeSet, ChangeSet -> ()
  let prevB = prev && prev.branches.find(b => b.pkg === pkg),
      nextB = next && next.branches.find(b => b.pkg === pkg);
  if (!prevB && !nextB) return; // no changes in this package
  if (!prevB) prevB = new Branch("master", pkg);
  if (!nextB) nextB = new Branch("master", pkg);
  const prevFiles = await prevB.files();
  const nextFiles = await nextB.files();
  for (const relPath in prevFiles) {
    const prevHash = prevFiles[relPath],
          nextHash = nextFiles[relPath],
          mod = `${pkg}/${relPath}`;
    if (prevHash && nextHash && prevHash != nextHash && module(mod).isLoaded()) {
      let newSource;
      if (nextB.name === "master") {
        newSource = await System.resource(mod).read();
      } else {
        newSource = await nextB.getFileContent(relPath);
      }
      await module(mod).changeSource(newSource, {targetModule: mod, doEval: true});
    }
  }
}

function fetchFromChangeset(proceed, load) {
  const cs = currentChangeSet();
  if (!cs) return proceed(load);
  return cs.getFileContent(load.name).then(content => {
    return content === null ? proceed(load) : content;
  });
}

export async function setCurrentChangeSet(csName) {
  // ChangeSetName? -> ChangeSet
  const old = currentChangeSet();
  let next;
  if (!csName) {
    next = null;
  } else {
    next = (await localChangeSets()).find(cs => cs.name === csName);
  }
  if (next === old) return;
  if (next) {
    install();
  } else {
    uninstall();
  }
  current = next;
  for (const pkg of getPackages()) {
    await switchPackage(pkg.address, old, next);
  }
  emit("lively.changesets/switchedcurrent", {
    changeset: csName || null,
    before: old ? old.name : null
  });
}
