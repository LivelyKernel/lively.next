import { mixins, promisify, modes } from "../dist/js-git-browser.js"
import JsGitWebDAVFs from "./js-git-webdav-fs.js";
import { Database } from "lively.storage";

// await lively.modules.module("https://lively-next.org/js-git-browser/js-git-browser.js").unload()

class FetchLogProcess {

  constructor(repo) {
    this.repo = repo;
    this.canceled = false;
    this.cancelRequested = false;
    this.running = false;
    this.error = null;
    this.logStream = null;
    this.commits = [];
    this.whenDone = Promise.resolve(null);
  }

  stop() { this.cancelRequested = true; };
  
  run(fromRef, limit, onUpdate) {

    this.whenDone = this.logWalkWithLocalDb(fromRef, limit, onUpdate)
      .catch(err => {
        console.error(`fetchLog error: ${err}`)
        this.running = false;
        this.error = err;
        throw err;
      });

    return this;

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // We can also loop through all the files of each commit version.
    // var treeStream = await repo.treeWalk(commit.tree);
    // while (object = await treeStream.read(), object !== undefined) {
    //   console.log(object);
    // }
  }

  async logWalkWithLocalDb(ref, limit = Infinity, onUpdate) {
    let seen = {},
        repo = this.repo,
        last = await repo.readRef("shallow"),
        refsToLoad = [ref];

    repo.fetchProcesses.push(this);
    this.running = true;

    while (true) {
      if (this.cancelRequested) this.canceled = true;
      if (this.canceled || !this.running) {
        repo.fetchProcesses.splice(repo.fetchProcesses.indexOf(this), 1);
        break;
      }

      let ref = refsToLoad.shift(),
          commit = await repo.localDb.get(ref),
          hash = commit ? commit.hash : null,
          saveInDb = false;

      if (!commit) {
        hash = await repo.resolveRef(ref);
        commit = await repo.loadAs("commit", hash);
        if (commit) commit.hash = hash;
        if (hash === last) {
          commit.last = true;
          this.running = false;
        }
        saveInDb = true;
      }

      if (!commit) {
        let err = new Error(`Cannot resolve ref ${ref}`);
        this.error = err;
        this.running = false;
        throw err;
      }

      seen[hash] = true;    
      this.commits.push(commit);
      typeof onUpdate === "function" && onUpdate(this);

      if (saveInDb)
        await repo.localDb.set(commit.hash, {...commit, type: "commit"});

      refsToLoad.push(...commit.parents.filter(hash => !seen[hash]));
      if (!refsToLoad.length || this.commits.length > limit)
        this.running = false;
    }

    return this;
  }


  toString() {
    return this.error ?
      `<commit fetcher errored: ${this.error} >` :
      `<commit fetcher ${this.running ? `is running` : this.canceled ? "was canceled" : "finished"} found ${this.commits.length} from ${this.fromRef}>`;
  }

}

export default class WebDAVRepository {

