/* global System,inspect */
import { ObjectDBHTTPInterface } from 'lively.storage';
import { Database } from 'lively.storage';
import { loadMorphFromSnapshot, createMorphSnapshot } from '../serialization.js';
import { resource } from 'lively.resources';
import { obj, Path, arr, string } from 'lively.lang';

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
const defaultServerURL = (typeof document !== 'undefined'
  ? document.location.origin : 'http://localhost:9001') + '/objectdb/';

export function convertToSerializableCommit (commit) {
  commit.__serialize__ = () => {
    const { type, name, _id } = commit;
    return {
      __expr__: `({type: "${type}", name: "${name}", _id: "${_id}"})`
    };
  };
  return commit;
}

export async function ensureCommitInfo (commit) {
  if (!commit || obj.isEmpty(commit)) return false;
  if (commit && commit._rev) return commit;
  const { type, name, _id } = commit;
  try {
    Object.assign(commit, await MorphicDB.default.fetchCommit(type, name, _id));
  } finally {
    return commit;
  }
}

export default class MorphicDB {
  static get default () {
    return this.named('lively.morphic/objectdb/morphicdb', { serverURL: defaultServerURL });
  }

  static named (name, options) {
    const existing = morphicDBs.get(name);
    if (existing) return existing;
    if (!options.serverURL) throw new Error('Needs serverURL!');
    const db = new this(name, options);
    morphicDBs.set(name, db);
    return db;
  }

  static async wellKnownMorphicDBs () {
    const db = Database.ensureDB('lively.morphic/morphicdb/well-known-morphic-dbs');
    const dbSpecs = await db.getAll();
    const dbs = dbSpecs.reduce((all, { _id, name, serverURL, snapshotLocation }) =>
      Object.assign(all, { [_id]: this.named(name, { serverURL, snapshotLocation }) }), {});
    if (!dbs.default) dbs.default = this.default;
    return dbs;
  }

  static async addWellKnownMorphicDB (alias, morphicDB) {
    const { name, snapshotLocation, serverURL } = morphicDB;
    const db = Database.ensureDB('lively.morphic/morphicdb/well-known-morphic-dbs');
    await db.set(alias, { name, snapshotLocation, serverURL });
  }

  static async removeWellKnownMorphicDB (alias) {
    const db = Database.ensureDB('lively.morphic/morphicdb/well-known-morphic-dbs');
    await db.remove(alias);
  }

  constructor (name, { snapshotLocation, serverURL }) {
    this.name = name;
    this.serverURL = serverURL;
    this.snapshotLocation = snapshotLocation || `${name}/snapshots/`;
    this.httpDB = new ObjectDBHTTPInterface(serverURL);
    this._initialized = false;
  }

  __serialize__ () {
    const { name, serverURL, snapshotLocation } = this;
    return {
      __expr__: `MorphicDB.named("${name}", {snapshotLocation: "${snapshotLocation}", serverURL: "${serverURL}"})`,
      bindings: { 'lively.morphic/morphicdb/index.js': ['MorphicDB'] }
    };
  }

  async initializeIfNecessary () {
    if (this._initialized) return;
    await this.ensureDB();
    this._initialized = true;
  }

  snapshotResourceFor (commit) {
    // content is sha1 hash
    const first = commit.content.slice(0, 2);
    const rest = commit.content.slice(2);
    return resource(System.decanonicalize(this.snapshotLocation))
      .join(`${first}/${rest}.json`);
  }

  ensureDB () {
    const { name: db, snapshotLocation } = this;
    return this.httpDB.ensureDB({ db, snapshotLocation });
  }

  destroyDB () {
    this._initialized = false;
    const { name: db } = this;
    return this.httpDB.destroyDB({ db });
  }

  async latestCommits (type = 'world', includeDeleted = false) {
    // await MorphicDB.default.latestCommits()
    await this.initializeIfNecessary();
    const { name: db } = this;
    const ref = 'HEAD'; const knownCommitIds = {};
    return this.httpDB.fetchCommits({ db, type, ref, knownCommitIds, includeDeleted });
  }

  async fetchCommit (type, name, ref) {
    await this.initializeIfNecessary();
    const typesAndNames = [{ type, name, ref }];
    const commits = await this.httpDB.fetchCommits(
      { db: this.name, ref, type, typesAndNames, knownCommitIds: {} });
    const commit = commits[0];
    return convertToSerializableCommit(commits[0]);
  }

