import { mixins, modes, promisify } from 'js-git-browser';
import { gitHubToken, gitHubURL } from './github-integration.js';

const repoForPackage = {};

function getAuthor() {
  return {name: "John Doe", email: "john@example.org"};
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
  
  async head() { // -> Hash?
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
  
  async filesForTree(tree) { // Tree -> {[RelPath]: Hash}
    const repo = await this.repo();
    const treeStream = await repo.treeWalk(tree),
          files = {};
    let obj;
    while (obj = await treeStream.read()) {
      if (obj.mode !== modes.file) continue;
      files[obj.path] = obj.hash;
    }
    return files;
  }
  
  async files() { // -> {[RelPath]: Hash}
    const tree = await this.tree();
    if (!tree) throw new Error("File tree not found in git");
    return this.filesForTree(tree);
  }
  
  async parent() { // () -> Commit
    const repo = await this.repo(),
          commitHash = await repo.readRef(`refs/heads/${this.name}`),
          commit = await repo.loadAs("commit", commitHash);
    return repo.loadAs("commit", commit.parents[0]);
  }
  
  async changedFiles() { // -> {[RelPath]: Hash}
    const repo = await this.repo(),
          files = await this.files(),
          parentTree = (await this.parent()).tree;
    if (!parentTree) throw new Error("File tree not found in git");
    const parentFiles = await this.filesForTree(parentTree),
          changedFiles = {};
    Object.keys(files).forEach(relPath => {
      if (files[relPath] != parentFiles[relPath]) {
        changedFiles[relPath] = files[relPath];
      }
    });
    return changedFiles;
  }
  
  async createFrom(csName) { // ChangeSetName -> ()
    // create a commit and a ref for this branch based on other branch
    const repo = await this.repo(),
          baseHead = await repo.readRef(`refs/heads/${csName}`);
    if (!baseHead) throw new Error(`Could not find branch ${csName}`);
    const tree = (await repo.loadAs("commit", baseHead)).tree,
          author = Object.assign(getAuthor(), {date: new Date()}),
          message = "created changeset",
          commitHash = await repo.saveAs("commit", {tree, author, message, parents: [baseHead]});
    return repo.updateRef(`refs/heads/${this.name}`, commitHash);
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

  evaluate() {
    //TODO
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

}