  constructor(url) {
    this.rootPath = url;
    this.fs = new JsGitWebDAVFs();
    this.localDb = Database.ensureDB("lively.git-" + url.replace(/^https?:\/\//, ""));
    mixins.fsDb(this, this.fs);
    mixins.createTree(this);
    mixins.formats(this);
    mixins.readCombiner(this);
    mixins.packOps(this);
    mixins.walkers(this);
    // jsgit.mixins.memCache(repo);
    this.fetchProcesses = [];
    promisify(this);
  }

  get url() { return this.rootPath }

  get master() { return this.resolveRef("refs/heads/master"); }

  async resolveRef(hashish, seen = {}) {
    if (seen[hashish] || /^[0-9a-f]{40}$/.test(hashish)) return hashish;
    seen[hashish] = true;
    let hash = await this.readRef(hashish);
    if (!hash) throw new Error("Bad ref " + hashish);
    if (hash.startsWith("ref: ")) hash = hash.slice(5);
    return hash === hashish ? hash : this.resolveRef(hash, seen);
  }

  commits(fromRef, limit, onUpdate) {
    let fetchProc = new FetchLogProcess(this).run(fromRef, limit, onUpdate);
    return fetchProc.whenDone.then(() => fetchProc.commits);
  }
    
  async readFileObject(object, readAs = "text") {
    // object {hash, mode, path}
    // readAs = "text"|"blob"
    if (object.mode !== modes.file) return undefined;
    let content
    try {
      content = await this.loadAs(readAs, object.hash);
    } catch (err) {
      content = await this.loadAs("blob", object.hash);
    }
    return {content, ...object};
  }

}


// let repo = new WebDAVRepository("https://lively-next.org/lively.morphic/.git/")
// await repo.master

// import { runCommand } from "lively.ide/shell/shell-interface.js";
// import { arr, num } from "lively.lang";
// import { Database } from "lively.storage";
// 
// const modes = jsgit.modes;
// 
// function makeRepo(rootPath) {
//   let repo = {fs: new window.JsGitHTTPBackend(), rootPath: rootPath};
//   jsgit.mixins.fsDb(repo, repo.fs);
//   jsgit.mixins.createTree(repo);
//   jsgit.mixins.formats(repo);
//   jsgit.mixins.readCombiner(repo);
//   jsgit.mixins.packOps(repo);
//   jsgit.mixins.walkers(repo);
//   // jsgit.mixins.memCache(repo);
//   return jsgit.promisify(repo);
// }
// 
// 
// async function commitChanges(repo, changes, author, message = "empty commit message", date = author.date || new Date(), parents = []) {
//   author = {...author, date}
//   var tree = await repo.createTree(changes),
//       commitHash = await repo.saveAs("commit", {tree, author, message, parents});
//   await repo.updateRef("refs/heads/master", commitHash);
//   return commitHash;
// }
// 
// async function loadFilesFromCommit(repo, commitHash, readAs) {
//   var {tree} = await repo.loadAs("commit", commitHash)
//   return loadFilesFromTree(repo, tree, readAs);
// }
// 
// async function loadFilesFromTree(repo, treeHash, readAs = "text") {
//   // readAs = "text"|"blob"
//   var textObjs = [], reader = await repo.treeWalk(treeHash), obj;
//   while (obj = await reader.read()) {
//     if (obj.mode !== modes.file) continue;
//     let content;
//     try {
//       content = await repo.loadAs(readAs, obj.hash);
//     } catch (err) {
//       content = await repo.loadAs("blob", obj.hash);
//     }
//     textObjs.push({content: content, ...obj})
//   }
//   return textObjs;
// }
// 
// async function storeIntoDataBase(repo, files) {
// 
//   let db = Database.ensureDB(`git-${repo.rootPath}`, {adapter: "idb"});
//   await db.destroy()
// 
//   await db.set("refs/heads/master", {type: "ref", value: headHash})
// 
//   await Promise.all(files.map(({content, hash, mode, path}) => {
//     let isText = typeof content === "string",
//         id = hash,
//         doc = {type: "file", hash, mode, path};
//     if (isText) return db.set(id, {content, ...doc});
//     let [_, ext] = path.match(/\.([^\.]+)$/) || [],
//         content_type = window.mime_extToTypes[ext] || "application/octet-stream",
//         blob = new Blob([content], {type: "octet/stream"});;
//     return db.set(id, {...doc, _attachments: {content: {content_type, data: blob}}});
//   }))
// 
// }
// // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// 
// 
// async function test() {
// 
//   await runCommand("rm -rf test-git; cp -r test-git{.bak,}", {cwd: "/home/lively/lively-web.org/lively.next"}).whenDone();
// 
// 
//   let repo = makeRepo("https://lively-next.org/lively.morphic/.git/")
//   var headHash = await repo.readRef("refs/heads/master");
//   let files = await loadFilesFromCommit(repo, headHash);
// 
//   num.humanReadableByteSize(files.reduce((size, ea) => size + ea.content.length, 0));
// 
// 
// 
//   // for (let i = 0; i < 17; i++)
// 
// 
//   var commitHash = await commitChanges(
//     repo,
//     [...files, {path: "test.txt", mode: jsgit.modes.file, content: "some content"}],
//     {name: "Robert Krahn", email: "robert.krahn@gmail.com"},
//     "test commit",
//     undefined,
//     [headHash]);
// 
//   var headHash = await repo.readRef("refs/heads/master");
//   var logStream = await repo.logWalk(headHash);
//   let commits = []
//   var commit, object;
// 
//   while (commit = await logStream.read(), commit !== undefined) {
//     commits.push(commit);
//     // We can also loop through all the files of each commit version.
//     // var treeStream = await repo.treeWalk(commit.tree);
//     // while (object = await treeStream.read(), object !== undefined) {
//     //   console.log(object);
//     // }
//   }
//   commits.length
// 
// }
