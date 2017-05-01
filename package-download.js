import {join as j} from "path";
import fs from "fs";
import {exec} from "child_process";
import {tmpdir} from "os";
import semver from "./semver.min.js"
import { x } from "./util.js";

// let centralPackageDir = process.env.CENTRAL_NODE_PACKAGE_DIR
// let centralPackageDir = "/Users/robert/.central-node-packages"
// let destinationDir = "/Users/robert/.central-node-packages"
// let spec = await installPackage("lively.user@LivelyKernel/lively.user", centralPackageDir);
// let spec = await installPackage("pouchdb", centralPackageDir);
// let {location, config} = await getInstalledPackage("pouchdb", null, centralPackageDir);


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// interface

export async function installPackage(pNameAndVersion, destinationDir) {

  if (!fs.existsSync(destinationDir))
    fs.mkdirSync(destinationDir);

  let queue = [pNameAndVersion.split("@")],
      packages = [];

  while (queue.length) {
    let [name, version] = queue.shift(),
        installed = getInstalledPackage(name, version, destinationDir)
        || await npmPackageDownload(version ? name + "@" + version : name, destinationDir);
    if (!installed)
      throw new Error(`cannot install package ${name}@${version}!`)
    packages.push(installed);
    let {config} = installed;
    Object.keys(config.dependencies || {}).forEach(name => {
      if (!getInstalledPackage(name, config.dependencies[name], destinationDir))
        queue.push([name, config.dependencies[name]]);
    });
    // console.log(queue)
  }
  return packages;
}

export function getInstalledPackages(packageInstallDir) {
  return fs.readdirSync(packageInstallDir).map(name =>
    readPackageSpec(j(packageInstallDir, name)));
}

export function getInstalledPackage(pName, versionRange, packageInstallDir, installedPackages) {
  if (!installedPackages) installedPackages = fs.readdirSync(packageInstallDir);
  let gitSpec = gitSpecFromVersion(versionRange || "");

  let existing = installedPackages.find(ea => {
    let [name, version] = ea.split("@");
    if (name !== pName) return false;
    if (!versionRange) return true;
    if (gitSpec && gitSpec.inFileName === version) return true;

    if (!semver.parse(version || "")) {
      try {
        version = JSON.parse(fs.readFileSync(j(packageInstallDir, ea, "package.json"))).version;
      } catch (err) {}
    }
    return semver.satisfies(version, versionRange);
  });
  return existing ? readPackageSpec(j(packageInstallDir, existing)) : null;
}

async function npmPackageDownload(packageNameAndRange, destinationDir) {
  // packageNameAndRange like "lively.modules@^0.7.45"
  // if no @ part than we assume @*

global.x = {packageNameAndRange, destinationDir}
// ({packageNameAndRange, destinationDir} = global.x)

  // do we have package already?
  let [name, range] = packageNameAndRange.split("@");
  let installed = getInstalledPackage(name, range, destinationDir);
  if (installed) return installed;

  if (!packageNameAndRange.includes("@")) {
    // any version
    packageNameAndRange += "@*";
  }

  // download package to tmp location
  let tmp = j(tmpdir(), "package_install_tmp/")
  if (!fs.existsSync(tmp)) fs.mkdirSync(tmp)

  let pathSpec = pathForNameAndVersion(packageNameAndRange, destinationDir),
      downloadDir = pathSpec.gitURL
        ? await npmPackageDownloadViaGit(pathSpec, tmp)
        : await npmPackageDownloadViaCurl(packageNameAndRange, tmp);

  
  let config = JSON.parse(fs.readFileSync(j(downloadDir, "package.json"))),
      packageDir;

  if (pathSpec.gitURL) {
    packageDir = pathSpec.location;
  } else {
    let dirName = config.name + "@" + config.version;
    packageDir = j(destinationDir, dirName);
    pathSpec = {...pathSpec, location: packageDir};
  }

  fs.renameSync(downloadDir, packageDir);

  if (pathSpec.gitURL) {
    fs.writeFileSync(j(packageDir, lvInfoFileName), JSON.stringify(pathSpec, null, 2))
  }

  return readPackageSpec(packageDir, config);
}




// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helper
const lvInfoFileName = ".lv-npm-helper-info.json";

async function npmPackageDownloadViaGit({gitURL, name, branch}, targetDir) {
  // packageNameAndRepo like "lively.modules@https://github.com/LivelyKernel/lively.modules"
  branch = branch || "master"
  gitURL = gitURL.replace(/#[^#]+$/, "");
  await x(`git clone -b "${branch}" "${gitURL}" "${name}"`, {cwd: targetDir});
  return j(targetDir, name);
}

async function npmPackageDownloadViaCurl(packageNameAndRange, targetDir) {
  // packageNameAndRange like "lively.modules@^0.7.45"
  // if no @ part than we assume @*

  let versions = JSON.parse(String(await x(`npm show "${packageNameAndRange}" name version --json`))),
      // _ = console.log(packageNameAndRange, versions),
      {version, name} = Array.isArray(versions) ? versions.slice(-1)[0] : versions,
      archive=`${name}-${version}.tgz`,
      archiveURL = `https://registry.npmjs.org/${name}/-/${archive}`

  console.log(`[${packageNameAndRange}] downloading ${archiveURL}`);

  await x(`curl --silent --remote-name "${archiveURL}"`, {cwd: targetDir});
  if (fs.existsSync(j(targetDir, name)))
    await x(`rm -rf "${name}"`, {cwd: targetDir});
  await x(`mkdir "${name}" && tar xzf "${archive}" --strip-components 1 -C "${name}" && rm "${archive}"`, {cwd: targetDir});
  return j(targetDir, name);
}

function readPackageSpec(packageDir, optPackageJSON) {
  let hasBindingGyp = fs.existsSync(j(packageDir, "binding.gyp")),
      config = optPackageJSON || JSON.parse(fs.readFileSync(j(packageDir, "package.json"))),
      scripts, bin;

  if (config.bin) {
    bin = typeof config.bin === "string" ? {[config.name]: config.bin} : {...config.bin};
  }

  if (config.scripts || hasBindingGyp) {
    scripts = {...config.scripts};
    if (hasBindingGyp && !scripts.install)
      scripts.install = "node-gyp rebuild";
  }

  let info = {};
  if (fs.existsSync(j(packageDir, lvInfoFileName))) {
    info = JSON.parse(fs.readFileSync(j(packageDir, lvInfoFileName)))
  }

  return {
    ...info,
    location: packageDir,
    hasBindingGyp,
    scripts,
    bin,
    config
  }
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
  // pathForNameAndVersion("foo-bar@1.2.3", "/x/y")
  // pathForNameAndVersion("foo-bar@foo/bar", "/x/y")
  // pathForNameAndVersion("foo-bar@git+https://github.com/foo/bar#master", "/x/y")

  let [name, version] = nameAndVersion.split("@"),
      gitSpec = gitSpecFromVersion(version);

  // "git clone -b my-branch git@github.com:user/myproject.git"
  if (gitSpec) {
    let location = j(destinationDir, `${name}@${gitSpec.inFileName}`)
    return {...gitSpec, location, name, version: gitSpec.gitURL}
  }
  
  return {location: j(destinationDir, nameAndVersion), name, version}
}
