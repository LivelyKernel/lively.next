/* global fetch */
/* eslint-disable no-console */
import ShellClientResource from './client-resource.js';
import { runCommand } from 'lively.ide/shell/shell-interface.js';
import L2LClient from 'lively.2lively/client.js';

export default class GitShellResource extends ShellClientResource {
  constructor (url) {
    url = url.replace('git\/', '');
    super(url);
    this.options.cwd = this.url;
    if (!this.options.l2lClient) {
      const defaultConnection = { url: `${document.location.origin}/lively-socket.io`, namespace: 'l2l' };
      this.options.l2lClient = L2LClient.ensure(defaultConnection);
    }
  }

  async fetch (remote = 'origin') {
    await this.runCommand(`git fetch ${remote}`).whenDone();
  }

  async branchesInRepository () {
    const output = await this.runCommand('git branch --all').whenDone();
    // TODO: insert error handling
    const printedBranches = output.output.split(/[\r\n]+/);
    let branches = [];
    printedBranches.forEach(b => {
      if (b.includes('HEAD') || b.length === 0) return;

      const branch = {};

      if (b.includes('*')) branch.checkedOut = true;
      else branch.checkedOut = false;

      if (b.includes('remotes')) {
        branch.remote = true;
        branch.name = b.match(/\/.*\/(.*)/)[1].trim();
      } else {
        branch.local = true;
        branch.name = b.match(/ (.*)/)[1].trim();
      }

      branches.push(branch);
    });

    const res = [];
    branches.forEach(currentBranch => {
      const b = res.find(b => b.name === currentBranch.name);
      if (b) {
        if (currentBranch.remote) b.remote = true;
        if (currentBranch.local) b.local = true;
        if (currentBranch.checkedOut) b.checkedOut = true;
      } else res.push(currentBranch);
    });
    return res;
  }

  async branchName () {
    const cmd = await this.runCommand('git rev-parse --abbrev-ref HEAD').whenDone();
    return cmd.output.trim().replace('\n', '');
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

  /**
   * Creates a new branch `branchName` and switches to it. Fails if the branch already exists.
   * @param {string} branchName - The branch to switch to.
   * @returns
   */
  async createAndCheckoutBranch (branchName, tracked = false) {
    const branchCreationCmd = tracked
      ? `git checkout --track origin/${branchName}`
      : `git checkout -b ${branchName}`;
    const cmd = this.runCommand(branchCreationCmd);
    await cmd.whenDone();
    // Branch could successfully be created and switched to.
    if (cmd.exitCode === 0) return true;
    return false;
  }

  async hasRemote () {
    const checkRemoteCommand = 'git remote';
    const res = await this.runCommand(checkRemoteCommand).whenDone();
    if (res.exitCode !== 0) throw Error('Error while executing git remote.');
    if (res.stdout === '') return false;
    else return true;
  }

  async getRemote () {
    const remoteCommand = 'git remote -v';
    const res = await this.runCommand(remoteCommand).whenDone();
    return res.stdout;
  }

  async setGitConfig (name, email) {
    const configureNameCmd = `git config user.name "${name}"`;
    const configureEmailCmd = `git config user.email "${email}"`;

    await this.runCommand(configureNameCmd).whenDone();
    await this.runCommand(configureEmailCmd).whenDone();
  }

  async hasRemoteBranchConfigured () {
    const getRemoteURLCommand = 'git remote -v';
    let res = await this.runCommand(getRemoteURLCommand).whenDone();
    if (res.exitCode !== 0) throw Error('Error while executing git remote.');
    const remoteOutput = res.stdout;
    if (remoteOutput === '') throw ('Remote unconfigured. This should be impossible!');
    const remoteURL = remoteOutput.match(/(https:.*)\s\(/)[1];
    const branchName = await this.branchName();
    const checkRemoteBranchCommand = `git ls-remote --heads ${remoteURL} ${branchName}`;
    res = await this.runCommand(checkRemoteBranchCommand).whenDone();
    if (res.exitCode !== 0) throw Error('Error while checking remote branches.');
    if (res.stdout === '') return false;
    return true;
  }

  async createAndAddRemoteToGitRepository (token, repoName, repoUser, repoDescription, orgScope, priv) {
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
    this.addRemoteURLWithToken(token, repoUser, repoName);
  }

  async addRemoteURLWithToken (token, repoUser, repoName) {
    const addingRemoteCommand = `git remote add origin https://${token}@github.com/${repoUser}/${repoName}`;
    const cmd = this.runCommand(addingRemoteCommand);
    await cmd.whenDone();
    if (cmd.exitCode !== 0) throw Error('Error adding the remote to local repository');
  }

  async deleteRemoteRepository (token, repoName, repoUser) {
    const deleteRes = await fetch(`https://api.github.com/repos/${repoUser}/${repoName}`, {
      method: 'DELETE',
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    });

    if (deleteRes.status === 404) throw Error('Unexpected problem delete remote repository.');
    if (deleteRes.status === 403) return false;
    if (deleteRes.status === 204) return true;
  }

  async changeRemoteURLToUseCurrentToken (token, repoUser, repoName) {
    const removeRemoteCommand = 'git remote remove origin';
    const cmd = this.runCommand(removeRemoteCommand);
    await cmd.whenDone();
    if (cmd.exitCode !== 0) throw Error('Error removing outdated remote `origin`');

    await this.addRemoteURLWithToken(token, repoUser, repoName);
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
    let cmd = this.runCommand('git push origin --all');
    await cmd.whenDone();
    // --all has the downside of trying to push all branches at once. In the case we have an outdated branch locally, pushing that will fail.
    // In this case, we get exitCode 1 and just need to make sure that the branch for which pushing failed is not the current one.
    // We use --all since it allows us to skip all manual setup regarding the tracking branch, its name, etc.
    if (cmd.exitCode === 1){
      const currentBranch = await this.branchName();
      const branchRegex = new RegExp(`\[rejected\]\s+${currentBranch} `, 'm');
      const currentBranchRejected = cmd.stderr.match(branchRegex);
      if (currentBranchRejected) throw Error('Error pushing to remote');
    } else if (cmd.exitCode !== 0) {
      throw Error('Error pushing to remote');
    }; 
    cmd = this.runCommand('git push origin --tags');
    await cmd.whenDone();
    if (cmd.exitCode !== 0) throw Error('Error pushing tags to remote');
    return true;
  }

  async pullRepo () {
    const hasRemoteBranch = await this.hasRemoteBranchConfigured();
    if (!hasRemoteBranch) return false;
    await this.runCommand('git stash -m "stashed-while-pulling-project"').whenDone();
    const branchName = await this.branchName();
    const pullCmd = this.runCommand(`git pull origin ${branchName} --rebase`);
    await pullCmd.whenDone();
    if (pullCmd.exitCode !== 0) throw Error('Error pulling. Might be due to a conflict!');
    // only apply lets us reference a stash by name -> clean up stash below
    const stashApplicationCommand = this.runCommand('git stash apply stash^{/stashed-while-pulling-project}');
    await stashApplicationCommand.whenDone();
    // Successful stash application means we have created a stash that we need to clean up.
    if (stashApplicationCommand.exitCode === 0) {
      await this.runCommand('git stash drop').whenDone();
    }
    if (stashApplicationCommand.exitCode !== 0 && !stashApplicationCommand.stderr.includes('is not a valid reference')) throw Error('Error applying stash. Might be due to a conflict!');
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
