/* global Map */
import { arr } from 'lively.lang';
import { emit } from 'lively.notifications';
import { module, getPackages, importPackage } from "lively.modules";
import { mixins, gitHubRequest } from "js-git-browser";

import { activeCommit, install, uninstall } from "../index.js";
import { enableGitHub } from "./repo.js";
import Branch from "./branch.js";
import { packageHead } from "./commit.js";

let changesets; // undefined (uninitialized) | Array<ChangeSet>
let branches; // undefined (uninitialized) | { [PackageAddress]: Array<Branch> }

class ChangeSet {

  constructor(name, branches) {
    // string, Array<Branch> -> ChangeSet
    this.name = name;
    this.branches = branches;
    this.active = false;
  }
  
  getBranch(pkg) { // PackageAddress -> Branch?
    return this.branches.find(b => b.pkg == pkg);
  }
  
  async getOrCreateBranch(pkg) { // PackageAddress -> Branch
    let branch = this.getBranch(pkg);
    if (!branch) {
      branch = new Branch(this.name, pkg);
      await branch.createFromActive();
      this.branches.push(branch);
      if (!(pkg in branches)) branches[pkg] = [];
      branches[pkg].push(branch);
    }
    return branch;
  }
  
  async pullBranchFromGitHub(pkg, hash) {
    await enableGitHub();
    let branch = this.getBranch(pkg);
    if (!branch) {
      branch = new Branch(this.name, pkg);
      this.branches.push(branch);
      if (!(pkg in branches)) branches[pkg] = [];
      branches[pkg].push(branch);
    }
    return branch.setHead(hash);
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
      if (prev[branch]) {
        await next.activate(prev[branch]);
      }
    }
    emit("lively.changesets/activated", {changeset: this.name});
  }
  
  async deactivate() { // () -> ()
    if (!this.isActive()) return;
    this.active = false;
    for (const branch of this.branches) {
      const prev = await branch.head(),
            next = await activeCommit(branch.pkg);
      if (next) {
        await next.activate(prev);
      }
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
  const local = await localChangeSets();
  const cs = new ChangeSet(name, []);
  local.push(cs);
  emit("lively.changesets/added", {changeset: name});
  return cs;
}

function parseChangeSetRef(url) {
  // string -> Branch?
  const parts = url.split('/'),
        l = parts.length;
  if (l < 4 || parts[l-3] !== "refs" || parts[l-2] !== "heads") return null;
  return new Branch(parts[l - 1], parts.slice(0, l - 3).join('/'));
}

export async function initChangeSets() { // () => Array<ChangeSet>
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
  const allBranches = refs.map(parseChangeSetRef).filter(t => !!t),
        groupedByCS = arr.groupBy(allBranches, branch => branch.name);
  branches = arr.groupBy(allBranches, branch => branch.pkg);
  changesets = Object.keys(groupedByCS)
                     .map(name => new ChangeSet(name, groupedByCS[name]));
}

export function localChangeSets() { // () => Promise<Array<ChangeSet>>
  if (changesets !== undefined) return Promise.resolve(changesets);
  return initChangeSets().then(() => changesets);
}

export function localBranchesOf(pkg) { // PackageAddress => Promise<Array<Branch>>
  if (branches !== undefined) return Promise.resolve(branches[pkg] || []);
  return initChangeSets().then(() => branches[pkg] || []);
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
