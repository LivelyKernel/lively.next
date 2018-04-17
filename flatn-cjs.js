// >>> file:///Users/robert/Lively/lively-dev2/flatn/util.js
/*global process, require, module, __filename*/

var { exec } = require("child_process");
var { join: j } = require("path");
var { basename } = require("path");
var { mkdirSync } = require("fs");
var { symlinkSync } = require("fs");
var { existsSync } = require("fs");
var { tmpdir: nodeTmpdir } = require("os");
var { resource } = require("./deps/lively.resources.js");

var crossDeviceTest = {
  done: false,
  isOnOtherDevice: undefined,
  customTmpDirExists: false,
  customTmpDir: j(process.cwd(), "tmp")
};
function tmpdir() {
  const { done, isOnOtherDevice, customTmpDirExists, customTmpDir } = crossDeviceTest;
  if (done) {
    if (!isOnOtherDevice) return nodeTmpdir();
    if (!customTmpDirExists) {
      // console.log(`[flatn] using custom tmp dir: ${customTmpDir}`);
      if (!existsSync(customTmpDir))
        mkdirSync(customTmpDir);
      crossDeviceTest.customTmpDirExists = true;
    }
    return customTmpDir
  }

  crossDeviceTest.done = true;
  try {
    symlinkSync(__filename), j(nodeTmpdir(), basename(__filename));
    crossDeviceTest.isOnOtherDevice = false;
  } catch (err) {
    crossDeviceTest.isOnOtherDevice = true;
  }
  return tmpdir();
}

function maybeFileResource(url) {
  if (typeof url === "string" && url.startsWith("/"))
    url = "file://" + url;
  return url.isResource ? url : resource(url);
}

var fixGnuTar = undefined;

