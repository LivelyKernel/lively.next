import { codec, bodec } from "js-git-browser";
import { emit } from 'lively.notifications';

import commit, { packageHead } from "./commit.js";
import repository from "./repo.js";

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
    this._head = null;
  }
  
  async head() { // -> Commit
    if (this._head) return this._head;
    const repo = await repository(this.pkg),
          h = await repo.readRef(`refs/heads/${this.name}`);
    return this._head = await commit(this.pkg, h);
  }
  
  async createFromHead() { // () -> ()
    const repo = await repository(this.pkg),
          prevHead = await packageHead(this.pkg);
    this._head = await prevHead.createChangeSetCommit();
    return repo.updateRef(`refs/heads/${this.name}`, this._head.hash);
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

  async setFileContent(relPath, content) { // string, string -> ()
    // add file as a new commit based on parent and replace current head
    const repo = await repository(this.pkg),
          head = await this.head();
    this._head = await head.setFileContent(relPath, content);
    await repo.updateRef(`refs/heads/${this.name}`, this._head.hash);
    emit("lively.changesets/changed", {changeset: this.name, path: relPath});
  }
  
  async commitChanges(message) { // string -> ()
    const repo = await repository(this.pkg),
          head = await this.head(),
          committedHead = await head.createCommit(message);
    this._head = await committedHead.createChangeSetCommit();
    await repo.updateRef(`refs/heads/${this.name}`, this._head.hash);
    emit("lively.changesets/changed", {changeset: this.name});
  }

  delete(db) { // Database -> Promise<()>
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
    const repo = await repository(this.pkg),
          headCommit = await this.head();
    await repo.send(`refs/heads/${this.name}`);
    await repo.updateRemoteRef(`refs/heads/${this.name}`, headCommit.hash);
  }

  pullFromGitHub() {
    //TODO
  }

}
