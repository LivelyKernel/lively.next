import { arr } from 'lively.lang';
import jsGit from 'js-git-browser';
const { codec, bodec } = jsGit;
import { emit } from 'lively.notifications';

import commit, { activeCommit, packageHead } from './commit.js';
import repository, { enableGitHub, gitHubBranches, database } from './repo.js';

let branches; // undefined (uninitialized) | { [PackageAddress]: Array<Branch> }

// type BranchName = string
// type EntryType = "tree" | "commit" | "tag" | "blob"

function serialize (type, body) { // EntryType, any -> string
  return bodec.toString(codec.frame({ type: type, body: body }), 'base64');
}

function deserialize (str) { // string -> {type: EntryType, body: any}
  return codec.deframe(bodec.fromString(str, 'base64'), true);
}

export default async function branch (pkg, name) {
  // PackageAddress, BranchName -> Branch
  const localBranches = await localBranchesOf(pkg);
  let branch = localBranches.find(b => b.name == name);
  if (!branch) {
    branch = new Branch(pkg, name);
    if (!(pkg in branches)) branches[pkg] = [];
    branches[pkg].push(branch);
    emit('lively.changesets/branchadded', { pkg, name });
  }
  return branch;
}

class Branch {
  constructor (pkg, name) { // PackageAddress, BranchName -> Branch
    this.pkg = pkg;
    this.name = name;
    this._head = null;
  }

  async head () { // () -> Commit
    if (this._head) return this._head;
    const repo = await repository(this.pkg);
    const h = await repo.readRef(`refs/heads/${this.name}`);
    return this._head = await commit(this.pkg, h);
  }

  async setHead (hash) { // Hash -> ()
    const repo = await repository(this.pkg);
    this._head = null;
    const prevHead = await commit(this.pkg, hash);
    this._head = await prevHead.createChangeSetCommit();
    await repo.updateRef(`refs/heads/${this.name}`, this._head.hash);
    emit('lively.changesets/changed', { pkg: this.pkg, name: this.name });
  }

  async createFrom (commit) { // Commit -> ()
    const repo = await repository(this.pkg);
    const prevHead = await commit.stableBase();
    this._head = await prevHead.createChangeSetCommit();
    await repo.updateRef(`refs/heads/${this.name}`, this._head.hash);
    emit('lively.changesets/changed', { pkg: this.pkg, name: this.name });
  }

  async fork (name) { // BranchName -> Branch
    const head = await this.head();
    const newBranch = await branch(this.pkg, name);
    await newBranch.createFrom(head);
    return newBranch;
  }

  async createFromActive () { // () -> ()
    let base = activeCommit(this.pkg);
    if (!base) {
      base = await packageHead(this.pkg);
    }
    if (!base) {
      throw new Error('Could not find any commit to use as base');
    }
    return this.createFrom(base);
  }

  files (withDir) { // boolean? -> {[RelPath]: Hash}
    return this.head().then(head => head.files(withDir));
  }

  changedFiles (withDir) { // boolean? -> Promise<{[RelPath]: Hash}>
    return this.head().then(head => head.changedFiles(withDir));
  }

  diffFile (relPath) { // RelPath -> Promise<string?>
    return this.head().then(head => head.diffFile(relPath));
  }

  getFileContent (relPath) { // RelPath -> Promise<string?>
    return this.head().then(head => head.getFileContent(relPath));
  }

  async setFileContent (relPath, content) { // string, string -> Commit
    // add file as a new commit based on parent and replace current head
    const repo = await repository(this.pkg);
    const head = await this.head();
    this._head = await head.setFileContent(relPath, content);
    await repo.updateRef(`refs/heads/${this.name}`, this._head.hash);
    emit('lively.changesets/changed', { pkg: this.pkg, name: this.name, path: relPath });
    return this._head;
  }

  async commitChanges (message) { // string -> Commit
    const repo = await repository(this.pkg);
    const head = await this.head();
    const committedHead = await head.createCommit(message);
    this._head = await committedHead.createChangeSetCommit();
    await repo.updateRef(`refs/heads/${this.name}`, this._head.hash);
    emit('lively.changesets/changed', { pkg: this.pkg, name: this.name });
    return this._head;
  }

