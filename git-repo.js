import { exec } from "./shell-exec.js";

async function test() {

  var repo = new Repository("/home/lively/lively-web.org/lively-modules-install/LivelyKernel")
  repo.currentBranch()
  repo.hasLocalChanges();
  repo.localBranchInfo()
  await repo.needsPullOrPush("new-module-system");
  await repo.getRemoteAndLocalHeadRef("new-module-system")
}

export class Repository {

  constructor(directory, options = {dryRun: false, log: []}) {
    this.directory = directory;
    this.dryRun = options.dryRun;
    this._log = options.log || [];
  }

  cmd(cmdString, opts) {
    opts = Object.assign({cwd: this.directory, log: this._log}, opts);
    opts.log = opts.log || this._log;
    return exec(cmdString, opts);
  }

  log() { return this._log.join(""); }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // status
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async currentBranch() {
    var {output} = await this.cmd('git branch | grep "*"');
    return output.trim().replace(/^\*\s*/, "");
  }

  async hasLocalChanges() {
    var {output, code} = await this.cmd(`git status --short -uno`);
    return !!output.trim().length;
  }

  async diff(opts = []) {
    var {output} = await this.cmd(`git diff ${opts.join(" ")}`);
    return output.trim();
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // branches
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async localBranchInfo() {
    // await new Repository().localBranchInfo()
    // var i = new Repository()
    // i.localBranchInfo()
    // i.log()
    // Returns {branch, remote}
    var {output: ref, code} = await this.cmd("git symbolic-ref HEAD");
    var branch = code ? undefined : ref.trim().slice(ref.lastIndexOf('/')+1);
    return {
      branch: branch,
      remote: branch ? await this.remoteOfBranch(branch) : undefined,
      hash: (await this.cmd("git rev-parse HEAD")).output.trim()
    }
  }

  async remoteOfBranch(branch) {
    var {output} = await this.cmd(`git config branch.${branch}.remote`);
    return output.trim();
  }

  async checkout(branchOrHash) {
    var {output, code} = this.cmd(`git checkout ${branchOrHash}`);
    if (code) throw new Error(`Failed to checkout ${branchOrHash}: ${output}`);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // remote
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async getListOfRemotes() {
    var {output: remotesString} = await this.cmd("git remote -v");
    return remotesString.split('\n').map(string => {
      string = string.trim();
      if (!string.length || string.match(/\(fetch\)$/)) return null;
      var parts = string.split(/\s+/);
      return {name: parts[0], url: parts[1]};
    }).filter(ea => !!ea);
  }

  async interactivelyChooseRemote() {
    // await new Repository().getListOfRemotes()
    // await new Repository().interactivelyChooseRemote()
    var remotes = await this.getListOfRemotes(),
        choice = await $world.listPrompt(
          `Please select a git remote repository.`,
          remotes.map(function(remote) {
            return {
              isListItem: true,
              string: remote.name + ' (' + remote.url + ')',
              value: remote
            };
          }), 'origin', pt(350, 140));

    if (!choice || choice.length === 0 || !choice.name)
      return undefined;

    // {name, url}
    return choice;
  }

  async needsPullOrPush(branch = "master", remote = "origin") {
    var result = await this.getRemoteAndLocalHeadRef();
    if (result.local === result.remote)
      return {push: false, pull: false}

    return {
      pull: !await this.isCommitInBranch(result.remote, branch, remote),
      push: !await this.isAncestorCommit(result.local, result.remote)
    }
  }

  async isCommitInBranch(commit, branch = "master", remote = "origin") {
    var {code, output} = await this.cmd(`git branch --contains ${remote}`);
    if (code || !output.trim()) return false;
    return output
        .trim().split("\n")
        .map(line => line.replace(/\*\s*/, "").trim())
        .some(line => line === branch);
  }

  async isAncestorCommit(maybeAncestorCommit, commit) {
    var {code} = await this.cmd(`git merge-base --is-ancestor ${maybeAncestorCommit} ${commit}`);
    return !code;
  }

  async hasRemoteChanges(branch = "master") {
    return !!(await this.needsPullOrPush(branch)).pull;
  }

  async getRemoteAndLocalHeadRef(branch = "master", remote = "origin") {
    var cmdString =
        `remote=$(git ls-remote "${remote}" ${branch});\n`
      + `local=$(git show-ref --hash ${branch} | head -n 1);\n`
      + `remoteLocal=$(git show-ref --hash ${remote}/${branch} | head -n 1);\n`
      + `echo "{\\"remoteLocal\\": \\"$remoteLocal\\", \\"remote\\": \\"$remote\\", \\"local\\": \\"$local\\"}";`;

    var {output} = await this.cmd(cmdString);

    if (output.match(/does not exist/)) {
      return {remote: '', local: this.directory + ' does not exist'};
    }

    var out;
    try {
      out = JSON.parse(output.replace(/\s/g, ' '));
    } catch (e) {
      throw new Error(output)
    }

    return {
      remote: (out.remote || '').trim().split(' ')[0],
      local: (out.local || '').trim().split(' ')[0],
      remoteLocal: (out.remoteLocal || '').trim().split(' ')[0]};
  }

  async push() {
    var {remote, branch} = await this.localBranchInfo()
    if (!remote) throw new Error(`No remote for pushing ${this.directory}`);
    if (!branch) throw new Error(`No branch for pushing ${this.directory}`);
    return this.cmd(`git push "${remote}" "${branch}"`);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // local commit state
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  stash() { return this.cmd("git stash"); }
  stashPop() { return this.cmd("git stash pop"); }

  commit(message, all = false) {
    if (!message) throw new Error("No commit message");
    return this.cmd(`git commit ${all ? "-a" : ""} -m "${message.replace(/\"/g, '\\"')}"`);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // pull / fetch
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  pull(branch = "master", remote = "origin") {
    return this.cmd(`git pull ${remote} ${branch}`);
  }

  async interactivelyUpdate(branch = "master", remote = "origin") {
    var current = await this.localBranchInfo();
    var trackedRemote = await this.remoteOfBranch(branch);
    if (trackedRemote) remote = trackedRemote;
    if (!await this.hasRemoteChanges(branch)) {
      false && console.log(`No remote changes, ${this.directory} is up-to-date.`)
      return "up-to-date";
    }

    console.log(`Updating ${this.directory} from git ${remote}/${branch}`)
    var stashed = false;
    if (await this.hasLocalChanges()) {
      console.log(`Stashing local changes...`);
      stashed = true;
      let {code, output} = await this.stash();
      if (code !== 0) throw new Error("Error in stash: " + output);
    }

    // in case we are switching to a new branch that isn't local yet we need to
    // fetch before checkout!
    await this.cmd(`git fetch ${remote}`)

    if (current.branch !== branch) await this.checkout(branch);

    var {code, output: pullOutput} = await this.pullSavingUntrackedFiles(branch, remote);
    if (code !== 0) throw new Error("Error in pull: " + pullOutput);

    if (current.branch !== branch) await this.checkout(current.branch || current.hash);

    if (stashed) {
      let {code, output} = await this.stashPop();
      if (code !== 0) throw new Error("Error in stash pop: " + output);
      console.log(`Local changes from stash restored...`);
    }

    return pullOutput;
  }

  async moveFilesElsewhereWhile(files, func) {
    var fileObjs = files.map(f => {
      var parts = f.split("/"),
          dir = parts.slice(0, -1).join("/"),
          name = parts[parts.length-1];
      return {path: f, name, dir}
    });

    for (let f of fileObjs)
      await this.cmd(`mkdir -p .lively-git-helper/${f.dir}; mv ${f.path} .lively-git-helper/${f.path};`)

    try {
      return await func();
    } finally {

      for (let f of fileObjs)
        await this.cmd(`mv .lively-git-helper/${f.path} ${f.path};`)
    }

  }

  async pullSavingUntrackedFiles(branch, remote) {
    var initialPull = await this.pull(branch, remote);
    if (!initialPull.code) return initialPull;

    // if the pull doesn't succeed check if we have files that would be overridden
    var untrackedRe = /untracked working tree files would be overwritten/;
    if (!initialPull.output.match(untrackedRe)) return initialPull;

    var lines = initialPull.output.trim().split("\n"),
        index = lines.findIndex((line) => line.match(untrackedRe)),
        overwrittenFiles = lines.slice(index+1)
                            .filter(line => line.match(/^\s/))
                            .map(line => line.trim())

    var pullCmd = await this.moveFilesElsewhereWhile(overwrittenFiles, async () => await this.pull(branch, remote));
    if (pullCmd.code !== 0) throw new Error("Error in pull:" + pullCmd.output);
    return pullCmd;
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // clone
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async clone(repoURL, branch = "master") {
    var pathParts = this.directory.split("/"),
        parentDir = pathParts.slice(0,-1).join("/"),
        name = pathParts[pathParts.length-1];
    if ((await this.cmd(`test -d "${this.directory}"`)).code === 0) {
      throw new Error(`Cannot clone into ${this.directory}: exists already`);
    }
    var {code, output} = await this.cmd(`git clone -b ${branch} ${repoURL} ${name}`, {cwd: parentDir});
    if (code) throw new Error(`Failure cloning repo: ${output}`);
  }

}
