/* global Map */
import { arr } from 'lively.lang';
import { emit } from 'lively.notifications';
import { module, getPackages, importPackage } from "lively.modules";
import { mixins, gitHubRequest } from "js-git-browser";

import { enableGitHub } from "./repo.js";
import branch from "./branch.js";
import { packageHead } from "./commit.js";

let changesets; // undefined (uninitialized) | Array<ChangeSet>

class ChangeSet {

  constructor(name, branches) {
    // string, Array<Branch> -> ChangeSet
    this.name = name;
    this.branches = branches;
  }
  
  getBranch(pkg) { // PackageAddress -> Branch?
    return this.branches.find(b => b.pkg == pkg);
  }
  
  async getOrCreateBranch(pkg) { // PackageAddress -> Branch
    let branch = this.getBranch(pkg);
    if (!branch) {
      branch = branch(pkg, this.name);
      await branch.createFromActive();
      this.branches.push(branch);
    }
    return branch;
  }
  
  async fromObject(obj) {
    this.name = obj["."];
    this.branches = await Promise.all(
      Object.keys(obj)
      .filter(pkg => pkg !== ".")
      .map(pkg => branch(pkg, this.name))
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
    await this.deactivate();
    changesets = changesets.filter(cs => cs !== this);
    emit("lively.changesets/deleted", {changeset: this.name});
  }
  
  async isActive() { // -> bool
    for (let branch of this.branches) {
      const isA = await branch.isActive();
      if (!isA) return false;
    }
    return true;
  }
  
  async isPartiallyActive() { // -> bool
    for (let branch of this.branches) {
      if (await branch.isActive()) return true;
    }
    return false;
  }
  
  isWrittenTo() { // -> Promise<bool>
    return targetChangeSet().then(target => target === this);
  }
  
  async activate() { // () -> ()
    for (const branch of this.branches) {
      await branch.activate();
    }
    emit("lively.changesets/activated", {changeset: this.name});
  }
  
  async deactivate() { // () -> ()
    for (const branch of this.branches) {
      await branch.deactivate();
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

export async function initChangeSets() { // () => Array<ChangeSet>
  return changesets = [];
  
  const allBranches = [];
  const groupedByCS = arr.groupBy(allBranches, branch => branch.name);
  changesets = Object.keys(groupedByCS)
                     .map(name => new ChangeSet(name, groupedByCS[name]));
}

export function localChangeSets() { // () => Promise<Array<ChangeSet>>
  if (changesets !== undefined) return Promise.resolve(changesets);
  return initChangeSets().then(() => changesets);
}

export function targetChangeSet() { // -> Promise<ChangeSet?>
  return localChangeSets().then(changesets =>
    changesets[changesets.length - 1] || null);
}
