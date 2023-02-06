
import { runCommand } from './client-command.js';

import ShellClientResource from './client-resource.js';

export default class GitShellResource extends ShellClientResource {
  constructor (url, l2lClient, options = {}) {
    url = url.replace('git\/', '');
    super(url);
  }

  async isGitRepository (withRemote = false) {
    const isDir = await this.isDirectory();
    if (!isDir) return false;
    // FIXME: this dictates that this function gets executed before any other of the git operations can be performed
    // would be nicer to make that transparent
    this.options.cwd = this.url;
    let cmd = runCommand('test -d ".git"', this.options);
    await cmd.whenDone();
    if (!withRemote) return cmd.exitCode === 0;
    cmd = runCommand('git remote', this.options);
    await cmd.whenDone();
    return cmd.exitCode === 0 && cmd.stdout !== '';
  }

  async initializeGitRepository () {
    if (this.options.cwd !== this.url) this.options.cwd = this.url;
    const cmd = runCommand('git init', this.options);
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
    let addingRemoteCommand = `git remote add origin https://${token}@github.com/${repoUser}/${repoName}.git`;
    await runCommand(addingRemoteCommand, this.options).whenDone();
  }

  async commitRepo () {
    let cmdString = `git add * && git commit -m "Commited from withing lively.next at ${Date.now()}"`;
    let cmd = runCommand(cmdString, this.options);
    await cmd.whenDone();
  }

  async pushGitRepo () {
    await this.pullGitRepo();
    await this.commitRepo();
    const cmd = runCommand('git push --set-upstream origin master', this.options);
    await cmd.whenDone();
  }

  // TODO: functioning error handling, especially in the case of conflicts
  async pullGitRepo () {
    await runCommand('git stash', this.options).whenDone();
    const pullCmd = runCommand('git pull', this.options);
    await pullCmd.whenDone();
    const cmd = runCommand('git stash pop', this.options);
    await cmd.whenDone();
  }
}

let _defaultL2LClient;

export const gitResourceExtension = {
  name: 'git-shell-client',
  matches: (url) => url.startsWith('git/') || url.match(/[a-z]:\\/i), // abs path
  resourceClass: GitShellResource
};
