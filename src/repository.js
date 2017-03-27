// await lively.modules.module("https://lively-next.org/js-git-browser/js-git-browser.js").unload()

import { mixins, promisify } from "../dist/js-git-browser.js"
import JsGitWebDAVFs from "./js-git-webdav-fs.js";


export default class WebDAVRepository {

  constructor(url) {
    this.rootPath = url;
    this.fs = new JsGitWebDAVFs();
    mixins.fsDb(this, this.fs);
    mixins.createTree(this);
    mixins.formats(this);
    mixins.readCombiner(this);
    mixins.packOps(this);
    mixins.walkers(this);
    // jsgit.mixins.memCache(repo);
    promisify(this);
  }

  get url() { return this.rootPath }

  get master() { return this.readRef("refs/heads/master"); }
}


// let repo = new WebDAVRepository("https://lively-next.org/lively.morphic/.git/")
// await repo.master

// import { runCommand } from "lively.morphic/ide/shell/shell-interface.js";
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
