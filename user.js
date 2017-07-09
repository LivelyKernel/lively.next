/*global System*/
const { hashSync, genSaltSync, compareSync } = System._nodeRequire("bcryptjs");
import { sign } from "./jwt.js";
import { string, promise } from "lively.lang";
import { obj } from "lively.lang";

export default class User {

  static get userCache() {
    if (!this._userCache) this._userCache = new Map();
    return this._userCache;
  }

  static namedSync(name) { return this.userCache.get(name); }

  static named(name, userDB) {
    return Promise.resolve(this.userCache.get(name) || this.loadFromDB(name, userDB)
      .then(user => { this.userCache.set(name, user); return user; }))
  }

  static async loadFromDB(name, userDB) {
    let stored = await userDB.db.get(name);
    return stored ? this.fromDBRecord(stored) : null;
  }

  static async fromDBRecord(record) {
    return new this(obj.select(record, [
      "name","email","avatar","roles","hashedPassword", "createdAt"]));
  }

  constructor({name, password, hashedPassword, email, avatar, roles, createdAt}) {
    this.name = name
    this.email = email;
    this.avatar = avatar;
    this.createdAt = createdAt || Date.now()
    this.roles = {};
    if (password) this.changePassword(password);
    else this.hashedPassword = hashedPassword;
    this.token = null;
  }

  storeIntoDB(userDB) {
    let {name, email, avatar, roles, hashedPassword} = this;
    return userDB.db.set(name, {name, email, avatar, roles, hashedPassword});
  }

  sign() {
    if (this.token) return this.token;
    let props = obj.select(this, ["roles", "avatar", "email", "name", "createdAt"]);
    return this.token = sign(props);
  }

  changePassword(password) {
    this.hashedPassword = hashSync(password, genSaltSync(10));
    return this;
  }

  checkPassword(password) {
    return password && this.hashedPassword
      ? compareSync(password, this.hashedPassword) : false;
  }

  dataForClient() {
    return obj.select(this, ["name","email","avatar","roles","createdAt"]);
  }

  toString() { return `<User ${this.name}>`; }
}
