import { resource } from 'lively.resources';
/* global fetch */

function jwtTokenDecode (token) {
  const [a, b, c] = token.split('.');
  return JSON.parse(atob(b));
}

function guid () {
  const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function makeRequest (url, method = 'GET', body, headers = {}) {
  const useCors = true; const fetchOpts = { method };
  if (useCors) fetchOpts.mode = 'cors';
  if (body) fetchOpts.body = body;
  fetchOpts.redirect = 'follow';
  fetchOpts.headers = { ...headers };
  return fetch(url, fetchOpts);
}

async function POST (url, body) {
  if (typeof body !== 'string') body = JSON.stringify(body);
  const res = await makeRequest(url, 'POST', body, {});
  let text; let json;
  try { text = await res.text(); } catch (err) {}
  if (text && res.headers.get('content-type') === 'application/json') {
    try { json = JSON.parse(text); } catch (err) {}
  }
  if (!json) throw new Error('Unexpected response: ' + text);
  return json;
}

export class User {
  static get guest () { return guestUser; }

  static named (name, url) {
    const key = name + '-' + url;
    let user = userMap.get(key);
    if (!user) {
      user = new this(name, url);
      userMap.set(key, user);
    }
    return user;
  }

  static fromToken (token, url) {
    const { name, roles, createdAt, email } = jwtTokenDecode(token);
    return Object.assign(this.named(name, url), { roles, createdAt, email, token });
  }

  static clearCache () {
    userMap = new Map();
  }

  constructor (name, url) {
    this.realm = url;
    this.name = name;
    this.roles = {};
    this.createdAt = 0;
    this.email = null;
    this.token = null;
  }

  isLoggedIn () { return !!this.token; }

  async loginOrRegister (action, password, authServerURL) {
    var { email, createdAt, roles, name } = this;
    const payload = action === 'register'
      ? { password, email, createdAt, roles, name }
      : { password, name };
    const answer = await POST(authServerURL + '/' + action, payload);
    if (answer.error) return answer;
    const { token } = answer;
    var { roles, createdAt, email } = jwtTokenDecode(token);
    Object.assign(this, { roles, createdAt, email, token });
    return { status: answer.status };
  }

  async verify () {
    // note: services should not trust if this verify method returns true, they
    // should check against the user token against the authServerURL/verify
    const { error, status } = await POST(this.realm + '/verify', { token: this.token });
    return !error;
  }

  login (password) {
    return this.loginOrRegister('login', password, this.realm);
  }

  register (password) {
    return this.loginOrRegister('register', password, this.realm);
  }

  async checkPassword (password) {
    if (!this.isLoggedIn) { throw new Error('To check password, user needs to login.'); }
    const { error, status } = await POST(this.realm + '/check-password', { token: this.token, password });
    if (error) throw new Error(error);
    return status;
  }

  async modify (changes) {
    const { error, status, token } = await POST(this.realm + '/modify', { token: this.token, changes });
    if (error) return { error };
    if (token) {
      const { name, roles, createdAt, email } = jwtTokenDecode(token);
      Object.assign(this, { roles, createdAt, email, token });
    }

    return { status };
  }

  getDir () {
    return resource(System.baseURL).join('users').join(this.name);
  }

  toString () { return `<${this.constructor.name} ${this.name} ${this.isLoggedIn() ? '' : 'not '}logged in>`; }
}

export class GuestUser extends User {
  get isGuestUser () { return true; }

  isLoggedIn () { return false; }

  async loginOrRegister (action, password, authServerURL) {
    throw new Error('Guest user cannot ' + action + '!');
  }
}

var userMap = userMap || new Map();
var guestUser = guestUser || GuestUser.named('guest-' + guid(), null);