  async fetchSnapshot (type, name, commitIdOrCommit, ref) {
    const firstArg = type;
    if (arguments.length === 1 && firstArg.type && firstArg.name) {
      type = firstArg.type;
      name = firstArg.name;
      commitIdOrCommit = firstArg._id;
    }
    await this.initializeIfNecessary();
    const { name: db } = this;
    return this.httpDB.fetchSnapshot({ db, type, name, ref, commit: commitIdOrCommit });
  }

  async exists (type, name, ref) {
    // await MorphicDB.default.latestWorldCommits()
    await this.initializeIfNecessary();
    const { name: db } = this;
    return this.httpDB.exists({ db, type, name, ref });
  }

  async history (type, name) {
    // await MorphicDB.default.latestWorldCommits()
    await this.initializeIfNecessary();
    const { name: db } = this;
    return this.httpDB.fetchVersionGraph({ db, type, name });
  }

  async log (commit, limit, includeCommits = false, knownCommitIds) {
    await this.initializeIfNecessary();
    const { name: db } = this;
    return (await this.httpDB.fetchLog({ db, commit, limit, includeCommits, knownCommitIds })).map(convertToSerializableCommit);
  }

  async revert (type, name, toCommitId, ref = 'HEAD') {
    await this.initializeIfNecessary();
    const { name: db } = this;
    return this.httpDB.revert({ db, type, name, toCommitId, ref });
  }

  async snapshotAndCommit (type, name, morph, snapshotOptions, commitSpec, ref, expectedParentCommit) {
    const snapshot = await createMorphSnapshot(morph, snapshotOptions);
    let commit = await this.commit(type, name, snapshot, commitSpec, ref, expectedParentCommit);
    commit = convertToSerializableCommit(commit);
    morph.changeMetaData('commit', obj.dissoc(commit, ['preview']), /* serialize = */true, /* merge = */false);

    return commit;
  }

