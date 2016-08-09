import { mixins, modes, promisify, codec, bodec } from 'js-git-browser';
import { gitHubToken, gitHubURL } from './github-integration.js';
import { packageGitHead, localGitHead } from './local-git-integration.js';
import { diffStr } from "./diff.js";

const repoForPackage = {};

function getAuthor() { // -> {name: string, email: string}
  return {name: "John Doe", email: "john@example.org"};
}

// type EntryType = "tree" | "commit" | "tag" | "blob"

function serialize(type, body) { // EntryType, any -> string
  return bodec.toString(codec.frame({type:type,body:body}), "base64");
}

function deserialize(str) { // string -> {type: EntryType, body: any}
  return codec.deframe(bodec.fromString(str, "base64"), true);
}

export default class Branch {
  constructor(name, pkg) { // ChangeSetName, PackageAddress
    this.name = name;
    this.pkg = pkg;
  }
  
  async repo() { // -> Repository
    if (this.pkg in repoForPackage) {
      return repoForPackage[this.pkg];
    }
    // local IndexedDB
    const repo = {};
    await new Promise((resolve, reject) => {
      mixins.indexed.init(err => err ? reject(err) : resolve());
    });
    mixins.indexed(repo, this.pkg);
    
    // GitHub fall through
    const url = await gitHubURL(this.pkg);
    if (url != null) {
      const remote = {};
      mixins.github(remote, url, await gitHubToken());
      mixins.readCombiner(remote);
      mixins.sync(repo, remote);
      mixins.fallthrough(repo, remote);
    }
    
    // Other plugins
    mixins.createTree(repo);
    mixins.memCache(repo);
    mixins.readCombiner(repo);
    mixins.walkers(repo);
    mixins.formats(repo);
    promisify(repo);
    return repoForPackage[this.pkg] = repo;
  }
  
  async head() { // -> Entry?
    const repo = await this.repo(),
          headHash = await repo.readRef(`refs/heads/${this.name}`);
    if (!headHash) return null;
    return repo.loadAs("commit", headHash);
  }
  
  async tree() { // -> Hash?
    const commit = await this.head();
    if (!commit) return null;
    return commit.tree;
  }
  
  async filesForTree(tree, withDir) {
    // Tree, boolean -> {[RelPath]: Hash}
    const repo = await this.repo();
    const treeStream = await repo.treeWalk(tree),
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
  
  async files(withDir = false) { // boolean? -> {[RelPath]: Hash}
    const tree = await this.tree();
    if (!tree) throw new Error("File tree not found in git");
    return this.filesForTree(tree, withDir);
  }
  
  async parent() { // () -> Commit
    const repo = await this.repo(),
          commitHash = await repo.readRef(`refs/heads/${this.name}`),
          commit = await repo.loadAs("commit", commitHash);
    return repo.loadAs("commit", commit.parents[0]);
  }
  
  async changedFiles(withDir) { // boolean? -> {[RelPath]: Hash}
    const repo = await this.repo(),
          files = await this.files(withDir),
          parentTree = (await this.parent()).tree;
    if (!parentTree) throw new Error("File tree not found in git");
    const parentFiles = await this.filesForTree(parentTree, withDir),
          changedFiles = {};
    Object.keys(files).forEach(relPath => {
      if (files[relPath] != parentFiles[relPath]) {
        changedFiles[relPath] = files[relPath];
      }
    });
    return changedFiles;
  }

  async diffFile(relPath) {
    const repo = await this.repo(),
          file = await this.getFileContent(relPath),
          parentTree = (await this.parent()).tree;
    if (!parentTree) throw new Error("File tree not found in git");
    const parentFiles = await this.filesForTree(parentTree),
          parentFile = await repo.loadAs("text", parentFiles[relPath]);
    return diffStr(parentFile, file);
  }
  
  async createFrom(baseHead) { // Hash -> ()
    // create a commit and a ref for this branch based on other branch
    const repo = await this.repo();
    const tree = (await repo.loadAs("commit", baseHead)).tree,
          author = Object.assign(getAuthor(), {date: new Date()}),
          message = "created changeset",
          commitHash = await repo.saveAs("commit", {tree, author, message, parents: [baseHead]});
    return repo.updateRef(`refs/heads/${this.name}`, commitHash);
  }
  
  async createFromCS(csName) { // ChangeSetName -> ()
    // create a commit and a ref for this branch based on other branch
    const repo = await this.repo(),
          baseHead = await repo.readRef(`refs/heads/${csName}`);
    if (!baseHead) throw new Error(`Could not find branch ${csName}`);
    return this.createFrom(baseHead);
  }

  async createFromHead() { // () -> ()
    // create a commit and a ref for this branch based on other branch
    let baseHead = await packageGitHead(this.pkg);
    if (!baseHead) {
      baseHead = await localGitHead(this.pkg);
    }
    if (!baseHead) {
      return this.createFromCS("master");
    }
    return this.createFrom(baseHead);
  }
  
  async fileExists(relPath) { // RelPath -> boolean?
    const files = await this.files();
    return !!files[relPath];
  }

  async getFileContent(relPath) { // RelPath -> string?
    const repo = await this.repo(),
          files = await this.files();
    if (!files[relPath]) return null;
    return await repo.loadAs("text", files[relPath]);
  }

  async setFileContent(relPath, content) { // string, string -> ()
    // add file as a new commit based on parent and replace current head
    const prevContent = await this.getFileContent(relPath);
    if (prevContent == content) return;
    const repo = await this.repo(),
          base = await this.head(),
          author = Object.assign(getAuthor(), {date: new Date()}),
          message = "work in progress",
          changes = [{
            path: relPath,
            mode: modes.file,
            content}];
    changes.base = await this.tree();
    const tree = await repo.createTree(changes),
          commitHash = await repo.saveAs("commit", {tree, author, message, parents: base.parents});
    return repo.updateRef(`refs/heads/${this.name}`, commitHash);
  }

  delete(db) {
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
    return `Branch(${this.name}, ${this.pkg})`;
  }

  async fromObject(obj) { // { ".": Hash, [Hash]: Entry } -> Branch
    const repo = await this.repo();
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
    const repo = await this.repo(),
          changed = await this.changedFiles(true),
          headHash = await repo.readRef(`refs/heads/${this.name}`),
          headCommit = await repo.loadAs("commit", headHash),
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

}
