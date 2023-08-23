/* eslint-disable no-console */
import ShellClientResource from './client-resource.js';
import { runCommand } from 'lively.ide/shell/shell-interface.js';

export default class GitShellResource extends ShellClientResource {
  constructor (url) {
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
    const cmd = this.runCommand('git init && git symbolic-ref HEAD refs/heads/main');
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

  async hasRemoteMainConfigured () {
    const getRemoteURLCommand = 'git remote -v';
    let res = await this.runCommand(getRemoteURLCommand).whenDone();
    if (res.exitCode !== 0) throw Error('Error while executing git remote.');
    const remoteOutput = res.stdout;
    if (remoteOutput === '') throw ('Remote unconfigured. This should be impossible!');
    const remoteURL = remoteOutput.match(/(https:.*)\s\(/)[1];
    const checkRemoteBranchCommand = `git ls-remote --heads ${remoteURL} main`;
    res = await this.runCommand(checkRemoteBranchCommand).whenDone();
    if (res.exitCode !== 0) throw Error('Error while checking remote branches.');
    if (res.stdout === '') return false;
    return true;
  }

  async addRemoteToGitRepository (token, repoName, repoUser, repoDescription, orgScope, priv) {
    const repoCreationCommand = orgScope
      ? `curl -L \
              -X POST \
              -H "Accept: application/vnd.github+json" \
              -H "Authorization: Bearer ${token}"\
              -H "X-GitHub-Api-Version: 2022-11-28" \
              https://api.github.com/orgs/${repoUser}/repos \
              -d '{"name":"${repoName}","description":"${repoDescription}", "private":${!!priv}}'`
      : `curl -L \
              -X POST \
              -H "Accept: application/vnd.github+json" \
              -H "Authorization: Bearer ${token}" \
              https://api.github.com/user/repos \
              -d '{"name":"${repoName}", "description": "${repoDescription}", "private":${!!priv}}'`;
    let cmd = this.runCommand(repoCreationCommand);
    await cmd.whenDone();
    if (cmd.exitCode !== 0) throw Error('Error executing curl call to create GitHub repository');

    const addingRemoteCommand = `git remote add origin https://${token}@github.com/${repoUser}/${repoName}.git`;
    cmd = this.runCommand(addingRemoteCommand);
    await cmd.whenDone();
    if (cmd.exitCode !== 0) throw Error('Error adding the remote to local repository');
  }

  async changeRemoteVisibility (token, repoName, repoUser, visibility) {
    const changeVisbilityCommand = `curl -L \
  -X PATCH \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${token}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/repos/${repoUser}/${repoName} \
  -d '{"private":${visibility === 'private'}}'`;
    const cmd = this.runCommand(changeVisbilityCommand);
    await cmd.whenDone();
    if (cmd.exitCode !== 0) {
      console.error('Error updating repository settings.');
      return false;
    }
    console.log('Repository settings updated.');
    return true;
  }

  async activateGitHubPages (token, repoName, repoUser) {
    const activateGitHubPagesEnvironmentCommand = `curl -L \
      -X POST \
      -H "Accept: application/vnd.github+json" \
      -H "Authorization: Bearer ${token}" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      https://api.github.com/repos/${repoUser}/${repoName}/pages \
      -d '{"build_type": "workflow"}'`;
    const cmd = this.runCommand(activateGitHubPagesEnvironmentCommand);
    await cmd.whenDone();
    if (cmd.exitCode !== 0) console.error(`Activating GitHub Pages for ${repoUser}/${repoName} was not successful. Proceeding.`);
  }

  async commitRepo (message, tag = false, tagName, filesToCommit = '.') {
    let cmdString = `git add ${filesToCommit} && git commit -m "${message}"`;
    let cmd = this.runCommand(cmdString);
    await cmd.whenDone();
    if (cmd.exitCode !== 0 && !cmd.stdout.includes('nothing to commit')) throw Error('Error committing');
    else if (tag) {
      // TODO: We currently only support Lightweight Tags
      // https://git-scm.com/book/en/v2/Git-Basics-Tagging
      cmdString = `git tag v${tagName}`;
      cmd = this.runCommand(cmdString);
      await cmd.whenDone();
      if (cmd.exitCode !== 0) throw Error('Error tagging release');
    }
    return true;
  }

  async pushRepo () {
    let cmd = this.runCommand('git push --set-upstream origin main');
    await cmd.whenDone();
    if (cmd.exitCode !== 0) throw Error('Error pushing to remote');
    cmd = this.runCommand('git push origin --tags');
    await cmd.whenDone();
    if (cmd.exitCode !== 0) throw Error('Error pushing tags to remote');
    return true;
  }

  async pullRepo () {
    const hasRemoteBranch = await this.hasRemoteMainConfigured();
    if (!hasRemoteBranch) return false;
    await this.runCommand('git stash').whenDone();
    const pullCmd = this.runCommand('git pull --rebase');
    await pullCmd.whenDone();
    if (pullCmd.exitCode !== 0) throw Error('Error pulling. Might be due to a conflict!');
    const cmd = this.runCommand('git stash pop');
    await cmd.whenDone();
    if (cmd.exitCode !== 0 && cmd.stderr !== 'No stash entries found.\n') throw Error('Error applying stash. Might be due to a conflict!');
    else return true;
  }

  async resetFile (fileName) {
    const resetCmd = `git checkout ${fileName}`;
    await this.runCommand(resetCmd).whenDone();
  }

  async hasUncommitedChanges () {
    const checkCmd = '(git add * || true) && git diff --cached --exit-code && git diff --exit-code';
    const check = this.runCommand(checkCmd);
    await check.whenDone();
    return !!check.exitCode;
  }
}

export const gitResourceExtension = {
  name: 'git-shell-client',
  matches: (url) => url.startsWith('git/') || url.match(/[a-z]:\\/i), // abs path
  resourceClass: GitShellResource
};
