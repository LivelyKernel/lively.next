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
    this.userCache = new Map();
  }

  async getAllUsers() {
    let docIds = await this.db.docList();
    return Promise.all(docIds.map(ea => this.getUserNamed(ea.id)));
  }
  
  async getUserNamed(name) {
    let cached = this.userCache.get(name);
    if (cached) return cached
    let user = await User.named(name, this);
    if (user) this.userCache.set(name, user);
    return user;
  }

  async createUser(userData, check = true) {
    // userData = {name, password, hashedPassword, email, avatar, roles}
    if (!userData.name) throw new Error("User needs a name");
    if (!userData.password && !userData.passwordHash) throw new Error("User needs a password");
    if (check && await this.getUserNamed(userData.name))
      throw new Error(`User ${userData.name} already exists`);
    let user = new User(userData);
    await user.storeIntoDB(this);
    this.userCache.set(user.name, user);
    return user;
  }
  
  destroy() {
    this.constructor.cached.delete(this.path);
    return this.db.destroy();
  }
}