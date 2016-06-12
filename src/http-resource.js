/*global fetch*/

import { Resource } from "./resource.js";

export class WebDAVResource extends Resource {

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
