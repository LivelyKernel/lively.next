import Resource from "lively.resources/src/resource.js";
import { runCommand } from "./client-command.js";
import { fileInfo, findFiles } from "./client-fs-helper.js";
import { string, promise, arr, obj } from "lively.lang";

export default class ShellClientResource extends Resource {

  static get defaultL2lClient() { return this._defaultL2lClient; }
  static set defaultL2lClient(l2lClient) { this._defaultL2lClient = l2lClient; }

  constructor(url, l2lClient = this.constructor.defaultL2lClient, options = {}) {
    super(url);
    this.options = {...options, l2lClient};  // passed to commands
  }

  read() {
    var cmd = runCommand(`cat "${this.url}"`, this.options);
    return cmd.whenDone().then(() => {
      if (cmd.exitCode) throw new Error(`Read ${this.url} failed: ${cmd.stderr}`);
      return cmd.output
    });
  }

  write(content) {
    content = content || '';
    var cmd = runCommand(`tee "${this.url}"`, {stdin: content, ...this.options});
    return cmd.whenDone().then(() => {
      if (cmd.exitCode) throw new Error(`Write ${this.url} failed: ${cmd.stderr}`);
      return this;
    });
  }

  exists() {
    var cmd = runCommand(`test -d "${this.url}" || test -f "${this.url}"`, this.options);
    return cmd.whenDone().then(() => cmd.exitCode === 0);
  }

  exists() {
    var cmd = runCommand(`test -d "${this.url}" || test -f "${this.url}"`, this.options);
    return cmd.whenDone().then(() => cmd.exitCode === 0);
  }

  remove() {
    var cmd = runCommand(`rm -rf "${this.url}"`, this.options);
    return cmd.whenDone().then(() => {
      if (cmd.exitCode) throw new Error(`Remove of ${this.url} failed: ${cmd.stderr}`);
      return this;
    });
  }

  async readProperties() {
    var info = await fileInfo(this.url, this.options);
    this.assignProperties(obj.dissoc(info, ["fileName", "path", "rootDirectory"]));
    return this;
  }

  async dirList(depth = 1, opts = {}) {
    var {exclude} = opts;

    if (Array.isArray(exclude))
      exclude = ("-iname " + exclude.map(string.print).join(' -o -iname '));

    var {url, options: {l2lClient}} = this,
        fileInfos = await findFiles("*", {exclude, depth, rootDirectory: url, l2lClient});

    // remove self
    if (fileInfos[0].path.replace(/\/$/, "") === this.url.replace(/\/$/, ""))
      fileInfos.shift();

    return fileInfos.map(info => {
      var {path, isDirectory} = info;
      if (isDirectory) path = path.replace(/\/?$/, "/");
      var res = new this.constructor(path, l2lClient, this.options);
      res.assignProperties(obj.dissoc(info, ["fileName", "path", "rootDirectory"]))
      return res;
    });
      
  }

}

export var resourceExtension = {
  name: "shell-client",
  matches: (url) => url.startsWith("/") || url.match(/[a-z]:\\/i), // abs path
  resourceClass: ShellClientResource
}
