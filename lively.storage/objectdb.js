/*global System,process,require,fetch*/
import Database from "./database.js";
import { resource } from "lively.resources";
import { obj, promise, arr, string, Path } from "lively.lang";
import { parse, categorizer } from "lively.ast";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// sha1
// Author: creationix
// Repo: https://github.com/creationix/git-sha1
// License: MIT https://github.com/creationix/git-sha1/blob/b3474591e6834232df63b5cf9bb969185a54a04c/LICENSE
const sha1 = (function sha1_setup(){function r(r){if(void 0===r)return o(!1);var e=o(!0);return e.update(r),e.digest()}function e(){var r=f.createHash("sha1");return{update:function(e){return r.update(e)},digest:function(){return r.digest("hex")}}}function t(r){function e(r){if("string"==typeof r)return t(r);var e=r.length;h+=8*e;for(var n=0;n<e;n++)o(r[n])}function t(r){var e=r.length;h+=8*e;for(var t=0;t<e;t++)o(r.charCodeAt(t))}function o(r){a[y]|=(255&r)<<g,g?g-=8:(y++,g=24),16===y&&u()}function f(){o(128),(y>14||14===y&&g<24)&&u(),y=14,g=24,o(0),o(0),o(h>0xffffffffff?h/1099511627776:0),o(h>4294967295?h/4294967296:0);for(var r=24;r>=0;r-=8)o(h>>r);return i(s)+i(c)+i(v)+i(p)+i(d)}function u(){for(var r=16;r<80;r++){var e=a[r-3]^a[r-8]^a[r-14]^a[r-16];a[r]=e<<1|e>>>31}var t,n,o=s,f=c,u=v,i=p,g=d;for(r=0;r<80;r++){r<20?(t=i^f&(u^i),n=1518500249):r<40?(t=f^u^i,n=1859775393):r<60?(t=f&u|i&(f|u),n=2400959708):(t=f^u^i,n=3395469782);var h=(o<<5|o>>>27)+t+g+n+(0|a[r]);g=i,i=u,u=f<<30|f>>>2,f=o,o=h}for(s=s+o|0,c=c+f|0,v=v+u|0,p=p+i|0,d=d+g|0,y=0,r=0;r<16;r++)a[r]=0}function i(r){for(var e="",t=28;t>=0;t-=4)e+=(r>>t&15).toString(16);return e}var a,s=1732584193,c=4023233417,v=2562383102,p=271733878,d=3285377520,y=0,g=24,h=0;return a=r?n:new Uint32Array(80),{update:e,digest:f}}var n,o,f;return"object"==typeof process&&"object"==typeof process.versions&&process.versions.node&&"renderer"!==process.__atom_type?(f="undefined"!=typeof System?System._nodeRequire("crypto"):require("crypto"),o=e):(n=new Uint32Array(80),o=t),r})();

const hashRe = /^[0-9a-f]+$/i;
function isHash(string) {
  return typeof string === "string" && string.length === 40 && string.match(hashRe);
}
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// let db = await ObjectDB.find("test-object-db");
// db = objectDBs.get("lively.morphic/objectdb/morphicdb")
// await db.objectStats()

var objectDBs = objectDBs || new Map();

export default class ObjectDB {

  static async dbList() {
    let metaDB = Database.ensureDB("internal__objectdb-meta");
    return (await metaDB.getAll()).map(ea => ea._id);
  }

  static async find(name) {
    let found = objectDBs.get(name);
    if (found) return found;
    let metaDB = Database.ensureDB("internal__objectdb-meta"),
        meta = await metaDB.get(name);
    if (!meta) return;
    return this.named(name, meta);
  }

  static named(name, options = {}) {
    let existing = objectDBs.get(name);
    if (existing) return existing;
    if (!options || !options.snapshotLocation)
      throw new Error("need snapshotLocation");
    if (typeof options.snapshotLocation === "string") {
      try { options.snapshotLocation = resource(options.snapshotLocation); }
      catch (err) { options.snapshotLocation = resource(System.baseURL)
        .join(options.snapshotLocation); }
    }
    let db = new this(name, options);
    objectDBs.set(name, db);

    let metaDB = Database.ensureDB("internal__objectdb-meta");
    metaDB.set(name, {...options, snapshotLocation: options.snapshotLocation.url})
      .catch(err => console.error(`error writing objectdb meta:`, err));

    return db;
  }

  constructor(name, options) {
    this.name = name;
    if (!options.snapshotLocation || !options.snapshotLocation.isResource)
      throw new Error(`ObjectDB needs snapshotLocation!`);
    this.snapshotLocation = options.snapshotLocation;
    this.__commitDB = null;
    this.__versionDB = null;
  }