  async commit (type, name, snapshot, commitSpec, ref, expectedParentCommit) {
    const firstArg = type;
    // commit with previous commit as first argument
    if (arguments.length === 1 && firstArg.type && firstArg.name) {
      type = firstArg.type;
      name = firstArg.name;
      snapshot = firstArg.snapshot || firstArg.content;
      commitSpec = obj.dissoc(firstArg, ['snapshot', '_rev', '_id', 'ancestors', 'deleted']);
      expectedParentCommit = firstArg._id;
    }

    await this.initializeIfNecessary();
    const { name: db } = this;
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

  async load (typeOrCommit, name, loadOptions, commitIdOrCommit, ref) {
    let type;
    if (typeof typeOrCommit === 'object') commitIdOrCommit = typeOrCommit;
    else type = typeOrCommit;
    let commit = commitIdOrCommit;
    if (!commit) {
      commit = await this.fetchCommit(type, name, ref);
    } else if (typeof commit === 'string') {
      [commit] = await this.log(commit, 1, true);
    }
    const snapshot = await this.fetchSnapshot(undefined, undefined, commit._id);
    const morph = await loadMorphFromSnapshot(snapshot, loadOptions);

    commit = convertToSerializableCommit(commit);

    morph.changeMetaData('commit', obj.dissoc(commit, ['preview']),
      /* serialize = */true, /* merge = */false);
    return morph;
  }

  async fetchDiff (otherDBName) {
    await this.initializeIfNecessary();
    const { name: db } = this;
    return this.httpDB.fetchDiff({ db, otherDB: otherDBName });
  }

  async fetchConflicts (includeDocs, only) {
    await this.initializeIfNecessary();
    const { name: db } = this;
    return this.httpDB.fetchConflicts({ db, includeDocs, only });
  }

  async resolveConflict (resolved) {
    // {id, kind, delete, resolved}
    await this.initializeIfNecessary();
    const { name: db } = this;
    return this.httpDB.resolveConflict({ db, ...resolved });
  }

  async synchronize ({ method, otherDB, otherDBSnapshotLocation, onlyTypesAndNames }) {
    await this.initializeIfNecessary();
    const { name: db } = this;
    return this.httpDB.synchronize({
      db,
      method,
      otherDB,
      otherDBSnapshotLocation,
      onlyTypesAndNames
    });
  }

  async softDelete (typeOrPrevCommit, name, commitSpec, ref, expectedParentCommit) {
    return this.commit(typeOrPrevCommit, name, undefined, commitSpec, ref, expectedParentCommit);
  }

  async delete (type, name, dryRun = true) {
    await this.initializeIfNecessary();
    const { name: db } = this;
    return this.httpDB.delete({ db, type, name, dryRun });
  }

  async deleteCommit (commitId, dryRun = true) {
    await this.initializeIfNecessary();
    const { name: db } = this;
    return this.httpDB.deleteCommit({ db, commit: commitId, dryRun });
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // search
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async codeSearchInPackages (stringOrRe, type = 'part', onProgress, commitFilter) {
    let commits = await this.latestCommits(type); const found = []; let i = 0;
    if (typeof commitFilter === 'function') { commits = commits.filter(commitFilter); }

    for (const commit of commits) {
      if (typeof onProgress === 'function') { onProgress(commit.name, i++, commits.length); }
      const matches = await this._textSearchInSnapshotOfCommit(stringOrRe, commit);
      if (matches.length) found.push(...matches);
    }

    return found;
  }

  async _textSearchInSnapshotOfCommit (stringOrRe, commit, optSnapshot) {
    const { _id } = commit;
    const snapshot = optSnapshot || await this.fetchSnapshot(undefined, undefined, _id);
    return new SnapshotPackageHelper(snapshot).textSearch(stringOrRe, commit);
  }
}

export class SnapshotPackageHelper {
  constructor (snapshot) {
    this.snapshot = snapshot;
  }

  textSearch (stringOrRe, commit) {
    // Example:
    // let snapshot = await MorphicDB.default.fetchSnapshot("part", "PartsBin")
    // let matches = new SnapshotPackageHelper(snapshot).textSearch("PartsBin")
    // let matches = new SnapshotPackageHelper(snapshot).textSearch(/.{0,10}PartsBin.{0,10}/g)

    const isRe = stringOrRe && stringOrRe instanceof RegExp; const found = [];

    if (!stringOrRe) return found;

    for (const file of this.filesInPackages()) {
      let source = file.get(this.snapshot);
      const lineNoFn = string.lineIndexComputer(source);
      const lineRanges = string.lineRanges(source);

      if (!isRe) {
        let index = 0; let offset = 0;
        while ((index = source.indexOf(stringOrRe)) >= 0) {
          const start = index + offset; const end = start + stringOrRe.length;
          const line = lineNoFn(start);
          const lineString = source.slice(...lineRanges[line]);
          found.push({
            match: stringOrRe,
            start,
            end,
            length: stringOrRe.length,
            line,
            lineString,
            commit,
            file
          });
          offset += index + stringOrRe.length;
          source = source.slice(index + stringOrRe.length);
        }
      } else {
        const matches = string.reMatches(source, stringOrRe);
        if (matches.length) { found.push(...matches.map(ea => Object.assign(ea, { commit, file }))); }
      }
    }

    return found;
  }

  filesInPackages () {
    // returns array, that form js path to "files" inside snap.packages
    // Example:
    // let snapshot = await MorphicDB.default.fetchSnapshot("part", "PartsBin")
    // let files = new SnapshotPackageHelper(snapshot).filesInPackages()

    const result = [];
    for (const baseURL in this.snapshot.packages) { collectFiles(this.snapshot.packages[baseURL], [baseURL], baseURL, null, result); }
    return result;

    function collectFiles (dirObj, path, url, currentPackage, result = []) {
      if (dirObj['package.json'] && typeof dirObj['package.json'] === 'string') {
        try {
          const packageConfig = JSON.parse(dirObj['package.json']);
          currentPackage = { url, path, name: packageConfig.name || arr.last(path) };
        } catch (err) {}
      }

      const subDirs = [];

      for (const fileName in dirObj) {
        if (typeof dirObj[fileName] === 'string') {
          result.push({
            path: path.concat(fileName),
            url: string.joinPath(url, fileName),
            package: currentPackage,
            get (snapshot) { return Path(this.path).get(snapshot.packages); },
            set (snapshot, content) { Path(this.path).set(snapshot.packages, content); }
          });
        } else subDirs.push(fileName);
      }

      subDirs.forEach(dirName =>
        collectFiles(dirObj[dirName], path.concat(dirName), string.joinPath(url, dirName),
          currentPackage, result));

      return result;
    }
  }
}