  async delete () { // () -> ()
    const db = await database();
    branches[this.pkg] = branches[this.pkg].filter(b => b !== this);
    await new Promise((resolve, reject) => {
      const key = this.pkg;
      const trans = db.transaction(['refs'], 'readwrite');
      const store = trans.objectStore('refs');
      const request = store.delete(`${key}/refs/heads/${this.name}`);
      request.onsuccess = evt => resolve(evt.target.result);
      request.onerror = evt => reject(new Error(evt.value));
    });
    emit('lively.changesets/branchdeleted', { pkg: this.pkg, name: this.name });
  }

  toString () { // -> String
    return `Branch(${this.pkg}, ${this.name})`;
  }

  async fromObject (obj) { // { ".": Hash, [Hash]: Entry } -> Branch
    const repo = await repository(this.pkg);
    for (const hash in obj) {
      if (hash === '.') {
        await repo.updateRef(`refs/heads/${this.name}`, obj[hash]);
        continue;
      }
      const { type, body } = deserialize(obj[hash]);
      await repo.saveAs(type, body);
    }
    return this;
  }

  async toObject () { // -> { ".": Hash, [Hash]: Entry }
    const repo = await repository(this.pkg);
    const headCommit = await this.head();
    const changed = await headCommit.changedFiles(true);
    const headHash = headCommit.hash;
    const result = {};
    for (const relPath in changed) {
      const hash = changed[relPath];
      const { type, body } = await repo.loadRaw(hash);
      result[hash] = serialize(type, body);
    }
    result[headHash] = serialize('commit', headCommit);
    result['.'] = headHash;
    return result;
  }

  async pushToGitHub () {
    await enableGitHub();
    const repo = await repository(this.pkg);
    let headCommit = await this.head();
    if (headCommit.message == 'work in progress') {
      headCommit = await headCommit.parent();
    }
    await repo.send(`refs/heads/${this.name}`);
    await repo.updateRemoteRef(`refs/heads/${this.name}`, headCommit.hash);
    emit('lively.changesets/branchpushed', { pkg: this.pkg, name: this.name });
  }

  async pullFromGitHub () {
    // PackageAddress, BranchName -> Branch
    await enableGitHub();
    const remoteBranches = await gitHubBranches(this.pkg);
    const remoteBranch = remoteBranches.find(b => b.name === this.name);
    await this.setHead(remoteBranch.hash);
    emit('lively.changesets/branchpulled', { pkg: this.pkg, name: this.name });
  }

  isActive () { // -> Promise<bool>
    return this.head().then(head => activeCommit(this.pkg).hash === head.hash);
  }

  async activate () { // () -> Promise<()>
    return this.head().then(head => head.activate());
  }

  async deactivate () { // () -> Promise<()>
    return this.head().then(head => head.deactivate());
  }
}

function parseChangeSetRef (url) {
  // string -> Branch?
  const parts = url.split('/');
  const l = parts.length;
  if (l < 4 || parts[l - 3] !== 'refs' || parts[l - 2] !== 'heads') return null;
  return new Branch(parts.slice(0, l - 3).join('/'), parts[l - 1]);
}

export async function initBranches () { // () => ()
  const db = await database();
  const refs = await new Promise((resolve, reject) => {
    const trans = db.transaction(['refs'], 'readonly');
    const store = trans.objectStore('refs');
    const request = store.getAllKeys();
    request.onsuccess = evt => resolve(evt.target.result);
    request.onerror = evt => reject(new Error(evt.value));
  });
  const allBranches = refs.map(parseChangeSetRef).filter(t => !!t);
  branches = arr.groupBy(allBranches, branch => branch.pkg);
}

export function localBranchesOf (pkg) { // PackageAddress => Promise<Array<Branch>>
  if (branches !== undefined) return Promise.resolve(branches[pkg] || []);
  return initBranches().then(() => branches[pkg] || []);
}

export function localBranches () { // () -> Promise<{ [PackageAddress]: Array<Branch> }>
  if (branches !== undefined) return Promise.resolve(branches);
  return initBranches().then(() => branches);
}
