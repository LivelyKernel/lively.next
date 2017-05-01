import { tmpdir } from "os";
import semver from "./semver.min.js"
import { resource } from "lively.resources";
import * as util from "./util.js";

// let centralPackageDir = process.env.CENTRAL_NODE_PACKAGE_DIR
// let centralPackageDir = "/Users/robert/.central-node-packages"
// let destinationDir = "/Users/robert/.central-node-packages"
// let spec = await installPackage("lively.user@LivelyKernel/lively.user", centralPackageDir);
// let spec = await installPackage("pouchdb", centralPackageDir);
// (await resource("file:///Users/robert/.central-node-packages").dirList()).forEach(ea => ea.remove())
// let spec = await installPackage("mkdirp@0.5.1", centralPackageDir);
// let {location, config} = await getInstalledPackage("pouchdb", null, centralPackageDir);

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// interface

export async function installPackage(pNameAndVersion, destinationDir) {

  if (typeof destinationDir === "string" && destinationDir.startsWith("/"))
    destinationDir = "file://" + destinationDir;

  destinationDir = resource(destinationDir);
  await destinationDir.ensureExistance();

  let queue = [pNameAndVersion.split("@")],
      packages = [];

  while (queue.length) {
    let [name, version] = queue.shift(),
        installed = await getInstalledPackage(name, version, destinationDir)
                 || await npmPackageDownload(version ? name + "@" + version : name, destinationDir);
    if (!installed)
      throw new Error(`cannot install package ${name}@${version}!`)
    packages.push(installed);
    let {config} = installed,
        deps = config.dependencies || {};
    for (let name in deps)
      if (!await getInstalledPackage(name, config.dependencies[name], destinationDir))
        queue.push([name, config.dependencies[name]]);
    // console.log(queue)
  }
  return packages;
}

export async function getInstalledPackages(packageInstallDir) {
  if (typeof packageInstallDir === "string" && packageInstallDir.startsWith("/"))
    packageInstallDir = "file://" + packageInstallDir;
  return Promise.all((await resource(packageInstallDir).dirList(1))
                        .map(ea => readPackageSpec(ea)));
}

export async function getInstalledPackage(pName, versionRange, packageInstallDir, installedPackages) {
  if (typeof packageInstallDir === "string" && packageInstallDir.startsWith("/"))
      packageInstallDir = "file://" + packageInstallDir;
  packageInstallDir = resource(packageInstallDir);

  if (!installedPackages) installedPackages = await packageInstallDir.dirList(1);
  let gitSpec = gitSpecFromVersion(versionRange || "");

  let existing;
  for (let p of installedPackages) {
    let [name, version] = p.name().split("@");
    if (name !== pName) continue;
    if (!versionRange || (gitSpec && gitSpec.inFileName === version)) {
      existing = p;
      break;
    }

    if (!semver.parse(version || "")) {
      try {
        version = (await p.join("package.json").readJson()).version;
      } catch (err) {}
    }
    if (semver.satisfies(version, versionRange)) {
      existing = p; break;
    }
  }

  return existing ? readPackageSpec(existing) : null;
}

async function npmPackageDownload(packageNameAndRange, destinationDir) {
  // packageNameAndRange like "lively.modules@^0.7.45"
  // if no @ part than we assume @*

  destinationDir = resource(destinationDir);

  // do we have package already?
  let [name, range] = packageNameAndRange.split("@");
  let installed = await getInstalledPackage(name, range, destinationDir);
  if (installed) return installed;

  if (!packageNameAndRange.includes("@")) {
    // any version
    packageNameAndRange += "@*";
  }

  // download package to tmp location
  let tmp = resource("file://" + tmpdir()).join("package_install_tmp/");
  await tmp.ensureExistance()

  let pathSpec = pathForNameAndVersion(packageNameAndRange, destinationDir),
      downloadDir = pathSpec.gitURL
        ? await npmPackageDownloadViaGit(pathSpec, tmp)
        : await npmPackageDownloadViaCurl(packageNameAndRange, tmp);


  let config = await downloadDir.join("package.json").readJson(), packageDir;

  if (pathSpec.gitURL) {
    packageDir = resource(pathSpec.location).asDirectory();
  } else {
    let dirName = config.name + "@" + config.version;
    packageDir = destinationDir.join(dirName).asDirectory();
    pathSpec = {...pathSpec, location: packageDir};
  }

  await downloadDir.rename(packageDir);

  if (pathSpec.gitURL)
    await packageDir.join(lvInfoFileName).writeJson(pathSpec);

  return readPackageSpec(packageDir, config);
}




// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helper
const lvInfoFileName = ".lv-npm-helper-info.json";

async function npmPackageDownloadViaGit({gitURL: url, name, branch}, targetDir) {
  // packageNameAndRepo like "lively.modules@https://github.com/LivelyKernel/lively.modules"
  branch = branch || "master"
  url = url.replace(/#[^#]+$/, "");
  let dir = targetDir.join(name).asDirectory()
  await util.gitClone(url, dir, branch);
  return dir;
}

async function npmPackageDownloadViaCurl(packageNameAndRange, targetDir) {
  // packageNameAndRange like "lively.modules@^0.7.45"
  // if no @ part than we assume @*
  let {
    downloadedArchive,
    name, version
  } = await util.npmDownloadArchive(packageNameAndRange, targetDir);
  return util.untar(downloadedArchive, targetDir, name);
}

async function readPackageSpec(packageDir, optPackageJSON) {

  let hasBindingGyp = await packageDir.join("binding.gyp").exists(),
      config = optPackageJSON || await packageDir.join("package.json").readJson(),
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
  try { info = await packageDir.join(lvInfoFileName).readJson(); } catch (err) {}

  return {
    ...info,
    location: packageDir.url,
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
  // pathForNameAndVersion("foo-bar@1.2.3", "file:///x/y")
  // pathForNameAndVersion("foo-bar@foo/bar", "file:///x/y")
  // pathForNameAndVersion("foo-bar@git+https://github.com/foo/bar#master", "file:///x/y")

  let [name, version] = nameAndVersion.split("@"),
      gitSpec = gitSpecFromVersion(version);

  // "git clone -b my-branch git@github.com:user/myproject.git"
  if (gitSpec) {
    let location = resource(destinationDir).join(`${name}@${gitSpec.inFileName}`).url;
    return {...gitSpec, location, name, version: gitSpec.gitURL}
  }
  
  return {location: resource(destinationDir).join(nameAndVersion).url, name, version}
}
