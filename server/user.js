/*global System*/
const { hashSync, genSaltSync, compareSync } = System._nodeRequire("bcryptjs");
import { sign } from "./jwt.js";
import { string, promise } from "lively.lang";
import { obj } from "lively.lang";

const userProps = ["name", "email", "avatar", "roles", "hashedPassword", "createdAt"],
      userPropsForClients = ["name", "email", "avatar", "roles", "createdAt"];

export default class User {

  static named(name, userDB) {
    return this.loadFromDB(name, userDB);
  }

  static async loadFromDB(name, userDB) {
    let stored = await userDB.db.get(name);
    return stored ? this.fromDBRecord(stored) : null;
  }

  static async fromDBRecord(record) {
    return new this(obj.select(record, userProps));
  }

  constructor({name, password, hashedPassword, email, avatar, roles, createdAt}) {
    this._name = name
    this._email = email;
    this._avatar = avatar;
    this._createdAt = createdAt || Date.now()
    this._roles = {};
    if (password) this.changePassword(password);
    else this._hashedPassword = hashedPassword;
    this._token = null;
  }

  get name() { return this._name; }
  get email() { return this._email; }
  set email(val) { this._token = null; this._email = val; }
  get avatar() { return this._avatar; }
  set avatar(val) { this._token = null; this._avatar = val; }
  get createdAt() { return this._createdAt; }
  set createdAt(val) { this._token = null; this._createdAt = val; }
  get roles() { return this._roles; }
  set roles(val) { this._token = null; this._roles = val; }
  get hashedPassword() { return this._hashedPassword; }
  set hashedPassword(val) { this._hashedPassword = val; }
  get password() { return ""; }
  set password(val) { this.changePassword(val); }

  get token() {
    if (this._token) return this._token;
    let props = obj.select(this, userPropsForClients);
    return this._token = sign(props);
  }

  modify(changes) {
    if (typeof changes !== "object") throw new Error("invalid change spec");

    if ("name" in changes)
      throw new Error("name cannot be changed");

    if ("hashedPassword" in changes)
      throw new Error("changing hashedPassword not supported");

    let supportedModificationProps = [...userProps, "password"];
    for (let key in changes) {
      if (supportedModificationProps.includes(key)) this[key] = changes[key];
      else console.warn(`${this}.modify: ignoring property ${key}`);
    }
  }

  storeIntoDB(userDB) {
    let {name, email, avatar, roles, hashedPassword} = this;
    return userDB.db.set(name, {name, email, avatar, roles, hashedPassword});
  }

  changePassword(password) {
    this.hashedPassword = hashSync(password, genSaltSync(10));
    return this;
  }

  checkPassword(password) {
    return password && this.hashedPassword
      ? compareSync(password, this.hashedPassword) : false;
  }

  dataForClient() { return obj.select(this, userPropsForClients); }

  toString() { return `<User ${this.name}>`; }
}