async function npmSearchForVersions(pname, range = "*") {
  // let packageNameAndRange = "lively.lang@~0.4"
  try {
    // pname = pname.replace(/\@/g, "_40");
    pname = pname.replace(/\//g, "%2f");
    let { name, version, dist: { shasum, tarball } } = await resource(`http://registry.npmjs.org/${pname}/${range}`).readJson();
    return { name, version, tarball };
  } catch (err) {
    console.error(err);
    throw new Error(`Cannot find npm package for ${pname}@${range}`);
  }
}

async function npmDownloadArchive(pname, range, destinationDir) {
  destinationDir = maybeFileResource(destinationDir);
  let { version, name, tarball: archiveURL } = await npmSearchForVersions(pname, range);
  let nameForArchive = name.replace(/\//g, "%2f");
  let archive = `${nameForArchive}-${version}.tgz`;

  if (!archiveURL) {
    archiveURL = `https://registry.npmjs.org/${name}/-/${archive}`;
  }
  console.log(`[flatn] downloading ${name}@${range} - ${archiveURL}`);
  let downloadedArchive = destinationDir.join(archive);
  await resource(archiveURL).beBinary().copyTo(downloadedArchive);
  return { downloadedArchive, name, version };
}


// let {downloadedArchive} = await npmDownloadArchive("lively.lang@^0.3", "local://lively.node-packages-test/test-download/")
// let z = await untar(downloadedArchive, resource("file:///Users/robert/temp/"))
// let z = await untar(downloadedArchive, resource("local://lively.node-packages-test/test-download/"))
// await z.dirList()
// https://registry.npmjs.org/lively.lang/-/lively.lang-0.3.5.tgz

async function untar(downloadedArchive, targetDir, name) {
  // FIXME use tar module???

  if (!name) name = downloadedArchive.name().replace(/(\.tar|\.tar.tgz|.tgz)$/, "");
  name = name.replace(/\//g, "%2f");

  downloadedArchive = maybeFileResource(downloadedArchive);
  targetDir = maybeFileResource(targetDir);

  let untarDir = resource(`file://${tmpdir()}/npm-helper-untar/`);
  await untarDir.ensureExistance();
  if (!downloadedArchive.url.startsWith("file://")) { // need to run exec
    let tmpDir = untarDir.join(downloadedArchive.name());
    await downloadedArchive.copyTo(tmpDir);
    downloadedArchive = tmpDir;
  }

  if (untarDir.join(name).exists()) {
    try {
      await untarDir.join(name).remove();
    } catch (err) {
      // sometimes remove above errors with EPERM...
      await x(`rm -rf "${name}"`, { cwd: untarDir.path() });
    }
  }

  // console.log(`[${name}] extracting ${downloadedArchive.path()} => ${targetDir.join(name).asDirectory().url}`);

  if (fixGnuTar === undefined) {
    try {
      await x(`tar --version | grep -q 'gnu'`);
      fixGnuTar = "--warning=no-unknown-keyword ";
    } catch (err) {
      fixGnuTar = "";
    }
  }

  try {
    let cmd = `mkdir "${name}" && `
      + `tar xzf "${downloadedArchive.path()}" ${fixGnuTar}--strip-components 1 -C "${name}" && `
      + `rm "${downloadedArchive.path()}"`
    await x(cmd, { verbose: false, cwd: untarDir.path() });
  } catch (err) {
    try { await x(`rm -rf ${untarDir.path()}`) } catch (err) { }
  } finally {
    try { await targetDir.join(name).asDirectory().remove(); } catch (err) { }
  }

  await x(`mv ${untarDir.join(name).path()} ${targetDir.join(name).path()}`, {});
  return targetDir.join(name).asDirectory();
}


// await gitClone("https://github.com/LivelyKernel/lively.morphic", "local://lively.node-packages-test/test-download/lively.morphic.test")

async function gitClone(gitURL, intoDir, branch = "master") {
  intoDir = maybeFileResource(intoDir).asDirectory();
  let name = intoDir.name(), tmp;
  if (!intoDir.url.startsWith("file://")) {
    tmp = resource(`file://${tmpdir()}/npm-helper-gitclone/`);
    await tmp.ensureExistance();
    if (tmp.join(name).exists()) await tmp.join(name).remove()
  } else {
    intoDir.parent().ensureExistance();
    if (intoDir.exists()) await intoDir.remove();
  }

  // console.log(`git clone -b "${branch}" "${gitURL}" "${name}"`)
  // console.log(tmp ? tmp.path() : intoDir.parent().path())

  let destPath = tmp ? tmp.path() : intoDir.parent().path();
  try {
    try {
      await x(`git clone --single-branch -b "${branch}" "${gitURL}" "${name}"`, { cwd: destPath });
    } catch (err) {
      // specific shas can't be cloned, so do it manually:
      await x(`git clone "${gitURL}" "${name}" && cd ${name} && git reset --hard "${branch}" `, { cwd: destPath });
    }
  } catch (err) {
    throw new Error(`git clone of ${gitURL} branch ${branch} into ${destPath} failed:\n${err}`);
  }

  if (tmp) await x(`mv ${tmp.join(name).path()} ${intoDir.asFile().path()}`);
}



function x(cmd, opts = {}) {
  return new Promise((resolve, reject) => {
    let p = exec(cmd, opts, (code, stdout, stderr) =>
      code
        ? reject(new Error(`Command ${cmd} failed: ${code}\n${stdout}${stderr}`))
        : resolve(stdout));
    if (opts.verbose) {
      // p.stdout.on("data", d => console.log(d));
      // p.stderr.on("data", d => console.log(d));
      p.stdout.pipe(process.stdout);
      p.stderr.pipe(process.stderr);
    }
  });
}


var npmFallbackEnv = {
  npm_config_access: '',
  npm_config_also: '',
  npm_config_always_auth: '',
  npm_config_auth_type: 'legacy',
  npm_config_bin_links: 'true',
  npm_config_browser: '',
  npm_config_ca: '',
  npm_config_cache: j(process.env.HOME || "", '.npm'),
  npm_config_cache_lock_retries: '10',
  npm_config_cache_lock_stale: '60000',
  npm_config_cache_lock_wait: '10000',
  npm_config_cache_max: 'Infinity',
  npm_config_cache_min: '10',
  npm_config_cafile: '',
  npm_config_cert: '',
  npm_config_color: 'true',
  npm_config_depth: 'Infinity',
  npm_config_description: 'true',
  npm_config_dev: '',
  npm_config_dry_run: '',
  npm_config_engine_strict: '',
  npm_config_fetch_retries: '2',
  npm_config_fetch_retry_factor: '10',
  npm_config_fetch_retry_maxtimeout: '60000',
  npm_config_fetch_retry_mintimeout: '10000',
  npm_config_force: '',
  npm_config_git: 'git',
  npm_config_git_tag_version: 'true',
  npm_config_global: '',
  npm_config_global_style: '',

  npm_config_globalconfig: j(process.env.HOME || "", 'npmrc'),
  npm_config_globalignorefile: j(process.env.HOME || "", 'npmignore'),
  npm_config_group: '20',
  npm_config_ham_it_up: '',
  npm_config_heading: 'npm',
  npm_config_https_proxy: '',
  npm_config_if_present: '',
  npm_config_ignore_scripts: '',
  npm_config_init_author_email: '',
  npm_config_init_author_name: '',
  npm_config_init_author_url: '',
  npm_config_init_license: 'ISC',
  npm_config_init_module: j(process.env.HOME || "", '.npm-init.js'),
  npm_config_init_version: '1.0.0',
  npm_config_json: '',
  npm_config_key: '',
  npm_config_legacy_bundling: '',
  npm_config_link: '',
  npm_config_local_address: '',
  npm_config_loglevel: 'warn',
  npm_config_logs_max: '10',
  npm_config_long: '',
  npm_config_maxsockets: '50',
  npm_config_message: '%s',
  npm_config_metrics_registry: 'https://registry.npmjs.org/',
  npm_config_node_version: '7.7.4',
  npm_config_onload_script: '',
  npm_config_only: '',
  npm_config_optional: 'true',
  npm_config_parseable: '',
  npm_config_prefix: process.env.HOME || "",
  npm_config_production: '',
  npm_config_progress: 'true',
  npm_config_proprietary_attribs: 'true',
  npm_config_proxy: '',
  npm_config_rebuild_bundle: 'true',
  npm_config_registry: 'https://registry.npmjs.org/',
  npm_config_rollback: 'true',
  npm_config_save: '',
  npm_config_save_bundle: '',
  npm_config_save_dev: '',
  npm_config_save_exact: '',
  npm_config_save_optional: '',
  npm_config_save_prefix: '^',
  npm_config_scope: '',
  npm_config_scripts_prepend_node_path: 'warn-only',
  npm_config_searchexclude: '',
  npm_config_searchlimit: '20',
  npm_config_searchopts: '',
  npm_config_searchstaleness: '900',
  npm_config_send_metrics: '',
  npm_config_shell: 'bash',
  npm_config_shrinkwrap: 'true',
  npm_config_sign_git_tag: '',
  npm_config_sso_poll_frequency: '500',
  npm_config_sso_type: 'oauth',
  npm_config_strict_ssl: 'true',
  npm_config_tag: 'latest',
  npm_config_tag_version_prefix: 'v',
  npm_config_tmp: tmpdir(),
  npm_config_umask: '0022',
  npm_config_unicode: 'true',
  npm_config_unsafe_perm: 'true',
  npm_config_usage: '',
  npm_config_user: '501',
  npm_config_user_agent: 'npm/4.4.4 node/v7.7.4 darwin x64',
  npm_config_userconfig: j(process.env.HOME || "", '.npmrc'),
  npm_config_version: '',
  npm_config_versions: '',
  npm_config_viewer: 'man',
  npm_execpath: '/Users/robert/.nvm/versions/node/v7.7.4/lib/node_modules/npm/bin/npm-cli.js',
  npm_node_execpath: '/Users/robert/.nvm/versions/node/v7.7.4/bin/node'
}

// gitSpecFromVersion("git+ssh://user@hostname/project.git#commit-ish")
// gitSpecFromVersion("https://rksm/flatn#commit-ish")
// gitSpecFromVersion("rksm/flatn#commit-ish")
function gitSpecFromVersion(version = "") {
  let gitMatch = version.match(/^([^:]+:\/\/[^#]+)(?:#(.+))?/),
    [_1, gitRepo, gitBranch] = gitMatch || [],
    githubMatch = version.match(/^(?:github:)?([^\/]+)\/([^#\/]+)(?:#(.+))?/),
    [_2, githubUser, githubRepo, githubBranch] = githubMatch || [];
  if (!githubMatch && !gitMatch) return null;

  if (!githubMatch)
    return {
      branch: gitBranch,
      gitURL: gitRepo,
      versionInFileName: gitRepo.replace(/[:\/\+#]/g, "_") + "_" + gitBranch
    };

  let gitURL = `https://github.com/${githubUser}/${githubRepo}`;
  return {
    branch: githubBranch, gitURL,
    versionInFileName: gitURL.replace(/[:\/\+#]/g, "_") + "_" + githubBranch
  };
}

module.exports.gitClone = gitClone;
module.exports.untar = untar;
module.exports.npmDownloadArchive = npmDownloadArchive;
module.exports.npmSearchForVersions = npmSearchForVersions;
module.exports.x = x;
module.exports.npmFallbackEnv = npmFallbackEnv;
module.exports.gitSpecFromVersion = gitSpecFromVersion;
module.exports.tmpdir = tmpdir;
// <<< file:///Users/robert/Lively/lively-dev2/flatn/util.js

// >>> file:///Users/robert/Lively/lively-dev2/flatn/package-map.js
var fs = require("fs");
var path = require("path");

var { resource } = require("./deps/lively.resources.js");
var semver = require("./deps/semver.min.js");

/*

lively.lang.fun.timeToRun(() => {
  let pm = PackageMap.build(["/Users/robert/Lively/lively-dev2/lively.next-node_modules"])
  pm.lookup("lively.morphic")
}, 100);

let dir = System.resource(System.baseURL).join("lively.next-node_modules/")
let pmap = AsyncPackageMap.build([dir]); await pmap.whenReady()

let dir = "/Users/robert/Lively/lively-dev2/lively.next-node_modules/"
let pmap = PackageMap.build([dir]);

let json = pmap.allPackages().reduce((map, spec) => {
  let {name,version} = spec;
  map[name + "@" + version] = spec;
  return map
}, {});


lively.lang.num.humanReadableByteSize(JSON.stringify(json).length)

await fs_dirList(pmap.lookup("react").location)
fs_dirList(pmap.lookup("react").location)

*/

function isAbsolute(path) {
  return path.startsWith("/") || path.match(/^[a-z\.-_\+]+:/i)
}

function ensureResource(x) {
  return x.isResource ? x : resource(x);
}

function parentDir(p) {
  if (p.isResource) return p.parent();
  return path.basename(p);
}

function equalLocation(a, b) {
  if (a.isResource) return a.equals(b);
  return a == b;
}

function join(a, b) {
  if (a.isResource) return a.join(b);
  return path.join(a, b);
}

function normalizePath(p) {
  if (p.isResource) return p.withRelativePartsResolved()
  return path.normalize(p);
}

function fs_isDirectory(location) {
  if (location.isResource) return location.isDirectory();
  return fs.statSync(location).isDirectory();
}

function fs_exists(location) {
  if (location.isResource) return location.exists();
  return fs.existsSync(location);
}

function fs_read(location) {
  if (location.isResource) return location.read();
  return fs.readFileSync(location);
}

function fs_write(location, content) {
  if (location.isResource) return location.write(content);
  return fs.writeFileSync(location, content);
}

function fs_readJson(location) {
  if (location.isResource) return location.exists().then(exists => exists ? location.readJson() : null);
  return fs.existsSync(location) ? JSON.parse(String(fs_read(location))) : null;
}

function fs_writeJson(location, jso) {
  if (location.isResource) return location.writeJson(jso);
  return fs_write(location, JSON.stringify(jso));
}

function fs_dirList(location) {
  if (location.isResource) return location.dirList(1);
  return fs.readdirSync(location).map(ea => join(location, ea));
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

class PackageMap {

  static empty() { return new this(); }

  static get cache() { return this._cache || (this._cache = {}); }

  static keyFor(packageCollectionDirs, individualPackageDirs, devPackageDirs) {
    return `all: ${packageCollectionDirs} ea: ${individualPackageDirs} dev: ${devPackageDirs}`
  }

  static ensure(packageCollectionDirs, individualPackageDirs, devPackageDirs) {
    let key = this.keyFor(packageCollectionDirs, individualPackageDirs, devPackageDirs);
    return this.cache[key] || (this.cache[key] = this.build(
      packageCollectionDirs, individualPackageDirs, devPackageDirs));
  }

  static build(packageCollectionDirs, individualPackageDirs, devPackageDirs) {
    let map = new this();
    map.buildDependencyMap(
      packageCollectionDirs,
      individualPackageDirs,
      devPackageDirs);
    return map;
  }

  constructor() {
    this.dependencyMap = {};
    this.byPackageNames = {};
    this.key = "";
    this.devPackageDirs = [];
    this.individualPackageDirs = [];
    this.packageCollectionDirs = [];
    this._readyPromise = null;
  }

  whenReady() { return this._readyPromise || Promise.resolve(); }

  isReady() { return !this._readyPromise; }

  withPackagesDo(doFn) {
    let result = [];
    for (let key in this.dependencyMap)
      result.push(doFn(key, this.dependencyMap[key]))
    return result;
  }

  findPackage(matchFn) {
    for (let key in this.dependencyMap) {
      let pkg = this.dependencyMap[key]
      if (matchFn(key, pkg)) return pkg
    }
    return null;
  }

  allPackages() {
    let pkgs = [];
    for (let key in this.dependencyMap)
      pkgs.push(this.dependencyMap[key]);
    return pkgs;
  }

  coversDirectory(dir) {
    let { packageCollectionDirs, devPackageDirs, individualPackageDirs } = this;

    if (individualPackageDirs.some(ea => equalLocation(ea, dir))) return "individualPackageDirs";
    if (devPackageDirs.some(ea => equalLocation(ea, dir))) return "devPackageDirs";
    let parent = parentDir(dir);
    if (packageCollectionDirs.some(ea => equalLocation(ea, parent))) {
      return this.allPackages().find(pkg => equalLocation(pkg.location, parent)) ?
        "packageCollectionDirs" : "maybe packageCollectionDirs";
    }
    return null;
  }

  addPackage(packageSpec, isDev = false) {
    // returns false if package already installed, true otherwise

    let self = this;
    if (typeof packageSpec === "string")
      packageSpec = PackageSpec.fromDir(packageSpec);

    return packageSpec instanceof Promise ?
      packageSpec.then(resolvedPackageSpec => {
        packageSpec = resolvedPackageSpec;
        return isPackageSpecIncluded();
      }) : isPackageSpecIncluded();

    function isPackageSpecIncluded() {
      let { location, name, version } = packageSpec,
        { packageCollectionDirs, devPackageDirs, individualPackageDirs } = self,
        isCovered = self.coversDirectory(location);

      if (["devPackageDirs", "individualPackageDirs", "packageCollectionDirs"].includes(isCovered))
        return false;
      if (isDev) devPackageDirs = devPackageDirs.concat(location);
      else individualPackageDirs = individualPackageDirs.concat(location);

      // FIXME key changes....
      let build = self.buildDependencyMap(
        packageCollectionDirs,
        individualPackageDirs,
        devPackageDirs);
      return build instanceof Promise ? build.then(() => true) : true;
    }
  }

  buildDependencyMap(packageCollectionDirs, individualPackageDirs = [], devPackageDirs = []) {
    // looks up all the packages in can find in packageDirs and creates
    // packageSpecs for them.  If a package specifies more flatn_package_dirs in its
    // config then repeat the process until no more new package dirs are found.
    // Finally, combine all the packages found into a single map, like
    // {package-name@version: packageSpec, ...}.
    //
    // Merging of the results of the different package dirs happens so that dirs
    // specified first take precedence. I.e. if a dependency foo@1 is found via
    // packageDirs and then another package specifies a dir that leads to the
    // discovery of another foo@1, the first one ends up in tha packageDir

    let key = this.constructor.keyFor(
      packageCollectionDirs,
      individualPackageDirs,
      devPackageDirs
    );

    let pkgMap = {},
      byPackageNames = {},
      seen = { packageDirs: {}, collectionDirs: {} };

    // 1. find all the packages in collection dirs and separate package dirs;
    for (let p of this._discoverPackagesInCollectionDirs(packageCollectionDirs, seen)) {
      let { name, version } = p;
      pkgMap[`${name}@${version}`] = p;
      (byPackageNames[name] || (byPackageNames[name] = [])).push(`${name}@${version}`);
    }

    for (let dir of individualPackageDirs)
      for (let p of this._discoverPackagesInPackageDir(dir, seen)) {
        let { name, version } = p;
        pkgMap[`${name}@${version}`] = p;
        (byPackageNames[name] || (byPackageNames[name] = [])).push(`${name}@${version}`);
      }

    // 2. read dev packages, those shadow all normal dependencies with the same package name;

    for (let dir of devPackageDirs)
      for (let p of this._discoverPackagesInPackageDir(dir, seen)) {
        let { name, version } = p;
        pkgMap[`${name}`] = p;
        p.isDevPackage = true;
        let versionsOfPackage = byPackageNames[name] || (byPackageNames[name] = []);
        if (versionsOfPackage) for (let key of versionsOfPackage) delete pkgMap[key];
        versionsOfPackage.push(name);
      }

    this.dependencyMap = pkgMap;
    this.byPackageNames = byPackageNames;
    this.packageCollectionDirs = packageCollectionDirs;
    this.individualPackageDirs = individualPackageDirs;
    this.devPackageDirs = devPackageDirs;
    this.key = key;

    return this;
  }


  lookup(name, versionRange) {
    // Query the package map if it has a package name@version
    // Compatibility is either a semver match or if package comes from a git
    // repo then if the git commit matches.  Additionally dev packages are
    // supported.  If a dev package with `name` is found it always matches

    let gitSpec = gitSpecFromVersion(versionRange || "");
    if (!gitSpec && versionRange) {
      try {
        // parse stuff like "3001.0001.0000-dev-harmony-fb" into "3001.1.0-dev-harmony-fb"
        versionRange = new semver.Range(versionRange, true).toString();
      } catch (err) { }
    }
    return this.findPackage((key, pkg) => pkg.matches(name, versionRange, gitSpec));
  }

  _discoverPackagesInCollectionDirs(
    packageCollectionDirs,
    seen = { packageDirs: {}, collectionDirs: {} }
  ) {
    // package collection dir structure is like
    // packages
    // |-package-1
    // | |-0.1.0
    // | | \-package.json
    // | \-0.1.1
    // |   \-package.json
    // |-package-2
    // ...

    let found = [];
    for (let dir of packageCollectionDirs) {
      if (!fs_exists(dir)) continue;
      for (let packageDir of fs_dirList(dir)) {
        if (!fs_isDirectory(packageDir)) continue;
        for (let versionDir of fs_dirList(packageDir))
          found.push(...this._discoverPackagesInPackageDir(versionDir, seen));
      }
    }
    return found;
  }

  _discoverPackagesInPackageDir(
    packageDir,
    seen = { packageDirs: {}, collectionDirs: {} }
  ) {
    let spec = fs_exists(packageDir) && PackageSpec.fromDir(packageDir);
    if (!spec) return [];

    let found = [spec],
      { location, flatn_package_dirs } = spec;

    if (flatn_package_dirs) {
      for (let dir of flatn_package_dirs) {
        if (!isAbsolute(dir)) dir = normalizePath(join(location, dir));
        if (seen.collectionDirs[dir]) continue;
        console.log(`[flatn] project ${location} specifies package dir ${dir}`);
        seen.collectionDirs[dir] = true;
        found.push(...this._discoverPackagesInCollectionDirs([dir], seen));
      }
    }

    return found;
  }

}



class AsyncPackageMap extends PackageMap {

  whenReady() { return this._readyPromise || Promise.resolve(); }

  isReady() { return !this._readyPromise; }

  async buildDependencyMap(
    packageCollectionDirs,
    individualPackageDirs = [],
    devPackageDirs = []
  ) {
    // looks up all the packages in can find in packageDirs and creates
    // packageSpecs for them.  If a package specifies more flatn_package_dirs in its
    // config then repeat the process until no more new package dirs are found.
    // Finally, combine all the packages found into a single map, like
    // {package-name@version: packageSpec, ...}.
    //
    // Merging of the results of the different package dirs happens so that dirs
    // specified first take precedence. I.e. if a dependency foo@1 is found via
    // packageDirs and then another package specifies a dir that leads to the
    // discovery of another foo@1, the first one ends up in tha packageDir

    if (!this.isReady()) {
      return this.whenReady().then(() =>
        this.buildDependencyMap(
          packageCollectionDirs,
          individualPackageDirs,
          devPackageDirs));
    }

    let resolve, reject;
    this._readyPromise = new Promise((_resolve, _reject) => {
      resolve = _resolve; reject = _reject;
    });

    try {

      let key = this.constructor.keyFor(
        packageCollectionDirs,
        individualPackageDirs,
        devPackageDirs
      );

      let pkgMap = {},
        byPackageNames = {},
        seen = { packageDirs: {}, collectionDirs: {} };

      // 1. find all the packages in collection dirs and separate package dirs;
      for (let p of await this._discoverPackagesInCollectionDirs(packageCollectionDirs, seen)) {
        let { name, version } = p;
        pkgMap[`${name}@${version}`] = p;
        (byPackageNames[name] || (byPackageNames[name] = [])).push(`${name}@${version}`);
      }

      for (let dir of individualPackageDirs)
        for (let p of await this._discoverPackagesInPackageDir(dir, seen)) {
          let { name, version } = p;
          pkgMap[`${name}@${version}`] = p;
          (byPackageNames[name] || (byPackageNames[name] = [])).push(`${name}@${version}`);
        }

      // 2. read dev packages, those shadow all normal dependencies with the same package name;

      for (let dir of devPackageDirs)
        for (let p of await this._discoverPackagesInPackageDir(dir, seen)) {
          let { name, version } = p;
          pkgMap[`${name}`] = p;
          p.isDevPackage = true;
          let versionsOfPackage = byPackageNames[name] || (byPackageNames[name] = []);
          if (versionsOfPackage) for (let key of versionsOfPackage) delete pkgMap[key];
          versionsOfPackage.push(name);
        }

      this.dependencyMap = pkgMap;
      this.byPackageNames = byPackageNames;
      this.packageCollectionDirs = packageCollectionDirs;
      this.individualPackageDirs = individualPackageDirs;
      this.devPackageDirs = devPackageDirs;
      this.key = key;

      resolve();
    }
    catch (err) { reject(err); }
    finally { this._readyPromise = null; }

    return this;
  }

  async _discoverPackagesInCollectionDirs(
    packageCollectionDirs,
    seen = { packageDirs: {}, collectionDirs: {} }
  ) {
    let found = [];
    for (let dir of packageCollectionDirs) {
      if (!await dir.exists()) continue;
      for (let packageDir of await dir.dirList()) {
        if (!packageDir.isDirectory()) continue;
        for (let versionDir of await packageDir.dirList())
          found.push(...await this._discoverPackagesInPackageDir(versionDir, seen));
      }
    }
    return found;
  }

  async _discoverPackagesInPackageDir(
    packageDir,
    seen = { packageDirs: {}, collectionDirs: {} }
  ) {
    let spec = await packageDir.exists() && await PackageSpec.fromDir(packageDir);
    if (!spec) return [];
    let found = [spec],
      { location, flatn_package_dirs } = spec;

    location = ensureResource(location);

    if (flatn_package_dirs) {
      for (let dir of flatn_package_dirs) {
        if (isAbsolute(dir)) dir = ensureResource(dir);
        else dir = join(location, dir).withRelativePartsResolved();
        if (seen.collectionDirs[dir.url]) continue;
        console.log(`[flatn] project ${location.url} specifies package dir ${dir.url}`);
        seen.collectionDirs[dir.url] = true;
        found.push(...await this._discoverPackagesInCollectionDirs([dir], seen));
      }
    }

    return found;
  }

}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// PackageSpec => package representation for dependency resolution and build


var lvInfoFileName = ".lv-npm-helper-info.json";

class PackageSpec {

  static fromDir(packageDir) {
    let spec = new this(packageDir),
      read = spec.read();
    return read instanceof Promise
      ? read.then(read => (read ? spec : null))
      : read ? spec : null;
  }

  constructor(location) {
    this.location = location;
    this.isDevPackage = false;

    // from config
    this.scripts = null;
    this.bin = null;
    this.flatn_package_dirs = null;
    this.name = "";
    this.version = "";
    this.dependencies = {};
    this.devDependencies = {};

    // from git spec
    this.branch = null;
    this.gitURL = null;
    this.versionInFileName = null; // @https___github.com_foo_bar#zork
  }

  matches(pName, versionRange, gitSpec) {
    // does this package spec match the package pName@versionRange?
    let { name, version, isDevPackage } = this;

    if (name !== pName) return false;

    if (!versionRange || isDevPackage) return true;

    if (gitSpec && (gitSpec.versionInFileName === version
      || this.versionInFileName === gitSpec.versionInFileName)) {
      return true
    }

    if (semver.parse(version || "", true) && semver.satisfies(version, versionRange, true))
      return true;

    return false;
  }

  read() {
    let self = this,
      packageDir = this.location,
      configFile = join(packageDir, "package.json");

    if (!fs_isDirectory(packageDir)) return false;

    let hasConfig = fs_exists(configFile);

    return hasConfig instanceof Promise ? hasConfig.then(step2) : step2(hasConfig);

    function step2(hasConfig) {
      if (!hasConfig) return false;
      let config = fs_readJson(configFile);
      return config instanceof Promise ? config.then(step3) : step3(config);
    }

    function step3(config) {
      let {
        name, version, bin, scripts,
        dependencies, devDependencies,
        flatn_package_dirs
      } = config;

      if (bin) {
        // npm allows bin to just be a string, it is then mapped to the package name
        bin = typeof bin === "string" ? { [name]: bin } : Object.assign({}, bin);
      }

      Object.assign(self, {
        location: packageDir,
        name, version, bin, scripts,
        dependencies, devDependencies,
        flatn_package_dirs
      });

      let info = self.readLvInfo();
      return info instanceof Promise ? info.then(step4) : step4(info);
    }

    function step4(info) {
      if (info) {
        let { branch, gitURL, versionInFileName } = info;
        Object.assign(self, { branch, gitURL, versionInFileName });
      }
      return true;
    }
  }

  readConfig() {
    const config = fs_readJson(join(this.location, "package.json"));
    return config instanceof Promise ?
      config.then(ensureConfig) : ensureConfig(config);
    function ensureConfig(config) {
      if (config) return config;
      const { name, version } = this;
      return { name, version };
    }
  }

  readLvInfo() {
    let infoF = join(this.location, lvInfoFileName);
    try {
      let read = fs_readJson(infoF);
      return read instanceof Promise ?
        read.catch(err => null) : read;
    } catch (err) { }
    return null;
  }

  writeLvInfo(spec) {
    return fs_writeJson(join(this.location, lvInfoFileName), spec);
  }

  changeLvInfo(changeFn) {
    let read = this.readLvInfo();
    return read instanceof Promise ?
      read.then(read => this.writeLvInfo(changeFn(read))) :
      this.writeLvInfo(changeFn(read));
  }

}


module.exports.PackageMap = PackageMap;
module.exports.AsyncPackageMap = AsyncPackageMap;
module.exports.PackageSpec = PackageSpec;
// <<< file:///Users/robert/Lively/lively-dev2/flatn/package-map.js

// >>> file:///Users/robert/Lively/lively-dev2/flatn/dependencies.js
var { graph } = require("./deps/lively.lang.min.js");

module.exports.buildStages = buildStages;
module.exports.depGraph = depGraph;
module.exports.graphvizDeps = graphvizDeps;

function buildStages(packageSpec, packageMap, dependencyFields) {
  let {name, version} = packageSpec,
      {deps, packages: packageDeps, resolvedVersions} = depGraph(packageSpec, packageMap);

  for (let dep in deps)
    for (let i = 0; i < deps[dep].length; i++)
      if (!deps[deps[dep][i]]) deps[dep][i] = resolvedVersions[deps[dep][i]];

  return lively.lang.graph.sortByReference(deps, `${name}@${version}`);
}

function depGraph(packageSpec, packageMap, dependencyFields = ["dependencies"]) {
  // console.log(lively.lang.string.indent(pNameAndVersion, " ", depth));
  // let packages = getInstalledPackages(centralPackageDir);

  let pNameAndVersion = `${packageSpec.name}@${packageSpec.version}`,
      queue = [pNameAndVersion],
      resolvedVersions = {},
      deps = {}, packages = {};

  while (queue.length) {
    let nameAndVersion = queue.shift();
    if (nameAndVersion in resolvedVersions) continue;
    
    let atIndex = nameAndVersion.lastIndexOf("@");
    if (atIndex === -1) atIndex = nameAndVersion.length;
    let name = nameAndVersion.slice(0, atIndex),
        version = nameAndVersion.slice(atIndex+1),
        pSpec = packageMap.lookup(name, version);
    if (!pSpec) throw new Error(`Cannot resolve package ${nameAndVersion}`);

    let resolvedNameAndVersion = `${pSpec.name}@${pSpec.version}`;

    resolvedVersions[nameAndVersion] = resolvedNameAndVersion;

    if (!packages[pSpec.name]) packages[pSpec.name] = [];
    if (!packages[pSpec.name].includes(resolvedNameAndVersion))
      packages[pSpec.name].push(resolvedNameAndVersion);

    if (!deps[resolvedNameAndVersion]) {
      let localDeps = Object.assign({},
          dependencyFields.reduce((map, key) =>
            Object.assign(map, pSpec[key]), {}));

      deps[resolvedNameAndVersion] = Object.keys(localDeps).map(name => {
        let fullName = name + "@" + localDeps[name];
        queue.push(fullName);
        return fullName;
      });
    }
  }

  return {deps, packages, resolvedVersions};
}

function graphvizDeps({deps, packages, resolvedVersions}) {
  let graph = `digraph {\n`
            + `compound=true;\n`
            + `node [shape=record fontsize=10 fontname="Verdana"];\n`;

  Object.keys(packages).forEach(pName => {
    graph += `subgraph "cluster_${pName}" {\n`
           + `style=filled;\ncolor=lightgrey;\n`
           + packages[pName].map(nameAndVersion => `"${nameAndVersion}";`).join("\n")
           + `\n}\n`;
  });

  graph += Object.keys(deps).map(nameAndVersion =>
              deps[nameAndVersion].map(depVersion =>
                `"${nameAndVersion}" -> "${resolvedVersions[depVersion]}";`).join("\n")).join("\n") + "\n"

  graph += "\n}\n";
  return graph;
}
// <<< file:///Users/robert/Lively/lively-dev2/flatn/dependencies.js

// >>> file:///Users/robert/Lively/lively-dev2/flatn/download.js
/*global require, module*/
var { join: j } = require("path");







var semver = require("./deps/semver.min.js");
var { resource } = require("./deps/lively.resources.js");

module.exports.packageDownload = packageDownload;


function maybeFileResource(url) {
  if (typeof url === "string" && url.startsWith("/"))
    url = "file://" + url;
  return url.isResource ? url : resource(url);
}

function pathForNameAndVersion(name, version, destinationDir) {
  // pathForNameAndVersion("foo-bar", "1.2.3", "file:///x/y")
  // pathForNameAndVersion("foo-bar", "foo/bar", "file:///x/y")
  // pathForNameAndVersion("foo-bar", "git+https://github.com/foo/bar#master", "file:///x/y")

  let gitSpec = gitSpecFromVersion(version);

  // "git clone -b my-branch git@github.com:user/myproject.git"
  return gitSpec ?
    Object.assign({}, gitSpec, { location: null, name, version: gitSpec.gitURL }) :
    { location: null, name, version };
}


async function packageDownload(name, range, destinationDir, verbose, attempt = 0) {
  // packageNameAndRange like "lively.modules@^0.7.45"
  // if no @ part than we assume @*

  try {

    destinationDir = maybeFileResource(destinationDir);

    if (!range) {
      // any version
      range = "*";
    }

    // download package to tmp location
    let tmp = resource("file://" + tmpdir()).join("package_install_tmp/");
    await tmp.ensureExistance();

    let pathSpec = pathForNameAndVersion(name, range, destinationDir.path()),
      downloadDir = pathSpec.gitURL
        ? await packageDownloadViaGit(pathSpec, tmp, verbose)
        : await packageDownloadViaNpm(name, range, tmp, verbose);


    let packageJSON = downloadDir.join("package.json"), config;
    if (!await packageJSON.exists())
      throw new Error(`Downloaded package ${name}@${range} does not have a package.json file at ${packageJSON}`);

    config = await packageJSON.readJson();
    let packageDir;
    if (pathSpec.gitURL) {
      let dirName = config.name.replace(/\//g, "__SLASH__") + "/" + pathSpec.versionInFileName;
      packageDir = maybeFileResource(destinationDir).join(dirName).asDirectory();
    } else {
      let dirName = config.name.replace(/\//g, "__SLASH__") + "/" + config.version;
      packageDir = destinationDir.join(dirName).asDirectory();
      pathSpec = Object.assign({}, pathSpec, { location: packageDir });
    }

    await addNpmSpecificConfigAdditions(
      packageJSON, config, name, range, pathSpec.gitURL);

    await packageDir.parent().ensureExistance();
    await x(`mv ${downloadDir.asFile().path()} ${packageDir.asFile().path()}`);

    let packageSpec = PackageSpec.fromDir(packageDir.path());
    packageSpec.writeLvInfo(Object.assign({ build: false }, pathSpec));

    return packageSpec;

  } catch (err) {
    if (attempt >= 3) {
      console.error(`Download of ${name}@${range} failed:`, err.stack);
      throw err;
    }
    console.log(`[flatn] retrying download of ${name}@${range}`);
    return packageDownload(name, range, destinationDir, verbose, attempt + 1);
  }
}


async function packageDownloadViaGit({ gitURL: url, name, branch }, targetDir, verbose) {
  // packageNameAndRepo like "lively.modules@https://github.com/LivelyKernel/lively.modules"
  branch = branch || "master"
  url = url.replace(/#[^#]+$/, "");
  let dir = targetDir.join(name).asDirectory()
  await gitClone(url, dir, branch);
  return dir;
}

async function packageDownloadViaNpm(nameRaw, range, targetDir, verbose) {
  // packageNameAndRange like "lively.modules@^0.7.45"
  // if no @ part than we assume @*
  let {
    downloadedArchive,
    name, version
  } = await npmDownloadArchive(nameRaw, range, targetDir, verbose);
  return untar(downloadedArchive, targetDir, name);
}

function addNpmSpecificConfigAdditions(configFile, config, name, version, gitURL) {
  // npm adds some magic "_" properties to the package.json. There is no
  // specification of it and the official stance is that it is npm internal but
  // some packages depend on that. In order to allow npm scripts like install to
  // work smoothly we add a subset of those props here.
  let _id = gitURL ?
    `${name}@${version}` :
    `${config.name}@${config.version}`,
    _from = gitURL ?
      `${config.name}@${gitURL}` :
      `${config.name}@${semver.validRange(version)}`;
  return configFile.writeJson(Object.assign({ _id, _from }, config), true);
}
// <<< file:///Users/robert/Lively/lively-dev2/flatn/download.js

// >>> file:///Users/robert/Lively/lively-dev2/flatn/build.js
/*global System,process,global,require,module,__dirname*/
var { join: j } = require("path");
var fs = require("fs");

var { execSync } = require("child_process");




var dir = typeof __dirname !== "undefined"
  ? __dirname
  : System.decanonicalize("flatn/").replace("file://", ""),
  helperBinDir = j(dir, "bin"),
  nodeCentralPackageBin = j(helperBinDir, "node");

var _npmEnv;
function npmEnv() {
  return _npmEnv || (_npmEnv = (() => {
    let cacheFile = j(tmpdir(), "npm-env.json"), env = {};
    if (fs.existsSync(cacheFile)) {
      let cached = JSON.parse(String(fs.readFileSync(cacheFile)))
      if (Date.now() - cached.time < 1000 * 60) return cached.env;
    }
    try {
      var dir = j(tmpdir(), "npm-test-env-project");
      if (!fs.existsSync(dir)) fs.mkdirSync(dir);
      fs.writeFileSync(j(dir, "package.json"), `{"scripts": {"print-env": "${process.env.npm_node_execpath || "node"} ./print-env.js"}}`);
      fs.writeFileSync(j(dir, "print-env.js"), `console.log(JSON.stringify(process.env))`);
      let PATH = process.env.PATH.split(":").filter(ea => ea !== helperBinDir).join(":")
      Object.keys(process.env).forEach(ea => {
        if (ea.toLowerCase().startsWith("npm_config_"))
          env[ea] = process.env[ea];
      });
      env = Object.assign({},
        JSON.parse(String(execSync(`npm --silent run print-env`, { cwd: dir, env: Object.assign({}, process.env, { PATH }) }))),
        env);
      for (let key in env)
        if (!key.toLowerCase().startsWith("npm") || key.toLowerCase().startsWith("npm_package"))
          delete env[key];
    } catch (err) {
      console.warn(`Cannot figure out real npm env, ${err}`);
      env = {};
    } finally {
      try {
        if (fs.existsSync(j(dir, "package.json")))
          fs.unlinkSync(j(dir, "package.json"));
        fs.unlinkSync(j(dir, "print-env.js"));
        fs.rmdirSync(dir);
      } catch (err) { }
    }
    fs.writeFileSync(cacheFile, JSON.stringify({ time: Date.now(), env }));
    return env;
  })());
}

function npmCreateEnvVars(configObj, env = {}, path = "npm_package") {
  if (Array.isArray(configObj))
    configObj.forEach((ea, i) => add(i, configObj[i]));
  else
    Object.keys(configObj).forEach(name => add(name, configObj[name]));
  return env;

  function add(key, val) {
    key = String(key).replace(/[-\.]/g, "_");
    if (typeof val === "object") npmCreateEnvVars(val, env, path + "_" + key);
    else env[path + "_" + key] = String(val);
  }

  return env;
}

function linkBins(packageSpecs, linkState = {}, verbose = false) {
  let linkLocation = j(tmpdir(), "npm-helper-bin-dir");
  if (!fs.existsSync(linkLocation)) fs.mkdirSync(linkLocation);
  packageSpecs.forEach(({ bin, location }) => {
    if (location.startsWith("file://"))
      location = location.replace(/^file:\/\//, "")
    if (!bin) return;
    if (linkState[location]) return;
    for (let linkName in bin) {
      let realFile = bin[linkName];
      try {
        // fs.existsSync follows links, so broken links won't be reported as existing
        fs.lstatSync(j(linkLocation, linkName));
        fs.unlinkSync(j(linkLocation, linkName));
      } catch (err) { }
      verbose && console.log(`[flatn build] linking ${j(location, realFile)} => ${j(linkLocation, linkName)}`)
      fs.symlinkSync(j(location, realFile), j(linkLocation, linkName));
    }
    linkState[location] = true;
  });
  return linkLocation;
}

class BuildProcess {

  static for(packageSpec, packageMap, dependencyFields, forceBuild = false) {
    let stages = buildStages(packageSpec, packageMap, dependencyFields);
    return new this(stages, packageMap, forceBuild);
  }

  constructor(buildStages, packageMap, forceBuild, verbose = false) {
    this.buildStages = buildStages; // 2d list, package specs in sorted order
    this.packageMap = packageMap;
    this.builtPackages = [];
    this.binLinkState = {};
    this.binLinkLocation = "";
    this.forceBuild = forceBuild;
    this.verbose = verbose;
  }

  async run() {

    // let {buildStages, packageMap} = build
    let { buildStages, packageMap } = this,
      i = 1, n = buildStages.length;

    this.verbose && console.log(`[flatn] Running build stage ${i++}/${n}`)

    while (buildStages.length) {
      let stage = buildStages[0];
      if (!stage.length) {
        buildStages.shift();
        this.verbose && buildStages.length && console.log(`[flatn] Running build stage ${i++}/${n}`);
        continue;
      }

      let next = stage[0],
        atIndex = next.lastIndexOf("@");
      if (atIndex === -1) atIndex = next.length;
      let name = next.slice(0, atIndex),
        version = next.slice(atIndex + 1),
        packageSpec = packageMap.lookup(name, version);
      if (!packageSpec) throw new Error(`[flatn build] package ${next} cannot be found in package map, skipping its build`);

      await this.build(packageSpec);
      stage.shift();
    }
  }

  normalizeScripts({ scripts, location }) {
    if (!scripts || !scripts.install) {
      let hasBindingGyp = fs.existsSync(j(location, "binding.gyp"));
      if (hasBindingGyp) {
        scripts = Object.assign({ install: "node-gyp rebuild" }, scripts)
      }
    }
    return scripts;
  }

  hasBuiltScripts(scripts) {
    return scripts && Object.keys(scripts).some(scriptName =>
      ["prepare", "preinstall", "install", "postinstall"].includes(scriptName));
  }

  async build(packageSpec) {
    this.binLinkLocation = linkBins(
      this.builtPackages.concat([packageSpec]),
      this.binLinkState,
      this.verbose);

    let env = npmCreateEnvVars(await packageSpec.readConfig());
    let needsBuilt =
      this.forceBuild || packageSpec.isDevPackage || !(packageSpec.readLvInfo() || {}).build;

    if (needsBuilt) {
      let scripts = this.normalizeScripts(packageSpec);
      if (this.hasBuiltScripts(scripts)) {
        console.log(`[flatn] ${packageSpec.name} build starting`);
        await this.runScript(scripts, "preinstall", packageSpec, env);
        await this.runScript(scripts, "install", packageSpec, env);
        await this.runScript(scripts, "postinstall", packageSpec, env);
        await packageSpec.changeLvInfo(info => Object.assign({}, info, { build: true }));
        console.log(`[flatn] ${packageSpec.name} build done`);
      }
    }

    this.builtPackages.push(packageSpec);
  }

  async runScript(scripts, scriptName, { name, location }, env) {
    if (!scripts || !scripts[scriptName]) return false;
    this.verbose && console.log(`[flatn] build ${name}: running ${scriptName}`);

    let pathParts = process.env.PATH.split(":");
    pathParts.unshift(helperBinDir);
    pathParts.unshift(this.binLinkLocation);

    env = Object.assign({},
      process.env,
      npmFallbackEnv,
      npmEnv(),
      env,
      {
        npm_lifecycle_event: scriptName,
        npm_lifecycle_script: scripts[scriptName].split(" ")[0],
        PATH: pathParts.join(":")
      });

    try {
      return await x(`/bin/sh -c '${scripts[scriptName]}'`, {
        verbose: true,
        cwd: location.replace(/^file:\/\//, ""),
        env
      });

    } catch (err) {
      console.error(`[build ${name}] error running ${scripts[scriptName]}:\n${err}`);
      if (err.stdout || err.stderr) {
        console.log("The command output:");
        console.log(err.stdout);
        console.log(err.stderr);
      }
      throw err;
    }
  }

}

module.exports.BuildProcess = BuildProcess;
// <<< file:///Users/robert/Lively/lively-dev2/flatn/build.js

// >>> file:///Users/robert/Lively/lively-dev2/flatn/index.js
/*global require, module,process*/





var { basename } = require("path");
var { dirname } = require("path");
var { isAbsolute } = require("path");
var { normalize: normPath } = require("path");
var { join: j } = require("path");
var fs = require("fs");
var { inspect } = require("util");

var semver = require("./deps/semver.min.js");

// FIXME for resources
var node_fetch = require("./deps/node-fetch.js");
if (!global.fetch) {
  Object.assign(
    global,
    { fetch: node_fetch.default },
    ["Response", "Headers", "Request"].reduce((all, name) =>
      Object.assign(all, node_fetch[name]), {}));
}

var debug = false;

module.exports.installDependenciesOfPackage = installDependenciesOfPackage;
module.exports.addDependencyToPackage = addDependencyToPackage;
module.exports.installPackage = installPackage;
module.exports.buildPackage = buildPackage;
module.exports.buildPackageMap = buildPackageMap;
module.exports.ensurePackageMap = ensurePackageMap;
module.exports.setPackageDirsOfEnv = setPackageDirsOfEnv;
module.exports.packageDirsFromEnv = packageDirsFromEnv;

function ensurePathFormat(dirOrArray) {
  // for flatn pure we expect directories to be specified in normal file system
  // form like /home/foo/bar/, not as lively.resources or as URL file://...
  // This ensures that...
  if (Array.isArray(dirOrArray)) return dirOrArray.map(ensurePathFormat);
  if (dirOrArray.isResource) return dirOrArray.path()
  if (dirOrArray.startsWith("file://")) dirOrArray = dirOrArray.replace("file://", "");
  return dirOrArray;
}

function buildPackageMap(packageCollectionDirs, individualPackageDirs, devPackageDirs) {
  if (packageCollectionDirs) packageCollectionDirs = ensurePathFormat(packageCollectionDirs);
  if (individualPackageDirs) individualPackageDirs = ensurePathFormat(individualPackageDirs);
  if (devPackageDirs) devPackageDirs = ensurePathFormat(devPackageDirs);
  return PackageMap.build(packageCollectionDirs, individualPackageDirs, devPackageDirs);
}

function ensurePackageMap(packageCollectionDirs, individualPackageDirs, devPackageDirs) {
  if (packageCollectionDirs) packageCollectionDirs = ensurePathFormat(packageCollectionDirs);
  if (individualPackageDirs) individualPackageDirs = ensurePathFormat(individualPackageDirs);
  if (devPackageDirs) devPackageDirs = ensurePathFormat(devPackageDirs);
  return PackageMap.ensure(packageCollectionDirs, individualPackageDirs, devPackageDirs);
}

function packageDirsFromEnv() {
  let env = process.env;
  return {
    packageCollectionDirs: (env.FLATN_PACKAGE_COLLECTION_DIRS || "").split(":").filter(Boolean),
    individualPackageDirs: (env.FLATN_PACKAGE_DIRS || "").split(":").filter(Boolean),
    devPackageDirs: (env.FLATN_DEV_PACKAGE_DIRS || "").split(":").filter(Boolean)
  }
}

function setPackageDirsOfEnv(packageCollectionDirs, individualPackageDirs, devPackageDirs) {
  packageCollectionDirs = ensurePathFormat(packageCollectionDirs);
  individualPackageDirs = ensurePathFormat(individualPackageDirs);
  devPackageDirs = ensurePathFormat(devPackageDirs);
  process.env.FLATN_PACKAGE_COLLECTION_DIRS = packageCollectionDirs.join(":");
  process.env.FLATN_PACKAGE_DIRS = individualPackageDirs.join(":");
  process.env.FLATN_DEV_PACKAGE_DIRS = devPackageDirs.join(":");
}


async function buildPackage(
  packageSpecOrDir,
  packageMapOrDirs,
  dependencyFields = ["dependencies"],
  verbose = false,
  forceBuild = false
) {
  if (typeof packageSpecOrDir === "string" || packageSpecOrDir.isResource)
    packageSpecOrDir = ensurePathFormat(packageSpecOrDir);
  if (Array.isArray(packageMapOrDirs))
    packageMapOrDirs = ensurePathFormat(packageMapOrDirs);

  let packageSpec = typeof packageSpecOrDir === "string"
    ? PackageSpec.fromDir(packageSpecOrDir)
    : packageSpecOrDir,
    packageMap = Array.isArray(packageMapOrDirs)
      ? buildPackageMap(packageMapOrDirs)
      : packageMapOrDirs,
    { name, version } = packageSpec;
  return await BuildProcess.for(packageSpec, packageMap, dependencyFields, forceBuild).run();
}


async function installPackage(
  pNameAndVersion,
  destinationDir,
  packageMap,
  dependencyFields,
  isDev = false,
  verbose = false
) {

  // will lookup or install a package matching pNameAndVersion.  Will
  // recursively install dependencies

  if (!packageMap) console.warn(`[flatn] install of ${pNameAndVersion}: No package map specified, using empty package map.`);
  if (!packageMap) packageMap = PackageMap.empty();

  if (!dependencyFields) dependencyFields = ["dependencies"];

  destinationDir = ensurePathFormat(destinationDir);

  if (!fs.existsSync(destinationDir))
    fs.mkdirSync(destinationDir);

  let atIndex = pNameAndVersion.lastIndexOf("@");
  if (atIndex === -1) atIndex = pNameAndVersion.length;
  let name = pNameAndVersion.slice(0, atIndex),
    version = pNameAndVersion.slice(atIndex + 1),
    queue = [[name, version]],
    seen = {},
    newPackages = [],
    installedNew = 0;

  while (queue.length) {
    let [name, version] = queue.shift(),
      installed = packageMap.lookup(name, version);

    if (!installed) {
      (verbose || debug) && console.log(`[flatn] installing package ${name}@${version}`);
      installed = await packageDownload(name, version, destinationDir, verbose);
      if (!installed)
        throw new Error(`Could not download package ${name + "@" + version}`);

      packageMap.addPackage(installed, isDev);

      newPackages.push(installed);
    } else {
      (verbose || debug) && console.log(`[flatn] ${name}@${version} already installed in ${installed.location}`);
    }

    if (!installed) throw new Error(`cannot install package ${name}@${version}!`);


    let deps = Object.assign({},
      dependencyFields.reduce((map, key) =>
        Object.assign(map, installed[key]), {}));

    for (let name in deps) {
      let nameAndVersion = `${name}@${deps[name]}`;
      if (nameAndVersion in seen) continue;
      queue.push([name, deps[name]]);
      seen[nameAndVersion] = true;
    }
  }

  if (newPackages.length > 0)
    console.log(`[flatn] installed ${newPackages.length} new packages into ${destinationDir}`);

  return { packageMap, newPackages };
}


function addDependencyToPackage(
  packageSpecOrDir,
  depNameAndRange,
  packageDepDir,
  packageMap,
  dependencyField,
  save = true,
  verbose = false
) {

  if (typeof packageSpecOrDir === "string" || packageSpecOrDir.isResource)
    packageSpecOrDir = ensurePathFormat(packageSpecOrDir);

  packageDepDir = ensurePathFormat(packageDepDir);

  if (!dependencyField) dependencyField = "dependencies"; /*vs devDependencies etc.*/

  let packageSpec = typeof packageSpecOrDir === "string"
    ? PackageSpec.fromDir(packageSpecOrDir)
    : packageSpecOrDir;

  let { location } = packageSpec;

  if (!packageSpec[dependencyField]) packageSpec[dependencyField] = {};

  let atIndex = depNameAndRange.lastIndexOf("@");
  if (atIndex === -1) atIndex = depNameAndRange.length;
  let depName = depNameAndRange.slice(0, atIndex),
    depVersionRange = depNameAndRange.slice(atIndex + 1),
    depVersion = packageSpec[dependencyField][depName];

  return installPackage(
    depNameAndRange,
    packageDepDir,
    packageMap,
    [dependencyField]/*dependencyFields*/,
    false/*isDev*/,
    verbose
  ).then(result => {
    if (!save) return result;
    let dep = result.packageMap.lookup(depName, depVersionRange);
    if (!depVersionRange) depVersionRange = dep.version;
    let isRange = semver.validRange(depVersionRange, true);
    let isRealRange = !semver.parse(depVersionRange, true);
    if (!isRange) depVersionRange = "*";
    else if (!isRealRange) depVersionRange = "^" + depVersionRange;
    if (dep) {
      if (!depVersion || !semver.parse(depVersion, true) || !semver.satisfies(depVersion, depVersionRange, true)) {
        packageSpec[dependencyField][depName] = depVersionRange;
        let config = fs.existsSync(j(location, "package.json")) ?
          JSON.parse(String(fs.readFileSync(j(location, "package.json")))) :
          { name: depName, version: dep.version };
        if (!config[dependencyField]) config[dependencyField] = {}
        config[dependencyField][depName] = depVersionRange;
        fs.writeFileSync(j(location, "package.json"), JSON.stringify(config, null, 2));
      }
    }
    return result;
  });
}


async function installDependenciesOfPackage(
  packageSpecOrDir,
  dirToInstallDependenciesInto,
  packageMap,
  dependencyFields,
  verbose
) {
  // Given a package spec of an installed package (retrieved via
  // `PackageSpec.fromDir`), make sure all dependencies (specified in properties
  // `dependencyFields` of package.json) are installed
  if (typeof packageSpecOrDir === "string" || packageSpecOrDir.isResource)
    packageSpecOrDir = ensurePathFormat(packageSpecOrDir);

  if (dirToInstallDependenciesInto)
    dirToInstallDependenciesInto = ensurePathFormat(dirToInstallDependenciesInto);

  let packageSpec = typeof packageSpecOrDir === "string"
    ? PackageSpec.fromDir(packageSpecOrDir)
    : packageSpecOrDir;

  if (!packageSpec)
    throw new Error(`Cannot resolve package: ${inspect(packageSpec, { depth: 0 })}`);

  if (!dirToInstallDependenciesInto) dirToInstallDependenciesInto = dirname(packageSpec.location);
  if (!dependencyFields) dependencyFields = ["dependencies"];

  let deps = Object.assign({},
    dependencyFields.reduce((map, key) => Object.assign(map, packageSpec[key]), {})),
    depNameAndVersions = [],
    newPackages = [];

  for (let name in deps) {
    let newPackagesSoFar = newPackages;
    ({ packageMap, newPackages } = await installPackage(
      `${name}@${deps[name]}`,
      dirToInstallDependenciesInto,
      packageMap,
      ["dependencies"],
      false,
      verbose
    ));
    newPackages = newPackages.concat(newPackagesSoFar);
  }

  if ((verbose || debug) && !newPackages.length)
    console.log(`[flatn] no new packages need to be installed for ${packageSpec.name}`);

  return { packageMap, newPackages };
}
// <<< file:///Users/robert/Lively/lively-dev2/flatn/index.js
