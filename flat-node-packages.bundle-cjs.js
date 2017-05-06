// >>> file:///Users/robert/Lively/lively-dev2/flat-node-packages/util.js
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
  console.log(`[${packageNameAndRange}] downloading ${archiveURL}`);
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

module.exports.gitClone = gitClone;
module.exports.untar = untar;
module.exports.npmDownloadArchive = npmDownloadArchive;
module.exports.npmSearchForVersions = npmSearchForVersions;
module.exports.x = x;
module.exports.npmFallbackEnv = npmFallbackEnv;
// <<< file:///Users/robert/Lively/lively-dev2/flat-node-packages/util.js

// >>> file:///Users/robert/Lively/lively-dev2/flat-node-packages/lookup.js
/*global require, module*/
var semver = require("./deps/semver.min.js");
var { basename } = require("path");
var { join: j } = require("path");
var fs = require("fs");

var lvInfoFileName = ".lv-npm-helper-info.json";

function readPackageSpec(packageDir, optPackageJSON) {
  if (!fs.statSync(packageDir).isDirectory() || !fs.existsSync(j(packageDir, "package.json")))
    return null;

  let hasBindingGyp = fs.existsSync(j(packageDir, "binding.gyp")),
      config = optPackageJSON || JSON.parse(String(fs.readFileSync(j(packageDir, "package.json")))),
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

  let info = {};
  try {
    info = JSON.parse(String(fs.readFileSync(j(packageDir, lvInfoFileName))));
  } catch (err) {}

  return Object.assign({}, info, {
    location: packageDir,
    hasBindingGyp,
    scripts,
    bin,
    config
  });
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
    ? {branch, gitURL: gitRepoUrl, inFileName: gitRepoUrl.replace(/[:\/\+#]/g, "_")}
    : null;
}

function pathForNameAndVersion(nameAndVersion, destinationDir) {
  // pathForNameAndVersion("foo-bar@1.2.3", "file:///x/y")
  // pathForNameAndVersion("foo-bar@foo/bar", "file:///x/y")
  // pathForNameAndVersion("foo-bar@git+https://github.com/foo/bar#master", "file:///x/y")

  let [name, version] = nameAndVersion.split("@"),
      gitSpec = gitSpecFromVersion(version);

  // "git clone -b my-branch git@github.com:user/myproject.git"
  if (gitSpec) {
    let location = j(destinationDir, `${name}@${gitSpec.inFileName}`);
    return Object.assign({}, gitSpec, {location, name, version: gitSpec.gitURL});
  }
  
  return {location: j(destinationDir, nameAndVersion), name, version}
}


function findMatchingPackageSpec(pName, versionRange, packageMap, verbose = false) {
  // tries to retrieve a package specified by name or name@versionRange (like
  // foo@^1.2) from packageDirs.

  // let pMap = buildPackageMap(["/Users/robert/.central-node-packages"])
  // await getInstalledPackage("leveldown", "^1", pMap)

  let gitSpec = gitSpecFromVersion(versionRange || ""), found;

  for (let key in packageMap) {
    let pSpec = packageMap[key],
        // {config: {name, version}} =
        [name, version] = key.split("@");

    if (name !== pName) continue;

    if (!versionRange) { found = pSpec; break; }

    if (gitSpec && (gitSpec.inFileName === version
      || pSpec.inFileName === gitSpec.inFileName)) {
       found = pSpec; break; 
    }

    if (!semver.parse(version || ""))
      version = pSpec.config.version;
    if (semver.satisfies(version, versionRange)) {
      found = pSpec; break;
    }
  }

  // verbose && console.log(`[fnp] is ${pName}@${versionRange} installed? ${found ? "yes" : "no"}`);

  return found;
}

module.exports.lvInfoFileName = lvInfoFileName;
module.exports.readPackageSpec = readPackageSpec;
module.exports.gitSpecFromVersion = gitSpecFromVersion;
module.exports.pathForNameAndVersion = pathForNameAndVersion;
module.exports.findMatchingPackageSpec = findMatchingPackageSpec;
// <<< file:///Users/robert/Lively/lively-dev2/flat-node-packages/lookup.js

// >>> file:///Users/robert/Lively/lively-dev2/flat-node-packages/dependencies.js
var { graph } = require("./deps/lively.lang.min.js");



module.exports.buildStages = buildStages;
module.exports.depGraph = depGraph;
module.exports.graphvizDeps = graphvizDeps;

function buildStages(packageSpec, packageMap) {
  let {config: {name, version}} = packageSpec,
      {deps, packages: packageDeps, resolvedVersions} = depGraph(packageSpec, packageMap);

  for (let dep in deps)
    for (let i = 0; i < deps[dep].length; i++)
      if (!deps[deps[dep][i]]) deps[dep][i] = resolvedVersions[deps[dep][i]];

  return lively.lang.graph.sortByReference(deps, `${name}@${version}`);
}

function depGraph(packageSpec, packageMap) {
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
        pSpec = findMatchingPackageSpec(name, version, packageMap);
    if (!pSpec) throw new Error(`Cannot resolve package ${nameAndVersion}`);
    let {config} = pSpec,
        resolvedNameAndVersion = `${config.name}@${config.version}`;

    resolvedVersions[nameAndVersion] = resolvedNameAndVersion;

    if (!packages[config.name]) packages[config.name] = [];
    if (!packages[config.name].includes(resolvedNameAndVersion))
      packages[config.name].push(resolvedNameAndVersion);

    if (!deps[resolvedNameAndVersion]) {
      deps[resolvedNameAndVersion] = Object.keys(config.dependencies || {}).map(name => {
        let fullName = name + "@" + config.dependencies[name];
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
// <<< file:///Users/robert/Lively/lively-dev2/flat-node-packages/dependencies.js

// >>> file:///Users/robert/Lively/lively-dev2/flat-node-packages/download.js
/*global require, module*/
var { tmpdir } = require("os");







var { resource } = require("./deps/lively.resources.js");

module.exports.packageDownload = packageDownload;


function maybeFileResource(url) {
  if (typeof url === "string" && url.startsWith("/"))
      url = "file://" + url;
  return url.isResource ? url : resource(url);
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

  if (pathSpec.gitURL)
    await packageDir.join(lvInfoFileName).writeJson(pathSpec);

  return readPackageSpec(packageDir.path(), config);
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
// <<< file:///Users/robert/Lively/lively-dev2/flat-node-packages/download.js

// >>> file:///Users/robert/Lively/lively-dev2/flat-node-packages/build.js
/*global System,process,global,require,module,__dirname*/
var { join: j } = require("path");
var fs = require("fs");
var { tmpdir } = require("os");
var { execSync } = require("child_process");





var dir = typeof __dirname !== "undefined"
        ? __dirname
        : System.decanonicalize("flat-node-packages/").replace("file://", ""),
      helperBinDir = j(dir, "bin"),
      nodeCentralPackageBin = j(helperBinDir, "node");

var npmEnv = (() => {
  try {
    var dir = j(tmpdir(), "npm-test-env-project");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    fs.writeFileSync(j(dir, "package.json"), `{"scripts": {"print-env": "${process.env.npm_node_execpath || "node"} ./print-env.js"}}`);
    fs.writeFileSync(j(dir, "print-env.js"), `console.log(JSON.stringify(process.env))`);
    let env = JSON.parse(String(execSync(`npm --silent run print-env`, {cwd: dir})))
    for (let key in env)
      if (!key.toLowerCase().startsWith("npm") || key.toLowerCase().startsWith("npm_package"))
        delete env[key];
    return env;
  } catch (err) {
    console.warn(`Cannot figure out real npm env, ${err}`);
    return {};
  } finally {
    try {
      fs.unlinkSync(j(dir, "package.json"));
      fs.unlinkSync(j(dir, "print-env.js"));
      fs.rmdirSync(dir);
    } catch (err) {}
  }
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
      // console.log(`[fnp build] linking ${j(location, realFile)} => ${j(linkLocation, linkName)}`)
      fs.symlinkSync(j(location, realFile), j(linkLocation, linkName));
    }
    linkState[location] = true;
  });
  return linkLocation;
}

class BuildProcess {

  static for(packageSpec, packageMap) {
    let stages = buildStages(packageSpec, packageMap);
    return new this(stages, packageMap);
  }

  constructor(buildStages, packageMap) {
    this.buildStages = buildStages; // 2d list, package specs in sorted order
    this.packageMap = packageMap;
    this.builtPackages = [];
    this.binLinkState = {};
    this.binLinkLocation = "";
  }

  async run() {

    // let {buildStages, packageMap} = build
    let {buildStages, packageMap} = this,
        i = 1, n = buildStages.length;

    console.log(`[fnp] Running build stage ${i++}/${n}`)

    while (buildStages.length) {
      let stage = buildStages[0];
      if (!stage.length) {
        buildStages.shift();
        buildStages.length && console.log(`[fnp] Running build stage ${i++}/${n}`);
        continue;
      }
      let next = stage[0],
          [name, version] = next.split("@"),
          packageSpec = findMatchingPackageSpec(name, version, packageMap);
      if (!packageSpec) throw new Error(`[fnp build] package ${next} cannot be found in package map, skipping its build`);

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
      console.log(`[fnp] ${packageSpec.config.name} build starting`);
      await this.runScript("preinstall",  packageSpec, env);
      await this.runScript("install",     packageSpec, env);
      await this.runScript("postinstall", packageSpec, env);
      console.log(`[fnp] ${packageSpec.config.name} build done`);
    } else {
      let {name, version} = packageSpec.config;
      console.log(`[fnp] no build scripts for ${name}@${version}`);
    }

    this.builtPackages.push(packageSpec);
  }

  async runScript(scriptName, {config, location, scripts}, env) {
    if (!scripts || !scripts[scriptName]) return false;
    console.log(`[fnp] build ${config.name}: running ${scriptName}`);
    
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
// <<< file:///Users/robert/Lively/lively-dev2/flat-node-packages/build.js

// >>> file:///Users/robert/Lively/lively-dev2/flat-node-packages/index.js
/*global require, module*/





var { basename } = require("path");
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

var debug = true;

module.exports.installDependenciesOfPackage = installDependenciesOfPackage;
module.exports.addDependencyToPackage = addDependencyToPackage;
module.exports.installPackage = installPackage;
module.exports.buildPackage = buildPackage;
module.exports.buildPackageMap = buildPackageMap;
module.exports.getInstalledPackages = getInstalledPackages;
module.exports.findMatchingPackageSpec = findMatchingPackageSpec;
module.exports.readPackageSpec = readPackageSpec;

async function installDependenciesOfPackage(
  packageSpecOrDir,
  dirToInstallDependenciesInto,
  lookupDirs,
  dependencyFields,
  packageMap,
  verbose
) {
  // Given a package spec of an installed package (retrieved via
  // `readPackageSpec`), make sure all dependencies (specified in properties
  // `dependencyFields` of package.json) are installed

  if (!lookupDirs) lookupDirs = [dirToInstallDependenciesInto];
  if (!dependencyFields) dependencyFields = ["dependencies"];

  let packageSpec = typeof packageSpecOrDir === "string"
    ? readPackageSpec(packageSpecOrDir)
    : packageSpecOrDir;

  if (!packageSpec)
    throw new Error(`Cannot resolve package: ${inspect(packageSpec, {depth: 0})}`);

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
      lookupDirs,
      ["dependencies"],
      packageMap,
      verbose
    ));
    newPackages = newPackages.concat(newPackagesSoFar);
  }

  if ((verbose || debug) && !newPackages.length)
    console.log(`[fnp] no new packages need to be installed for ${config.name}`);

  return {packageMap, newPackages};
}

function addDependencyToPackage(
  packageSpecOrDir,
  depNameAndRange,
  packageDepDir,
  lookupDirs,
  dependencyField,
  verbose = false
) {

  if (!lookupDirs) lookupDirs = [packageDepDir];
  if (!dependencyField) dependencyField = "dependencies"; /*vs devDependencies etc.*/

  let packageSpec = typeof packageSpecOrDir === "string"
    ? readPackageSpec(packageSpecOrDir)
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
    lookupDirs,
    undefined,
    undefined,
    verbose
  );
}

async function buildPackage(packageSpecOrDir, packageMapOrDirs, verbose = false) {
  let packageSpec = typeof packageSpecOrDir === "string"
        ? readPackageSpec(packageSpecOrDir)
        : packageSpecOrDir,
      packageMap = Array.isArray(packageMapOrDirs)
        ? buildPackageMap(packageMapOrDirs)
        : packageMapOrDirs,
      {name, version} = packageSpec.config;
  packageMap[`${name}@${version}`] = packageSpec;
  return await BuildProcess.for(packageSpec, packageMap).run();
}


async function installPackage(
  pNameAndVersion,
  destinationDir,
  lookupDirs,
  dependencyFields,
  packageMap,
  verbose = false
) {

  // will lookup or install a package matching pNameAndVersion.  Will
  // recursivly install dependencies

  if (!lookupDirs) lookupDirs = [destinationDir];
  if (!dependencyFields) dependencyFields = ["dependencies"];

  if (!packageMap)
    packageMap = buildPackageMap(lookupDirs);

  if (!fs.existsSync(destinationDir))
    fs.mkdirSync(destinationDir);

  let queue = [pNameAndVersion.split("@")],
      seen = {},
      newPackages = [];

  while (queue.length) {
    let [name, version] = queue.shift(),
        installed = findMatchingPackageSpec(name, version, packageMap);

    if (!installed) {
      (verbose || debug) && console.log(`[fnp] installing package ${name}@${version}`);
      installed = await packageDownload(version ? name + "@" + version : name, destinationDir);
      if (!installed)
        throw new Error(`Could not download package ${name + "@" + version}`);

      packageMap = Object.assign({}, packageMap, {[basename(installed.location)]: installed});
      newPackages.push(installed);
    } else {
      (verbose || debug) && console.log(`[fnp] ${name}@${version} already installed in ${installed.location}`);
    }

    if (!installed) throw new Error(`cannot install package ${name}@${version}!`);


    let {config} = installed,
        deps = Object.assign({},
          dependencyFields.reduce((map, key) =>
            Object.assign(map, config[key]), {}));

    for (let name in deps) {
      if (deps[name] in seen) continue;
      queue.push([name, deps[name]]);
      seen[deps[name]] = true;
    }
  }

  return {packageMap, newPackages};
}

function buildPackageMap(packageDirs) {
  // looks up all the packages in can find in packageDirs and creates
  // packageSpecs for them.  If a package specifies more fnp_package_dirs in its
  // config then repeat the process until no more new package dirs are found.
  // Finally, combine all the packages found into a single map, like
  // {package-name@version: packageSpec, ...}.
  // 
  // Merging of the results of the different package dirs happens so that dirs
  // specified first take precedence. I.e. if a dependency foo@1 is found via
  // packageDirs and then another package specifies a dir that leads to the
  // discovery of another foo@1, the first one ends up in tha packageDir

  // let packageMap = buildPackageMap(["/Users/robert/.central-node-packages"])
  let packageDirsSeen = packageDirs.reduce((all, ea) =>
                          Object.assign(all, {[ea]: true}), {}),
      newPackageDirs = [],
      packageMaps = [];

  while (packageDirs.length) {
    let newPackageDirs = [],
        packageMap = {};
    packageMaps.push(packageMap);
    for (let p of getInstalledPackages(packageDirs)) {
      let {location, config: {name, version, fnp_package_dirs}} = p;
      Object.assign(packageMap, {[`${name}@${version}`]: p});
      if (fnp_package_dirs) {
        for (let dir of fnp_package_dirs) {
          if (!isAbsolute(dir)) dir = normPath(j(location, dir));
          if (packageDirsSeen[dir]) continue;
          console.log(`[fnp] project ${location} specifies pacakge dir ${dir}`)
          packageDirsSeen[dir] = true;
          newPackageDirs.push(dir)
        }
      }
    }
    packageDirs = newPackageDirs;
  }
  return packageMaps.reduceRight((all, ea) => Object.assign(all, ea), {});
}

function getInstalledPackages(packageInstallDirs) {
  let packages = [];
  for (let dir of packageInstallDirs)
    if (fs.existsSync(dir))
      for (let file of fs.readdirSync(dir)) {
        let spec = readPackageSpec(j(dir, file));
        spec && packages.push(spec);
      }
  return packages;
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
// await x(`/bin/sh -c 'env'`, {cwd: context.location, env: context.env});// <<< file:///Users/robert/Lively/lively-dev2/flat-node-packages/index.js
