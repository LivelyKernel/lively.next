import { resource } from "../index.js";

const slashEndRe = /\/+$/,
      slashStartRe = /^\/+/,
      protocolRe = /^[a-z0-9-_]+:/,
      slashslashRe = /^\/\/[^\/]+/;

function nyi(obj, name) {
  throw new Error(`${name} for ${obj.constructor.name} not yet implemented`);
}

export class Resource {

  static fromProps(props = {}) {
    // props can have the keys contentType, type, size, etag, created, lastModified, url
    // it should have at least url
    return new this(props.url).assignProperties(props);
  }

  constructor(url, opts = {}) {
    if (!url) throw new Error("Cannot create resource without url");
    this.url = String(url);
    this.lastModified = undefined;
    this.created = undefined;
    this.etag = undefined;
    this.size = undefined;
    this.type = undefined;
    this.contentType = undefined;
  }

  get isResource() { return true; }

  equals(otherResource) {
    if (!otherResource || this.constructor !== otherResource.constructor)
      return false;
    var myURL = this.url, otherURL = otherResource.url;
    if (myURL[myURL.length-1] === "/") myURL = myURL.slice(0, -1);
    if (otherURL[otherURL.length-1] === "/") otherURL = otherURL.slice(0, -1);
    return myURL === otherURL;
  }

  toString() {
    return `${this.constructor.name}("${this.url}")`;
  }

  path() {
    var path = this.url
      .replace(protocolRe, "")
      .replace(slashslashRe, "");
    return path === "" ? "/" : path;
  }

  name() {
    return this.path().replace(/\/$/, "").split("/").slice(-1)[0];
  }

  schemeAndHost() {
    if (this.isRoot()) return this.asFile().url;
    return this.url.slice(0, this.url.length - this.path().length);
  }

  parent() {
    if (this.isRoot()) return null;
    return resource(this.url.replace(slashEndRe, "").split("/").slice(0,-1).join("/") + "/");
  }

  parents() {
    var result = [], p = this.parent();
    while (p) { result.unshift(p); p = p.parent(); }
    return result;
  }

  isParentOf(otherRes) {
    return otherRes.schemeAndHost() === this.schemeAndHost()
        && otherRes.parents().some(p => p.equals(this));
  }
  
  commonDirectory(other) {
    if (other.schemeAndHost() !== this.schemeAndHost()) return null;
    if (this.isDirectory() && this.equals(other)) return this;
    if (this.isRoot()) return this.asDirectory();
    if (other.isRoot()) return other.asDirectory();
    var otherParents = other.parents(),
        myParents = this.parents(),
        common = this.root();    
    for (var i = 0; i < myParents.length; i++) {
      var myP = myParents[i], otherP = otherParents[i];
      if (!otherP || !myP.equals(otherP)) return common;
      common = myP;
    }
    return common;
  }

  join(path) {
    return resource(this.url.replace(slashEndRe, "") + "/" + path.replace(slashStartRe, ""));
  }

  isRoot() { return this.path() === "/" }

  isFile() { return !this.isRoot() && !this.url.match(slashEndRe); }

  isDirectory() { return !this.isFile(); }

  asDirectory() {
    if (this.url.endsWith("/")) return this;
    return resource(this.url.replace(slashEndRe, "") + "/");
  }

  root() {
    if (this.isRoot()) return this;
    var toplevel = this.url.slice(0, -this.path().length);
    return resource(toplevel + "/");
  }

  asFile() {
    if (!this.url.endsWith("/")) return this;
    return resource(this.url.replace(slashEndRe, ""));
  }

  assignProperties(props) {
    // lastModified, etag, ...
    for (var name in props)
      if (name !== "url")
        this[name] = props[name]
    return this;
  }

  async ensureExistance(optionalContent) {
    if (await this.exists()) return this;
    await this.parent().ensureExistance();
    if (this.isFile()) await this.write(optionalContent || "");
    else await this.mkdir();
    return this;
  }

  async read()               { nyi(this, "read"); }
  async write()              { nyi(this, "write"); }
  async exists()             { nyi(this, "exists"); }
  async remove()             { nyi(this, "remove"); }
  async dirList(depth, opts) { nyi(this, "dirList"); }
  async readProperties(opts) { nyi(this, "readProperties"); }

}
