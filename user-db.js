import { Database } from "lively.storage";
import User from "./user.js";

// let Database.ensureDB(name, options)

export default class UserDB {

  static get cached() {
    if (!this._cached) this._cached = new Map();
    return this._cached;
  }

  static ensureDB(path, options) {
    let cached = this.cached.get(path);
    if (cached) return cached;
    let db = Database.ensureDB(path, options),
        userDB = new this(path, db);
    this.cached.set(path, userDB);
    return userDB;
  }

  constructor(path, db) {
    this.path = path;
    this.db = db;
  }


  async getAllUsers() {
    let docIds = await this.db.docList();
    return Promise.all(docIds.map(ea =>
      User.namedSync(ea.id) || User.named(ea.id, this)));
  }
  
  async getUserNamed(name) { return User.named(name, this); }
  
  destroy() {
    this.constructor.cached.delete(this.path);
    return this.db.destroy();
  }
}