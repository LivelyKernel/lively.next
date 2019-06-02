import { resource } from "../index.js";
import { parseQuery, withRelativePartsResolved, relativePathBetween, join } from "./helpers.js";

const slashEndRe = /\/+$/,
      slashStartRe = /^\/+/,
      protocolRe = /^[a-z0-9-_\.]+:/,
      slashslashRe = /^\/\/[^\/]+/;

function nyi(obj, name) {
  throw new Error(`${name} for ${obj.constructor.name} not yet implemented`);
}

export default class Resource {

  static fromProps(props = {}) {
    // props can have the keys contentType, type, size, etag, created, lastModified, url
    // it should have at least url
    return new this(props.url).assignProperties(props);
  }

  constructor(url, opts = {}) {
    if (!url) throw new Error("Cannot create resource without url");
    this.url = String(url);
    this.binary = false;
    this.lastModified = undefined;
    this.created = undefined;
    this.etag = undefined;
    this.size = undefined;
    this.type = undefined;
    this.contentType = undefined;
    this.user = undefined;
    this.group = undefined;
    this.mode = undefined;
    this._isDirectory = undefined;
    this._isLink = undefined;
    this.linkCount = undefined;
  }

  get isResource() { return true; }

  get canDealWithJSON() { return false; }

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

  newResource(url) { return resource(url); }

  path() {
    var path = this.url
      .replace(protocolRe, "")
      .replace(slashslashRe, "");
    return path === "" ? "/" : path;
  }

  pathWithoutQuery() { return this.path().split("?")[0]; }

  name() {
    let path = this.path(),
        queryIndex = path.lastIndexOf("?");
    if (queryIndex > -1) path = path.slice(0, queryIndex);
    if (path.endsWith("/")) path = path.slice(0, -1);
    let parts = path.split("/"),
        lastPart = parts[parts.length-1];
    return decodeURIComponent(lastPart);
  }

  ext() {
    let url = this.url;
    if (url.endsWith("/")) return "";
    let [_, ext] = url.match(/\.([^\/\.]+$)/) || ["", ""];
    return ext.toLowerCase();
  }

  nameWithoutExt() {
    let name = this.name(),
        extIndex = name.lastIndexOf(".");
    if (extIndex > 0) name = name.slice(0, extIndex);
    return name;
  }

  scheme() { return this.url.split(":")[0]; }

  host() {
    var idx = this.url.indexOf("://");
    if (idx === -1) return null;
    var noScheme = this.url.slice(idx+3),
        slashIdx = noScheme.indexOf("/");
    return noScheme.slice(0, slashIdx > -1 ? slashIdx : noScheme.length);
  }

  schemeAndHost() {
    if (this.isRoot()) return this.asFile().url;
    return this.url.slice(0, this.url.length - this.path().length);
  }

  parent() {
    return this.isRoot() ? null :
      this.newResource(this.url.replace(slashEndRe, "").split("/").slice(0, -1).join("/") + "/");
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

  query() { return parseQuery(this.url); }

  withQuery(queryObj) {
    let query = {...this.query(), ...queryObj},
        [url] = this.url.split("?"),
        queryString = Object.keys(query)
          .map(key => `${key}=${encodeURIComponent(String(query[key]))}`)
          .join("&");
    return this.newResource(`${url}?${queryString}`);
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

  withRelativePartsResolved() {
    let path = this.path(), result = withRelativePartsResolved(path);
    if (result === path) return this;
    if (result.startsWith("/")) result = result.slice(1);
    return this.newResource(this.root().url + result);
  }

  relativePathFrom(fromResource) {
    return relativePathBetween(fromResource.url, this.url);
  }

  withPath(path) {
    var root = this.isRoot() ? this : this.root();
    return root.join(path);
  }

  join(path) {
    return this.newResource(this.url.replace(slashEndRe, "") + "/" + path.replace(slashStartRe, ""));
  }

  isRoot() { return this.path() === "/" }

  isFile() { return !this.isRoot() && !this.url.match(slashEndRe); }

  isDirectory() { return !this.isFile(); }

  asDirectory() {
    if (this.url.endsWith("/")) return this;
    return this.newResource(this.url.replace(slashEndRe, "") + "/");
  }

  root() {
    if (this.isRoot()) return this;
    var toplevel = this.url.slice(0, -this.path().length);
    return this.newResource(toplevel + "/");
  }

  asFile() {
    if (!this.url.endsWith("/")) return this;
    return this.newResource(this.url.replace(slashEndRe, ""));
  }

  assignProperties(props) {
    // lastModified, etag, ...
    for (var name in props) {
      if (name === "url") continue;
      // rename some properties to not create conflicts
      var myPropName = name;
      if (name === "isLink" || name === "isDirectory")
        myPropName = "_" + name;
      this[myPropName] = props[name]
    }
    return this;
  }

  async ensureExistance(optionalContent) {
    if (await this.exists()) return this;
    await this.parent().ensureExistance();
    if (this.isFile()) await this.write(optionalContent || "");
    else await this.mkdir();
    return this;
  }

  async copyTo(otherResource, ensureParent = true) {
    if (this.isFile()) {
      var toFile = otherResource.isFile() ? otherResource : otherResource.join(this.name());
      if (ensureParent)
        await toFile.parent().ensureExistance();
      await toFile.write(await this.read());

    } else {
      if (!otherResource.isDirectory()) throw new Error(`Cannot copy a directory to a file!`);
      var fromResources = await this.dirList('infinity'),
          toResources = fromResources.map(ea => otherResource.join(ea.relativePathFrom(this)));

      // First create directory structure, this needs to happen in order
      await otherResource.ensureExistance();
      await fromResources.reduceRight((next, ea, i) =>
        () => Promise.resolve(
                ea.isDirectory() && toResources[i].ensureExistance()).then(next),
        () => Promise.resolve())();
  
      // copy individual files, this can happen in parallel but certain protocols
      // might not be able to handle a large amount of parallel writes so we
      // synchronize this as well by default
      await fromResources.reduceRight((next, ea, i) =>
        () => Promise.resolve(
                ea.isFile() && ea.copyTo(toResources[i], false)).then(next),
        () => Promise.resolve())();
    }

    return this;
  }

  async rename(otherResource) {
    await this.copyTo(otherResource);
    this.remove();
    return otherResource;
  }

  beBinary(bool) { return this.setBinary(true); };

  setBinary(bool) {
    this.binary = bool;
    return this;
  }
  
  async read()               { nyi(this, "read"); }
  async write()              { nyi(this, "write"); }
  async mkdir()              { nyi(this, "mkdir"); }
  async exists()             { nyi(this, "exists"); }
  async remove()             { nyi(this, "remove"); }
  async dirList(depth, opts) { nyi(this, "dirList"); }
  async readProperties(opts) { nyi(this, "readProperties"); }

  writeJson(obj, pretty = false) {
    return this.write(pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj));
  }

  async readJson(obj) { return JSON.parse(await this.read()); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // serialization
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  __serialize__() {
    return {__expr__: `var r = null; try { r = resource("${this.url}");} catch (err) {}; r`, bindings: {"lively.resources": ["resource"]}}
  }

}
