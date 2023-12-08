/* global fetch */
import jsGit from 'js-git-browser';
const { modes } = jsGit;
import { module } from 'lively.modules';
import { emit } from 'lively.notifications';

import repository from './repo.js';
import { diffStr } from './diff.js';
import { getAuthor } from './settings.js';
import { install } from '../index.js';

let active; // PackageAddress -> Commit

function getDate () { // -> {seconds: number, offset: number}
  const d = new Date();
  return { seconds: d.valueOf() / 1000, offset: d.getTimezoneOffset() };
}

function packageGitHead (pkg) { // PackageAddress -> Hash?
  return fetch(`${pkg}/package.json`)
    .then(res => res.json())
    .then(conf => conf && conf.gitHead || null)
    .catch(e => null);
}

function localGitHead (pkg) { // PackageAddress -> Promise<Hash?>
  return fetch(`${pkg}/.git/HEAD`)
    .then(res => res.text())
    .then(head => {
      if (typeof head !== 'string') return null;
      const match = head.match(/^ref: ([^\n]+)\n/);
      if (!match) return null;
      return fetch(`${pkg}/.git/${match[1]}`);
    })
    .then(res => res.text())
    .then(hash => {
      if (typeof hash !== 'string') return null;
      const match = hash.match(/^([0-9a-f]+)/);
      return match ? match[1] : null;
    })
    .catch(e => null);
}

function gitMasterHead (pkg) {
  // PackageAddress -> Promise<Hash?>
  return repository(pkg)
    .then(repo => repo.readRef('refs/heads/master'))
    .catch(e => null);
}

export async function packageHead (pkg) { // PackageAddress -> Commit?
  let baseHead = await packageGitHead(pkg);
  if (!baseHead) {
    baseHead = await localGitHead(pkg);
  }
  if (!baseHead) {
    baseHead = await gitMasterHead(pkg);
  }
  if (!baseHead) {
    console.error('Unable to locate git commit for HEAD');
    return null;
  }
  return commit(pkg, baseHead);
}

export function activeCommit (pkg) { // PackageAddress -> Commit?
  if (active === undefined) {
    active = {};
  }
  return active[pkg] || null;
}

export default async function commit (pkg, hash) {
  // PackageAddress, Hash -> Commit
  const repo = await repository(pkg);
  const data = await repo.loadAs('commit', hash);
  return new Commit(pkg, hash, data);
}

class Commit {
  constructor (pkg, hash, data) {
    // PackageAddress, Hash, {author, committer, message, parents, tree} -> ()
    this.pkg = pkg;
    this.hash = hash;
    this.author = data.author;
    this.committer = data.committer;
    this.message = data.message;
    this.parents = data.parents;
    this.tree = data.tree;
  }

  parent () { // () -> Promise<Commit>
    return this.parents[0]
      ? commit(this.pkg, this.parents[0])
      : Promise.resolve(null);
  }

  stableBase () { // () -> Promise<Commit>
    if (this.message != 'work in progress') {
      return Promise.resolve(this);
    }
    return this.parent().then(p => p.stableBase());
  }

