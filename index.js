/*global System, fetch*/

const slashEndRe = /\/+$/,
      slashStartRe = /^\/+/,
      protocolRe = /^[a-z0-9-_]+:/,
      slashslashRe = /^\/\/[^\/]+/;

class XResource {

  constructor(url) {
    this.isResource = true;
    this.url = String(url);
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

  async read() { throw new Error(`read for ${this.constructor.name} not yet implemented`); }
  async write() { throw new Error(`write for ${this.constructor.name} not yet implemented`); }
  async exists() { throw new Error(`exists for ${this.constructor.name} not yet implemented`); }
  async remove() { throw new Error(`remove for ${this.constructor.name} not yet implemented`); }
}

class XHTTPResource extends XResource {

  async read() {
    return (await fetch(this.url)).text();
  }

  async write(content) {
    if (!this.isFile()) throw new Error(`Cannot write a non-file: ${this.url}`);
    await fetch(this.url, {method: "PUT", body: content});
    return this;
  }

  async mkdir(content) {
    if (this.isFile()) throw new Error(`Cannot mkdir on a file: ${this.url}`);
    await fetch(this.url, {method: "MKCOL"});
    return this;
  }

  async exists() {
    return this.isRoot() ? true : !!(await fetch(this.url, {method: "HEAD"})).ok;
  }

  async remove() {
    await fetch(this.url, {method: "DELETE"})
    return this;
  }

}


var isNode = System.get("@system-env").node;

import { readFile, writeFile, exists, mkdir, rmdir, unlink, readdir, lstat } from "fs";

function wrapInPromise(func) {
  return (...args) => 
    new Promise((resolve, reject) =>
      func.apply(System.global, args.concat((err, result) => err ? reject(err) : resolve(result))))
}

function ensureString(promisedVal) {
  return Promise.resolve(promisedVal).then(String);
}

const readFileP = wrapInPromise(readFile),
      writeFileP = wrapInPromise(writeFile),
      existsP = (path) => new Promise((resolve, reject) => exists(path, (exists) => resolve(!!exists))),
      readdirP = wrapInPromise(readdir),
      mkdirP = wrapInPromise(mkdir),
      rmdirP = wrapInPromise(rmdir),
      unlinkP = wrapInPromise(unlink),
      lstatP = wrapInPromise(lstat);

class NodeJSFileResource extends XResource {

  async stat() {
    return lstatP(this.path());
  }

  async read() {
    return readFileP(this.path()).then(String);
  }

  async write(content) {
    if (this.isDirectory()) throw new Error(`Cannot write into a directory: ${this.path()}`);
    await writeFileP(this.path(), content);
    return this;
  }

  async mkdir(content) {
    if (this.isFile()) throw new Error(`Cannot mkdir on a file: ${this.path()}`);
    await mkdirP(this.path());
    return this;
  }

  async exists() {
    return this.isRoot() ? true : existsP(this.path());
  }

  async dirList() {
    if (!this.isDirectory())
      throw new Error(`dirList called on non-directory: ${this.path()}`)
    var subResources = [];
    for (let name of await readdirP(this.path())) {
      var subResource = this.join(name);
      subResources.push(
        (await subResource.stat()).isDirectory() ?
          subResource.asDirectory() : subResource);
    }
    return subResources;
  }

  async isEmptyDirectory() {
    return (await this.dirList()).length === 0;
  }

