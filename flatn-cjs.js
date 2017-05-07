// >>> file:///Users/robert/Lively/lively-dev2/flatn/util.js
/*global process, require, module*/

var { exec } = require("child_process");
var { join: j } = require("path");
var { tmpdir } = require("os");
var { resource } = require("./deps/lively.resources.js");

function maybeFileResource(url) {
  if (typeof url === "string" && url.startsWith("/"))
      url = "file://" + url;
  return url.isResource ? url : resource(url);
}

async function npmSearchForVersions(packageNameAndRange) {
  // let packageNameAndRange = "lively.lang@~0.4"
  try {
    let [pname, range = "*"] = packageNameAndRange.split("@"),
        {name, version} = await resource(`http://registry.npmjs.org/${pname}/${range}`).readJson()
    return {name, version};
  } catch (err) {
    console.error(err);
    throw new Error(`Cannot find npm package for ${packageNameAndRange}`);
  }
}

async function npmDownloadArchive(packageNameAndRange, destinationDir) {
  destinationDir = maybeFileResource(destinationDir);
  let {version, name} = await npmSearchForVersions(packageNameAndRange),
      archive=`${name}-${version}.tgz`,
      archiveURL = `https://registry.npmjs.org/${name}/-/${archive}`
  console.log(`[flatn] downloading archive from npm for ${packageNameAndRange}: ${archiveURL}`);
  let downloadedArchive = destinationDir.join(archive);
  await resource(archiveURL).beBinary().copyTo(downloadedArchive);
  return {downloadedArchive, name, version};
}


// let {downloadedArchive} = await npmDownloadArchive("lively.lang@^0.3", "local://lively.node-packages-test/test-download/")
// let z = await untar(downloadedArchive, resource("file:///Users/robert/temp/"))
// let z = await untar(downloadedArchive, resource("local://lively.node-packages-test/test-download/"))
// await z.dirList()
// https://registry.npmjs.org/lively.lang/-/lively.lang-0.3.5.tgz

async function untar(downloadedArchive, targetDir, name) {
  // FIXME use tar module???

  if (!name) name = downloadedArchive.name().replace(/(\.tar|\.tar.tgz|.tgz)$/, "");
  downloadedArchive = maybeFileResource(downloadedArchive);
  targetDir = maybeFileResource(targetDir);

  let untarDir = resource(`file://${tmpdir()}/npm-helper-untar/`);
  await untarDir.ensureExistance();
  if (!downloadedArchive.url.startsWith("file://")) { // need to run exec
    let tmpDir = untarDir.join(downloadedArchive.name());
    await downloadedArchive.copyTo(tmpDir);
    downloadedArchive = tmpDir;
  }

  if (untarDir.join(name).exists())
    await untarDir.join(name).remove();

  // console.log(`[${name}] extracting ${downloadedArchive.path()} => ${targetDir.join(name).asDirectory().url}`);

  await x(`mkdir "${name}" && `
        + `tar xzf "${downloadedArchive.path()}" --strip-components 1 -C "${name}" && `
        + `rm "${downloadedArchive.path()}"`, {cwd: untarDir.path()});

  await targetDir.join(name).asDirectory().remove();
  await targetDir.join(name).asDirectory().ensureExistance();
  return untarDir.join(name).asDirectory().rename(targetDir.join(name).asDirectory());
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
      await x(`git clone --single-branch -b "${branch}" "${gitURL}" "${name}"`, {cwd: destPath});
    } catch (err) {
      // specific shas can't be cloned, so do it manually:
      await x(`git clone "${gitURL}" "${name}" && cd ${name} && git reset --hard "${branch}" `, {cwd: destPath});
    }
  } catch (err) {
    throw new Error(`git clone of ${gitURL} branch ${branch} into ${destPath} failed:\n${err}`);
  }
  
  if (tmp) await tmp.join(name + "/").rename(intoDir);
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

