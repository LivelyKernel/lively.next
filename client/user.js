/*global fetch*/

function jwtTokenDecode(token) {
  let [a,b,c] = token.split(".")
  return JSON.parse(atob(b));
}

function makeRequest(url, method = "GET", body, headers = {}) {
  var useCors = true, fetchOpts = {method};
  if (useCors) fetchOpts.mode = "cors"
  if (body) fetchOpts.body = body;
  fetchOpts.redirect = 'follow';
  fetchOpts.headers = {...headers};
  return fetch(url, fetchOpts);
}

async function POST(url, body) {
  if (typeof body !== "string") body = JSON.stringify(body);
  let res = await makeRequest(url, "POST", body, {}),
      text, json;
  try { text = await res.text(); } catch (err) {}
  if (text && res.headers.get("content-type") === "application/json") {
    try { json = JSON.parse(text); } catch (err) {}
  }
  if (!json) throw new Error("Unexpected response: " + text);
  return json;
}


export default class User {

  static get guest() { return guestUser; }

  static named(name, url) {
    let key = name + "-" + url;
    let user = userMap.get(key);
    if (!user) {
      user = new this(name, url);
      userMap.set(key, user);
    }
    return user;
  }

  static fromToken(token, url) {
    let {name, roles, createdAt, email} = jwtTokenDecode(token);
    return Object.assign(this.named(name, url), {roles, createdAt, email, token});
  }

  static clearCache() {
    userMap = new Map();
  }

  constructor(name, url) {
    this.url = url;
    this.name = name;
    this.roles = {};
    this.createdAt = 0;
    this.email = null;
    this.token = null;
  }

  isLoggedIn() { return !!this.token; }

  async loginOrRegister(action, password, authServerURL) {
    var {email, createdAt, roles, name} = this,
        payload = action === "register" ? {password, email, createdAt, roles, name} : {password, name},
        answer = await POST(authServerURL + "/" + action, payload);
    if (answer.error) return answer;
    var {token} = answer,
        {roles, createdAt, email} = jwtTokenDecode(token);
    Object.assign(this, {roles, createdAt, email, token});
    return {status: answer.status};
  }

  login(password) {
    return this.loginOrRegister("login", password, this.url);
  }

  register(password) {
    return this.loginOrRegister("register", password, this.url);
  }

  toString() { return `<User ${this.name} logged in: ${this.isLoggedIn()}>`; }
}


class GuestUser extends User {

  get isGuestUser() { return true; }

  isLoggedIn() { return false; }

  async loginOrRegister(action, password, authServerURL) {
    throw new Error("Guest user cannot " + action + "!");
  }

  toString() { return `<GuestUser ${this.name}>`; }
}


var guestUser = guestUser || new GuestUser("guest");
var userMap = userMap || new Map();
