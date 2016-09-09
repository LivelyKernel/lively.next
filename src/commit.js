/* global fetch */
import { modes } from "js-git-browser";
import { module } from "lively.modules";

import repository from "./repo.js";
import { diffStr } from "./diff.js";
import { targetChangeSet } from "./changeset.js";
import { getAuthor } from "./settings.js";
import { activeCommit } from "../index.js";

function getDate() { // -> {seconds: number, offset: number}
  const d = new Date();
  return {seconds: d.valueOf() / 1000, offset: d.getTimezoneOffset()};
}

export default async function commit(pkg, hash) {
  // PackageAddress, Hash -> Commit
  const repo = await repository(pkg),
        data = await repo.loadAs("commit", hash);
  return new Commit(pkg, hash, data);
}

function packageGitHead(pkg) { // PackageAddress -> Hash?
  return fetch(`${pkg}/package.json`)
    .then(res => res.json())
    .then(conf => conf && conf.gitHead || null)
    .catch(e => null);
}

function localGitHead(pkg) { // PackageAddress -> Promise<Hash?>
  return fetch(`${pkg}/.git/HEAD`)
    .then(res => res.text())
    .then(head => {
      if (typeof head !== "string") return null;
      const match = head.match(/^ref: ([^\n]+)\n/);
      if (!match) return null;
      return fetch(`${pkg}/.git/${match[1]}`);
    })
    .then(res => res.text())
    .then(hash => {
      if (typeof hash !== "string") return null;
      const match = hash.match(/^([0-9a-f]+)/);
      return match ? match[1] : null;
    })
    .catch(e => null);
}

function gitMasterHead(pkg) {
  // PackageAddress -> Promise<Hash?>
  return repository(pkg)
    .then(repo => repo.readRef("refs/heads/master"))
    .catch(e => null);
}

export async function packageHead(pkg) { // PackageAddress -> Commit
  let baseHead = await packageGitHead(pkg);
  if (!baseHead) {
    baseHead = await localGitHead(pkg);
  }
  if (!baseHead) {
    baseHead = await gitMasterHead(pkg);
  }
  if (!baseHead) {
    throw new Error("Unable to locate git commit for HEAD");
  }
  return commit(pkg, baseHead);
}

class Commit {
  constructor(pkg, hash, data) {
    // PackageAddress, Hash, {author, committer, message, parents, tree} -> ()
    this.pkg = pkg;
    this.hash = hash;
    this.author = data.author;
    this.committer = data.committer;
    this.message = data.message;
    this.parents = data.parents;
    this.tree = data.tree;
  }
  
  parent() { // () -> Promise<Commit>
    return this.parents[0]
            ? commit(this.pkg, this.parents[0])
            : Promise.resolve(null);
  }
  
  stableBase() { // () -> Promise<Commit>
    if (this.message != "work in progress") {
      return Promise.resolve(this);
    }
    return this.parent().then(p => p.stableBase());
  }

  async files(withDir) { // boolean -> {[RelPath]: Hash}
    const repo = await repository(this.pkg);
    const treeStream = await repo.treeWalk(this.tree),
          files = {};
    let obj;
    while (obj = await treeStream.read()) {
      const path = obj.path.replace(/^\//, "");
      if (withDir && obj.mode === modes.tree) {
        files[path] = obj.hash;
      }
      if (obj.mode !== modes.file) continue;
      files[path] = obj.hash;
    }
    return files;
  }
  
  async changedFiles(withDir) { // boolean? -> {[RelPath]: Hash}
    const files = await this.files(withDir),
          parent = await this.parent(),
          parentFiles = await parent.files(withDir),
          changedFiles = {};
    Object.keys(files).forEach(relPath => {
      if (files[relPath] != parentFiles[relPath]) {
        changedFiles[relPath] = files[relPath];
      }
    });
    return changedFiles;
  }

  async diffFile(relPath) { // RelPath -> string
    const file = await this.getFileContent(relPath),
          parent = await this.parent(),
          parentFile = parent && (await parent.getFileContent(relPath));
    return diffStr(parentFile || '', file || '');
  }
  
  async createCommit(message) { // string -> Commit
    // return new commit based on current parent and tree
    const repo = await repository(this.pkg),
          author = Object.assign(getAuthor(), {date: getDate()}),
          data = {tree: this.tree, author, committer: author, message, parents: this.parents},
          commitHash = await repo.saveAs("commit", data);
    return new Commit(this.pkg, commitHash, data);
  }
  
  async createChangeSetCommit() { // () -> ()
    // create a commit and a ref for this branch based on other branch
    const repo = await repository(this.pkg),
          author = Object.assign(getAuthor(), {date: getDate()}),
          message = "work in progress",
          commitHash = await repo.saveAs("commit", {
            tree: this.tree, author, committer: author, message, parents: [this.hash]});
    return commit(this.pkg, commitHash);
  }
  
  async fileExists(relPath) { // RelPath -> boolean
    const files = await this.files();
    return !!files[relPath];
  }

  async getFileContent(relPath) { // RelPath -> string?
    const repo = await repository(this.pkg),
          files = await this.files();
    if (!files[relPath]) return null;
    return repo.loadAs("text", files[relPath]);
  }

  async setFileContent(relPath, content) { // string, string -> Commit
    // add file as a new commit based on parent and replace current head
    const prevContent = await this.getFileContent(relPath);
    if (prevContent == content) return this;
    const repo = await repository(this.pkg),
          author = Object.assign(getAuthor(), {date: getDate()}),
          message = "work in progress",
          changes = [{
            path: relPath,
            mode: modes.file,
            content}];
    changes.base = this.tree;
    const tree = await repo.createTree(changes),
          data = {tree, author, committer: author, message, parents: this.parents},
          commitHash = await repo.saveAs("commit", data);
    return new Commit(this.pkg, commitHash, data);
  }
  
  async activate(prev) { // Commit? -> ()
    if (!prev) prev = await activeCommit(this.pkg);
    if (this.hash == prev.hash) return;
    const prevFiles = await prev.files(),
          nextFiles = await this.files();
    for (const relPath in prevFiles) {
      const prevHash = prevFiles[relPath],
            nextHash = nextFiles[relPath],
            mod = `${this.pkg}/${relPath}`;
      if (prevHash && nextHash && prevHash != nextHash && module(mod).isLoaded() && (/\.js$/i).test(relPath)) {
        const newSource = await this.getFileContent(relPath);
        await module(mod)
          .changeSource(newSource, {targetModule: mod, doEval: true})
          .catch(e => console.error(e));
      }
    }
  }
  
  isActive() { // -> Promise<bool>
    return activeCommit(this.pkg).then(c => c && c.hash == this.hash);
  }

  toString() { // -> String
    return `Commit(${this.pkg}, ${this.hash})`;
  }
}