  async destroy() {
    let commitDB = Database.findDB(this.name + "-commits");
    if (commitDB) await commitDB.destroy();
    let versionDB = Database.findDB(this.name + "-version-graph");
    if (versionDB) await versionDB.destroy();
    objectDBs.delete(this.name);

    let metaDB = Database.ensureDB("internal__objectdb-meta");
    await metaDB.remove(this.name);

    // await this.snapshotLocation.remove()
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // storage

  snapshotResourceFor(commit) {
    // content is sha1 hash
    let first = commit.content.slice(0, 2),
        rest = commit.content.slice(2);
    return this.snapshotLocation.join(`${first}/${rest}.json`);
  }

  async snapshotObject(type, name, object, snapshotOptions, commitSpec, preview, ref, expectedPrevVersion) {
    snapshotOptions = snapshotOptions || {};
    let serializeFn = x => x,
        snapshot = await serializeFn(object, snapshotOptions);
    return this.commit(type, name, snapshot, commitSpec, preview, ref, expectedPrevVersion);
  }

  async loadObject(type, name, loadOptions, commitIdOrCommit, ref) {
    loadOptions = loadOptions || {}
    let snapshot = await this.loadSnapshot(type, name, commitIdOrCommit, ref),
        deserializeFn = x => x;
    return deserializeFn(snapshot, loadOptions);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // data management

  async has(type, name) { return !!(await this.objectStats(type, name)); }

  async objects(optType) {
    let stats = await this.objectStats(optType);
    if (optType) return Object.keys(stats || {});
    let result = {};
    for (let type in stats)
      result[type] = Object.keys(stats[type]);
    return result;
  }

  async objectStats(objectType, objectName) {
    let statsByType = {},
        commitDB = this.__commitDB || await this._commitDB(),
        queryOpts = {reduce: true, group: true};
    if (objectType && objectName) {
      queryOpts.key = `${objectType}\u0000${objectName}`;
      // queryOpts.endkey = `${objectType}\u0000${objectName}`;
    } else if (objectType) {
      // queryOpts.key = objectType;
      queryOpts.startkey = `${objectType}\u0000`;
      queryOpts.endkey = `${objectType}\ufff0`;
    }

    try {
      let {rows} = await commitDB.pouchdb.query("nameWithMaxMinTimestamp_index", queryOpts);
      for (let {key: objectTypeAndName, value: {count, max: newest, min: oldest}} of rows) {
        let [type, objectName] = objectTypeAndName.split("\u0000"),
            statsOfType = statsByType[type] || (statsByType[type] = {});
        statsOfType[objectName] = {count, newest, oldest};
      }
    } catch (err) {
      console.error(err);
      return statsByType;
    }

    if (objectType && objectName) return (statsByType[objectType] || {})[objectName];
    if (objectType) return statsByType[objectType];
    return statsByType;
  }

  async getCommits(type, objectName, ref = "HEAD", limit = Infinity) {
    let history = await this._log(type, objectName, ref, limit);
    if (!history.length) return [];
    let commitDB = this.__commitDB || await this._commitDB(),
        commits = await commitDB.getDocuments(history.map(ea => ({id: ea})));
    return commits;
  }

  async getCommit(commitId) {
    let commitDB = this.__commitDB || await this._commitDB();
    return commitDB.get(commitId);
  }

  async getCommitsWithIds(commitIds) {
    if (!commitIds.length) return [];
    let commitDB = this.__commitDB || await this._commitDB();
    return commitDB.getDocuments(commitIds.map(id => ({id})));
  }

  async getLatestCommit(type, objectName, ref = "HEAD", includeDeleted = false) {
    let [commitId] = await this._log(type, objectName, ref, 1);
    if (!commitId) return null;
    let commitDB = this.__commitDB || await this._commitDB();
    let commit = await commitDB.get(commitId);
    if (commit && commit.deleted && !includeDeleted) return null;
    return commit;
  }

  async commit(type, name, snapshot, commitSpec, preview, ref = "HEAD", expectedPrevVersion) {
    let {
      author,
      description = "no description",
      tags = [],
      timestamp,
      message = "",
      metadata,
      preview: alternativePreview
    } = commitSpec;

    if (!type) throw new Error("object needs a type");
    if (!name) throw new Error("object needs a name");
    if (!author) throw new Error(`Cannot commit ${type}/${name} without user`);

    // Retrieve version graph for object. Check if the prev version requirement
    // is met and get the ancestors
    let versionDB = this.__versionDB || await this._versionDB(),
        versionData = await this.versionGraph(type, name),
        ancestor = versionData ? versionData.refs[ref] : null,
        ancestors = ancestor ? [ancestor] : [];
    if (expectedPrevVersion) {
      if (!versionData) throw new Error(`Trying to store "${type}/${name}" on top of expected version ${expectedPrevVersion} but no version entry exists!`);
      if (ancestor !== expectedPrevVersion) throw new Error(`Trying to store "${type}/${name}" on top of expected version ${expectedPrevVersion} but ref ${ref} is of version ${ancestor}!`);
    }

    // Snapshot object and create commit.
    let snapshotIsHash = isHash(snapshot),
        snapshotJson = snapshotIsHash ? null : snapshot ? JSON.stringify(snapshot) : null,
        commit = this._createCommit(
          type, name, description, tags, metadata,
          author, timestamp, message, ancestors,
          snapshotIsHash ? null : snapshot, snapshotJson,
          preview || alternativePreview, snapshotIsHash ? snapshot : null);

    // write snapshot to resource
    if (snapshot && !snapshotIsHash) {
      let res = this.snapshotResourceFor(commit);
      await res.parent().ensureExistance();
      if (res.canDealWithJSON) await res.writeJson(snapshot);
      else await res.write(snapshotJson);
    }

    // store the commit
    let commitDB = this.__commitDB || await this._commitDB();
    commit = await commitDB.set(commit._id, commit);

    // update version graph
    if (!versionData) versionData = {refs: {}, history: {}};
    versionData.refs[ref] = commit._id;
    versionData.history[commit._id] = ancestors;
    await versionDB.set(type + "/" + name, versionData);

    return commit;
  }

  async loadSnapshot(type, name, commitOrId, ref = "HEAD") {
    let commit;
    if (commitOrId && typeof commitOrId !== "string") {
      commit = commitOrId;
    } else if (commitOrId) {
      let commitDB = this.__commitDB || await this._commitDB();
      commit = await commitDB.get(commitOrId);
    } else {
      commit = await this.getLatestCommit(type, name, ref);
    }
    if (!commit)
      throw new Error(`Cannot find commit to loadSnapshot for ${type}/${name} (using ${commitOrId})`)
    return this.snapshotResourceFor(commit).readJson();
  }

  async revert(type, name, ref, toCommitId) {
    let versionDB = this.__versionDB || await this._versionDB(),
        history = await versionDB.get(type + "/" + name);
    history.refs[ref || "HEAD"] = toCommitId;
    delete history.deleted;
    await versionDB.set(`${type}/${name}`, history);
    return history;
  }

  _createCommit(
    type, name, description, tags, metadata, author,
    timestamp, message = "", ancestors = [],
    snapshot, snapshotJson, preview, content
  ) {
    if (!preview && snapshot && snapshot.preview) preview = snapshot.preview;
    return this._createCommitFromSpec({
      name, type,
      timestamp: timestamp || Date.now(),
      author: {
        name: author.name,
        email: author.email,
        realm: author.realm
      },
      tags, description, preview,
      message,
      content: content || (snapshotJson && sha1(snapshotJson)) || null,
      deleted: !content && !snapshot,
      metadata, ancestors
    }, true);
  }

  _createCommitFromSpec(commit, isHashed = false) {
    if (!commit.name) throw new Error(`commit needs name`);
    if (!commit.type) throw new Error(`commit needs type`);
    if (!commit.author) throw new Error(`commit needs author`);
    if (!commit.author.name) throw new Error(`commit needs author.name`);
    if (!commit.timestamp) commit.timestamp = Date.now();
    if (!commit.tags) commit.tags = [];

    if (!isHashed && commit.content) {
      isHashed = isHash(commit.content);
      if (!isHashed) commit.content = sha1(commit.content);
    }
    let hashObj = obj.dissoc(commit, ["preview"]),
        commitHash = sha1(JSON.stringify(hashObj));
    return Object.assign(commit, {_id: commitHash});
  }

  get _commitdb_indexes() {

    return [
      {
        name: 'name_index',
        version: 4,
        mapFn: 'function (doc) { emit(doc.type + "\u0000" + doc.name); }'
      },

      {
        name: 'nameAndTimestamp_index',
        version: 3,
        mapFn: 'function (doc) { emit(doc.type + "\u0000" + doc.name + "\u0000" + doc.timestamp + "\u0000" + doc._id); }'
      },

      {
        name: 'nameWithMaxMinTimestamp_index',
        version: 3,
        mapFn: 'function(doc) { emit(doc.type + "\u0000" + doc.name, doc.timestamp); }',
        reduceFn: "_stats"
      },

      {
        name: 'nameTypeFilter',
        version: 9,
        filterFn: `function(doc, req) {
          if (doc._id[0] === "_" || !req || !req.query) return true;
          if (req.query.onlyIds) return !!req.query.onlyIds[doc._id];
          if (req.query.onlyTypesAndNames)
            return !!req.query.onlyTypesAndNames[doc.type + "/" + doc.name];
          return true;
        }`
      },
      {
        name: 'conflict_index',
        version: 4,
        mapFn: `function(doc) { if (doc._conflicts) emit(doc._id); }`
      }

    ];
  }

  get _versiondb_indexes() {      
    return [
      {
        name: 'nameTypeFilter',
        version: 3,
        filterFn: `function(doc, req) {
          if (doc._id[0] === "_" || !req || !req.query) return true;
          if (req.query.onlyIds) return !!req.query.onlyIds[doc._id];
          if (req.query.onlyTypesAndNames) return !!req.query.onlyTypesAndNames[doc._id];
          return true;
        }`
      },
      {
        name: 'conflict_index',
        version: 4,
        mapFn: `function(doc) { if (doc._conflicts) emit(doc._id); }`
      }
    ]      
  }

  async _commitDB() {
    if (this.__commitDB) return this.__commitDB;

    let dbName = this.name + "-commits",
        db = Database.findDB(dbName);
    if (db) return this.__commitDB = db;

    db = Database.ensureDB(dbName);

    // prepare indexes

    await db.addDesignDocs(this._commitdb_indexes);

    return this.__commitDB = db;
  }

  async close() {
    if (this.__commitDB) {
      await this.__commitDB.close();
      this.__commitDB = null;
    }
    if (this.__versionDB) {
      await this.__versionDB.close();
      this.__versionDB = null;
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // versioning

  async versionGraph(type, objectName) {
    let versionDB = this.__versionDB || await this._versionDB(),
        graph = await versionDB.get(type + "/" + objectName);
    return !graph || graph.deleted || graph._deleted ? null : graph;
  }

  async _log(type, objectName, ref = "HEAD", limit = Infinity) {
    let data = await this.versionGraph(type, objectName);
    if (!data || data.deleted|| data._deleted) return [];
    let version = data.refs.HEAD, history = [];
    while (true) {
      if (history.includes(version))
        throw new Error("cyclic version graph???");
      history.push(version);
      // FIXME what about multiple ancestors?
      [version] = data.history[version] || [];
      if (!version || history.length >= limit) break;
    }
    return history;
  }

  async _findTimestampedVersionsOfObjectNamed(objectName, options = {}) {
    // other opts: {limit, include_docs}
    let {
          include_docs = true,
          descending = true,
          startTime = "0".repeat(13),
          endTime = "9".repeat(13),
        } = options,
        startkey = `${objectName}\u0000${descending ? endTime : startTime}`,
        endkey = `${objectName}\u0000${descending ?  startTime : endTime}`,
        objectDB = this.__commitDB || await this._commitDB(),
        {rows} = await objectDB.pouchdb.query("nameAndTimestamp_index", {
          ...options,
          descending,
          include_docs,
          startkey,
          endkey
        });
    return include_docs ? rows.map(ea => ea.doc) : rows.map(ea => ea.id);
  }

  async _versionDB() {
    if (this.__versionDB) return this.__versionDB;
    let dbName = this.name + "-version-graph",
        db = Database.findDB(dbName);
    if (db) return this.__versionDB = db;
    db = Database.ensureDB(dbName);
    await db.addDesignDocs(this._versiondb_indexes);
    return this.__versionDB = db;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // export

  async exportToDir(exportDir, nameAndTypes, copyResources = false, includeDeleted = false) {

    if (typeof exportDir === "string") exportDir = resource(exportDir);

    let commitDB = this.__commitDB || await this._commitDB(),
        versionDB = this.__versionDB || await this._versionDB(),
        backupData = [];

    if (!nameAndTypes) {
      let versions = await versionDB.getAll();
      for (let {refs, history, _id} of versions) {
        if (_id.startsWith("_")) continue;
        let {type, name} = await this.getCommit(refs.HEAD || Object.keys(history)[0]),
            currentExportDir = exportDir.join(type).join(name).asDirectory(),
            commitIds = Object.keys(history),
            commits = await this.getCommitsWithIds(commitIds);
        backupData.push({refs, history, currentExportDir, commits, name, type});
      }
    } else {
      for (let {name, type} of nameAndTypes) {
        let currentExportDir = exportDir.join(type).join(name).asDirectory(),
            {refs, history} = await this.versionGraph(type, name),
            commitIds = Object.keys(history),
            commits = await this.getCommitsWithIds(commitIds);
        backupData.push({refs, history, currentExportDir, commits, name, type});
      }
    }

    for (let {refs, history, currentExportDir, commits, name, type} of backupData) {
      if (!includeDeleted)
        commits = commits.filter(ea => !ea.deleted);

      let resourcesForCopy = copyResources ? commits.map(commit => {
        if (commit.deleted || commit._deleted || !commit.content) return null
        delete commit._rev;
        let from = this.snapshotResourceFor(commit),
            to = currentExportDir.join(from.parent().name() + "/" + from.name());
        return {from, to};
      }).filter(Boolean) : [];

      if (!copyResources) commits.forEach(commit => { delete commit._rev; });
      await currentExportDir.ensureExistance();
      await currentExportDir.join("index.json").writeJson({name, type});
      await currentExportDir.join("commits.json").writeJson(commits);
      await currentExportDir.join("history.json").writeJson({refs, history});
      for (let {from, to} of resourcesForCopy)
        await from.copyTo(to);
    }
  }

  async exportToSpecs(nameAndTypes, includeDeleted = false) {
    // note: only version data, no snapshots!
    let specs = [];
    if (!nameAndTypes) { // = everything
      nameAndTypes = [];
      let stats = (await this.objectStats()) || {};
      for (let type in stats)
        for (let name in stats[type])
          nameAndTypes.push({type, name})
    }

    for (let {name, type} of nameAndTypes) {
      let {refs, history} = await this.versionGraph(type, name),
          commitIds = Object.keys(history),
          commits = await this.getCommitsWithIds(commitIds);
      if (!includeDeleted)
        commits = commits.filter(ea => !ea.deleted);
      commits.forEach(commit => { delete commit._rev; });
      specs.push({type, name, commits, history: {refs, history}})
    }
    return specs;
  }

  async importFromDir(importDir, overwrite = false, copyResources = false) {
    // let commitDB = this.__commitDB || await this._commitDB();;

    // 1. discover type/names;
    // depth 1: type dirs, depth 2: object dirs, those include index.json, ...
    let indexes = await importDir.dirList(3, {exclude: ea => !ea.isDirectory() && ea.name() !== "index.json"})

    indexes = indexes.filter(ea => ea.name() === "index.json"); // FIXME!
    let dirs = indexes.map(ea => ea.parent());

    let {snapshotLocation} = this, importSpecs = [];

    // 2. retrieve import data
    for (let dir of dirs) importSpecs.push(await findImportDataIn(dir));

    return this.importFromSpecs(importSpecs, overwrite, copyResources);

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    async function findImportDataIn(dir) {
      // dir is directory with index.json etc.
      let [{type, name}, commits, history] = await Promise.all([
            dir.join("index.json").readJson(),
            dir.join("commits.json").readJson(),
            dir.join("history.json").readJson(),
          ]),
          snapshotDirs = copyResources ?
            await dir.dirList(1, {exclude: ea => !ea.isDirectory()}) : [];
      return {dir, type, name, commits, history, snapshotDirs};
    }
  }

  async importFromSpecs(specs, overwrite = false, copyResources = false) {
    if (!overwrite) {
      let versionDB = this.__versionDB || await this._versionDB();
      for (let {type, name} of specs) {
        if (await versionDB.get(`${type}/${name}`))
          throw new Error(`Import failed: object ${type}/${name} already exists and overwrite is not allowed`);
      }
    }

    for (let spec of specs)
      await this.importFromSpec(spec, true, copyResources);

    return specs;
  }

  async importFromSpec(spec, overwrite = false, copyResources = false) {
    let versionDB = this.__versionDB || await this._versionDB(),
        commitDB = this.__commitDB || await this._commitDB(),
        {snapshotLocation} = this,
        {type, name, commits, history, snapshotDirs} = spec;

    if (!overwrite && await versionDB.get(`${type}/${name}`))
      throw new Error(`Import failed: object ${type}/${name} already exists and overwrite is not allowed`);

    await Promise.all([
      commitDB.setDocuments(commits),
      versionDB.set(`${type}/${name}`, history),
      ...(snapshotDirs && copyResources
          ? snapshotDirs.map(ea =>
           ea.copyTo(snapshotLocation.join(ea.name()).asDirectory())) : [])
    ]);

    return spec;
  }

  async importFromResource(type, name, resource, commitSpec, purgeHistory = false) {
    let snap = await resource.readJson();
    if (purgeHistory && await this.has(type, name))
      await this.delete(type, name, false);
    return this.commit(type, name, snap, commitSpec);
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // synchronization / replication

  replicateTo(remoteCommitDB, remoteVersionDB, toSnapshotLocation, options) {
    return new Synchronization(
      this, remoteCommitDB, remoteVersionDB, toSnapshotLocation,
      {method: "replicateTo", ...options}).start();
  }

  replicateFrom(remoteCommitDB, remoteVersionDB, toSnapshotLocation, options) {
    return new Synchronization(
      this, remoteCommitDB, remoteVersionDB, toSnapshotLocation,
      {method: "replicateFrom", ...options}).start();
  }

  sync(remoteCommitDB, remoteVersionDB, toSnapshotLocation, options) {
    return new Synchronization(
      this, remoteCommitDB, remoteVersionDB, toSnapshotLocation,
      {method: "sync", ...options}).start();
  }

  async getConflicts(includeDocs, only) {
    let commitDB = this.__commitDB || await this._commitDB(),
        versionDB = this.__versionDB || await this._versionDB();
    return {
        versionConflicts: await getConflicts(versionDB, "versions"),
        commitConflicts: await await getConflicts(commitDB, "commits"),
    }

    async function getConflicts(db, kind) {
      let conflicts = await db.getConflicts({include_docs: true});
      return (await Promise.all(conflicts.map(async ea => {
        let {id, rev, conflicts, doc} = ea;
        if (only && only[kind] && !only[kind][id]) return null;
        if (includeDocs) {
          let query = conflicts.map(rev => ({id, rev}));
          conflicts = await db.getDocuments(query);
        }
        if (!includeDocs) doc = null;
        else obj.dissoc(doc, ["_conflicts"]);
        return {id, rev, conflicts, kind, doc};
      }))).filter(Boolean);
    }
  }

  async resolveConflict(arg) {
    // {resolved, delete: del, kind, id}
    let {resolved, delete: del, kind, id} = arg, db;
    if (kind === "versions") {
      db = this.__versionDB || await this._versionDB();
    } else if (kind === "commits") {
      db = this.__commitDB || await this._commitDB();
    } else throw new Error(`Unknown conflict kind: ${kind}`);
    await db.set(id, resolved);
    await Promise.all(del.map(rev => db.pouchdb.remove(id, rev)))
  }

  async getDiff(remoteCommitDBOrName, remoteVersionDB) {
    let remoteCommitDB = remoteCommitDBOrName;
    if (typeof remoteCommitDBOrName === "string") {
      remoteCommitDB = Database.ensureDB(`${remoteCommitDBOrName}-commits`);
      remoteVersionDB = Database.ensureDB(`${remoteCommitDBOrName}-version-graph`);
    }

    let localCommitDB = this.__commitDB || await this._commitDB(),
        localVersionDB = this.__versionDB || await this._versionDB(),
        commitDiff = await localCommitDB.diffWith(remoteCommitDB),
        versionDiff = await localVersionDB.diffWith(remoteVersionDB),
        local = await Promise.all(versionDiff.inLeft.map(async ea => ({id: ea.id, doc: await localVersionDB.get(ea.id)}))),
        allRemoteVersions = arr.groupBy(await remoteVersionDB.getAll(), d => d._id),
        remote = await Promise.all(versionDiff.inRight.map(async ea => ({id: ea.id, doc: allRemoteVersions[ea.id]}))),
        changed = await Promise.all(versionDiff.changed.map(async ea => ({...ea.left, docA: await localVersionDB.get(ea.left.id), docB: await remoteVersionDB.get(ea.right.id)}))),
        allRemoteCommits = arr.groupBy(await remoteCommitDB.getAll(), d => d._id),
        localCommits = [], remoteCommits = [], changedCommits = [];

    for (let ea of commitDiff.inLeft) localCommits.push(await localCommitDB.get(ea.id));
    for (let ea of commitDiff.inRight) remoteCommits.push(await allRemoteCommits[ea.id]);
    for (let ea of commitDiff.changed) {
      changedCommits.push(await localCommitDB.get(ea.left.id))
      changedCommits.push(await remoteCommitDB.get(ea.right.id))
    }

    let localCommitTypeAndNames = localCommits.map(ea => obj.select(ea, ["_id", "name", "type"])),
        remoteCommitTypeAndNames = remoteCommits.map(ea => obj.select(ea, ["_id", "name", "type"])),
        changedCommitTypeAndNames = changedCommits.map(ea => obj.select(ea, ["_id", "name", "type"]));

    return {
      changed, remote, local,
      changedCommitTypeAndNames,
      remoteCommitTypeAndNames,
      localCommitTypeAndNames
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // deletion

  async delete(type, name, dryRun = true) {
    let resources = [],
        commitDeletions = [];

    // 1. meta data to delete
    let objectDB = this.__commitDB || await this._commitDB(),
        opts = {
          include_docs: true,
          startkey: `${type}\u0000${name}\u0000`,
          endkey: `${type}\u0000${name}\uffff`
        },
        {rows} = await objectDB.query("nameAndTimestamp_index", opts);

    for (let {doc: commit} of rows) {
      // 2. resources to delete
      if (!commit.deleted && !commit._deleted && commit.content)
        resources.push(this.snapshotResourceFor(commit));
      commitDeletions.push({...commit, _deleted: true});
    }

    // 3. history to delete
    let versionDB = this.__versionDB || await this._versionDB(),
        {_id, _rev} = await versionDB.get(type + "/" + name),
        deletedHist = {_id, _rev, _deleted: true}


    if (!dryRun) {
      await objectDB.setDocuments(commitDeletions);
      await versionDB.setDocuments([deletedHist]);
      Promise.all(resources.map(ea => ea.remove()));
    }

    return {
      commits: commitDeletions,
      history: deletedHist,
      resources
    }
  }

  async deleteCommit(commitOrId, dryRun = true, ref = "HEAD") {
    let commit;
    if (commitOrId && typeof commitOrId !== "string") {
      commit = commitOrId;
    } else if (commitOrId) {
      let commitDB = this.__commitDB || await this._commitDB();
      commit = await commitDB.get(commitOrId);
    }

    if (!commit) throw new Error("commit needed!");

    let versionDB = this.__versionDB || await this._versionDB(),
        objectDB = this.__commitDB || await this._commitDB(),
        {name, type, _id} = commit,
        resources = (commit.deleted || commit._deleted || !commit.content) ?
                     [] : [this.snapshotResourceFor(commit)],
        commitDeletions = [{...commit, _deleted: true}],
        hist = await versionDB.get(type + "/" + name);

    if (!hist) throw new Error(`No history for ${type}/${name}@${commit._id}`);
    if (!hist.refs[ref]) throw new Error(`Cannot delete commit ${type}/${name}@${commit._id} b/c it is not where ref ${ref} is pointing!`);

    let [ancestor] = hist.history[commit._id] || [];
    if (!ancestor && Object.keys(hist.history).length <= 1) {
      hist._deleted = true;
    } else if (!ancestor) {
      throw new Error(`Cannot delete commit ${type}/${name}@${commit._id} b/c it has no ancestor but there are still other commits!`);
    } else {
      delete hist.history[commit._id];
      hist.refs[ref] = ancestor;
    }

    if (!dryRun) {
      await versionDB.set(type + "/" + name, hist);
      await objectDB.setDocuments(commitDeletions);
      await Promise.all(resources.map(ea => ea.remove()));
    }

    return {
      commits: commitDeletions,
      history: hist,
      resources
    }
  }
}


class Synchronization {

  constructor(fromObjectDB, remoteCommitDB, remoteVersionDB, remoteLocation, options = {}) {
    // replicationFilter: {onlyIds: {STRING: BOOL}, onlyTypesAndNames: {[type+"\u0000"+name]: BOOL}}
    this.options = {
      debug: false, live: false, method: "sync",
      replicationFilter: undefined,
      ...options
    };
    this.state = "not started";
    this.method = "";
    this.fromObjectDB = fromObjectDB;
    this.remoteCommitDB = remoteCommitDB;
    this.remoteVersionDB = remoteVersionDB;
    this.remoteLocation = remoteLocation;
    this.deferred = promise.deferred();
    this.conflicts = [];
    this.changes = [];
    this.errors = [];
  }

  get isSynchonizing() { return this.isPaused || this.isRunning; }
  get isComplete() { return this.state === "complete"; }
  get isRunning() { return this.state === "running"; }
  get isPaused() { return this.state === "paused"; }

  get changesByTypeAndName() {
    let changesByTypeAndName = {push: {}, pull: {}};
    this.changes.forEach(ea => {
      let {direction: dir, id, kind} = ea;
      if (id[0] === "_") return;
      let byTypeAndName;
      if (kind === "versions") {
        byTypeAndName = changesByTypeAndName[dir][id] || (changesByTypeAndName[dir][id] = []);
      } else if (kind === "commits") {
        let typeAndName = `${ea.type}/${ea.name}`;
        byTypeAndName = changesByTypeAndName[dir][typeAndName] || (changesByTypeAndName[dir][typeAndName] = []);
      }
      byTypeAndName.push(ea)
    });
    return changesByTypeAndName;
  }

  whenPaused() {
    return Promise.resolve()
      .then(() => promise.waitFor(() => this.isPaused || this.isComplete))
      .then(() => this);
  }

  waitForIt() { return this.deferred.promise; }

  start() {
    if (!this.isSynchonizing)
      this._startReplicationAndCopy().catch(err =>
        console.error(`Error starting synchronization: `, err));
    return this;
  }

  async _startReplicationAndCopy() {
    let {
          fromObjectDB,
          remoteCommitDB,
          remoteVersionDB,
          remoteLocation,
          options: {
            debug,
            live = false,
            retry = false,
            method,
            replicationFilter,
            pushDesignDocToRemote = false
          }
        } = this,

        versionDB = fromObjectDB.__versionDB || await fromObjectDB._versionDB(),
        commitDB = fromObjectDB.__commitDB || await fromObjectDB._commitDB(),
        {
          _commitdb_indexes, _versiondb_indexes,
          snapshotLocation: fromSnapshotLocation
        } = fromObjectDB,
        versionChangeListener, commitChangeListener;

    this.method = method;

    let commitNameTypeFilter = _commitdb_indexes.find(ea => ea.name === 'nameTypeFilter'),
        versionNameTypeFilter = _versiondb_indexes.find(ea => ea.name === 'nameTypeFilter');

    if (pushDesignDocToRemote) {
      console.log("adding commitNameTypeFilter")
      await remoteCommitDB.addDesignDoc(commitNameTypeFilter);      
      console.log("adding versionNameTypeFilter")
      await remoteVersionDB.addDesignDoc(versionNameTypeFilter);
    }

    let opts = {
          live, retry,
          // conflicts: true,
        }, commitOpts = {...opts}, versionOpts = {...opts};

    if (replicationFilter) {
      // opts.filter = 'nameTypeFilter/nameTypeFilter';
      commitOpts.filter = eval(`(${commitNameTypeFilter.filterFn})`);
      commitOpts.query_params = replicationFilter;
      versionOpts.filter = eval(`(${versionNameTypeFilter.filterFn})`);
      versionOpts.query_params = replicationFilter;
    }

    let commitReplication = commitDB[method](remoteCommitDB, commitOpts),
        versionReplication = versionDB[method](remoteVersionDB, versionOpts),
        snapshotReplication = {
          copyCalls: 0,
          copyCallsWaiting: 0,
          nFilesToCopy: 0,
          nFilesCopied: 0,
          stopped: false,
          isComplete() {
            return this.stopped || (this.copyCalls <= 0 && this.copyCallsWaiting <= 0);
          }
        },

        commitReplicationState = "not started",
        versionReplicationState = "not started";

    this.versionReplication = versionReplication;
    this.commitReplication = commitReplication;
    this.snapshotReplication = snapshotReplication;

    commitChangeListener = remoteCommitDB.pouchdb.changes({
      include_docs: true, live: true, conflicts: true});
    versionChangeListener = remoteVersionDB.pouchdb.changes({
      include_docs: true, live: true, conflicts: true});

    commitChangeListener.on("change", change => {
      let {id, changes, doc: {_conflicts: conflicts}} = change;
      debug && console.log(`commit changes ${id}:`, changes, conflicts);
      if (!conflicts) return;
      console.log(`commit conflict ${id}:`, changes, conflicts);
      this.conflicts.push({db: "commits", id, changes, conflicts: conflicts})
    });

    versionChangeListener.on("change", change => {
      let {id, changes, doc: {_conflicts: conflicts}} = change;
      debug && console.log(`version changes ${id}:`, changes, conflicts);
      if (!conflicts) return;
      console.log(`version conflict ${id}:`, changes, conflicts);
      this.conflicts.push({db: "versions", id, changes, conflicts: conflicts})
    });

    commitReplication.on("change", async change => {
      if (method === "replicateTo") change = {direction: "push", change}
      else if (method === "replicateFrom") change = {direction: "pull", change};

      let {direction, change: {ok, docs: commits, errors}} = change;
      console.log(`${this} ${direction === "push" ? "send" : "received"} ${commits.length} commits`);

      var error;
      try {
        let toCopy = [];
        for (let commit of commits) {
          if (commit._id.startsWith("_")) continue;
          this.changes.push({direction, kind: "commits", id: commit._id, type: commit.type, name: commit.name});
          let contentResource = snapshotPathFor(commit);
          contentResource && toCopy.push(contentResource);
        }

        snapshotReplication.nFilesToCopy += toCopy.length;

        if (snapshotReplication.copyCalls > 0) {
          snapshotReplication.copyCallsWaiting++;
          await promise.waitFor(() => snapshotReplication.copyCalls <= 0);
          snapshotReplication.copyCallsWaiting--;
        }

        snapshotReplication.copyCalls++; updateState(this);

        console.log(`${this} copying ${toCopy.length} snapshots...`);

        await promise.parallel(toCopy.map(path => () => {
          let fromResource = (direction === "push" ? fromSnapshotLocation : remoteLocation).join(path),
              toResource = (direction === "push" ? remoteLocation : fromSnapshotLocation).join(path);

          if (snapshotReplication.stopped) {
            console.warn(`${this} Stopping copying resources b/c synchronization ended (${snapshotReplication.copyCalls}, ${fromResource.url} => ${toResource.url})`);
            return Promise.resolve();
          }

          return toResource.exists().then(toExists => {
            if (toExists) {
              debug && console.log(`Skip copying to ${toResource.url}, already exist`);
              return Promise.resolve();
            }

            return fromResource.exists().then(fromExists => {
              if (!fromExists) {
                console.warn(`Skip copying ${fromResource.url}, does not exist`);
                return Promise.resolve();
              }
              debug && console.log(`${this} Copying ${fromResource.url} => ${toResource.url}`);
              return tryCopy(0).then(result => {
                snapshotReplication.nFilesCopied++;
                if (!snapshotReplication.stopped && snapshotReplication.nFilesCopied % 10 === 0)
                  console.log(`${this} copied ${snapshotReplication.nFilesCopied} of ${snapshotReplication.nFilesToCopy} snapshots`);
                return result;
              });
            })

            function tryCopy(n = 0) {
              return fromResource.copyTo(toResource).catch(err => {
                if (n >= 5) throw err;
                return tryCopy(n+1);
              })
            }
          })
        }), 5);
        console.log(`${this} sending files done`);
      } catch (err) {
        console.error(`error in commitReplication onChange`, err);
        error = err;
        throw err;
      } finally {
        snapshotReplication.copyCalls--;
        updateState(this);
        tryToResolve(this, error ? [error] : []);
      }

    })
    .on('paused', () => {
      commitReplicationState = "paused";
      updateState(this);
      debug && console.log(`${this} commit replication paused`);
    })
    .on('active', () => {
      commitReplicationState = "active";
      updateState(this);
      debug && console.log(`${this} commit replication active`);
    })
    .on('error', err => {
      commitReplicationState = "complete"; updateState(this);
      console.error(`${this} commit replication error`, err);
      tryToResolve(this, [err]);
    })
    .on('complete', info => {
      commitReplicationState = "complete"; updateState(this);
      let errors = method === "sync" ? info.push.errors.concat(info.pull.errors) : info.errors;
      tryToResolve(this, errors);
    });

    versionReplication.on(`change`, change => {
      if (method === "replicateTo") change = {direction: "push", change}
      else if (method === "replicateFrom") change = {direction: "pull", change};
      let {direction, change: {ok, docs, errors}} = change;

      debug && console.log(`${this} ${direction === "push" ? "send" : "received"} ${docs.length} histories`);

      docs.forEach(doc => {
        if (doc._id.startsWith("_")) return;
        this.changes.push({direction, kind: "versions", id: doc._id});
      });

      // versionChanges.push(change);
    })
    .on('paused', () => {
      versionReplicationState = "paused";
      updateState(this);
      debug && console.log(`${this} version replication paused`);
    })
    .on('active', x => {
      versionReplicationState = "active";
      updateState(this);
      debug && console.log(`${this} version replication active`, x);
    })
    .on('error', err => {
      versionReplicationState = "complete"; updateState(this);
      console.error(`${this} version replication error`, err);
      tryToResolve(this, [err]);
    })
    .on('complete', info => {
      versionReplicationState = "complete"; updateState(this);
      let errors = method === "sync" ? info.push.errors.concat(info.pull.errors) : info.errors;
      tryToResolve(this, errors);
    });

    this.state = "running";

    return this;

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    function updateState(sync) {
      if (versionReplicationState === "paused" && commitReplicationState === "paused" && snapshotReplication.copyCalls <= 0 && snapshotReplication.copyCallsWaiting <= 0)
        return sync.state = "paused";
      if (versionReplicationState === "complete" && commitReplicationState === "complete" && snapshotReplication.isComplete())
        return sync.state = "complete";
      return sync.state = "running";
    }

    function tryToResolve(sync, errors) {
      if (!errors.length && (commitReplicationState !== "complete"
                     || versionReplicationState !== "complete"
                     || !snapshotReplication.isComplete())) return;
      versionChangeListener.cancel();
      let err;
      if (errors.length) {
        sync.state = "complete";
        sync.errors = errors;
        commitReplication.cancel();
        versionReplication.cancel();
        err = new Error(`Synchronization error:\n  ${errors.join("\n  ")}`);
        err.errors = errors;
        console.log(`${sync} errored`);
      } else {
        console.log(`${sync} completed`);
      }
      if (err) sync.deferred.reject(err);
      else sync.deferred.resolve(sync);
    }

    function snapshotPathFor(commit) {
      // content is sha1 hash
      if (!commit.content) return null;
      let first = commit.content.slice(0, 2),
          rest = commit.content.slice(2);
      return `${first}/${rest}.json`
    }
  }

  async safeStop() {
    if (this.state === "not started" || !this.isSynchonizing) return this;
    await this.whenPaused();
    return this.stop();
  }

  stop() {
    if (this.state === "not started" || !this.isSynchonizing) return this;
    this.commitReplication.cancel();
    this.versionReplication.cancel();
    this.snapshotReplication.stopped = true;
    return this;
  }

  toString() {
    let {method, state, fromObjectDB: {name}} = this,
        dir = method === "sync" ? "<=>" :
              method === "replicateTo" ? "=>" :
              method === "replicateFrom" ? "<=" : "??";
    return `Synchronization(${state}: ${name} ${dir})`;
  }
}






function checkArg(name, value, spec) {
  if (typeof value === "undefined" && typeof spec === "string" && !spec.includes("undefined"))
    throw new Error(`parameter ${name} is undefined`);
  if (value === null && typeof spec === "string" && !spec.includes("null"))
    throw new Error(`parameter ${name} is null`);

  if (typeof spec === "string") {
    let actualType = typeof value,
        actualClass = value ? value.constructor.name : "",
        types = spec.split("|"),
        matches = types.some(t => actualType === t || actualClass === t)
    if (!matches)
      throw new Error(`parameter "${name}" expected to be of type ${spec} but is ${actualClass || actualType}`)
  }

  if (typeof spec === "function") {
    let result = spec(value);
    if (result && result.error)
      throw new Error(`check of parameter "${name}" failed: ${result.error}`)
  }
}

function checkArgs(args, specs, testFn) {
  for (let key in specs)
    checkArg(key, args[key], specs[key]);
  if (typeof testFn === "function") {
    let result = testFn(args);
    if (result && result.error)
      throw new Error(result.error);
  }
  return args;
}

export var ObjectDBInterface = {

  async describe(method) {
    // await ObjectDBInterface.describe(method = "importFromResource")
    // await ObjectDBInterface.describe()
    try {
      if (!this._methodSpecs) {
        let src = await lively.modules.module("lively.storage/objectdb.js").source(),
            parsed = parse(src, {withComments: true}),
            entities = categorizer.findDecls(parsed);
        this._methodSpecs = entities.filter(ea => ea.parent && ea.parent.name === "ObjectDBInterface");
      }

      return method ? methodNameAndParametersAndDescription(this._methodSpecs, method) :
        this._methodSpecs
          .map(ea => methodNameAndParametersAndDescription(this._methodSpecs, ea.name))
          .filter(Boolean)
    } catch (err) { return `Error in describe ${err}`; }

    function methodNameAndParametersAndDescription(methodSpecs, name) {
      let methodSpec = methodSpecs.find(ea => ea.name === name),
          body = methodSpec.node.value.body,
          stmts = body.body || [],
          comment = (body.comments || []).find(ea => ea.end < stmts[0].start),
          doc = {name, parameters: [], sideEffect: false, returns: null, description: ""};

      if (comment && comment.text.trim()) {
        let text = string.changeIndent(comment.text, " ", 0),
            commentLines = text.split("\n");
        for (let line of commentLines) {
          if (line.startsWith("ignore-in-doc")) { doc.description = ""; break; }
          if (line.startsWith("side effect:")) {
            doc.sideEffect = JSON.parse(line.split(":")[1]);
            continue;
          }
          if (line.startsWith("returns:")) {
            doc.returns = line.split(":")[1].trim();
            continue;
          }
          doc.description += line + "\n";
        }
      }

      for (let stmt of stmts) {
        if ("checkArgs" !== Path("declarations.0.init.callee.name").get(stmt))
          continue;
        let props = Path("declarations.0.id.properties").get(stmt);
        if (props) {
          doc.parameters = props.map(ea => ea.key.name);
        }
      }
      return doc
    }
  },

  async ensureDB(args) {
    // side effect: true
    // returns: boolean
    // Ensures that a database with the name `db` exists.  If not, creates one
    // and sets it up so that snapshots that get committed are stored into
    // snapshotLocation.  The return value indicates if a new DB was create
    // (true) or if one already existed (false).
    let {db: dbName, snapshotLocation} = checkArgs(args, {
      db: "string",
      snapshotLocation: "string|Resource"
    }), db = await ObjectDB.find(dbName);
    if (db) return false;
    ObjectDB.named(dbName, {snapshotLocation});
    return true;
  },

  async destroyDB(args) {
    // side effect: true
    // returns: boolean
    // Removes the DB with the name `db`. Returns true if such a DB existed and
    // if it was destroyed
    let {db: dbName} = checkArgs(args, {db: "string"}),
        db = await ObjectDB.find(dbName);
    if (!db) return false;
    await db.destroy();
    return true;
  },

  async fetchCommits(args) {
    // side effect: false
    // returns: [commits]
    // Gets the lates commits from all objects specified in `typesAndNames`.
    let {
      db: dbName, ref, type,
      typesAndNames, knownCommitIds, includeDeleted, filterFn
    } = checkArgs(args, {
      db: "string",
      ref: "string|undefined",
      type: "string|undefined",
      typesAndNames: "Array|undefined",
      knownCommitIds: "object|undefined",
      includeDeleted: "boolean|undefined",
      filterFn: "string|undefined"
    }), db = await ObjectDB.find(dbName)
    if (!ref) ref = "HEAD";

    if (!db) throw new Error(`db ${dbName} does not exist`);

    let commitDB = db.__commitDB || await db._commitDB(),
        versionDB = db.__versionDB || await db._versionDB();

    let versionQueryOpts = {},
        refsByTypeAndName = {};
    if (typesAndNames) {
      let keys = versionQueryOpts.keys = [];
      for (let {type, name, ref} of typesAndNames) {
        keys.push(`${type}/${name}`);
        if (ref) refsByTypeAndName[`${type}/${name}`] = ref;
      }

    } else if (type) {
      versionQueryOpts.startkey = `${type}/\u0000"`;
      versionQueryOpts.endkey = `${type}/\uffff"`;
    }

    let versions = await versionDB.getAll(versionQueryOpts), commitIds = [];
    for (let version of versions) {
      if (!version) continue;
      if (version.deleted || version._deleted) continue;
      let {_id, refs} = version;
      if (_id.startsWith("_")) continue;
      let commitId = refs[refsByTypeAndName[_id] || ref] || ref;
      if (commitId && (!knownCommitIds || !knownCommitIds.hasOwnProperty(commitId)))
        commitIds.push(commitId);
    }

    let commits = await db.getCommitsWithIds(commitIds);
    if (!includeDeleted)
      commits = commits.filter(ea => ea && !ea.deleted);
    if (filterFn) {
      try {
        let fn = eval(`(${filterFn})`);
        if (typeof fn !== "function")
          throw new Error(`${filterFn} does not eval to a function!`);
        let filteredCommits = commits.filter(fn);
        if (!Array.isArray(filteredCommits))
          throw new Error(`${filterFn} does not return an array!`);
        else commits = filteredCommits;
      } catch (err) {
        console.error(`fetchCommits filterFn failed:`, err)
      }
    }

    return commits;
  },

  async fetchVersionGraph(args) {
    // side effect: false
    // returns: {refs: {refName => commitId}, history: [commitId]}
    let {db: dbName, type, name} = checkArgs(args, {
          db: "string",
          type: "string",
          name: "string"
        }),
        db = await ObjectDB.find(dbName);
    if (!db) throw new Error(`db ${dbName} does not exist`);
    let {refs, history} = await db.versionGraph(type, name);
    return {refs, history};
  },

  async exists(args) {
    // side effect: false
    // returns: {exists: BOOLEAN, commitId}
    let {db: dbName, type, name, ref} = checkArgs(args, {
          db: "string",
          type: "string",
          name: "string",
          ref: "string|undefined"
        }),
        db = await ObjectDB.find(dbName),
        hist = await db.versionGraph(type, name);
    if (!hist) return {exists: false, commitId: undefined};
    ref = ref || "HEAD";
    let commit = hist.refs[ref];
    if (!commit) return {exists: false, commitId: undefined};
    return {exists: true, commitId: commit}
  },

  async fetchLog(args) {
    // side effect: false
    // returns: [commitIds]|[commits]
    let {
          db: dbName, type, name, ref,
          commit, limit, includeCommits,
          knownCommitIds
        } = checkArgs(args, {
          db: "string",
          type: "string|undefined",
          name: "string|undefined",
          ref: "string|undefined",
          commit: "string|undefined",
          limit: "number|undefined",
          includeCommits: "boolean|undefined",
          knownCommitIds: "object|undefined",
        }, args => args.type && args.name || args.commit
                      ? null : {error: `Eiter .type + .name or .commit needed!`}),
        db = await ObjectDB.find(dbName),
        defaultRef = ref || "HEAD";

    if (!db) throw new Error(`db ${dbName} does not exist`);

    if (!limit) limit = Infinity;
    if (!commit && !ref) ref = defaultRef;

    let startCommitId;
    if (commit) {
      startCommitId = commit;
      if (!type || !name) {
        let realCommit = await db.getCommit(commit);
        if (!realCommit)
          throw new Error(`fetchLog: specified commit ${commit} but no commit with this id is in the database!`);
        ({type, name} = realCommit);
      }
    }

    let versionGraph = await db.versionGraph(type, name);
    if (!versionGraph) throw new Error(`Unknown object ${type}/${name}`);
    let {refs, history} = versionGraph;
    if (!startCommitId) startCommitId = refs[ref];

    let currentCommit = startCommitId, result = [];
    while (result.length < limit && !result.includes(currentCommit)) {
      result.push(currentCommit);
      let ancestors = history[currentCommit];
      if (!ancestors || !ancestors.length) break;
      [currentCommit] = ancestors;
    }

    if (includeCommits) {
      if (knownCommitIds) result = result.filter(id => !knownCommitIds.hasOwnProperty(id));
      result = await db.getCommitsWithIds(result);
    }

    return result;
  },

  async fetchSnapshot(args) {
    // side effect: false
    // returns: object
    let {db: dbName, type, name, ref, commit: commitId} = checkArgs(args, {
          db: "string",
          type: "string|undefined",
          name: "string|undefined",
          ref: "string|undefined",
          commit: "string|undefined"
        }, args => args.type && args.name || args.commit
                      ? null : {error: `Eiter .type + .name or .commit needed!`}),
        db = await ObjectDB.find(dbName),
        defaultRef = "HEAD";

    ref = ref || defaultRef;

    if (!db) throw new Error(`db ${dbName} does not exist`);

    if (!commitId) {
      let versionGraph = await db.versionGraph(type, name);
      if (!versionGraph) throw new Error(`Unknown object ${type}/${name}`);
      commitId = versionGraph.refs[ref];
      if (!commitId) throw new Error(`Cannot find commit for ref ${ref} of ${type}/${name}`);
    }

    let commit = await db.getCommit(commitId);
    if (!commit) throw new Error(`Cannot find commit ${commitId}`);
    return db.loadSnapshot(undefined, undefined, commit);
  },

  async revert(args) {
    // side effect: true
    // returns: hist
    let {
          db: dbName, type, name, ref, toCommitId
        } = checkArgs(args, {
          db: "string",
          type: "string", name: "string",
          ref: "string|undefined",
          toCommitId: "string",
        }), db = await ObjectDB.find(dbName);

    if (!ref) ref = "HEAD";
    return db.revert(type, name, ref, toCommitId);
  },

  async commit(args) {
    // side effect: true
    // returns: commit
    let {
        db: dbName, type, name, ref,
        expectedParentCommit, commitSpec,
        snapshot, preview
      } = checkArgs(args, {
          db: "string",
          type: "string", name: "string",
          ref: "string|undefined",
          snapshot: "object|string|undefined",
          preview: "string|undefined",
          commitSpec: "object",
          expectedParentCommit: "string|undefined"
        }), db = await ObjectDB.find(dbName);

    if (!ref) ref = "HEAD";
    return db.commit(type, name, snapshot, commitSpec, preview, ref, expectedParentCommit);
  },

  async exportToSpecs(args) {
    // side effect: false
    // returns: {name: String, type: String, history: {}, commits: [commit]}
    let {db: dbName, nameAndTypes} = checkArgs(args, {
          db: "string",
          nameAndTypes: "Array|undefined",
          includeDeleted: "boolean|undefined"
        }), db = await ObjectDB.find(dbName);
    if (!db) throw new Error(`db ${dbName} does not exist`);
    return db.exportToSpecs(nameAndTypes);
  },

  async exportToDir(args) {
    // side effect: true
    // returns: undefined
    let {db: dbName, url, nameAndTypes, copyResources, includeDeleted} = checkArgs(args, {
      db: "string",
      url: "string",
      nameAndTypes: "Array|undefined",
      copyResources: "boolean|undefined",
      includeDeleted: "boolean|undefined"
    }), db = await ObjectDB.find(dbName), exportDir;
    if (!db) throw new Error(`db ${dbName} does not exist`);
    try { exportDir = resource(url); }
    catch (err) { exportDir = resource(System.baseURL).join(url); }
    return db.exportToDir(exportDir, nameAndTypes, copyResources, includeDeleted);
  },

  async importFromDir(args) {
    // side effect: true
    // returns: [{dir, type, name, commits, history, snapshotDirs}]
    let {db: dbName, url, overwrite, copyResources} = checkArgs(args, {
      db: "string", url: "string",
      overwrite: "boolean|undefined",
      copyResources: "boolean|undefined"
    }), db = await ObjectDB.find(dbName), importDir;
    if (!db) throw new Error(`db ${dbName} does not exist`);
    try { importDir = resource(url); }
    catch (err) { importDir = resource(System.baseURL).join(url); }
    return db.importFromDir(importDir, overwrite, copyResources);
  },

  async importFromSpecs(args) {
    // side effect: true
    // returns: [{dir, type, name, commits, history, snapshotDirs}]
    let {db: dbName, specs, overwrite, copyResources} = checkArgs(args, {
      db: "string",
      specs: "object",
      overwrite: "boolean|undefined",
      copyResources: "boolean|undefined"
    }), db = await ObjectDB.find(dbName);
    if (!db) throw new Error(`db ${dbName} does not exist`);
    return db.importFromSpecs(specs, overwrite, copyResources);
  },

  async importFromResource(args) {
    // side effect: true
    // returns: [{dir, type, name, commits, history, snapshotDirs}]
    // Example:
    // let author = select($world.getCurrentUser(), ["name", "realm", "email"])
    // let commitSpec = {author, description: "An empty world.", metadata: {belongsToCore: true}};
    // let result = ObjectDBInterface.importFromResource({
    //   db: "test-object-db",
    //   url: "lively.morphic/worlds/default.json",
    //   type: "world", name: "default", commitSpec, purgeHistory: true
    // })

    let {db: dbName, type, name, url, commitSpec, purgeHistory} = checkArgs(args, {
      db: "string",
      type: "string", name: "string",
      url: "string",
      commitSpec: "object",
      purgeHistory: "boolean|undefined"
    }), db = await ObjectDB.find(dbName), res;
    if (!db) throw new Error(`db ${dbName} does not exist`);
    try { res = resource(url); } catch (err) { res = resource(System.baseURL).join(url); }
    return db.importFromResource(type, name, res, commitSpec, purgeHistory);
  },

  async delete(args) {
    // side effect: true
    // returns: deletion spec
    let {db: dbName, type, name, dryRun} = checkArgs(args, {
          db: "string", type: "string", name: "string",
          dryRun: "boolean|undefined"
        }), db = await ObjectDB.find(dbName);

    return db.delete(type, name, typeof dryRun === "undefined" || dryRun);
  },

  async deleteCommit(args) {
    // side effect: true
    // returns: deletion spec
    let {db: dbName, commit, dryRun} = checkArgs(args, {
          db: "string", commit: "string",
          dryRun: "boolean|undefined"
        }), db = await ObjectDB.find(dbName);
    return db.deleteCommit(commit, typeof dryRun === "undefined" || dryRun)
  },

  async fetchConflicts(args) {
    // side effect: false
    // returns: [{
    //   commitConflicts: [{conflicts,doc,id,kind,rev}],
    //   versionConflicts: [{conflicts,doc,id,kind,rev}]
    // }]
    // Returns conflicts in version and commit dbs.
    let {
          db: dbName, includeDocs, only
        } = checkArgs(args, {
        db: "string",
        includeDocs: "boolean|undefined",
        only: "object|undefined"
      }), db = await ObjectDB.find(dbName)
    return db.getConflicts(includeDocs, only);
  },

  async resolveConflict(args) {
    // side effect: true
    // returns: [{
    let {
          db: dbName, resolved, delete: del, kind, id
        } = checkArgs(args, {
        db: "string",
        id: "string",
        kind: "string",
        delete: "Array",
        resolved: "object"
      }), db = await ObjectDB.find(dbName)
    return db.resolveConflict({resolved, delete: del, kind, id});
  },

  async fetchDiff(args) {
    // side effect: false
    let {
          db: dbName, otherDB
        } = checkArgs(args, {
        db: "string",
        otherDB: "string",
      }), db = await ObjectDB.find(dbName);
    return db.getDiff(otherDB);
  },

  async synchronize(args) {
    let {
      db: dbName, otherDB, otherDBSnapshotLocation, onlyTypesAndNames, method
    } = checkArgs(args, {
      db: "string",
      otherDB: "string",
      otherDBSnapshotLocation: "string|undefined",
      onlyTypesAndNames: "object|undefined",
      method: "string|undefined",
    }), db = await ObjectDB.find(dbName)

    if (!otherDBSnapshotLocation)
      otherDBSnapshotLocation = otherDB.replace(/\/$/, "") + "/" + "snapshots";
    if (!method) method = "replicateTo";

    let db1 = await ObjectDB.find(dbName),
        db2 = await ObjectDB.named(otherDB, {snapshotLocation: otherDBSnapshotLocation}),
        remoteCommitDB = await db2._commitDB(),
        remoteVersionDB = await db2._versionDB(),
        toSnapshotLocation = db2.snapshotLocation,
        opts = {
          replicationFilter: onlyTypesAndNames ? {onlyTypesAndNames} : undefined,
          retry: true, live: true
        },
        rep = db1[method](remoteCommitDB, remoteVersionDB, toSnapshotLocation, opts);

    await rep.whenPaused()
    await rep.safeStop();
    await rep.waitForIt()

    return obj.select(rep, ["state", "method", "conflicts", "errors", "changesByTypeAndName"]);
  }
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


// let httpDB = new ObjectDBHTTPInterface()
// await httpDB.exportToSpecs({db: "test-object-db"})

export class ObjectDBHTTPInterface {

  constructor(serverURL = document.location.origin + "/objectdb/") {
    this.serverURL = serverURL;
  }

  async _processResponse(res) {
    let contentType = res.headers.get("content-type"),
        answer = await res.text(), json;
    if (contentType === "application/json") {
      try { json = JSON.parse(answer); } catch (err) {}
    }
    if (!res.ok || (json && json.error)) {
      throw new Error((json && json.error) || answer || res.statusText);
    }
    return json || answer;
  }

  async _GET(action, opts = {}) {
    let query = Object.keys(opts).map(key => {
          let val = opts[key];
          if (typeof val === "object") val = JSON.stringify(val);
          return `${key}=${encodeURIComponent(val)}`;
        }).join("&"),
        url = this.serverURL + action + "?" + query;
    return this._processResponse(await fetch(url));
  }

  async _POST(action, opts = {}) {
    let url = this.serverURL + action;
    return this._processResponse(await fetch(url, {
      method: "POST", body: JSON.stringify(opts),
      headers: {"content-type": "application/json"}
    }));
  }

  async describe(args) {
    // parameters:
    // returns: null
    return this._GET("describe", args);
  }

  async ensureDB(args) {
    // parameters: db, snapshotLocation
    // returns: boolean
    return this._POST("ensureDB", args);
  }

  async destroyDB(args) {
    // parameters: db
    // returns: boolean
    return this._POST("destroyDB", args);
  }

  async fetchCommits(args) {
    // parameters: db, ref, type, typesAndNames, knownCommitIds, includeDeleted, filterFn
    // returns: [commits]
    return this._GET("fetchCommits", args);
  }

  async fetchVersionGraph(args) {
    // parameters: db, type, name
    // returns: {refs, history}
    return this._GET("fetchVersionGraph", args);
  }

  async exists(args) {
    // parameters: db, type, name, ref
    // returns: {commit, exists}
    return this._GET("exists", args);
  }

  async fetchLog(args) {
    // parameters: db, type, name, ref, commit, limit, includeCommits, knownCommitIds
    // returns: [commitIds]|[commits]
    return this._GET("fetchLog", args);
  }

  async fetchSnapshot(args) {
    // parameters: db, type, name, ref, commit
    // returns: object
    return this._GET("fetchSnapshot", args);
  }

  async revert(args) {
    // parameters: db, type, name, toCommitId, ref
    // returns: hist
    return this._POST("revert", args);
  }

  async commit(args) {
    // parameters: db, type, name, ref, expectedParentCommit, commitSpec, preview, snapshot
    // returns: commit
    return this._POST("commit", args);
  }

  async exportToSpecs(args) {
    // parameters: db, nameAndTypes, includeDeleted
    // returns: [{dir, type, name, commits, history, snapshotDirs}]
    return this._GET("exportToSpecs", args);
  }

  async exportToDir(args) {
    // parameters: db, url, nameAndTypes, copyResources
    // returns: undefined
    return this._POST("exportToDir", args);
  }

  async importFromDir(args) {
    // parameters: db, url, overwrite, copyResources
    // returns: [{dir, type, name, commits, history, snapshotDirs}]
    return this._POST("importFromDir", args);
  }

  async importFromSpecs(args) {
    // parameters: db, specs, overwrite, copyResources
    // returns: [{dir, type, name, commits, history, snapshotDirs}]
    return this._POST("importFromSpecs", args);
  }

  async importFromResource(args) {
    // parameters: db, type, name, url, commitSpec, purgeHistory
    // returns: [{dir, type, name, commits, history, snapshotDirs}]
    return this._POST("importFromResource", args);
  }

  async delete(args) {
    // parameters: db, type, name, dryRun
    // returns: deletion spec
    return this._POST("delete", args);
  }

  async deleteCommit(args) {
    // parameters: db, commit, dryRun
    // returns: deletion spec
    return this._POST("deleteCommit", args);
  }

  async fetchConflicts(args) {
    // parameters: db, only, includeDocs
    // returns: conflicts
    return this._GET("fetchConflicts", args);
  }

  async resolveConflict(args) {
    // parameters: db, id, kind, delete, resolved
    // returns: conflicts
    return this._POST("resolveConflict", args);
  }

  async fetchDiff(args) {
    // parameters: db, otherDB
    // returns: conflicts
    return this._GET("fetchDiff", args);
  }

  async synchronize(args) {
    // parameters: db: otherDB, otherDBSnapshotLocation, onlyTypesAndNames, method
    // returns: ...
    return this._POST("synchronize", args);
  }
}
