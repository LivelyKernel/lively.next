import { arr } from 'lively.lang';
import { codec, bodec } from "js-git-browser";
import { emit } from 'lively.notifications';
import { mixins } from "js-git-browser";

import commit, { activeCommit, packageHead } from "./commit.js";
import repository, { enableGitHub, gitHubBranches } from "./repo.js";

let branches; // undefined (uninitialized) | { [PackageAddress]: Array<Branch> }

// type EntryType = "tree" | "commit" | "tag" | "blob"

function serialize(type, body) { // EntryType, any -> string
  return bodec.toString(codec.frame({type:type,body:body}), "base64");
}

function deserialize(str) { // string -> {type: EntryType, body: any}
  return codec.deframe(bodec.fromString(str, "base64"), true);
}

export default async function branch(pkg, name) {
  const localBranches = await localBranchesOf(pkg);
  let branch = localBranches.find(b => b.name == name);
  if (!branch) {
    branch = new Branch(pkg, name);
    if (!(pkg in branches)) branches[pkg] = [];
    branches[pkg].push(branch);
  }
  return branch;
}

class Branch {
  constructor(pkg, name) { // PackageAddress, BranchName -> Branch
    this.pkg = pkg;
    this.name = name;
    this._head = null;
  }
  
  async head() { // -> Commit
    if (this._head) return this._head;
    const repo = await repository(this.pkg),
          h = await repo.readRef(`refs/heads/${this.name}`);
    return this._head = await commit(this.pkg, h);
  }
  
  async setHead(hash) { // Hash -> ()
    const repo = await repository(this.pkg);
    this._head = null;
    const prevHead = await commit(this.pkg, hash);
    this._head = await prevHead.createChangeSetCommit();
    await repo.updateRef(`refs/heads/${this.name}`, this._head.hash);
    emit("lively.changesets/changed", {changeset: this.name});
  }
  
  async createFrom(commit) { // Commit -> ()
    const repo = await repository(this.pkg),
          prevHead = await commit.stableBase();
    this._head = await prevHead.createChangeSetCommit();
    await repo.updateRef(`refs/heads/${this.name}`, this._head.hash);
    emit("lively.changesets/changed", {changeset: this.name});
  }
  
  async createFromActive() { // () -> ()
    let base = activeCommit(this.pkg);
    if (!base) {
      base = await packageHead(this.pkg);
    }
    if (!base) {
      throw new Error("Could not find any commit to use as base");
    }
    return this.createFrom(base);
  }
  
  files(withDir) { // boolean? -> {[RelPath]: Hash}
    return this.head().then(head => head.files(withDir));
  }

  changedFiles(withDir) { // boolean? -> Promise<{[RelPath]: Hash}>
    return this.head().then(head => head.changedFiles(withDir));
  }

  diffFile(relPath) { // RelPath -> Promise<string?>
    return this.head().then(head => head.diffFile(relPath));
  }
  
  getFileContent(relPath) { // RelPath -> Promise<string?>
    return this.head().then(head => head.getFileContent(relPath));
  }

  async setFileContent(relPath, content) { // string, string -> Commit
    // add file as a new commit based on parent and replace current head
    const repo = await repository(this.pkg),
          head = await this.head();
    this._head = await head.setFileContent(relPath, content);
    await repo.updateRef(`refs/heads/${this.name}`, this._head.hash);
    emit("lively.changesets/changed", {changeset: this.name, path: relPath});
    return this._head;
  }
  
  async commitChanges(message) { // string -> Commit
    const repo = await repository(this.pkg),
          head = await this.head(),
          committedHead = await head.createCommit(message);
    this._head = await committedHead.createChangeSetCommit();
    await repo.updateRef(`refs/heads/${this.name}`, this._head.hash);
    emit("lively.changesets/changed", {changeset: this.name});
    return this._head;
  }

  delete(db) { // Database -> Promise<()>
    branches[this.pkg] = branches[this.pkg].filter(b => b !== this);
    return new Promise((resolve, reject) => {
      const key = this.pkg,
            trans = db.transaction(["refs"], "readwrite"),
            store = trans.objectStore("refs"),
            request = store.delete(`${key}/refs/heads/${this.name}`);
      request.onsuccess = evt => resolve(evt.target.result);
      request.onerror = evt => reject(new Error(evt.value));
    });
  }
  
  toString() { // -> String
    return `Branch(${this.pkg}, ${this.name})`;
  }

  async fromObject(obj) { // { ".": Hash, [Hash]: Entry } -> Branch
    const repo = await repository(this.pkg);
    for (const hash in obj) {
      if (hash === ".") {
        await repo.updateRef(`refs/heads/${this.name}`, obj[hash]);
        continue;
      }
      const {type, body} = deserialize(obj[hash]);
      await repo.saveAs(type, body);
    }
    return this;
  }
  
  async toObject() { // -> { ".": Hash, [Hash]: Entry }
    const repo = await repository(this.pkg),
          headCommit = await this.head(),
          changed = await headCommit.changedFiles(true),
          headHash = headCommit.hash,
          result = {};
    for (const relPath in changed) {
      const hash = changed[relPath];
      const {type, body} = await repo.loadRaw(hash);
      result[hash] = serialize(type, body);
    }
    result[headHash] = serialize("commit", headCommit);
    result["."] = headHash;
    return result;
  }

  async pushToGitHub() {
    await enableGitHub();
    const repo = await repository(this.pkg);
    let headCommit = await this.head();
    if (headCommit.message == "work in progress") {
      headCommit = await headCommit.parent();
    }
    await repo.send(`refs/heads/${this.name}`);
    return repo.updateRemoteRef(`refs/heads/${this.name}`, headCommit.hash);
  }
  
  async pullFromGitHub() {
    // PackageAddress, BranchName -> Branch
    await enableGitHub();
    const remoteBranches = await gitHubBranches(this.pkg),
          remoteBranch = remoteBranches.find(b => b.name === this.name);
    return this.setHead(remoteBranch.hash);
  }

  isActive() { // -> Promise<bool>
    return this.head().then(head => activeCommit(this.pkg).hash === head.hash);
  }
  
  async activate() { // () -> ()
    const head = await this.head();
    await head.activate();
    emit("lively.changesets/activated", {branch: this.name});
  }
  
  async deactivate() { // () -> ()
    const head = await this.head();
    await head.deactivate();
    emit("lively.changesets/deactivated", {branch: this.name});
  }
  
}

function parseChangeSetRef(url) {
  // string -> Branch?
  const parts = url.split('/'),
        l = parts.length;
  if (l < 4 || parts[l-3] !== "refs" || parts[l-2] !== "heads") return null;
  return new Branch(parts.slice(0, l - 3).join('/'), parts[l - 1]);
}

async function initBranches() { // () => ()
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
  const allBranches = refs.map(parseChangeSetRef).filter(t => !!t);
  branches = arr.groupBy(allBranches, branch => branch.pkg);
}

export function localBranchesOf(pkg) { // PackageAddress => Promise<Array<Branch>>
  if (branches !== undefined) return Promise.resolve(branches[pkg] || []);
  return initBranches().then(() => branches[pkg] || []);
}
