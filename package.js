import { exec } from "./shell-exec.js";
import { join, read } from "./helpers.js";
import { Repository } from "./git-repo.js";

export class Package {

  constructor(dir, config = {}, log = []) {
    config = Object.assign({name: "", repoURL: "", branch: "master"}, config);
    this._log = log;
    this.directory = dir;
    this.config = config;
    this.repo = new Repository(this.directory, {log: this._log});
    this.exists = undefined;
    this.hasGitRepo = undefined;
    this.currentBranch = undefined;
    this.hasLocalChanges = undefined;
    this.hasRemoteChanges = undefined;
  }

  printLog() { return this._log.join(""); }

  get version() { return this.config.version || null; }
  get name() { return this.config.name || ""; }
  get dependencies() {
    return Object.assign({}, this.config.dependencies, this.config.devDependencies);
  }

  async readConfig() {
    try {
      var content = await read(join(this.directory, "package.json"));
      if (content) this.config = Object.assign(this.config, JSON.parse(content));
    } catch (e) {
      console.warn(`Error when reading package config for ${this.directory}: ${e}`)
    }
    return this;
  }

  async readStatus() {
    this.exists = await this.existsInFileSystem();
    if (!this.exists) return this;
    this.hasGitRepo = await this.isGitRepo();
    if (!this.hasGitRepo) return this;
    this.currentBranch = await this.repo.currentBranch();
    this.hasLocalChanges = await this.repo.hasLocalChanges(),
    this.hasRemoteChanges = await this.repo.hasRemoteChanges(this.config.branch);
    return this;
  }

  async existsInFileSystem() {
    return (await exec(`node -e 'process.exit(require("fs").existsSync("${this.directory}") ? 0 : 1);'`)).code === 0;
  }

  async isGitRepo() {
    return (await exec(`node -e 'process.exit(require("fs").existsSync(require("path").join("${this.directory}", ".git")) ? 0 : 1);'`)).code === 0;
  }

  async ensure(packages) {
    if (!await this.existsInFileSystem()) {
      await this.repo.clone(this.config.repoURL, this.config.branch);
    } else if (!await this.isGitRepo()) {
      // dir does exists but is not a git repo
      var helperDir = join(this.directory, ".temp-lively-clone-helper"),
          helperRepo = new Repository(helperDir, {log: this._log});
      await helperRepo.clone(this.config.repoURL, this.config.branch);
      await exec(`mv .temp-lively-clone-helper/.git .git; rm -rf .temp-lively-clone-helper`, {cwd: this.directory});
    }
    packages && await this.linkToDependencies(packages);
    var {output} = await exec(`git status`, {cwd: this.directory})
    return output;
  }

  async update(packages) {
    if (await this.existsInFileSystem())
      var output = await this.repo.interactivelyUpdate(this.config.branch, undefined);
    packages && await this.linkToDependencies(packages);
    return output;
  }

  async installOrUpdate(packages) {
    return !await this.existsInFileSystem() || !await this.isGitRepo() ?
      await this.ensure(packages) :
      await this.update(packages);
  }

  findDependenciesIn(packages) {
    var deps = Object.keys(this.dependencies);
    return packages.filter((p) => deps.indexOf(p.name) > -1);
  }

  async symlinkTo(localDir, toPackage) {
    // creates a link from this.directory -> toPackage.directory/localDir/this.name
    var fromPackage = this;
    var cmd = await exec(`node -e '
var j = require("path").join, fs = require("fs"), localDir = "${localDir}", linkedDir = j(localDir, "${fromPackage.name}");
if (!fs.existsSync(localDir)) fs.mkdirSync(localDir);
if (fs.existsSync(linkedDir)) rm(linkedDir);
fs.symlinkSync("${fromPackage.directory}", linkedDir, "dir");
function rm(path) {
    var stat = fs.lstatSync(path);
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
    fs.readdirSync(path).forEach(f => rm(j(path, f)));
    fs.rmdirSync(path);
    } else fs.unlinkSync(path);
}
'`, {cwd: toPackage.directory, log: this._log});
    return cmd;
  }

  async linkToDependencies(packages) {
    await this.readConfig();
    var deps = await this.findDependenciesIn(packages);
    for (let dep of deps) await dep.symlinkTo("node_modules", this);
  }

  async npmInstall() {
    return exec("npm install", {log: this._log, cwd: this.directory});
  }

  async npmInstallNeeded() {
    var cmd = await exec('npm list --depth 1 --json --silent', {log: this._log, cwd: this.directory}),
        { stdout } = cmd,
        npmList = JSON.parse(stdout),
        depNames = Object.getOwnPropertyNames(npmList.dependencies);
        toFix = depNames.reduce(function(depsToFix, name) {
          var dep = npmList.dependencies[name];
          if (dep.missing || dep.invalid) depsToFix.push(name);
          return depsToFix;
        }, []);
    return toFix.length && toFix.length > 0;
  }
}
