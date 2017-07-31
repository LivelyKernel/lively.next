/*global System*/
import { ObjectDBHTTPInterface } from "lively.storage/objectdb.js";
import { Database } from "lively.storage";
import { loadMorphFromSnapshot, createMorphSnapshot } from "../serialization.js";
import { resource } from "lively.resources";

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
    // await MorphicDB.default.latestWorldCommits()
    await this.initializeIfNecessary();
    let {name: db} = this,
        ref = "HEAD", knownCommitIds = {};
    return this.httpDB.fetchCommits({db, type, ref, knownCommitIds});
  }

  async fetchCommit(type, name, id, ref) {
    await this.initializeIfNecessary();
    let typesAndNames = !id ? [{type, name, ref}] : undefined,
        knownCommitIds = id ? {[id]: true} : undefined,
        commits = await this.httpDB.fetchCommits(
          {db: this.name, ref, type, typesAndNames, knownCommitIds});
    return commits[0];
  }

  async fetchSnapshot(type, name, commitIdOrCommit, ref) {
    await this.initializeIfNecessary();
    let {name: db} = this;
    return this.httpDB.fetchSnapshot({db, type, name, ref, commit: commitIdOrCommit});
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
    let snapshot = await createMorphSnapshot(morph, snapshotOptions);
    return this.commit(type, name, snapshot, commitSpec, ref, expectedParentCommit);
  }

  async commit(type, name, snapshot, commitSpec, ref, expectedParentCommit) {
    await this.initializeIfNecessary();
    let {name: db} = this;
    console.log({
      db,
      type,
      name,
      ref,
      expectedParentCommit,
      commitSpec,
      snapshot /*, preview*/
    })
    return this.httpDB.commit({
      db,
      type,
      name,
      ref,
      expectedParentCommit,
      commitSpec,
      snapshot /*, preview*/
    });
  }

  async load(type, name, loadOptions, commitIdOrCommit, ref) {
    let snapshot = await this.fetchSnapshot(type, name, commitIdOrCommit, ref);
    return loadMorphFromSnapshot(snapshot, loadOptions);
  }

  async delete(type, name, dryRun = true) {
    await this.initializeIfNecessary();
    let {name: db} = this;
    return this.httpDB.delete({db,type,name,dryRun});
  }

}
