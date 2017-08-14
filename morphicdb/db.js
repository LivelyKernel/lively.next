/*global System,inspect*/
import { ObjectDBHTTPInterface } from "lively.storage/objectdb.js";
import { Database } from "lively.storage";
import { loadMorphFromSnapshot, createMorphSnapshot } from "../serialization.js";
import { resource } from "lively.resources";
import { obj } from "lively.lang";

/*

$world.execCommand("open workspace", {
  backend: "http://localhost:9011/eval",
  content: `
import ObjectDB from "lively.storage/objectdb.js";

// await ObjectDB.dbList()

let db = await ObjectDB.find("lively.morphic/objectdb/morphicdb")
let commitDB = await db._commitDB()
let versionDB = await db._versionDB()

await versionDB.getAll()
`});

*/
var morphicDBs = morphicDBs || (morphicDBs = new Map());
const defaultServerURL = (typeof document !== "undefined" ? document.origin : "http://localhost:9001") + "/objectdb/"

export default class MorphicDB {

  static get default() {
    return this.named("lively.morphic/objectdb/morphicdb", {serverURL: defaultServerURL});
  }

  static named(name, options) {
    let existing = morphicDBs.get(name);
    if (existing) return existing;
    if (!options.serverURL) throw new Error("Needs serverURL!");
    let db = new this(name, options);
    morphicDBs.set(name, db);
    return db;
  }

  constructor(name, {serverURL}) {
    this.name = name;
    this.serverURL = serverURL;
    this.httpDB = new ObjectDBHTTPInterface(serverURL);
    this._initialized = false;
    this._cacheDB = new Database(this.name + "-cache");
  }

  __serialize__() {
    let {name, serverURL} = this;
    return {
      __expr__: `MorphicDB.named("${name}", {serverURL: "${serverURL}"})`,
      bindings: {"lively.morphic/morphicdb.js": [{exported: "default", local: "MorphicDB"}]}
    }
  }

  get snapshotLocation() { return `${this.name}/snapshots/`; }

  async initializeIfNecessary() {
    if (this._initialized) return;
    await this.ensureDB();
    this._initialized = true;
  }

  snapshotResourceFor(commit) {
    // content is sha1 hash
    let first = commit.content.slice(0, 2),
        rest = commit.content.slice(2);
    return resource(System.decanonicalize(this.snapshotLocation))
            .join(`${first}/${rest}.json`);
  }

  ensureDB() {
    let {name: db, snapshotLocation} = this;
    return this.httpDB.ensureDB({db, snapshotLocation});
  }

  destroyDB() {
    this._initialized = false;
    let {name: db} = this;
    return this.httpDB.destroyDB({db});
  }

  async latestCommits(type = "world") {
    // await MorphicDB.default.latestCommits()
    await this.initializeIfNecessary();
    let {name: db} = this,
        ref = "HEAD", knownCommitIds = {};
    return this.httpDB.fetchCommits({db, type, ref, knownCommitIds});
  }

  async fetchCommit(type, name, ref) {
    await this.initializeIfNecessary();
    let typesAndNames = [{type, name, ref}],
        commits = await this.httpDB.fetchCommits(
          {db: this.name, ref, type, typesAndNames});
    return commits[0];
  }

  async fetchSnapshot(type, name, commitIdOrCommit, ref) {
    let firstArg = type;
    if (arguments.length === 1 && firstArg.type && firstArg.name) {
      type = firstArg.type;
      name = firstArg.name;
      commitIdOrCommit = firstArg._id;
    }
    await this.initializeIfNecessary();
    let {name: db} = this;
    return this.httpDB.fetchSnapshot({db, type, name, ref, commit: commitIdOrCommit});
  }

  async exists(type, name, ref) {
    // await MorphicDB.default.latestWorldCommits()
    await this.initializeIfNecessary();
    let {name: db} = this;
    return this.httpDB.exists({db, type, name, ref});
  }

  async history(type, name) {
    // await MorphicDB.default.latestWorldCommits()
    await this.initializeIfNecessary();
    let {name: db} = this;
    return this.httpDB.fetchVersionGraph({db, type, name});
  }

  async log(commit, limit, includeCommits = false, knownCommitIds) {
    await this.initializeIfNecessary();
    let {name: db} = this;
    return this.httpDB.fetchLog({db, commit, limit, includeCommits, knownCommitIds});
  }

  async snapshotAndCommit(type, name, morph, snapshotOptions, commitSpec, ref, expectedParentCommit) {
    let snapshot = await createMorphSnapshot(morph, snapshotOptions),
        commit = await this.commit(type, name, snapshot, commitSpec, ref, expectedParentCommit);
    morph.changeMetaData("commit", commit, /*serialize = */false, /*merge = */false);
    
    return commit;
  }

  async commit(type, name, snapshot, commitSpec, ref, expectedParentCommit) {
    let firstArg = type;
    if (arguments.length === 1 && firstArg.type && firstArg.name) {
      type = firstArg.type;
      name = firstArg.name;
      snapshot = firstArg.snapshot || firstArg.content;
      commitSpec = obj.dissoc(firstArg, ["snapshot", "_rev", "_id", "ancestors", "deleted"]);
      expectedParentCommit = firstArg._id;
    }
      
    await this.initializeIfNecessary();
    let {name: db} = this;
    return this.httpDB.commit({
      db,
      type,
      name,
      ref,
      expectedParentCommit,
      commitSpec,
      snapshot
    });
  }

  async load(type, name, loadOptions, commitIdOrCommit, ref) {
    let commit = commitIdOrCommit;
    if (!commit) {
      commit = await this.fetchCommit(type, name, ref);
    } else if (typeof commit === "string") {
      [commit] = await this.log(commit, 1, true);
    }
    let snapshot = await this.fetchSnapshot(undefined, undefined, commit._id),
        morph = await loadMorphFromSnapshot(snapshot, loadOptions);
    morph.changeMetaData("commit", commit, /*serialize = */false, /*merge = */false);
    return morph;
  }

  async delete(type, name, dryRun = true) {
    await this.initializeIfNecessary();
    let {name: db} = this;
    return this.httpDB.delete({db,type,name,dryRun});
  }

}
