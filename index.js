import PouchDB from "pouchdb";
import pouchdbFind from "pouchdb-find";
PouchDB.plugin(pouchdbFind);

// System.get(System.normalizeSync("pouchdb-find", "http://localhost:9011/lively.storage/index.js"))
// await lively.modules.module(System.normalizeSync("pouchdb", "http://localhost:9011/lively.storage/index.js")).reload()

export default class Database {

  static get databases() {
    return this._databases || (this._databases = new Map());
  }

  static findDB(name) { return this.databases.get(name); }

  static ensureDB(name) { return this.findDB(name) || new this(name); }

  constructor(name, options = {}) {
    this.name = name;
    this.options = options;
    this._pouchdb = null;
  }

  get pouchdb() {
    if (this._pouchdb) return this._pouchdb;
    let {name, options} = this;
    return this._pouchdb = new PouchDB(name, options);
  }

  isDestroyed() { return !!this.pouchdb._destroyed; }

  destroy(opts) {
    this.constructor.databases.delete(this.name);
    return this.isDestroyed() ? {ok: true} : this.pouchdb.destroy(opts);
  }

}