import Resource from './resource.js';
import { createFiles } from './helpers.js';

const debug = false;
const slashRe = /\//g;

function applyExclude (resource, exclude) {
  if (!exclude) return true;
  if (typeof exclude === 'string') return !resource.url.includes(exclude);
  if (typeof exclude === 'function') return !exclude(resource);
  if (exclude instanceof RegExp) return !exclude.test(resource.url);
  return true;
}

let _hosts;
_hosts = _hosts || {}; // preserve this state among module reloads

export class LocalResourceInMemoryBackend {
  static get hosts () {
    return _hosts;
  }

  static removeHost (name) {
    delete this.hosts[name];
  }

  static ensure (filespec, options = {}) {
    const host = this.named(options.host);
    return Promise.resolve()
      .then(() => filespec ? createFiles(`local://${host.name}`, filespec) : null)
      .then(() => this);
  }

  static named (name) {
    if (!name) name = 'default';
    return this.hosts[name] || (this.hosts[name] = new this(name));
  }

  constructor (name, filespec = {}) {
    if (!name || typeof name !== 'string') { throw new Error('LocalResourceInMemoryBackend needs name!'); }
    this.name = name;
    this._filespec = filespec;
  }

  get filespec () { return this._filespec; }
  set filespec (filespec) { this._filespec = filespec; }

  get (path) { return this._filespec[path]; }
  set (path, spec) { this._filespec[path] = spec; }

  write (path, content) {
    let spec = this._filespec[path];
    if (!spec) spec = this._filespec[path] = { created: new Date() };
    spec.content = content;
    spec.isDirectory = false;
    spec.lastModified = new Date();
  }

  read (path) {
    const spec = this._filespec[path];
    return !spec || !spec.content ? '' : spec.content;
  }

  mkdir (path) {
    let spec = this._filespec[path];
    if (spec && spec.isDirectory) return;
    if (!spec) spec = this._filespec[path] = { created: new Date() };
    if (spec.content) delete spec.content;
    spec.isDirectory = true;
    spec.lastModified = new Date();
  }

  partialFilespec (path = '/', depth = Infinity) {
    const result = {};
    const filespec = this.filespec;
    const paths = Object.keys(filespec);

    for (let i = 0; i < paths.length; i++) {
      const childPath = paths[i];
      if (!childPath.startsWith(path) || path === childPath) continue;
      const trailing = childPath.slice(path.length);
      const childDepth = trailing.includes('/') ? trailing.match(slashRe).length + 1 : 1;
      if (childDepth > depth) continue;
      result[childPath] = filespec[childPath];
    }
    return result;
  }
}

export default class LocalResource extends Resource {
  get localBackend () {
    return LocalResourceInMemoryBackend.named(this.host());
  }

  read () { return Promise.resolve(this.localBackend.read(this.path())); }

  write (content) {
    debug && console.log(`[${this}] write`);
    if (this.isDirectory()) { throw new Error(`Cannot write into a directory! (${this.url})`); }
    const spec = this.localBackend.get(this.path());
    if (spec && spec.isDirectory) { throw new Error(`${this.url} already exists and is a directory (cannot write into it!)`); }
    this.localBackend.write(this.path(), content);
    return Promise.resolve(this);
  }

  mkdir () {
    debug && console.log(`[${this}] mkdir`);
    if (!this.isDirectory()) { throw new Error(`Cannot mkdir a file! (${this.url})`); }
    const spec = this.localBackend.get(this.path());
    if (spec && spec.isDirectory) return Promise.resolve(this);
    if (spec && !spec.isDirectory) { throw new Error(`${this.url} already exists and is a file (cannot mkdir it!)`); }
    this.localBackend.mkdir(this.path());
    return Promise.resolve(this);
  }

  exists () {
    debug && console.log(`[${this}] exists`);
    return Promise.resolve(this.isRoot() || this.path() in this.localBackend.filespec);
  }

  remove () {
    debug && console.log(`[${this}] remove`);
    const thisPath = this.path();
    Object.keys(this.localBackend.filespec).forEach(path =>
      path.startsWith(thisPath) && delete this.localBackend.filespec[path]);
    return Promise.resolve(this);
  }

  readProperties () {
    debug && console.log(`[${this}] readProperties`);
    throw new Error('not yet implemented');
  }

  dirList (depth = 1, opts = {}) {
    debug && console.log(`[${this}] dirList`);
    if (!this.isDirectory()) return this.asDirectory().dirList(depth, opts);

    const { exclude } = opts;
    const prefix = this.path();
    const children = [];
    const paths = Object.keys(this.localBackend.filespec);

    if (depth === 'infinity') depth = Infinity;

    for (let i = 0; i < paths.length; i++) {
      const childPath = paths[i];
      if (!childPath.startsWith(prefix) || prefix === childPath) continue;
      const trailing = childPath.slice(prefix.length);
      const childDepth = trailing.includes('/') ? trailing.match(slashRe).length + 1 : 1;
      if (childDepth > depth) {
        // add the dir pointing to child
        const dirToChild = this.join(trailing.split('/').slice(0, depth).join('/') + '/');
        if (!children.some(ea => ea.equals(dirToChild))) children.push(dirToChild);
        continue;
      }
      const child = this.join(trailing);
      if (!exclude || applyExclude(child, exclude)) { children.push(child); }
    }
    return Promise.resolve(children);
  }
}

export var resourceExtension = {
  name: 'local-resource',
  matches: (url) => url.startsWith('local:'),
  resourceClass: LocalResource
};
