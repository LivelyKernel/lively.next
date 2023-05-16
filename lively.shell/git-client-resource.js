
import ShellClientResource from './client-resource.js';
import { runCommand } from 'lively.ide/shell/shell-interface.js';

export default class GitShellResource extends ShellClientResource {
  constructor (url, l2lClient, options = {}) {
    url = url.replace('git\/', '');
    super(url);
    this.options.cwd = this.url;
  }

  runCommand (cmd) {
    return runCommand(cmd, this.options);
  }

  async isGitRepository () {
    const isDir = await this.isDirectory();
    if (!isDir) return false;

    let cmd = this.runCommand('test -d ".git"');
    await cmd.whenDone();
    return cmd.exitCode === 0;
  }

  async initializeGitRepository () {
    const cmd = this.runCommand('git init -b main');
    await cmd.whenDone();
    if (cmd.exitCode !== 0) throw Error('Error initializing git repository');
  }

  async hasRemote () {
    const checkRemoteCommand = 'git remote';
    const res = await this.runCommand(checkRemoteCommand).whenDone();
    if (res.exitCode !== 0) throw Error('Error while executing git remote.');
    if (res.stdout === '') return false;
    else return true;
  }

  async addRemoteToGitRepository (token, repoName, repoUser, repoDescription, orgScope = false) {
    let repoCreationCommand = orgScope
      ? `curl -L \
              -X POST \
              -H "Accept: application/vnd.github+json" \
              -H "Authorization: Bearer ${token}"\
              -H "X-GitHub-Api-Version: 2022-11-28" \
              https://api.github.com/orgs/${repoUser}/repos \
              -d '{"name":"${repoName}","description":"${repoDescription}"}'`
      : `curl -L \
              -X POST \
              -H "Accept: application/vnd.github+json" \
              -H "Authorization: Bearer ${token}" \
              https://api.github.com/user/repos \
              -d '{"name":"${repoName}", "description": "${repoDescription}"}'`;
    let cmd = this.runCommand(repoCreationCommand);
    await cmd.whenDone();
    if (cmd.exitCode !== 0) throw Error('Error executing curl call to create GitHub repository');
    const addingRemoteCommand = `git remote add origin https://${token}@github.com/${repoUser}/${repoName}.git`;
    cmd = this.runCommand(addingRemoteCommand);
    await cmd.whenDone();
    if (cmd.exitCode !== 0) throw Error('Error adding the remote to local repository');
    // TODO: We could improve by providing a way to configure this.
    const trackingCommand = 'git branch --track origin';
    cmd = this.runCommand(trackingCommand);
    await cmd.whenDone();
    if (cmd.exitCode !== 0) throw Error('Error tracking main with origin');
  }

  async commitRepo (message) {
    let cmdString = `git add . && git commit -m "${message}"`;
    let cmd = this.runCommand(cmdString);
    await cmd.whenDone();
    if (cmd.exitCode !== 0) throw Error('Error committing');
    else return true;
  }

  async pushRepo () {
    await this.pullRepo();
    await this.commitRepo();
    const cmd = this.runCommand('git push --set-upstream origin main');
    await cmd.whenDone();
    if (cmd.exitCode !== 0) throw Error('Error pushing to remote');
    else return true;
  }

  async pullRepo () {
    await this.runCommand('git stash').whenDone();
    const pullCmd = this.runCommand('git pull');
    await pullCmd.whenDone();
    if (pullCmd.exitCode !== 0) throw Error('Error pulling. Might be due to a conflict!');
    const cmd = this.runCommand('git stash pop');
    await cmd.whenDone();
    if (cmd.exitCode !== 0) throw Error('Error applying stash. Might be due to a conflict!');
    else return true;
  }
}

let _defaultL2LClient;

export const gitResourceExtension = {
  name: 'git-shell-client',
  matches: (url) => url.startsWith('git/') || url.match(/[a-z]:\\/i), // abs path
  resourceClass: GitShellResource
};
