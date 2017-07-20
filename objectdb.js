/*global System,process,require,fetch*/
import Database from "./database.js";
import { resource } from "lively.resources";
import { obj } from "lively.lang";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// sha1
// Author: creationix
// Repo: https://github.com/creationix/git-sha1
// License: MIT https://github.com/creationix/git-sha1/blob/b3474591e6834232df63b5cf9bb969185a54a04c/LICENSE
const sha1 = (function sha1_setup(){function r(r){if(void 0===r)return o(!1);var e=o(!0);return e.update(r),e.digest()}function e(){var r=f.createHash("sha1");return{update:function(e){return r.update(e)},digest:function(){return r.digest("hex")}}}function t(r){function e(r){if("string"==typeof r)return t(r);var e=r.length;h+=8*e;for(var n=0;n<e;n++)o(r[n])}function t(r){var e=r.length;h+=8*e;for(var t=0;t<e;t++)o(r.charCodeAt(t))}function o(r){a[y]|=(255&r)<<g,g?g-=8:(y++,g=24),16===y&&u()}function f(){o(128),(y>14||14===y&&g<24)&&u(),y=14,g=24,o(0),o(0),o(h>0xffffffffff?h/1099511627776:0),o(h>4294967295?h/4294967296:0);for(var r=24;r>=0;r-=8)o(h>>r);return i(s)+i(c)+i(v)+i(p)+i(d)}function u(){for(var r=16;r<80;r++){var e=a[r-3]^a[r-8]^a[r-14]^a[r-16];a[r]=e<<1|e>>>31}var t,n,o=s,f=c,u=v,i=p,g=d;for(r=0;r<80;r++){r<20?(t=i^f&(u^i),n=1518500249):r<40?(t=f^u^i,n=1859775393):r<60?(t=f&u|i&(f|u),n=2400959708):(t=f^u^i,n=3395469782);var h=(o<<5|o>>>27)+t+g+n+(0|a[r]);g=i,i=u,u=f<<30|f>>>2,f=o,o=h}for(s=s+o|0,c=c+f|0,v=v+u|0,p=p+i|0,d=d+g|0,y=0,r=0;r<16;r++)a[r]=0}function i(r){for(var e="",t=28;t>=0;t-=4)e+=(r>>t&15).toString(16);return e}var a,s=1732584193,c=4023233417,v=2562383102,p=271733878,d=3285377520,y=0,g=24,h=0;return a=r?n:new Uint32Array(80),{update:e,digest:f}}var n,o,f;return"object"==typeof process&&"object"==typeof process.versions&&process.versions.node&&"renderer"!==process.__atom_type?(f="undefined"!=typeof System?System._nodeRequire("crypto"):require("crypto"),o=e):(n=new Uint32Array(80),o=t),r})();

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// let db = await ObjectDB.find("test-object-db");
// db = objectDBs.get("lively.morphic/objectdb/morphicdb")
// await db.objectStats()

var objectDBs = objectDBs || new Map();

export default class ObjectDB {

