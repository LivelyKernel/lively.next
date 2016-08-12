/* global fetch */
import { modes } from "js-git-browser";
import { module } from "lively.modules";

import repository from "./repo.js";
import { diffStr } from "./diff.js";

function getAuthor() { // -> {name: string, email: string}
  return {name: "John Doe", email: "john@example.org"};
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
    return commit(this.pkg, this.parents[0]);
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
          parentFile = await parent.getFileContent(relPath);
    return diffStr(parentFile, file);
  }
  
  async createChangeSetCommit() { // Hash -> ()
    // create a commit and a ref for this branch based on other branch
    const repo = await repository(this.pkg),
          author = Object.assign(getAuthor(), {date: new Date()}),
          message = "created changeset",
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
          author = Object.assign(getAuthor(), {date: new Date()}),
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
  
  async activate(prev) { // () -> ()
    if (this.hash == prev.hash) return;
    const prevFiles = await prev.files(),
          nextFiles = await this.files();
    for (const relPath in prevFiles) {
      const prevHash = prevFiles[relPath],
            nextHash = nextFiles[relPath],
            mod = `${this.pkg}/${relPath}`;
      if (prevHash && nextHash && prevHash != nextHash && module(mod).isLoaded()) {
        const newSource = await this.getFileContent(relPath);
        await module(mod)
          .changeSource(newSource, {targetModule: mod, doEval: true})
          .catch(e => console.error(e));
      }
    }
  }

  toString() { // -> String
    return `Commit(${this.pkg}, ${this.hash})`;
  }
}