  async files (withDir) { // boolean -> {[RelPath]: Hash}
    const repo = await repository(this.pkg);
    const treeStream = await repo.treeWalk(this.tree);
    const files = {};
    let obj;
    while (obj = await treeStream.read()) {
      const path = obj.path.replace(/^\//, '');
      if (withDir && obj.mode === modes.tree) {
        files[path] = obj.hash;
      }
      if (obj.mode !== modes.file) continue;
      files[path] = obj.hash;
    }
    return files;
  }

  async changedFiles (withDir) { // boolean? -> {[RelPath]: Hash}
    const files = await this.files(withDir);
    const parent = await this.parent();
    const parentFiles = await parent.files(withDir);
    const changedFiles = {};
    Object.keys(files).forEach(relPath => {
      if (files[relPath] != parentFiles[relPath]) {
        changedFiles[relPath] = files[relPath];
      }
    });
    return changedFiles;
  }

  async diffFile (relPath) { // RelPath -> string
    const file = await this.getFileContent(relPath);
    const parent = await this.parent();
    const parentFile = parent && (await parent.getFileContent(relPath));
    return diffStr(parentFile || '', file || '');
  }

  async createCommit (message) { // string -> Commit
    // return new commit based on current parent and tree
    const repo = await repository(this.pkg);
    const author = Object.assign(getAuthor(), { date: getDate() });
    const data = { tree: this.tree, author, committer: author, message, parents: this.parents };
    const commitHash = await repo.saveAs('commit', data);
    return new Commit(this.pkg, commitHash, data);
  }

  async createChangeSetCommit () { // () -> Commit
    // create a commit and a ref for this branch based on other branch
    const repo = await repository(this.pkg);
    const author = Object.assign(getAuthor(), { date: getDate() });
    const message = 'work in progress';
    const commitHash = await repo.saveAs('commit', { tree: this.tree, author, committer: author, message, parents: [this.hash] });
    return commit(this.pkg, commitHash);
  }

  async fileExists (relPath) { // RelPath -> boolean
    const files = await this.files();
    return !!files[relPath];
  }

  async getFileContent (relPath) { // RelPath -> string?
    const repo = await repository(this.pkg);
    const files = await this.files();
    if (!files[relPath]) return null;
    return repo.loadAs('text', files[relPath]);
  }

  async setFileContent (relPath, content) { // string, string -> Commit
    // add file as a new commit based on parent and replace current head
    const prevContent = await this.getFileContent(relPath);
    if (prevContent == content) return this;
    const repo = await repository(this.pkg);
    const author = Object.assign(getAuthor(), { date: getDate() });
    const message = 'work in progress';
    const changes = [{
      path: relPath,
      mode: modes.file,
      content
    }];
    changes.base = this.tree;
    const tree = await repo.createTree(changes);
    const data = { tree, author, committer: author, message, parents: this.parents };
    const commitHash = await repo.saveAs('commit', data);
    return new Commit(this.pkg, commitHash, data);
  }

  async activate () { // () -> ()
    const prev = activeCommit(this.pkg);
    if (prev && this.hash == prev.hash) return;
    console.log(`prev ${prev && prev.hash.substr(0, 8)}`);
    const nextFiles = await this.files();
    let prevFiles;
    if (prev) {
      prevFiles = await prev.files();
    } else {
      prevFiles = Object.keys(nextFiles).reduce((o, k) => { o[k] = 0; return o; }, {});
    }
    this.setActive();
    install();
    for (const relPath in prevFiles) {
      const prevHash = prevFiles[relPath];
      const nextHash = nextFiles[relPath];
      const mod = `${this.pkg}/${relPath}`;
      if (prevHash && nextHash && prevHash != nextHash && module(mod).isLoaded() && (/\.js$/i).test(relPath)) {
        const newSource = await this.getFileContent(relPath);
        await module(mod)
          .changeSource(newSource, { targetModule: mod, doEval: true, doSave: false })
          .catch(e => console.error(e));
      }
    }
    emit('lively.changesets/activated', { pkg: this.pkg, hash: this.hash });
  }

  setActive () {
    active[this.pkg] = this;
  }

  async deactivate () { // () -> ()
    const prevFiles = await this.files();
    delete active[this.pkg];
    for (const relPath in prevFiles) {
      const prevHash = prevFiles[relPath];
      const mod = `${this.pkg}/${relPath}`;
      if (module(mod).isLoaded() && (/\.js$/i).test(relPath)) {
        await module(mod).reload({ reset: true }).catch(e => console.error(e));
      }
    }
  }

  isActive () { // -> bool
    return this.hash === activeCommit(this.pkg).hash;
  }

  toString () { // -> String
    return `Commit(${this.pkg}, ${this.hash.substr(0, 8)})`;
  }
}
