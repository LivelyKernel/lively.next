const slashEndRe = /\/+$/,
      slashStartRe = /^\/+/,
      protocolRe = /^[a-z0-9-_]+:/,
      slashslashRe = /^\/\/[^\/]+/;

import { resource } from "../index.js";

function nyi(obj, name) {
  throw new Error(`${name} for ${obj.constructor.name} not yet implemented`);
}

export class Resource {

  constructor(url) {
    this.isResource = true;
    this.url = String(url);
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

  schemeAndHost() {
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

  join(path) {
    return resource(this.url.replace(slashEndRe, "") + "/" + path.replace(slashStartRe, ""));
  }

  isRoot() { return this.path() === "/" }

  isFile() { return !this.isRoot() && !this.url.match(slashEndRe); }

  isDirectory() { return !this.isFile(); }

  asDirectory() {
    return resource(this.url.replace(slashEndRe, "") + "/");
  }

  root() {
    var toplevel = this.url.slice(0, -this.path().length);
    return resource(toplevel + "/");
  }

  asFile() {
    return resource(this.url.replace(slashEndRe, ""));
  }

  async ensureExistance(optionalContent) {
    if (await this.exists()) return this;
    await this.parent().ensureExistance();
    if (this.isFile()) await this.write(optionalContent || "");
    else await this.mkdir();
    return this;
  }

  async read()         { nyi(this, "read"); }
  async write()        { nyi(this, "write"); }
  async exists()       { nyi(this, "exists"); }
  async remove()       { nyi(this, "remove"); }
  async dirList(depth) { nyi(this, "dirList"); }

}