function gitSpecFromVersion(version = "") {
  let gitMatch = version.match(/([^:]+):\/\/.*/),
      githubMatch = version.match(/([^\/]+)\/([^#]+).*/),
      gitRepoUrl = gitMatch ? version : githubMatch ? "https://github.com/" + version : null,
      [_, branch] = (gitRepoUrl && gitRepoUrl.match(/#([^#]*)$/) || []);
  if (gitRepoUrl && !branch) {
     branch = "master";
     gitRepoUrl += "#master";
  }
  return gitRepoUrl
    ? {branch, gitURL: gitRepoUrl, versionInFileName: gitRepoUrl.replace(/[:\/\+#]/g, "_")}
    : null;
}

module.exports.gitClone = gitClone;
module.exports.untar = untar;
module.exports.npmDownloadArchive = npmDownloadArchive;
module.exports.npmSearchForVersions = npmSearchForVersions;
module.exports.x = x;
module.exports.npmFallbackEnv = npmFallbackEnv;
module.exports.gitSpecFromVersion = gitSpecFromVersion;
// <<< file:///Users/robert/Lively/lively-dev2/flatn/util.js

// >>> file:///Users/robert/Lively/lively-dev2/flatn/package-spec.js
/*global require, module*/
var semver = require("./deps/semver.min.js");
var { basename } = require("path");
var { join: j } = require("path");
var fs = require("fs");

var lvInfoFileName = ".lv-npm-helper-info.json";

// PackageSpec.fromDir("/Users/robert/Lively/lively-dev2/lively.server")


class PackageSpec {

  static fromDir(packageDir) {
    let spec = new this(packageDir)
    return spec.read() ? spec : null;
  }

  constructor(location) {
    this.location = location;
    this.isDevPackage = false;
    this.config = {};

    this.hasBindingGyp = false;
    this.scripts = null;
    this.bin = null;

    this.branch = null;
    this.gitURL = null;
    this.versionInFileName = null;
  }

  get name() { return this.config.name || ""; }
  get version() { return this.config.version || ""; }

  read() {
    let packageDir = this.location;

    if (!fs.statSync(packageDir).isDirectory() || !fs.existsSync(j(packageDir, "package.json")))
      return false;

    let hasBindingGyp = fs.existsSync(j(packageDir, "binding.gyp")),
        config = JSON.parse(String(fs.readFileSync(j(packageDir, "package.json")))),
        scripts, bin;

    if (config.bin) {
      bin = typeof config.bin === "string"
        ? {[config.name]: config.bin}
        : Object.assign({}, config.bin);
    }

    if (config.scripts || hasBindingGyp) {
      scripts = Object.assign({}, config.scripts);
      if (hasBindingGyp && !scripts.install)
        scripts.install = "node-gyp rebuild";
    }

    Object.assign(this, {
      location: packageDir,
      hasBindingGyp,
      scripts,
      bin,
      config
    });

    let info = this.readLvInfo();
    if (info) {
      let {branch, gitURL, versionInFileName} = info;
      Object.assign(this, {branch, gitURL, versionInFileName});
    }
    return true;
  }

  readLvInfo() {
    try {
      let infoF = j(this.location, lvInfoFileName);
      if (fs.existsSync(infoF)) {
        return JSON.parse(String(fs.readFileSync(infoF)));
      }
    } catch (err) {}
    return null;
  }

  writeLvInfo(spec) {
    fs.writeFileSync(j(this.location, lvInfoFileName), JSON.stringify(spec));
  }

  changeLvInfo(changeFn) {
    this.writeLvInfo(changeFn(this.readLvInfo()));
  }

  matches(pName, versionRange, gitSpec) {
    // does this package spec match the package pName@versionRange?

    let {name, version, isDevPackage} = this;

    if (name !== pName) return false;

    if (!versionRange || isDevPackage) return true;

    if (gitSpec && (gitSpec.versionInFileName === version
      || this.versionInFileName === gitSpec.versionInFileName)) {
       return true
    }

    if (semver.parse(version || "") && semver.satisfies(version, versionRange))
      return true;

    return false;
  }

}

module.exports.PackageSpec = PackageSpec;
// <<< file:///Users/robert/Lively/lively-dev2/flatn/package-spec.js

// >>> file:///Users/robert/Lively/lively-dev2/flatn/package-map.js

var { basename } = require("path");
var { isAbsolute } = require("path");
var { normalize: normPath } = require("path");
var { join: j } = require("path");
var fs = require("fs");


/*
lively.lang.fun.timeToRun(() => {
  let pm = PackageMap.build(["/Users/robert/Lively/lively-dev2"])
  pm.lookup("lively.morphic")
}, 100);
*/

class PackageMap {

  static empty() { return new this(); }

  static keyFor(packageCollectionDirs, individualPackageDirs, devPackageDirs) {
    return `all: ${packageCollectionDirs} ea: ${individualPackageDirs} dev: ${devPackageDirs}`
  }

  static build(packageCollectionDirs, individualPackageDirs, devPackageDirs) {
    return new this().buildDependencyMap(
      packageCollectionDirs,
      individualPackageDirs,
      devPackageDirs);
  }

  constructor() {
    this.dependencyMap = {};
    this.byPackageNames = {};
    this.key = "";
    this.devPackageDirs = [];
    this.individualPackageDirs = [];
    this.packageCollectionDirs = [];
  }

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

  addPackage(packageSpec, isDev = false) {
    // returns false if package already installed, true otherwise

    let {location, name, version} = packageSpec,
        {packageCollectionDirs, devPackageDirs, individualPackageDirs} = this;

    if (individualPackageDirs.includes(location) || devPackageDirs.includes(location)) {
      return false;
    } else if (packageCollectionDirs.includes(basename(location))) {
      if (this.allPackages().find(pkg => pkg.location === location))
        return false;
    } else {
      if (isDev) devPackageDirs = devPackageDirs.concat(location);
      else individualPackageDirs = individualPackageDirs.concat(location);
    }

    // FIXME key changes....
    this.buildDependencyMap(packageCollectionDirs, individualPackageDirs, devPackageDirs);
    return true;
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
        seen = {packageDirs: {}, collectionDirs: {}};

    // 1. find all the packages in collection dirs and separate package dirs;
    for (let p of discoverPackagesInCollectionDirs(packageCollectionDirs, seen)) {
      let {name, version} = p;
      pkgMap[`${name}@${version}`] = p;
      (byPackageNames[name] || (byPackageNames[name] = [])).push(`${name}@${version}`);
    }

    for (let dir of individualPackageDirs)
      for (let p of discoverPackagesInPackageDir(dir, seen)) {
        let {name, version} = p;
        pkgMap[`${name}@${version}`] = p;
        (byPackageNames[name] || (byPackageNames[name] = [])).push(`${name}@${version}`);
      }

    // 2. read dev packages, those shadow all normal dependencies with the same package name;

    for (let dir of devPackageDirs)
      for (let p of discoverPackagesInPackageDir(dir, seen)) {
        let {name, version} = p;
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
    return this.findPackage((key, pkg) => pkg.matches(name, versionRange, gitSpec));
  }
}


function discoverPackagesInCollectionDirs(
  packageCollectionDirs,
  seen = {packageDirs: {}, collectionDirs: {}}
) {
  let found = [];
  for (let dir of packageCollectionDirs)
    if (fs.existsSync(dir))
      for (let packageDir of fs.readdirSync(dir))
        found.push(...discoverPackagesInPackageDir(j(dir, packageDir), seen));
  return found
}

function discoverPackagesInPackageDir(
  packageDir,
  seen = {packageDirs: {}, collectionDirs: {}}
) {
  let spec = fs.existsSync(packageDir) && PackageSpec.fromDir(packageDir);
  if (!spec) return [];

  let found = [spec],
      {location, config: {flatn_package_dirs}} = spec;

  if (flatn_package_dirs) {
    for (let dir of flatn_package_dirs) {
      if (!isAbsolute(dir)) dir = normPath(j(location, dir));
      if (seen.collectionDirs[dir]) continue;
      console.log(`[flatn] project ${location} specifies package dir ${dir}`);
      seen.collectionDirs[dir] = true;
      found.push(...discoverPackagesInCollectionDirs([dir], seen));
    }
  }

  return found;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

module.exports.PackageMap = PackageMap;
// <<< file:///Users/robert/Lively/lively-dev2/flatn/package-map.js

// >>> file:///Users/robert/Lively/lively-dev2/flatn/dependencies.js
var { graph } = require("./deps/lively.lang.min.js");

module.exports.buildStages = buildStages;
module.exports.depGraph = depGraph;
module.exports.graphvizDeps = graphvizDeps;

function buildStages(packageSpec, packageMap, dependencyFields) {
  let {config: {name, version}} = packageSpec,
      {deps, packages: packageDeps, resolvedVersions} = depGraph(packageSpec, packageMap);

  for (let dep in deps)
    for (let i = 0; i < deps[dep].length; i++)
      if (!deps[deps[dep][i]]) deps[dep][i] = resolvedVersions[deps[dep][i]];

  return lively.lang.graph.sortByReference(deps, `${name}@${version}`);
}

function depGraph(packageSpec, packageMap, dependencyFields = ["dependencies"]) {
  // console.log(lively.lang.string.indent(pNameAndVersion, " ", depth));
  // let packages = getInstalledPackages(centralPackageDir);

  let pNameAndVersion = `${packageSpec.config.name}@${packageSpec.config.version}`,
      queue = [pNameAndVersion],
      resolvedVersions = {},
      deps = {}, packages = {};

  while (queue.length) {
    let nameAndVersion = queue.shift();
    if (nameAndVersion in resolvedVersions) continue;

    let [name, version] = nameAndVersion.split("@"),
        pSpec = packageMap.lookup(name, version);
    if (!pSpec) throw new Error(`Cannot resolve package ${nameAndVersion}`);

    let {config} = pSpec,
        resolvedNameAndVersion = `${config.name}@${config.version}`;

    resolvedVersions[nameAndVersion] = resolvedNameAndVersion;

    if (!packages[config.name]) packages[config.name] = [];
    if (!packages[config.name].includes(resolvedNameAndVersion))
      packages[config.name].push(resolvedNameAndVersion);

    if (!deps[resolvedNameAndVersion]) {
      let localDeps = Object.assign({},
          dependencyFields.reduce((map, key) =>
            Object.assign(map, config[key]), {}));

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
var { tmpdir } = require("os");






var { resource } = require("./deps/lively.resources.js");

module.exports.packageDownload = packageDownload;


function maybeFileResource(url) {
  if (typeof url === "string" && url.startsWith("/"))
      url = "file://" + url;
  return url.isResource ? url : resource(url);
}

function pathForNameAndVersion(nameAndVersion, destinationDir) {
  // pathForNameAndVersion("foo-bar@1.2.3", "file:///x/y")
  // pathForNameAndVersion("foo-bar@foo/bar", "file:///x/y")
  // pathForNameAndVersion("foo-bar@git+https://github.com/foo/bar#master", "file:///x/y")

  let [name, version] = nameAndVersion.split("@"),
      gitSpec = gitSpecFromVersion(version);

  // "git clone -b my-branch git@github.com:user/myproject.git"
  if (gitSpec) {
    let location = j(destinationDir, `${name}@${gitSpec.versionInFileName}`);
    return Object.assign({}, gitSpec, {location, name, version: gitSpec.gitURL});
  }

  return {location: j(destinationDir, nameAndVersion), name, version}
}


async function packageDownload(packageNameAndRange, destinationDir) {
  // packageNameAndRange like "lively.modules@^0.7.45"
  // if no @ part than we assume @*

  destinationDir = maybeFileResource(destinationDir);

  if (!packageNameAndRange.includes("@")) {
    // any version
    packageNameAndRange += "@*";
  }

  // download package to tmp location
  let tmp = resource("file://" + tmpdir()).join("package_install_tmp/");
  await tmp.ensureExistance()

  let pathSpec = pathForNameAndVersion(packageNameAndRange, destinationDir.path()),
      downloadDir = pathSpec.gitURL
        ? await packageDownloadViaGit(pathSpec, tmp)
        : await packageDownloadViaNpm(packageNameAndRange, tmp);


  let packageJSON = downloadDir.join("package.json"), config;
  if (await packageJSON.exists()) {
    config = await downloadDir.join("package.json").readJson();
  } else {
    // FIXME, doesn't really work for git downloads...
    let [name, version] = downloadDir.name().split("@");
    config = {name, version};
  }

  let packageDir;
  if (pathSpec.gitURL) {
    packageDir = maybeFileResource(pathSpec.location).asDirectory();
  } else {
    let dirName = config.name + "@" + config.version;
    packageDir = destinationDir.join(dirName).asDirectory();
    pathSpec = Object.assign({}, pathSpec, {location: packageDir});
  }

  await downloadDir.rename(packageDir);

  let packageSpec = PackageSpec.fromDir(packageDir.path(), config);
  packageSpec.writeLvInfo(Object.assign({build: false}, pathSpec));

  return packageSpec;
}


async function packageDownloadViaGit({gitURL: url, name, branch}, targetDir) {
  // packageNameAndRepo like "lively.modules@https://github.com/LivelyKernel/lively.modules"
  branch = branch || "master"
  url = url.replace(/#[^#]+$/, "");
  let dir = targetDir.join(name).asDirectory()
  await gitClone(url, dir, branch);
  return dir;
}

async function packageDownloadViaNpm(packageNameAndRange, targetDir) {
  // packageNameAndRange like "lively.modules@^0.7.45"
  // if no @ part than we assume @*
  let {
    downloadedArchive,
    name, version
  } = await npmDownloadArchive(packageNameAndRange, targetDir);
  return untar(downloadedArchive, targetDir, name);
}
// <<< file:///Users/robert/Lively/lively-dev2/flatn/download.js

// >>> file:///Users/robert/Lively/lively-dev2/flatn/build.js
/*global System,process,global,require,module,__dirname*/
var { join: j } = require("path");
var fs = require("fs");
var { tmpdir } = require("os");
var { execSync } = require("child_process");




var dir = typeof __dirname !== "undefined"
        ? __dirname
        : System.decanonicalize("flatn/").replace("file://", ""),
      helperBinDir = j(dir, "bin"),
      nodeCentralPackageBin = j(helperBinDir, "node");

var npmEnv = (() => {
  let cacheFile = j(tmpdir(), "npm-env.json"), env;
  if (fs.existsSync(cacheFile)) {
    let cached = JSON.parse(String(fs.readFileSync(cacheFile)))
    if (Date.now() - cached.time < 1000*60) return cached.env;
  }
  try {
    var dir = j(tmpdir(), "npm-test-env-project");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    fs.writeFileSync(j(dir, "package.json"), `{"scripts": {"print-env": "${process.env.npm_node_execpath || "node"} ./print-env.js"}}`);
    fs.writeFileSync(j(dir, "print-env.js"), `console.log(JSON.stringify(process.env))`);
    let PATH = process.env.PATH.split(":").filter(ea => ea !== helperBinDir).join(":")
    env = JSON.parse(String(execSync(`npm --silent run print-env`, {cwd: dir, env: Object.assign({}, process.env, {PATH})})));
    for (let key in env)
      if (!key.toLowerCase().startsWith("npm") || key.toLowerCase().startsWith("npm_package"))
        delete env[key];
  } catch (err) {
    console.warn(`Cannot figure out real npm env, ${err}`);
    env = {};
  } finally {
    try {
      fs.unlinkSync(j(dir, "package.json"));
      fs.unlinkSync(j(dir, "print-env.js"));
      fs.rmdirSync(dir);
    } catch (err) {}
  }
  fs.writeFileSync(cacheFile, JSON.stringify({time: Date.now(), env}));
  return env;
})();


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

function linkBins(packageSpecs, linkState = {}) {
  let linkLocation = j(tmpdir(), "npm-helper-bin-dir");
  if (!fs.existsSync(linkLocation)) fs.mkdirSync(linkLocation);
  packageSpecs.forEach(({bin, location}) => {
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
      } catch (err) {}
      // console.log(`[flatn build] linking ${j(location, realFile)} => ${j(linkLocation, linkName)}`)
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

  constructor(buildStages, packageMap, forceBuild) {
    this.buildStages = buildStages; // 2d list, package specs in sorted order
    this.packageMap = packageMap;
    this.builtPackages = [];
    this.binLinkState = {};
    this.binLinkLocation = "";
    this.forceBuild = forceBuild;
  }

  async run() {

    // let {buildStages, packageMap} = build
    let {buildStages, packageMap} = this,
        i = 1, n = buildStages.length;

    console.log(`[flatn] Running build stage ${i++}/${n}`)

    while (buildStages.length) {
      let stage = buildStages[0];
      if (!stage.length) {
        buildStages.shift();
        buildStages.length && console.log(`[flatn] Running build stage ${i++}/${n}`);
        continue;
      }
      let next = stage[0],
          [name, version] = next.split("@"),
          packageSpec = packageMap.lookup(name, version);
      if (!packageSpec) throw new Error(`[flatn build] package ${next} cannot be found in package map, skipping its build`);

      await this.build(packageSpec);
      stage.shift();
    }
  }

  hasBuiltScripts({config}) {
    return config.scripts && Object.keys(config.scripts).some(scriptName =>
      ["preinstall", "install", "postinstall"].includes(scriptName));
  }

  async build(packageSpec) {
    this.binLinkLocation = linkBins(this.builtPackages.concat([packageSpec]), this.binLinkState);
    let env = npmCreateEnvVars(packageSpec.config);


    if (this.hasBuiltScripts(packageSpec)) {
      let needsBuilt = this.forceBuild || packageSpec.isDevPackage || !(packageSpec.readLvInfo() || {}).build;
      if (needsBuilt) {
        console.log(`[flatn] ${packageSpec.config.name} build starting`);
        await this.runScript("preinstall",  packageSpec, env);
        await this.runScript("install",     packageSpec, env);
        await this.runScript("postinstall", packageSpec, env);
        packageSpec.changeLvInfo(info => Object.assign({}, info, {build: true}));
        console.log(`[flatn] ${packageSpec.config.name} build done`);
      } else {
        console.log(`[flatn] ${packageSpec.config.name} already built`);
      }

    } else {
      let {name, version} = packageSpec.config;
      // console.log(`[flatn] no build scripts for ${name}@${version}`);
    }

    this.builtPackages.push(packageSpec);
  }

  async runScript(scriptName, {config, location, scripts}, env) {
    if (!scripts || !scripts[scriptName]) return false;
    console.log(`[flatn] build ${config.name}: running ${scriptName}`);
    
    env = Object.assign({},
      process.env,
      npmFallbackEnv,
      npmEnv,
      env,
      {
        npm_lifecycle_event: scriptName,
        npm_lifecycle_script: scripts[scriptName].split(" ")[0],
        PATH: `${this.binLinkLocation}:${helperBinDir}:${process.env.PATH}`
      });

    try {
      return await x(`/bin/sh -c '${scripts[scriptName]}'`, {
        verbose: true,
        cwd: location.replace(/^file:\/\//, ""),
        env
      });

    } catch (err) {
      console.error(`[build ${config.name}] error running ${scripts[scriptName]}:\n${err}`);
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
/*global require, module*/





var { basename } = require("path");
var { dirname } = require("path");
var { isAbsolute } = require("path");
var { normalize: normPath } = require("path");
var { join: j } = require("path");
var fs = require("fs");
var { inspect } = require("util");

// FIXME for resources
var node_fetch = require("./deps/node-fetch.js");
if (!global.fetch) {
  Object.assign(
    global,
    {fetch: node_fetch.default},
    ["Response", "Headers", "Request"].reduce((all, name) =>
      Object.assign(all, node_fetch[name]), {}));
}

var debug = false;

module.exports.installDependenciesOfPackage = installDependenciesOfPackage;
module.exports.addDependencyToPackage = addDependencyToPackage;
module.exports.installPackage = installPackage;
module.exports.buildPackage = buildPackage;
module.exports.buildPackageMap = buildPackageMap;
module.exports.setPackageDirsOfEnv = setPackageDirsOfEnv;
module.exports.packageDirsFromEnv = packageDirsFromEnv;


function buildPackageMap(packageCollectionDirs, individualPackageDirs, devPackageDirs) {
  return PackageMap.build(packageCollectionDirs, individualPackageDirs, devPackageDirs);
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
  let packageSpec = typeof packageSpecOrDir === "string"
    ? PackageSpec.fromDir(packageSpecOrDir)
    : packageSpecOrDir,
      packageMap = Array.isArray(packageMapOrDirs)
        ? buildPackageMap(packageMapOrDirs)
        : packageMapOrDirs,
      {name, version} = packageSpec.config;
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

  // if (!packageMap) throw new Error(`[flatn] install of ${pNameAndVersion}: No package map specified!`);
  if (!packageMap) packageMap = PackageMap.empty();

  if (!dependencyFields) dependencyFields = ["dependencies"];

  if (!fs.existsSync(destinationDir))
    fs.mkdirSync(destinationDir);

  let queue = [pNameAndVersion.split("@")],
      seen = {},
      newPackages = [];

  while (queue.length) {
    let [name, version] = queue.shift(),
        installed = packageMap.lookup(name, version);

    if (!installed) {
      (verbose || debug) && console.log(`[flatn] installing package ${name}@${version}`);
      installed = await packageDownload(version ? name + "@" + version : name, destinationDir);
      if (!installed)
        throw new Error(`Could not download package ${name + "@" + version}`);

      packageMap.addPackage(installed, isDev);

      newPackages.push(installed);
    } else {
      (verbose || debug) && console.log(`[flatn] ${name}@${version} already installed in ${installed.location}`);
    }

    if (!installed) throw new Error(`cannot install package ${name}@${version}!`);


    let {config} = installed,
        deps = Object.assign({},
          dependencyFields.reduce((map, key) =>
            Object.assign(map, config[key]), {}));

    for (let name in deps) {
      let nameAndVersion = `${name}@${deps[name]}`;
      if (nameAndVersion in seen) continue;
      queue.push([name, deps[name]]);
      seen[nameAndVersion] = true;
    }
  }

  return {packageMap, newPackages};
}


function addDependencyToPackage(
  packageSpecOrDir,
  depNameAndRange,
  packageDepDir,
  packageMap,
  dependencyField,
  verbose = false
) {

  if (!dependencyField) dependencyField = "dependencies"; /*vs devDependencies etc.*/

  let packageSpec = typeof packageSpecOrDir === "string"
    ? PackageSpec.fromDir(packageSpecOrDir)
    : packageSpecOrDir;

  let {config, location} = packageSpec;

  if (!config[dependencyField]) config[dependencyField] = {};
  let [depName, depVersionRange] = depNameAndRange.split("@"),
      depVersion = config[dependencyField][depName];
  if (!depVersion || depVersion !== depVersionRange) {
    config[dependencyField][depName] = depVersionRange;
    fs.writeFileSync(j(location, "package.json"), JSON.stringify(config, null, 2));
  }

  return installPackage(
    depNameAndRange,
    packageDepDir,
    packageMap,
    [dependencyField]/*dependencyFields*/,
    false/*isDev*/,
    verbose
  );
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

  let packageSpec = typeof packageSpecOrDir === "string"
    ? PackageSpec.fromDir(packageSpecOrDir)
    : packageSpecOrDir;

  if (!packageSpec)
    throw new Error(`Cannot resolve package: ${inspect(packageSpec, {depth: 0})}`);

  if (!dirToInstallDependenciesInto) dirToInstallDependenciesInto = dirname(packageSpec.location);
  if (!dependencyFields) dependencyFields = ["dependencies"];

  let {config} = packageSpec,
      deps = Object.assign({},
        dependencyFields.reduce((map, key) => Object.assign(map, config[key]), {})),
      depNameAndVersions = [],
      newPackages = [];

  for (let name in deps) {
    let newPackagesSoFar = newPackages;
    ({packageMap, newPackages} = await installPackage(
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
    console.log(`[flatn] no new packages need to be installed for ${config.name}`);

  return {packageMap, newPackages};
}


/*
DIR=/Users/robert/Lively/lively-dev2/npm-helper/bin
export PATH=$DIR:$PATH
export CENTRAL_NODE_PACKAGE_DIR="/Users/robert/.central-node-packages";
node -r "lively.resources/dist/lively.resources.js" -e "lively.resources.resource('file://'+__dirname).dirList().then(files => console.log(files.map(ea => ea.path())))"
*/

// await installPackage("pouchdb", packageDir)
// await installPackage("lively.resources", packageDir)
// await installPackage("lively.user@LivelyKernel/lively.user#master", packageDir)
// await installPackage("pouchdb", packageDir)

// process.env.CENTRAL_NODE_PACKAGE_DIR = "/Users/robert/.central-node-packages"
// let packageDir = process.env.CENTRAL_NODE_PACKAGE_DIR
// let packages = getInstalledPackages(packageDir)
// let pMap = buildPackageMap([packageDir])
// let p = getInstalledPackage("pouchdb", null, pMap)
// let p = getInstalledPackage("lively.resources", undefined, pMap);
// let p = getInstalledPackage("lively.user", undefined, pMap);

// import { depGraph, buildStages } from "./dependencies.js";
// import {BuildProcess} from "./build.js";
// await depGraph(p, pMap)
// let stages = await buildStages(p, pMap)
// let build = new BuildProcess(stages, pMap);
// await build.run()


// context.env
// await x(`/bin/sh -c 'env'`, {cwd: context.location, env: context.env});// <<< file:///Users/robert/Lively/lively-dev2/flatn/index.js
