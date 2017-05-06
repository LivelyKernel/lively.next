/*global require, module*/
import semver from "./deps/semver.min.js";
import { basename, join as j } from "path";
import fs from "fs";

const lvInfoFileName = ".lv-npm-helper-info.json";

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

  // verbose && console.log(`[flatn] is ${pName}@${versionRange} installed? ${found ? "yes" : "no"}`);

  return found;
}

export {
  lvInfoFileName,
  readPackageSpec,
  gitSpecFromVersion,
  pathForNameAndVersion,
  findMatchingPackageSpec
}
