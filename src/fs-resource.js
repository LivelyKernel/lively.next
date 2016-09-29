import { Resource } from "./resource.js";
import { applyExclude } from "./helpers.js";

import { readFile, writeFile, exists, mkdir, rmdir, unlink, readdir, lstat } from "fs";

function wrapInPromise(func) {
  return (...args) =>
    new Promise((resolve, reject) =>
      func.apply(null, args.concat((err, result) => err ? reject(err) : resolve(result))))
}

const readFileP = wrapInPromise(readFile),
      writeFileP = wrapInPromise(writeFile),
      existsP = (path) => new Promise((resolve, reject) => exists(path, (exists) => resolve(!!exists))),
      readdirP = wrapInPromise(readdir),
      mkdirP = wrapInPromise(mkdir),
      rmdirP = wrapInPromise(rmdir),
      unlinkP = wrapInPromise(unlink),
      lstatP = wrapInPromise(lstat);

export class NodeJSFileResource extends Resource {

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

  async dirList(depth = 1, opts = {}) {
    if (typeof depth !== "number" && depth !== 'infinity')
      throw new Error(`dirList – invalid depth argument: ${depth}`);

    var {exclude} = opts;

    if (depth <= 0) depth = 1;

    if (depth === 1) {
      let subResources = [];
      for (let name of await readdirP(this.path())) {
        let subResource = this.join(name);
        subResources.push(
          (await subResource.stat()).isDirectory() ?
            subResource.asDirectory() : subResource);
      }
      if (exclude) subResources = applyExclude(exclude, subResources);
      return subResources;
    }

    let subResources = await this.dirList(1, opts),
        subCollections = subResources.filter(ea => ea.isDirectory());
    return Promise.all(subCollections.map(col =>
          col.dirList(typeof depth === "number" ? depth - 1 : depth, opts)))
            .then(recursiveResult =>
              recursiveResult.reduce((all, ea) => all.concat(ea), subResources));

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
