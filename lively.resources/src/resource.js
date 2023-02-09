import { resource, parseQuery, withRelativePartsResolved, relativePathBetween, windowsPathPrefixRe, stringifyQuery } from './helpers.js';
import { ensureFolder } from 'lively.lang/string.js';
import { notYetImplemented } from 'lively.lang/function.js';

const slashEndRe = /\/+$/;
const slashStartRe = /^\/+/;
const protocolRe = /^[a-z0-9-_\.]+:/;
const slashslashRe = /^\/\/[^\/]+/;

function nyi (obj, name) {
  notYetImplemented(`${name} for ${obj.constructor.name} not yet implemented`);
}

export default class Resource {
  static fromProps (props = {}) {
    // props can have the keys contentType, type, size, etag, created, lastModified, url
    // it should have at least url
    return new this(props.url).assignProperties(props);
  }

  constructor (url, opts = {}) {
    if (!url) throw new Error('Cannot create resource without url');
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

  get isResource () { return true; }

  get canDealWithJSON () { return false; }

  equals (otherResource) {
    if (!otherResource || this.constructor !== otherResource.constructor) { return false; }
    let myURL = this.url; let otherURL = otherResource.url;
    if (myURL[myURL.length - 1] === '/') myURL = myURL.slice(0, -1);
    if (otherURL[otherURL.length - 1] === '/') otherURL = otherURL.slice(0, -1);
    return myURL === otherURL;
  }

  toString () {
    return `${this.constructor.name}("${this.url}")`;
  }

  newResource (url) { return resource(url, this); }

  path () {
    const path = this.url
      .replace(protocolRe, '')
      .replace(slashslashRe, '');
    return path === '' ? '/' : path;
  }

  pathWithoutQuery () { return this.path().split('?')[0]; }

  name () {
    let path = this.path();
    const queryIndex = path.lastIndexOf('?');
    if (queryIndex > -1) path = path.slice(0, queryIndex);
    if (path.endsWith('/')) path = path.slice(0, -1);
    const parts = path.split('/');
    const lastPart = parts[parts.length - 1];
    return decodeURIComponent(lastPart);
  }

  ext () {
    const url = this.url;
    if (url.endsWith('/')) return '';
    const [_, ext] = url.match(/\.([^\/\.]+$)/) || ['', ''];
    return ext.toLowerCase();
  }

  nameWithoutExt () {
    let name = this.name();
    const extIndex = name.lastIndexOf('.');
    if (extIndex > 0) name = name.slice(0, extIndex);
    return name;
  }

  scheme () { return this.url.split(':')[0]; }

  host () {
    const idx = this.url.indexOf('://');
    if (idx === -1) return null;
    const noScheme = this.url.slice(idx + 3);
    const slashIdx = noScheme.indexOf('/');
    return noScheme.slice(0, slashIdx > -1 ? slashIdx : noScheme.length);
  }

  schemeAndHost () {
    if (this.isRoot()) return this.asFile().url;
    return this.url.slice(0, this.url.length - this.path().length);
  }

  parent () {
    // drops the query
    return this.isRoot()
      ? null
      : this.newResource(this.url.split('?')[0].replace(slashEndRe, '').split('/').slice(0, -1).join('/') + '/');
  }

  parents () {
    const result = []; let p = this.parent();
    while (p) { result.unshift(p); p = p.parent(); }
    return result;
  }

  isParentOf (otherRes) {
    return otherRes.schemeAndHost() === this.schemeAndHost() &&
        otherRes.parents().some(p => p.equals(this));
  }

  query () { return parseQuery(this.url); }

  withQuery (queryObj) {
    const query = { ...this.query(), ...queryObj };
    const [url] = this.url.split('?');
    const queryString = stringifyQuery(query);
    return this.newResource(`${url}?${queryString}`);
  }

  commonDirectory (other) {
    if (other.schemeAndHost() !== this.schemeAndHost()) return null;
    if (this.isDirectory() && this.equals(other)) return this;
    if (this.isRoot()) return this.asDirectory();
    if (other.isRoot()) return other.asDirectory();
    const otherParents = other.parents();
    const myParents = this.parents();
    let common = this.root();
    for (let i = 0; i < myParents.length; i++) {
      const myP = myParents[i]; const otherP = otherParents[i];
      if (!otherP || !myP.equals(otherP)) return common;
      common = myP;
    }
    return common;
  }

  withRelativePartsResolved () {
    const path = this.path(); let result = withRelativePartsResolved(path);
    if (result === path) return this;
    if (result.startsWith('/')) result = result.slice(1);
    if (result[1] === ':'.startsWith('/')) result = result.slice(1);
    else if (result[1] === ':' && result.match(windowsPathPrefixRe)) result = result.slice(3);
    return this.newResource(this.root().url + result);
  }

  relativePathFrom (fromResource) {
    return relativePathBetween(fromResource.url, this.url);
  }

  withPath (path) {
    const root = this.isRoot() ? this : this.root();
    return root.join(path);
  }

  join (path) {
    return this.newResource(this.url.replace(slashEndRe, '') + '/' + path.replace(slashStartRe, ''));
  }

  isRoot () { return this.path() === '/'; }

  isFile () { return !this.isRoot() && !this.url.match(slashEndRe); }

  isDirectory () { return !this.isFile(); }

  asDirectory () {
    if (this.url.endsWith('/')) return this;
    return this.newResource(ensureFolder(this.url));
  }

  root () {
    if (this.isRoot()) return this;
    const toplevel = this.url.slice(0, -this.path().length);
    return this.newResource(toplevel + '/');
  }

  asFile () {
    if (!this.url.endsWith('/')) return this;
    return this.newResource(this.url.replace(slashEndRe, ''));
  }

  assignProperties (props) {
    // lastModified, etag, ...
    for (const name in props) {
      if (name === 'url') continue;
      // rename some properties to not create conflicts
      let myPropName = name;
      if (name === 'isLink' || name === 'isDirectory') { myPropName = '_' + name; }
      this[myPropName] = props[name];
    }
    return this;
  }

  async ensureExistance (optionalContent) {
    if (await this.exists()) return this;
    await this.parent().ensureExistance();
    if (this.isFile()) await this.write(optionalContent || '');
    else await this.mkdir();
    return this;
  }

  async copyTo (otherResource, ensureParent = true) {
    if (this.isFile()) {
      const toFile = otherResource.isFile() ? otherResource : otherResource.join(this.name());
      if (ensureParent) { await toFile.parent().ensureExistance(); }
      await toFile.write(await this.read());
    } else {
      if (!otherResource.isDirectory()) throw new Error('Cannot copy a directory to a file!');
      const fromResources = await this.dirList('infinity');
      const toResources = fromResources.map(ea => otherResource.join(ea.relativePathFrom(this)));

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

  async rename (otherResource) {
    await this.copyTo(otherResource);
    this.remove();
    return otherResource;
  }

  beBinary (bool) { return this.setBinary(true); }

  setBinary (bool) {
    this.binary = bool;
    return this;
  }

  async read () { nyi(this, 'read'); }
  async write () { nyi(this, 'write'); }
  async mkdir () { nyi(this, 'mkdir'); }
  async exists () { nyi(this, 'exists'); }
  async remove () { nyi(this, 'remove'); }
  async dirList (depth, opts) { nyi(this, 'dirList'); }
  async readProperties (opts) { nyi(this, 'readProperties'); }

  writeJson (obj, pretty = false) {
    return this.write(pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj));
  }

  async readJson (obj) { return JSON.parse(await this.read()); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // serialization
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  __serialize__ () {
    return { __expr__: `var r = null; try { r = resource("${this.url}");} catch (err) {}; r`, bindings: { 'lively.resources': ['resource'] } };
  }
}