  static async find(name) {
    let found = objectDBs.get(name);
    if (found) return found;
    let metaDB = Database.ensureDB("__internal__objectdb-meta"),
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

    let metaDB = Database.ensureDB("__internal__objectdb-meta");
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
    
    let metaDB = Database.ensureDB("__internal__objectdb-meta");
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

  async objects(type) {
    let stats = await this.objectStats(type);
    if (type) return Object.keys(stats || {});
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
      user,
      description = "no description",
      tags = [],
      message = "",
      metadata
    } = commitSpec;

    if (!type) throw new Error("object needs a type");
    if (!name) throw new Error("object needs a name");
    if (!user) throw new Error(`Cannot commit ${type}/${name} without user`);

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

    let snapshotJson = snapshot ? JSON.stringify(snapshot) : null,
        commit = this._createCommit(
          type, name, description, tags, metadata,
          user, message, ancestors,
          snapshot, snapshotJson, preview);

    // update version graph
    if (!versionData) versionData = {refs: {}, history: {}};
    versionData.refs[ref] = commit._id;
    versionData.history[commit._id] = ancestors;
    await versionDB.set(type + "/" + name, versionData);

    // store the commit
    let commitDB = this.__commitDB || await this._commitDB();
    commit = await commitDB.set(commit._id, commit);

    // write snapshot to resource
    if (snapshot) {
      let res = this.snapshotResourceFor(commit);
      await res.parent().ensureExistance();
      if (res.canDealWithJSON) await res.writeJson(snapshot);
      else await res.write(snapshotJson);
    }

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

  _createCommit(
    type, name, description, tags, metadata, user,
    message = "", ancestors = [],
    snapshot, snapshotJson, preview
  ) {
    if (!preview && snapshot && snapshot.preview) preview = snapshot.preview;
    let commit = {
      name, type, timestamp: Date.now(),
      author: {
        name: user.name,
        email: user.email,
        realm: user.realm
      },
      tags: [], description,
      message,
      preview,
      content: snapshotJson ? sha1(snapshotJson) : null,
      deleted: !snapshot,
      metadata,
      ancestors
    }
    let hashObj = obj.dissoc(commit, ["preview"]),
        commitHash = sha1(JSON.stringify(hashObj));
    return Object.assign(commit, {_id: commitHash});
  }

  async _commitDB() {
    if (this.__commitDB) return this.__commitDB;

    let dbName = this.name + "-commits",
        db = Database.findDB(dbName);
    if (db) return this.__commitDB = db;

    db = Database.ensureDB(dbName);

    // prepare indexes
    let hasIndexes = await Promise.all([
      db.has("_design/name_index"),
      db.has("_design/nameAndTimestamp_index"),
      db.has("_design/nameWithMaxMinTimestamp_index")
    ]);

    if (!hasIndexes.every(Boolean)) {
      console.log(`Preparing indexes for object storage DB ${dbName}`);

      var nameIndex = {
            _id: '_design/name_index',
            views: {'name_index': {map: 'function (doc) { emit(`${doc.type}\u0000${doc.name}}`); }'}}},
          nameAndTimestampIndex = {
            _id: '_design/nameAndTimestamp_index',
            views: {'nameAndTimestamp_index': {
              map: "function (doc) { emit(`${doc.type}\u0000${doc.name}\u0000${doc.timestamp}}\u0000${doc._id}}`); }"}}},
          nameWithMaxMinTimestamp = {
            _id: '_design/nameWithMaxMinTimestamp_index',
            views: {
              'nameWithMaxMinTimestamp_index': {
                map: 'doc => emit(`${doc.type}\u0000${doc.name}`, doc.timestamp)',
                reduce: "_stats"}}};

      await db.setDocuments([nameIndex, nameAndTimestampIndex, nameWithMaxMinTimestamp]);
      await Promise.all([
        db.pouchdb.query('name_index', {stale: 'update_after'}),
        db.pouchdb.query('nameAndTimestamp_index', {stale: 'update_after'}),
        db.pouchdb.query("nameWithMaxMinTimestamp_index", {stale: 'update_after'}),
      ]);
    }

    return this.__commitDB = db;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // versioning

  async versionGraph(type, objectName) {
    let versionDB = this.__versionDB || await this._versionDB(),
        graph = await versionDB.get(type + "/" + objectName);
    return !graph || graph.deleted ? null : graph;
  }

  async _log(type, objectName, ref = "HEAD", limit = Infinity) {
    let data = await this.versionGraph(type, objectName);
    if (!data || data.deleted) return [];
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

    // var typeAndNameIndex = {
    //   _id: '_design/type_name_index',
    //   views: {'name_index': {map: 'function (doc) { emit(`${doc.type}\u0000${doc.name}}`); }'}}};
    // db.setDocuments([typeAndNameIndex]);
    // await Promise.alll([db.pouchdb.query('type_name_index', {stale: 'update_after'})]);

    return this.__versionDB = db;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // export

  async exportToDir(exportDir, nameAndTypes, copyResources = false, includeDeleted = false) {
    let commitDB = this.__commitDB || await this._commitDB();;
    for (let {name, type} of nameAndTypes) {
      let currentExportDir = exportDir.join(type).join(name).asDirectory(),
          {refs, history} = await this.versionGraph(type, name),
          commitIds = Object.keys(history),
          commits = await this.getCommitsWithIds(commitIds);

      if (!includeDeleted)
        commits = commits.filter(ea => !ea.deleted);

      let resourcesForCopy = copyResources ? commits.map(commit => {
        delete commit._rev;
        let from = this.snapshotResourceFor(commit),
            to = currentExportDir.join(from.parent().name() + "/" + from.name());
        return {from, to};
      }) : [];

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
      resources.push(this.snapshotResourceFor(commit));
      commitDeletions.push({...commit, _deleted: true});
    }

    // 3. history to delete
    let versionDB = this.__versionDB || await this._versionDB(),
        {_id, _rev} = await versionDB.get(type + "/" + name),
        deletedHist = {_id, _rev, deleted: true}


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
        resources = [this.snapshotResourceFor(commit)],
        commitDeletions = [{...commit, _deleted: true}],
        hist = await versionDB.get(type + "/" + name);

    if (!hist) throw new Error(`No history for ${type}/${name}@${commit._id}`);
    if (!hist.refs[ref]) throw new Error(`Cannot delete commit ${type}/${name}@${commit._id} b/c it is not where ref ${ref} is pointing!`);

    let [ancestor] = hist.history[commit._id] || [];
    if (!ancestor && Object.keys(hist.history).length <= 1) {
      hist.deleted = true;
    } else if (!ancestor) {
      throw new Error(`Cannot delete commit ${type}/${name}@${commit._id} b/c it has no ancestor but there are still other commits!`);
    } else {
      delete hist.history[commit._id];
      hist.refs[ref] = ancestor;
    }

    if (!dryRun) {
      await objectDB.setDocuments(commitDeletions);
      await versionDB.set(type + "/" + name, hist);
      Promise.all(resources.map(ea => ea.remove()));
    }

    return {
      commits: commitDeletions,
      history: hist,
      resources
    }
  }
}





function checkArg(name, value, spec) {
  if (typeof value === "undefined" && typeof spec === "string" && !spec.includes("undefined"))
    throw new Error(`parameter ${name} is undefined`);

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
            parsed = lively.ast.parse(src, {withComments: true}),
            entities = lively.ast.categorizer.findDecls(parsed);
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
        let text = lively.lang.string.changeIndent(comment.text, " ", 0),
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
        if ("checkArgs" !== lively.lang.Path("declarations.0.init.callee.name").get(stmt))
          continue;
        let props = lively.lang.Path("declarations.0.id.properties").get(stmt);
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
      typesAndNames, knownCommitIds, includeDeleted
    } = checkArgs(args, {
      db: "string",
      ref: "string|undefined",
      type: "string|undefined",
      typesAndNames: "Array|undefined",
      knownCommitIds: "object|undefined",
      includeDeleted: "boolean|undefined"
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
      if (version.deleted) continue;
      let {_id, refs} = version;
      ref = refsByTypeAndName[_id] || ref;
        let commitId = refs[ref];
      if (commitId && !knownCommitIds
       || !knownCommitIds.hasOwnProperty(commitId))
        commitIds.push(commitId);
    }

    let commits = await db.getCommitsWithIds(commitIds);
    if (!includeDeleted)
      commits = commits.filter(ea => !ea.deleted);
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
      if (!type || !name) ({type, name} = await db.getCommit(commit));
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
          snapshot: "object",
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
    // let user = select($world.getCurrentUser(), ["name", "realm", "email"])
    // let commitSpec = {user, description: "An empty world.", metadata: {belongsToCore: true}};
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
  }

}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


// let httpDB = new ObjectDBHTTPInterface()
// await httpDB.exportToSpecs({db: "test-object-db"})

export class ObjectDBHTTPInterface {

  constructor(serverURL = document.origin + "/objectdb/") {
    this.serverURL = serverURL;
  }


  async _processResponse(res) {
    let contentType = res.headers.get("content-type"),
        answer = await res.text(), json;
    if (contentType === "application/json") {
      try { json = JSON.parse(answer); } catch (err) {}
    }
    if (!res.ok || json.error) {    
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
    // parameters: db, ref, type, typesAndNames, knownCommitIds, includeDeleted
    // returns: [commits]
    return this._GET("fetchCommits", args);
  }
  
  async fetchVersionGraph(args) {
    // parameters: db, type, name
    // returns: {refs, history}
    return this._GET("fetchVersionGraph", args);
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
  
}
