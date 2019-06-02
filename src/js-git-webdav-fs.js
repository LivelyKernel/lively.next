/*global fetch, Uint8Array*/

import { resource } from "lively.resources";
import { show } from "lively.morphic";

function fixPath(path) {
  if (path.startsWith("http:/") && path[6] !== "/") return "http://" + path.slice(6);
  if (path.startsWith("https:/") && path[7] !== "/") return "https://" + path.slice(7);
  return path
}

// Adapter to let js-git's fs-db talk to WebDAV
export default class JsGitWebDAVFs {

  constructor(useCache = true, useLog = false) {
    this.useCache = useCache;    
    this.cachedFiles = {};
    this.cachedDirs = {};

    this.useLog = useLog;
    this.log = []
  }

  logCall() {
    if (!this.useLog) return;
    let entry = Array.from(arguments);
    entry.unshift(new Date());
    this.log.push(entry);
    return entry;
  }

  logResult(entry, result) {
    if (this.useLog) entry.push(result);
    return result;
  }

  async readFile(path, cb) { // => binary | undefined
    // Reads the entirety of the file at the given path and produces the binary. If
    // the file does not exist, readFile provides undefined instead.

    let logged = this.logCall("readFile", path);
    path = fixPath(path);

    if (this.useCache && this.cachedFiles[path]) {
      try {
        return cb(null, this.logResult(logged, this.cachedFiles[path]));
      } catch (err) { return cb(err); }
    }

    let res = await fetch(path);
    if (res.status === 404) return cb();

    if (!res.ok) {
      let err = new Error(res.statusText);
      this.logResult(logged, err)
      return cb(err);
    }

    try {
      let data = new Uint8Array(await res.arrayBuffer());
      if (this.useCache) this.cachedFiles[path] = data;
      this.logResult(logged, data);
      return cb(null, data);
    } catch (err) { return cb(err); }
  }


  async readChunk(path, start, end, cb) { // => binary | undefined
    // Reads a byte range of the file at the given path. The byte range is a half
    // open interval, including the byte at the initial index, and excluding the byte
    // at the terminal index, such that the end minus the start is the length of the
    // resulting binary data. The end offset may be negative, in which case it should
    // count back from the end of the size of the file at the path, such that the size
    // plus the negative end is the positive end. If the file does not exist,
    // readChunk provides undefined instead.

    let logged = this.logCall("readChunk", path, start, end);
    path = fixPath(path);

    let buf;
    if (this.useCache && this.cachedFiles[path]) {
      buf = this.cachedFiles[path];
    } else {
      let res = await fetch(path);
      if (res.status === 404) return cb();
      if (!res.ok) return cb(this.logResult(logged, new Error(res.statusText)));
      buf = await res.arrayBuffer();
      if (this.useCache) this.cachedFiles[path] = buf;
    }

    try {
      if (end < 0) end = buf.byteLength + end;
      return cb(null, this.logResult(logged, new Uint8Array(buf.slice(start, end))));
    } catch (err) { cb(err); }
  }


  async readDir(path, cb) { // => array of names | undefined
    // Reads the names of the entries in the directory at the given path. The names
    // are not fully qualified paths, just the name of the entry within the given
    // directory.
    let logged = this.logCall("readDir", path);
    path = fixPath(path);

    if (this.useCache && this.cachedDirs[path]) {
      return cb(null, this.logResult(logged, this.cachedDirs[path]));
    }

    let r = resource(path)
    try {
      let files = (await r.asDirectory().dirList(1)).map(ea => ea.name());
      if (this.useCache) this.cachedDirs[path] = files;
      cb(null, this.logResult(logged, files));
    } catch (err) {
      return cb(String(err).match(/not found/i) ? undefined : this.logResult(logged, err));
    }
  }

  async writeFile(path, binary, cb) { // => undefined
    // Writes the given bytes to the file at the given path. The method creates any
    // directories leading up to the path if they do not already exist.
    let logged = this.logCall("writeFile", path, binary);
    path = fixPath(path);
    let dir = resource(path).parent();
    if (!await dir.exists()) {
      if (this.useCache) this.cachedDirs = {};
      await dir.ensureExistance();
    }
    if (this.useCache) this.cachedFiles[path] = null;
    let res = await fetch(path, {method: "PUT", body: binary});
    cb(this.logResult(logged, res.ok ? null : new Error(res.statusText)));
  }

  async rename(oldPath, newPath, cb) { // => undefined
    // Renames the given file.
    // Creates all necessary parent directories.
    let logged = this.logCall("rename", oldPath, newPath);
    oldPath = fixPath(oldPath);
    newPath = fixPath(newPath);

    try {
      let res1 = await fetch(oldPath);
      if (res1.status === 404) return cb();
      if (!res1.ok) return cb(this.logResult(logged, new Error(res1.statusText)));
      let body = await res1.arrayBuffer();

      if (this.useCache) {
        this.cachedDirs = {};
        this.cachedFiles[oldPath] = null;
        this.cachedFiles[newPath] = null;
      }

      let res2 = await fetch(newPath, {method: "PUT", body});
      if (res2.status === 404) {
        await resource(newPath).parent().ensureExistance();
        res2 = await fetch(newPath, {method: "PUT", body});
      }

      if (!res2.ok) return cb(this.logResult(logged, new Error(res2.statusText)));

      let res3 = await fetch(oldPath, {method: "DELETE"});
      if (!res3.ok) return cb(this.logResult(logged, new Error(res3.statusText)));
    } catch (err) { return cb(this.logResult(logged, err)); }

    this.logResult(logged, undefined);
    return cb();
  }

}
