import { arr } from 'lively.lang';
import { emit } from 'lively.notifications';
import { getPackages } from 'lively.modules';

import branch, { localBranches } from './branch.js';
import { install } from '../index.js';

const CHANGESETS_KEY = 'lively.changesets/changesets';

let changesets; // undefined (uninitialized) | Array<ChangeSet>

export default async function changeSet (name) {
  const local = await localChangeSets();
  let cs = local.find(cs => cs.name === name);
  if (!cs) {
    cs = new ChangeSet(name);
    return adjustChangeSets(
      () => { changesets.push(cs); },
      () => { emit('lively.changesets/added', { changeset: name }); }
    ).then(() => cs);
  }
  install();
  return cs;
}

class ChangeSet {
  constructor (name) {
    // string -> ChangeSet
    this.name = name;
  }

  getBranches () { // () -> Promise<Array<Branch>>
    return localBranches().then(branches =>
      Object.keys(branches).flatMap(k => branches[k])
        .filter(b => b.name == this.name));
  }

  getBranch (pkg) { // PackageAddress -> Promise<Branch?>
    return localBranches().then(branches =>
      branches[pkg] ? branches[pkg].find(b => b.name == this.name) : null);
  }

  async getOrCreateBranch (pkg) { // PackageAddress -> Branch
    let b = await this.getBranch(pkg);
    if (!b) {
      b = await branch(pkg, this.name);
      await b.createFromActive();
    }
    return b;
  }

  async fromObject (obj) { // { ".": ChangeSetName, [PackageAddress]: BranchExport } -> ()
    this.name = obj['.'];
    for (let pkg of Object.keys(obj).filter(pkg => pkg !== '.')) {
      const b = await branch(pkg, this.name);
      await b.fromObject(obj[pkg]);
    }
    return this;
  }

  async toObject () { // () -> { ".": ChangeSetName, [PackageAddress]: BranchExport }
    const result = {};
    const branches = await this.getBranches();
    for (let branch of branches) {
      result[branch.pkg] = await branch.toObject();
    }
    result['.'] = this.name;
    return result;
  }

  delete () { // () -> Promise<()>
    return adjustChangeSets(
      () => {
        changesets = changesets.filter(cs => cs !== this);
        return this.getBranches().then(branches => Promise.all(branches.map(b => b.delete())));
      },
      () => { emit('lively.changesets/deleted', { changeset: this.name }); }
    );
  }

  toString () { // -> String
    return `ChangeSet(${this.name})`;
  }
}

async function adjustChangeSets (doFunc, doneFunc, skipPrev) { // (() -> Promise?), (() -> A) -> A
  const prev = {};
  if (!skipPrev) {
    for (let pkg of getPackages()) {
      prev[pkg.address] = await targetBranchRead(pkg.address);
    }
  }
  const intermediate = doFunc();
  if (typeof intermediate === 'object' && intermediate.then) await intermediate;
  const next = {};
  for (let pkg of getPackages()) {
    const prevB = prev[pkg.address];
    const nextB = await targetBranchRead(pkg.address);
    if (prevB && !nextB) {
      console.log(`deactivating ${prevB}`);
      prevB.deactivate();
    } else if (!prevB && nextB || prevB && nextB && prevB.name !== nextB.name) {
      console.log(`activating ${nextB}`);
      await nextB.activate();
    }
  }
  window.localStorage.setItem(CHANGESETS_KEY, JSON.stringify(changesets.map(c => c.name)));

  return doneFunc();
}

export async function importChangeSet (obj) { // { ".": ChangeSetName, [PackageAddress]: BranchExport } -> ()
  const cs = await changeSet(obj['.']);
  return adjustChangeSets(
    () => { return cs.fromObject(obj); },
    () => { emit('lively.changesets/imported', { changeset: cs.name }); }
  ).then(() => cs);
}

export async function initChangeSets () { // () => Promise<()>
  return adjustChangeSets(
    () => {
      const json = window.localStorage.getItem(CHANGESETS_KEY) || '[]';
      changesets = JSON.parse(json).map(csName => new ChangeSet(csName));
    },
    () => { emit('lively.changesets/initialized'); },
    true
  );
}

export function localChangeSets () { // () => Promise<Array<ChangeSet>>
  if (changesets !== undefined) return Promise.resolve(changesets);
  return initChangeSets().then(() => changesets);
}

export async function targetBranchRead (pkg) { // PackageAddress -> Branch?
  const cs = await localChangeSets();
  for (let i = cs.length - 1; i >= 0; i--) {
    const b = await cs[i].getBranch(pkg);
    if (b) return b;
  }
  return null;
}

export function targetBranchWrite (pkg) { // PackageAddress -> Promise<ChangeSet?>
  return localChangeSets().then(cs => {
    if (cs.length === 0) return null;
    return cs[cs.length - 1].getOrCreateBranch(pkg);
  });
}
