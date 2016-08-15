/* global Map */
import { arr } from 'lively.lang';
import { emit } from 'lively.notifications';
import { module, getPackages, importPackage } from "lively.modules";
import { mixins } from "js-git-browser";

import { activeCommit, install, uninstall } from "../index.js";
import Branch from "./branch.js";
import { packageHead } from "./commit.js";

let changesets; // undefined (uninitialized) | Array<ChangeSet>

class ChangeSet {

  constructor(name, pkgs) {
    // string, Array<{pkg: PackageAddress}> -> ChangeSet
    this.name = name;
    this.branches = pkgs.map(pkg => new Branch(name, pkg.pkg));
    this.active = false;
  }
  
  getBranch(pkg) { // PackageAddress -> Branch?
    return this.branches.find(b => b.pkg == pkg);
  }
  
  async getOrCreateBranch(pkg) { // PackageAddress -> Branch
    let branch = this.getBranch(pkg);
    if (!branch) {
      branch = new Branch(this.name, pkg);
      await branch.createFromHead();
      this.branches.push(branch);
    }
    return branch;
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
    if (this.isActive()) {
      await this.deactivate();
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
  
  isActive() { // -> bool
    return this.active;
  }
  
  isWrittenTo() { // -> Promise<bool>
    return targetChangeSet().then(target => target === this);
  }
  
  async activate() { // () -> ()
    if (this.isActive()) return;
    install();
    const prev = new Map();
    for (const branch of this.branches) {
      prev[branch] = await activeCommit(branch.pkg);
    }
    this.active = true;
    for (const branch of this.branches) {
      const next = await activeCommit(branch.pkg);
      await next.activate(prev[branch]);
    }
    emit("lively.changesets/activated", {changeset: this.name});
  }
  
  async deactivate() { // () -> ()
    if (!this.isActive()) return;
    this.active = false;
    for (const branch of this.branches) {
      const prev = await branch.head(),
            next = await activeCommit(branch.pkg);
      await next.activate(prev);
    }
    const cs = await localChangeSets();
    if (cs.filter(c => c.isActive()).length === 0) {
      uninstall();
    }
    emit("lively.changesets/deactivated", {changeset: this.name});
  }
  
  toString() { // -> String
    return `ChangeSet(${this.name})`;
  }
}

export async function createChangeSet(name) { // ChangeSetName => ChangeSet
  await new Promise((resolve, reject) => { // initialize DB
    mixins.indexed.init(err => err ? reject(err) : resolve());
  });
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

function parseChangeSetRef(url) {
  // string -> {cs: ChangeSetName, pkg: PackageAddress}?
  const parts = url.split('/'),
        l = parts.length;
  if (l < 4 || parts[l-3] !== "refs" || parts[l-2] !== "heads") return null;
  return {cs: parts[l - 1], pkg: parts.slice(0, l - 3).join('/')};
}

export async function localChangeSets() { // () => Array<ChangeSet>
  if (changesets !== undefined) return changesets;
  await new Promise((resolve, reject) => { // initialize DB
    mixins.indexed.init(err => err ? reject(err) : resolve());
  });
  const db = await new Promise((resolve, reject) => {
    const req = window.indexedDB.open("tedit", 1);
    req.onsuccess = evt => resolve(evt.target.result);
    req.onerror = err => reject(err);
  });
  const refs = await new Promise((resolve, reject) => {
    const trans = db.transaction(["refs"], "readonly"),
          store = trans.objectStore("refs"),
          request = store.getAllKeys();
    request.onsuccess = evt => resolve(evt.target.result);
    request.onerror = evt => reject(new Error(evt.value));
  });
  const allChangeSets = refs.map(parseChangeSetRef).filter(t => !!t),
        groups = arr.groupBy(allChangeSets, ({cs}) => cs);
  return changesets = Object.keys(groups).map(name => new ChangeSet(name, groups[name]));
}

export function targetChangeSet() { // -> Promise<ChangeSet?>
  return localChangeSets().then(changesets => {
    for (let i = changesets.length - 1; i >= 0; i--) {
      if (changesets[i].isActive()) return changesets[i];
    }
    return null;
  });
}

export async function deactivateAll() {
  const cs = await localChangeSets();
  for (const c of cs) { await c.deactivate(); }
}
