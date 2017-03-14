import { resource } from "../index.js";

const slashEndRe = /\/+$/,
      slashStartRe = /^\/+/,
      protocolRe = /^[a-z0-9-_]+:/,
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

  name() {
    return this.path().replace(/\/$/, "").split("/").slice(-1)[0];
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
    if (this.isRoot()) return null;
    return this.newResource(this.url.replace(slashEndRe, "").split("/").slice(0,-1).join("/") + "/");
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

  withRelativePartsResolved() {
    let path = this.path(),
        result = path;
    // /foo/../bar --> /bar
    do {
      path = result;
      result = path.replace(/\/[^\/]+\/\.\./, '');
    } while (result != path);

    // foo//bar --> foo/bar
    result = result.replace(/(^|[^:])[\/]+/g, '$1/');
    // foo/./bar --> foo/bar
    result = result.replace(/\/\.\//g, '/');
    if (result === this.path()) return this;
    if (result.startsWith("/")) result = result.slice(1);
    return this.newResource(this.root().url + result);
  }

  relativePathFrom(fromResource) {
    if (fromResource.root().url != this.root().url)
        throw new Error('hostname differs in relativePathFrom ' + fromResource + ' vs ' + this);

    var myPath = this.withRelativePartsResolved().path(),
        otherPath = fromResource.withRelativePartsResolved().path();
    if (myPath == otherPath) return '';
    var relPath = checkPathes(myPath, otherPath);
    if (!relPath)
        throw new Error('pathname differs in relativePathFrom ' + fromResource + ' vs ' + this);
    return relPath;

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    function checkPathes(path1, path2) {
      var paths1 = path1.split('/'),
          paths2 = path2.split('/');
      paths1.shift();
      paths2.shift();
      for (var i = 0; i < paths2.length; i++)
          if (!paths1[i] || (paths1[i] != paths2[i])) break;
      // now that's some JavaScript FOO
      var result = '../'.repeat(Math.max(0, paths2.length - i - 1))
                 + paths1.splice(i, paths1.length).join('/');
      return result;
    }
  }

  join(path) {
    return this.newResource(this.url.replace(slashEndRe, "") + "/" + path.replace(slashStartRe, ""));
  }

  withPath(path) {
    var root = this.isRoot() ? this : this.root();
    return root.join(path)
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

  async copyTo(otherResource) {
    if (this.isFile()) {
      var toFile = otherResource.isFile() ? otherResource : otherResource.join(this.name());
      await toFile.write(await this.read());
    } else {
      if (!otherResource.isDirectory()) throw new Error(`Cannot copy a directory to a file!`);
      var fromResources = await this.dirList('infinity'),
          toResources = fromResources.map(ea => otherResource.join(ea.relativePathFrom(this)));

      // First create directory structure, this needs to happen in order
      await otherResource.ensureExistance();
      await fromResources.reduceRight((next, ea, i) =>
        () => Promise.resolve(
                ea.isDirectory() && toResources[i].ensureExistance() ).then(next),
        () => Promise.resolve())();
  
      // copy individual files, this can happen in parallel but certain protocols
      // might not be able to handle a large amount of parallel writes so we
      // synchronize this as well by default
      await fromResources.reduceRight((next, ea, i) =>
        () => Promise.resolve(
                ea.isFile() && ea.copyTo(toResources[i])).then(next),
        () => Promise.resolve())();

    }

    return this;
  }

  async read()               { nyi(this, "read"); }
  async write()              { nyi(this, "write"); }
  async exists()             { nyi(this, "exists"); }
  async remove()             { nyi(this, "remove"); }
  async dirList(depth, opts) { nyi(this, "dirList"); }
  async readProperties(opts) { nyi(this, "readProperties"); }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // serialization
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  __serialize__() {
    return {__expr__: `resource("${this.url}")`, bindings: {"lively.resources": ["resource"]}}
  }

}
