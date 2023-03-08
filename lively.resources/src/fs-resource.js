/* global process */
import Resource from './resource.js';
import { applyExclude, windowsURLPrefixRe, windowsRootPathRe } from './helpers.js';

import { createWriteStream, createReadStream, readFile, writeFile, stat, mkdir, rmdir, unlink, readdir, lstat, rename, constants, access } from 'fs';

function exists (path, cb) {
  return access(path, constants.F_OK, (err) => {
    if (err) {
      cb(false)
    } else {
      cb(true)
    }
  });
}

function wrapInPromise (func) {
  return (...args) =>
    new Promise((resolve, reject) =>
      func.apply(null, args.concat((err, result) => err ? reject(err) : resolve(result))));
}

const readFileP = wrapInPromise(readFile);
const writeFileP = wrapInPromise(writeFile);
const existsP = (path) => new Promise((resolve, _reject) =>
  exists(path, (exists) => resolve(!!exists)));
const readdirP = wrapInPromise(readdir);
const mkdirP = wrapInPromise(mkdir);
const rmdirP = wrapInPromise(rmdir);
const unlinkP = wrapInPromise(unlink);
const lstatP = wrapInPromise(lstat);
const renameP = wrapInPromise(rename);

export class NodeJSFileResource extends Resource {
  get isNodeJSFileResource () { return true; }

  path () {
    return this.url.replace('file://', '');
  }

  async stat () {
    return lstatP(this.path());
  }

  async read () {
    const readP = readFileP(this.path());
    return this.binary ? readP : readP.then(String);
  }

  async write (content) {
    if (this.isDirectory()) throw new Error(`Cannot write into a directory: ${this.path()}`);
    await writeFileP(this.path(), content);
    return this;
  }

  async mkdir () {
    if (this.isFile()) throw new Error(`Cannot mkdir on a file: ${this.path()}`);
    await mkdirP(this.path());
    return this;
  }

  async exists () {
    return this.isRoot() ? true : existsP(this.path());
  }

  async dirList (depth = 1, opts = {}) {
    if (typeof depth !== 'number' && depth !== 'infinity') { throw new Error(`dirList – invalid depth argument: ${depth}`); }

    const { exclude } = opts;

    if (depth <= 0) depth = 1;

    if (depth === 1) {
      let subResources = [];
      for (const name of await readdirP(this.path())) {
        let subResource = this.join(name);
        const stat = await subResource.stat();
        subResource = stat.isDirectory() ? subResource.asDirectory() : subResource;
        subResource._assignPropsFromStat(stat);
        subResources.push(subResource);
      }
      if (exclude) subResources = applyExclude(exclude, subResources);
      return subResources;
    }

    const subResources = await this.dirList(1, opts);
    const subCollections = subResources.filter(ea => ea.isDirectory());
    return Promise.all(subCollections.map(col =>
      col.dirList(typeof depth === 'number' ? depth - 1 : depth, opts)))
      .then(recursiveResult =>
        recursiveResult.reduce((all, ea) => all.concat(ea), subResources));
  }

  async isEmptyDirectory () {
    return (await this.dirList()).length === 0;
  }

  async rename (toResource) {
    if (!(toResource instanceof this.constructor)) { return super.rename(toResource); }

    // optimized for file system move
    if (this.isFile()) {
      toResource = toResource.asFile();
      renameP(this.path(), toResource.path());
    } else {
      toResource = toResource.asDirectory();
      await toResource.ensureExistance();
      const files = []; const dirs = [];
      for (const subR of await this.dirList('infinity')) {
        if (subR.isDirectory()) dirs.push(subR);
        else files.push(subR);
      }
      for (const subdir of dirs) { await toResource.join(subdir.relativePathFrom(this)).ensureExistance(); }
      for (const file of files) { await file.rename(toResource.join(file.relativePathFrom(this))); }
      await this.remove();
    }
    return toResource;
  }

  async remove () {
    if (!(await this.exists())) {
      /* ... */
    } else if (this.isDirectory()) {
      for (const subResource of await this.dirList()) { await subResource.remove(); }
      await rmdirP(this.path());
    } else {
      await unlinkP(this.path());
    }
    return this;
  }

  async readProperties () {
    return this._assignPropsFromStat(await this.stat());
  }

  makeProxied () {
    return this;
  }

  async copyTo (otherResource, ensureParent = true) {
    if (this.isFile()) {
      const toFile = otherResource.isFile() ? otherResource : otherResource.join(this.name());
      // optimized copy, using pipes, for HTTP
      if (toFile.isHTTPResource) { return toFile._copyFrom_file_nodejs_fs(this, ensureParent = true); }
    }
    return super.copyTo(otherResource, ensureParent);
  }

  _assignPropsFromStat (stat) {
    return this.assignProperties({
      lastModified: stat.mtime,
      created: stat.ctime,
      size: stat.size,
      type: stat.isDirectory() ? 'directory' : 'file',
      isLink: stat.isSymbolicLink()
    });
  }

  _createWriteStream () { return createWriteStream(this.path()); }
  _createReadStream () { return createReadStream(this.path()); }
}

export class NodeJSWindowsFileResource extends NodeJSFileResource {
  constructor (url, opts) {
    // rkrk 2019-10-31:
    // Windows file uris have three slashes. Since we have used
    // file:// throughout the code base we introduce this as a
    // single point fix for the time being...
    const prefix = url.slice(0, 8);
    if (prefix !== 'file:///' && url.slice(0, 7) === 'file://') {
      url = 'file:///' + url.slice(7);
    }
    if (url.includes('\\')) {
      url = url.replace(/\\/g, '/');
    }
    super(url, opts);
  }

  path () {
    return this.url.replace('file:///', '');
  }

  isRoot () {
    return !!this.path().match(windowsRootPathRe);
  }

  root () {
    if (this.isRoot()) return this;
    console.log(this.url);
    const toplevelMatch = this.url.match(windowsURLPrefixRe);
    if (toplevelMatch) return this.newResource(toplevelMatch[0]);
    throw new Error(
      'Could not determine root path of windows file resource for url ' +
        this.url);
  }
}

export const resourceExtension = {
  name: 'nodejs-file-resource',
  matches: url => url.startsWith('file:'),
  resourceClass: typeof process !== 'undefined' && process.platform === 'win32'
    ? NodeJSWindowsFileResource
    : NodeJSFileResource
};