  async remove() {
    if (!(await this.exists())) {
      /*...*/
    } else if (this.isDirectory()) {
      for (let subResource of await this.dirList())
        await subResource.remove();
      await rmdirP(this.path());
    } else {
      await unlinkP(this.path());
    }
    return this;
  }

}

// resource("/foo/bar").path()
// resource("/foo/bar/").isDirectory()

export function resource(url) {
  if (!url) throw new Error("lively.resource resource constructor: expects url but got " + url);
  if (url.isResource) return url;
  if (url.match(/^http/i)) return new XHTTPResource(url);
  if (url.match(/^file/i) && isNode) return new NodeJSFileResource(url);
  throw new Error(`Cannot find resource type for url ${url}`);
}


export async function createFiles(baseDir, fileSpec) {
  var base = resource(baseDir).asDirectory();
  await base.ensureExistance();
  for (var name in fileSpec) {
    if (!fileSpec.hasOwnProperty(name)) continue;
    let resource = base.join(name)
    if (typeof fileSpec[name] === "object") {
      await createFiles(resource, fileSpec[name])
    } else {
      await resource.write(fileSpec[name]);
    }
  }
  return base;
}

// function resourceDirToResourceExists(url) {
//   return new Promise((resolve, reject) => {
//     url = new URL(url);

//     if (url.protocol === "file:") {
//       var file = url.toString().replace("file:", ""),
//           path = file.replace(/[^\/]*$/, "");
//       lively.shell.run("mkdir -p " + path, (err, cmd) => err ? reject(err) : resolve());

//     } else if (url.protocol.match(/https?:/)) {
//       url.asWebResource().beAsync()
//         .ensureExistance(err => err ? reject(err) : resolve());

//     } else if (url.protocol === "l2l:") {
//       lively.l2lModules.fsRequest(url, "mkdir").then(resolve, reject);

//     } else {
//       reject(new Error("Cannot write resource: " + url));
//     }

//   })

// }

// function resourceMkdir(url) {
//     url.pathname.split('/');
//     return new Promise((resolve, reject) => {
//         url = new Global.URL(String(url).replace(/([^\/])$/, '$1/'));
//         if (url.protocol === 'file:') {
//             lively.shell.run('mkdir -p ' + String(url).replace('file:', ''), (err, cmd) => err ? reject(err) : resolve());
//         } else if (url.protocol.match(/https?:/)) {
//             Promise.all([url.getAllParentDirectories().map((url) => url.asWebResource().exists() ? Promise.resolve() : new Promise((resolve, reject) => url.asWebResource().beAsync().create().whenDone((_, status) => status.isSuccess() ? resolve() : reject(status))))]).then(resolve, reject);
//         } else if (url.protocol === 'l2l:') {
//             lively.l2lModules.fsRequest(url, 'mkdir').then(resolve, reject);
//         } else
//             reject('Unsupport address for new mkdir: ' + url);
//     });
// }

// function resourceRead(url, options) {

//   options = lively.lang.obj.merge({}, options)

//   return new Promise((resolve, reject) => {
//     url = new URL(url);

//     if (url.protocol === "file:") {
//       var file = url.toString().replace("file:", "");
//       lively.shell.cat(file, (err, source) =>
//         err ? reject(err) : resolve(source))

//     } else if (url.protocol.match(/https?:/)) {
//         url.asWebResource().beAsync().get()
//           .whenDone((content, status) => status.isSuccess() ?
//             resolve(content) : reject(new Error(String(status))));
//     } else if (url.protocol === "l2l:") {
//       lively.l2lModules.fsRequest(url, "read").then(resolve, reject);

//     } else reject(new Error("Cannot read resource: " + url));

//   })


// /*

// export { read }

// async function read(url, options) {

//   options = Object.assign({}, options)

//   url = new URL(url);

//   if (url.protocol === "file:") {
//     var file = url.toString().replace("file:", "");
//     return new Promise((resolve, reject) =>
//       lively.shell.cat(file, (err, source) =>
//         err ? reject(err) : resolve(source)))

//   } else if (url.protocol.match(/https?:/)) {
//     await (await window.fetch(url)).text()
//     window.fetch(url)
//     var res = await window.fetch(url);
//     if (res.status >= 400)
//       throw new Error(`Failure retrieving ${url}, status ${res.statusText} (${res.status})\n${await res.text()}`)
//     else
//       return res.text();

//   } else if (url.protocol === "l2l:") {
//     new Promise((resolve, reject) =>
//       lively.l2lModules.fsRequest(url, "read").then(resolve, reject))

//   } else throw new Error("Cannot read resource: " + url);

// }

// */

// }

// function resourceRemoveDirectory(url) {
//   return new Promise((resolve, reject) => {

//     url = new URL(url);

//     if (url.protocol === "file:") {
//       lively.shell.rm(url.toString().replace("file:", ""),
//         (err, cmd) => err ? reject(err) : resolve());

//     } else if (url.protocol.match(/https?:/)) {
//       url.asWebResource().beAsync().del()
//         .whenDone((_, status) => {
//           if (status.isSuccess()) resolve();
//           else reject(new Error(status));
//         });

//     } else if (url.protocol === "l2l:") {
//       lively.l2lModules.fsRequest(url, "rm").then(resolve, reject);

//     } else reject("Cannot remove, unsupport protocol of file: " + url);
//   })
// }

// function resourceRemoveFile(url) {
//   return new Promise((resolve, reject) => {

//     url = new URL(url);

//     if (url.protocol === "file:") {
//       lively.shell.rm(url.toString().replace("file:", ""),
//         (err, cmd) => err ? reject(err) : resolve());

//     } else if (url.protocol.match(/https?:/)) {
//       url.asWebResource().beAsync().del()
//         .whenDone((_, status) => {
//           if (status.isSuccess()) resolve();
//           else reject(new Error(status));
//         });

//     } else if (url.protocol === "l2l:") {
//       lively.l2lModules.fsRequest(url, "rm").then(resolve, reject);

//     } else reject("Cannot remove, unsupport protocol of file: " + url);
//   })
// }

// function resourceWrite(url, content, options) {
//   options = lively.lang.obj.merge({overwrite: true}, options)

//   return new Promise((resolve, reject) => {
//     url = new URL(url);

//     if (url.protocol === "file:") {
//       var file = url.toString().replace("file:", "");

//       (options.overwrite ?
//         Promise.resolve() :
//         new Promise((resolve, reject) => {
//           lively.shell.run("test -f " + file, (err, cmd) => { resolve(cmd.getCode() === 0) })
//         }))
//         .then(exists => {
//           if (!options.overwrite && exists) return resolve()
//           lively.shell.writeFile(file, content,
//             (err, cmd) => err ? reject(err) : resolve())
//         })

//     } else if (url.protocol.match(/https?:/)) {
//       if (!options.overwrite && url.asWebResource().exists())
//         resolve();
//       else
//         url.asWebResource().beAsync().put(content)
//           .whenDone((_, status) => status.isSuccess() ?
//             resolve() : reject(new Error(String(status))));

//     } else if (url.protocol === "l2l:") {
//       lively.l2lModules.fsRequest(url, "write", {content: content}).then(resolve, reject);

//     } else reject(new Error("Cannot write resource: " + url));

//   })

// }