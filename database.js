/*global global,self,process,System,require*/
import _PouchDB from "pouchdb";
import pouchdbAdapterMem from "pouchdb-adapter-mem";


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// PouchDB setup

const GLOBAL = typeof window !== "undefined" ? window :
    typeof global !== "undefined" ? global :
      typeof self !== "undefined" ? self : this;

const isNode = typeof global !== "undefined" && typeof process !== "undefined";
var PouchDB = _PouchDB;
PouchDB.plugin(pouchdbAdapterMem);

function nodejsRequire(name) {
  if (!isNode) throw new Error("nodejsRequire can only be used in nodejs!");
  if (typeof System !== "undefined") return System._nodeRequire(name);
  return require("module")._load(name)
}


// nodejs_leveldbPath("test")
// nodejs_leveldbPath("file:///Users/robert/Downloads/hackernews-data")
function nodejs_leveldbPath(dbName) {
  // absolute path?
  if (dbName.startsWith("/")) return dbName;
  if (dbName.match(/[^\/]+:\/\//)) {
    if (dbName.startsWith("file:"))
      dbName = dbName.replace(/^file:\/\//, "");
    return dbName;
  }

  if (!isNode) throw new Error(`nodejs_leveldbPath called under non-nodejs environment`);
  let basePath = typeof System !== "undefined" && System.baseURL.startsWith("file://")
                    ? System.baseURL.replace("file://", "") : GLOBAL.process.cwd()

  // are we in a typical lively.next env? Meaning serverPath points to
  // lively.next-dir/lively.server. If so, use parent dir of lively.server
  let {join} = nodejsRequire("path"),
      {mkdirSync, existsSync, readdirSync, readFileSync} = nodejsRequire("fs");

  if (dbName.includes("/")) return join(basePath, dbName);

  try {
    let parentPackage = readFileSync(join(basePath, "../package.json")),
        conf = JSON.parse(parentPackage)
    if (conf.name === "lively.web" || conf.name === "lively.next") {
      let dbDir = join(basePath, "../.livelydbs")
      if (!existsSync(dbDir)) mkdirSync(dbDir);
      return join(dbDir, dbName);
    }
  } catch (e) {}

  let dbDir = join(basePath, ".livelydbs")
  if (!existsSync(dbDir)) mkdirSync(dbDir);
  return join(dbDir, dbName);
}


function nodejs_attemptToLoadProperPouchDB() {
  // We ship lively.storage with a PouchDB dist version that runs everywhere.
  // This version does not support leveldb, the adapter backend that is needed in
  // nodejs for persistence storage.  Here we try to lazily switch to a PouchDB
  // required via node's require.

  if (!isNode) throw new Error(`nodejs_attemptToLoadProperPouchDB called under non-nodejs environment`);

  if (typeof System !== "undefined") {
    let {join} = System._nodeRequire("path"),
        storageMain = System.normalizeSync("lively.storage/index.js"),
        pouchDBMain = System.normalizeSync("pouchdb", storageMain).replace(/file:\/\//, ""),
        pouchDBNodeMain = join(pouchDBMain, "../../lib/index.js");
    try {
      PouchDB = System._nodeRequire(pouchDBNodeMain);
      PouchDB.plugin(pouchdbAdapterMem);
      return true;
    } catch(e) { return false; }
  }

  try {
    PouchDB = require("pouchdb");
    PouchDB.plugin(pouchdbAdapterMem);
    return true;
  } catch (err) { return false; }
}


// var pouch = createPouchDB("test-db"); pouch.adapter;
let createPouchDB = !isNode ?
  (name, options) => new PouchDB({name, ...options}) :
  (function() {
    let properLoadAttempted = false,
        nodejsCouchDBLoaded = false;
    return function createPouchDB(name, options = {}) {
      if (!properLoadAttempted) {
        properLoadAttempted = true;
        nodejsCouchDBLoaded = nodejs_attemptToLoadProperPouchDB();
      }
      if (!options.adapter) {
        options.adapter = name.startsWith("http") ? "http" :
          nodejsCouchDBLoaded ? "leveldb" : "memory";
      }
      if (options.adapter == "leveldb")
        name = nodejs_leveldbPath(name);
      options = {...options, name};
      return new PouchDB(options);
    }
  })();



// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// main database interface

export default class Database {

  static get PouchDB() { return PouchDB; }
  static set PouchDB(klass) { PouchDB = klass; }

  static get databases() {
    return this._databases || (this._databases = new Map());
  }

  static findDB(name) { return this.databases.get(name); }

  static ensureDB(name, options) {
    let db = this.findDB(name);
    if (db) return db;
    db = new this(name, options);
    this.databases.set(name, db);
    return db;
  }

  constructor(name, options = {}) {
    this.name = name;
    this.options = options;
    this._pouchdb = null;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // initialize / release
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get pouchdb() {
    // lazy pouch db accessor
    if (this._pouchdb) return this._pouchdb;
    let {name, options} = this;
    return this._pouchdb = createPouchDB(name, options);
  }

  close() {
    // close database to free mem
    if (!this._pouchdb) return;
    this._pouchdb.close();
    delete this._pouchdb;
  }

  isDestroyed() { return !!this.pouchdb._destroyed; }

  destroy(opts) {
    // completely get rid of database
    this.constructor.databases.delete(this.name);
    return this.isDestroyed() ? {ok: true} : this.pouchdb.destroy(opts);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing and updating
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async update(_id, updateFn, options, updateAttempt = 0) {
    // Will try to fetch document _id and feed it to updateFn. The result value
    // (promise supported) of updateFn will be used as the next version of
    // document.  If updateFn returns a falsy value the update will be canceled.
    // options: {
    //   ensure: BOOL, // if no document exists, create one, default true
    //   retryOnConflict: BOOL, // if update conflicts retry maxUpdateAttempts
    //                          // times to update doc, default true
    //   maxUpdateAttempts: NUMBER // default 10
    // }
    // returns created document
    options = options || {};

    let {ensure = true, retryOnConflict = true, maxUpdateAttempts = 10} = options,
        getOpts = {latest: true},
        {pouchdb: db} = this, lastDoc, newDoc;

    // 1. get the old doc
    try {
      lastDoc = await db.get(_id, getOpts);
    } catch (e) {
      if (e.name !== "not_found" || !ensure) throw e;
    }

    // 2. retrieve new doc via updateFn
    newDoc = await updateFn(lastDoc);
    if (!newDoc || typeof newDoc !== "object")
      return null; // canceled!

    // ensure _id, _rev props
    if (newDoc._id !== _id) newDoc._id = _id;
    if (lastDoc && newDoc._rev !== lastDoc._rev) newDoc._rev = lastDoc._rev;

    // 3. try writing new doc
    try {
      let {id, rev} = await db.put(newDoc);
      return Object.assign(newDoc, {_rev: rev});
    } catch (e) {
      if (e.name === "conflict" && retryOnConflict && updateAttempt < maxUpdateAttempts)
        return this.update(_id, updateFn, options, updateAttempt+1);
      throw e;
    }
  }

  async mixin(_id, mixin, options) {
    // updates or creates document with _id by mixing in all properties of
    // `mixin`
    return this.update(_id, oldDoc => Object.assign(oldDoc || {_id}, mixin), options);
  }

  async set(id, value, options) {
    // creates or overwrites document with id
    return this.update(id, _ => value, options);
  }

  async get(id) {
    // returns document with id
    try { return await this.pouchdb.get(id); } catch (e) {
      if (e.name === "not_found") return undefined;
      throw e;
    }
  }

  async has(id) {
    // FIXME, more efficient version?
    return !!(await this.get(id));
  }

  async add(doc) {
    // auto generates id
    return this.pouchdb.post(doc);
  }

  async docList(opts = {}) {
    // a list of ids and revs of current docs in the database.
    // does not return full document!
    // returns [{id, rev}]
    let {rows} = await this.pouchdb.allDocs(opts),
        result = [];
    for (let i = 0; i < rows.length; i++) {
      let {id, value: {rev}} = rows[i];
      result.push({id, rev});
    }
    return result;
  }

  async revList(id) {
    // get a list of all revision ids in form ["2-xxx", "1-yyy", ...] of doc
    // with id
    let {_id, _revisions: {start, ids}} = await this.pouchdb.get(id, {revs: true});
    return ids.map(ea => `${start--}-${ea}`);
  }

  async getAllRevisions(id, options = {}) {
    // retrieve documents of all revisions of doc with id
    // use options.skip and options.limit to select a subset
    let {skip = 0, limit = 0} = options,
        revs = await this.revList(id);
    if (skip > 0) revs = revs.slice(skip);
    if (limit > 0) revs = revs.slice(0, limit);
    let query = revs.map(rev => ({rev, id}))
    return await this.getDocuments(query);
  }

  async getAll(options = {}) {
    // retrieve all documents, also design docs!
    let {rows} = await this.pouchdb.allDocs({...options, include_docs: true});
    return rows.map(ea => ea.doc);
  }

  async setDocuments(documents, opts) {
    // bulk set multiple documents at once
    // documents = [{_id, _rev?}, ...]
    let results =  await this.pouchdb.bulkDocs(documents, opts);
    for (let i = 0; i < results.length; i++) {
      let d = documents[i], result = results[i];
      // if a conflict happens and document does not specify the exact revision
      // then just overwrite old doc
      if (!result.ok && result.name === "conflict" && !d._rev) {
        let {_id: id, _rev: rev} = await this.set(d._id, d);
        results[i] = {ok: true, id, rev};
      }
    }
    return results;
  }

  async getDocuments(idsAndRevs, options = {}) {
    // bulk get multiple documents at once
    // idsAndRevs = [{id, rev?}]
    let {ignoreErrors = true} = options,
        {results} = await this.pouchdb.bulkGet({docs: idsAndRevs}),
        result = [];
    for (let i = 0; i < results.length; i++) {
      let {docs, id} = results[i];
      console.assert(docs.length === 1, `getDocuments: expected only one doc for ${id}`);
      for (let j = 0; j < docs.length; j++) {
        let d = docs[j];
        if (ignoreErrors && !d.ok) continue;
        result.push(d.ok || d.error || d);
      }
    }
    return result;
  }

  query(subject, opts) {
    return this.pouchdb.query(subject, opts);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // removal
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async remove(_id, _rev, options) {
    let arg = typeof _rev !== "undefined" ? {_id, _rev} : await this.get(_id);
    return arg ? this.pouchdb.remove(arg) : undefined;
  }

  async removeAll() {
    let db = this.pouchdb,
        docs = await db.allDocs();
    return await Promise.all(docs.rows.map(row => db.remove(row.id, row.value.rev)));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // replication + conflicts
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  replicateTo(otherDB, opts) {
    // opts: {live, retry}
    if (otherDB instanceof Database)
      otherDB = otherDB.pouchdb;
    return this.pouchdb.replicate.to(otherDB, opts);
  }

  replicateFrom(otherDB, opts) {
    // opts: {live, retry}
    if (otherDB instanceof Database)
      otherDB = otherDB.pouchdb;
    return this.pouchdb.replicate.from(otherDB, opts);
  }

  sync(otherDB, opts) {
    // opts: {live, retry}
    if (otherDB instanceof Database)
      otherDB = otherDB.pouchdb;
    return this.pouchdb.sync(otherDB, opts);
  }

  async getConflicts() {
    let {rows} = await this.pouchdb.query(
      {map: `function(doc) { if (doc._conflicts) emit(doc._id); }`},
      {reduce: false, include_docs: true, conflicts: true})
    return rows.map(ea => ea.doc);
  }

  async resolveConflicts(id, resolveFn) {
    let doc = await this.pouchdb.get("doc", {conflicts: true}),
        query = doc._conflicts.map(rev => ({id, rev})),
        conflicted = await this.getDocuments(query),
        resolved = doc;
    for (let conflictedDoc of conflicted) {
      resolved = await resolveFn(resolved, conflictedDoc);
      if (!resolved) return null;
      resolved = await this.set(id, resolved);
      await this.pouchdb.remove(conflictedDoc);
    }
    return resolved;
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // backup
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  static async loadDump(dump, opts = {}) {
    let {header, docs} = dump,
        name = opts.name || header.name,
        db = this.ensureDB(name);
    await db.setDocuments(docs, {new_edits: false});
    return db;
  }

  async dump() {
    // similar format to pouchd.dump but no stream.
    // see https://github.com/nolanlawson/pouchdb-replication-stream/blob/master/lib/index.js#L27
    let {name, pouchdb} = this,
        header = {
          name,
          db_type: pouchdb.type(),
          start_time: new Date().toJSON(),
          db_info: await pouchdb.info()
        },
        docs = await this.getAll({attachments: true});
    return {header, docs};
  }

  async backup(backupNo = 1) {
    let name = `${this.name}_backup_${backupNo}`,
        backupDB = this.constructor.ensureDB(name);
    await this.replicateTo(backupDB);
    return backupDB;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // migration
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async migrate(migrationFn) {
    let docs = await this.getAll();
    let migrated = [], unchanged = [];
    for (let i = 0; i < docs.length; i++) {
      let doc = docs[i],
          migratedDoc = migrationFn(doc, i);
      if (!migratedDoc) { unchanged.push(doc); continue; }

      if (!migratedDoc.hasOwnProperty("_id"))
        migratedDoc._id = doc._id;
      if (migratedDoc.hasOwnProperty("_rev"))
        delete migratedDoc._rev;

      migrated.push(migratedDoc);
    }

    await this.setDocuments(migrated);
    return {migrated: migrated.length, unchanged: unchanged.length};
  }
}
