import Resource from 'lively.resources/src/resource.js';
import { runCommand } from './client-command.js';
import { fileInfo, findFiles } from './client-fs-helper.js';
import { string, obj } from 'lively.lang';

export default class ShellClientResource extends Resource {
  static get defaultL2lClient () { return this._defaultL2lClient || _defaultL2LClient; } // eslint-disable-line no-use-before-define
  static set defaultL2lClient (l2lClient) { this._defaultL2lClient = _defaultL2LClient = l2lClient; } // eslint-disable-line no-use-before-define

  constructor (url, l2lClient, options = {}) {
    super(url);
    this.options = { ...options, l2lClient: l2lClient || this.constructor.defaultL2lClient }; // passed to commands
  }

  newResource (url) {
    return new this.constructor(url, this.options.l2lClient, this.options);
  }

  read () {
    let cmd = runCommand(`cat "${this.url}"`, this.options);
    return cmd.whenDone().then(() => {
      if (cmd.exitCode) throw new Error(`Read ${this.url} failed: ${cmd.stderr}`);
      return cmd.output;
    });
  }

  async write (content) {
    let cmd = !content
      ? await runCommand(`echo -n > "${this.url}"`, { ...this.options }).whenDone()
      : await runCommand(`touch "${this.url}" && tee "${this.url}"`,
        { stdin: String(content), ...this.options }).whenDone();
    if (cmd.exitCode) throw new Error(`Write ${this.url} failed: ${cmd.stderr}`);
    return this;
  }

  async mkdir () {
    let cmd = await runCommand(`mkdir -p "${this.url}"`, this.options).whenDone();
    if (cmd.exitCode) throw new Error(`${this} cannot create directory: ${cmd.stderr}`);
    return this;
  }

  async isDirectory () {
    let cmd = runCommand(`test -d "${this.url}"`, this.options);
    await cmd.whenDone();
    return cmd.exitCode === 0;
  }

  async isFile () {
    let cmd = runCommand(`test -f "${this.url}"`, this.options);
    await cmd.whenDone();
    return cmd.exitCode === 0;
  }

  async exists () {
    return (await this.isDirectory() || await this.isFile());
  }

  async isGitRepository (withRemote = false) {
    const isDir = await this.isDirectory();
    if (!isDir) return false;
    let cmd = runCommand(`test -d "${this.url}/.git"`, this.options);
    await cmd.whenDone();
    if (!withRemote) return cmd.exitCode === 0;
    cmd = runCommand(`cd "${this.url}" && git remote`, this.options);
    await cmd.whenDone();
    return cmd.exitCode === 0 && cmd.stdout !== '';
  }

  async initializeGitRepository (repoName) {
    const cmd = runCommand(`cd "${this.url}" && git init`, this.options);
    await cmd.whenDone();
  }

  async addRemoteToGitRepository (token, repoName, repoUser) {
    let repoCreationCommand = `curl \
              -X POST \
              -H "Accept: application/vnd.github+json" \
              -H "Authorization: Bearer ${token}" \
              https://api.github.com/user/repos \
              -d '{"name":"${repoName}"}'`;
    let cmd = runCommand(repoCreationCommand, this.options);
    await cmd.whenDone();
    let addingRemoteCommand = `cd "${this.url}" && git remote add origin https://${token}@github.com/${repoUser}/${repoName}.git`;
    await runCommand(addingRemoteCommand, this.options).whenDone();
  }

  }

  remove () {
    let cmd = runCommand(`rm -rf "${this.url}"`, this.options);
    return cmd.whenDone().then(() => {
      if (cmd.exitCode) throw new Error(`Remove of ${this.url} failed: ${cmd.stderr}`);
      return this;
    });
  }

  async gzip (content) {
    // requires gzip to be installed on server!
    let cmd = runCommand(`gzip > "${this.url}"`, { stdin: String(content), ...this.options });
    return cmd.whenDone().then(() => {
      if (cmd.exitCode) throw new Error(`Gzip compression of ${this.url} failed: ${cmd.stderr}`);
      return this;
    });
  }

  async brotli (content) {
    // requires brotli to be installed on server!
    let cmd = runCommand(`brotli > "${this.url}"`, { stdin: String(content), ...this.options });
    return cmd.whenDone().then(() => {
      if (cmd.exitCode) throw new Error(`Brotli compression of ${this.url} failed: ${cmd.stderr}`);
      return this;
    });
  }

  async readProperties () {
    let info = await fileInfo(this.url, this.options);
    this.assignProperties(obj.dissoc(info, ['fileName', 'path', 'rootDirectory']));
    return this;
  }

  async dirList (depth = 1, opts = {}) {
    let { exclude } = opts;

    if (Array.isArray(exclude)) { exclude = ('-iname ' + exclude.map(string.print).join(' -o -iname ')); }

    let { url, options: { l2lClient } } = this;
    let fileInfos = await findFiles('*', { exclude, depth, rootDirectory: url, l2lClient });

    // remove self
    if (fileInfos[0].path.replace(/\/$/, '') === this.url.replace(/\/$/, '')) { fileInfos.shift(); }

    return fileInfos.map(info => {
      let { path, isDirectory } = info;
      if (isDirectory) path = path.replace(/\/?$/, '/');
      let res = new this.constructor(path, l2lClient, this.options);
      res.assignProperties(obj.dissoc(info, ['fileName', 'path', 'rootDirectory']));
      return res;
    });
  }
}

let _defaultL2LClient;

export const resourceExtension = {
  name: 'shell-client',
  matches: (url) => url.startsWith('/') || url.match(/[a-z]:\\/i), // abs path
  resourceClass: ShellClientResource
};
