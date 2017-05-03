const semver = require("./deps/semver.min.js")
const { packageDownload } = require("./download.js");
const { readPackageSpec, gitSpecFromVersion } = require("./lookup.js");

const { resource } = (typeof lively !== "undefined" && lively.resources) || require("./deps/lively.resources.js");

module.exports = {
  installDependenciesOfPackage,
  addDependencyToPackage,
  installPackage,
  buildPackageMap,
  getInstalledPackages,
  getInstalledPackage
}

async function installDependenciesOfPackage(
  packageSpecOrDir,
  dirToInstallDependenciesInto,
  lookupDirs = [dirToInstallDependenciesInto],
  dependencyFields = ["dependencies"],
  packageMap,
  verbose = false
) {
  // Given a package spec of an installed package (retrieved via
  // `readPackageSpec`), make sure all dependencies (specified in properties
  // `dependencyFields` of package.json) are installed

  let packageSpec = packageSpecOrDir;
  if (typeof packageSpecOrDir === "string") {
    if (packageSpecOrDir.startsWith("/")) packageSpecOrDir = "file://" + packageSpecOrDir;
    packageSpecOrDir = resource(packageSpecOrDir);
  }
  if (packageSpecOrDir.isResource)
    packageSpec = await readPackageSpec(packageSpecOrDir);

  let {config} = packageSpec,
      deps = Object.assign({}, dependencyFields.reduce((map, key) => Object.assign(map, config[key]), {})),
      depNameAndVersions = [], newPackages = [];

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

  if (verbose && !newPackages.length)
    console.log(`[fnp] no new packages need to be installed for ${config.name}`);

  return {packageMap, newPackages};
}

async function addDependencyToPackage(
  packageSpecOrDir,
  depNameAndRange,
  packageDepDir,
  lookupDirs = [packageDepDir],
  dependencyField = "dependencies", /*vs devDependencies etc.*/
  verbose = false
) {

  let packageSpec = packageSpecOrDir;
  if (typeof packageSpecOrDir === "string") {
    if (packageSpecOrDir.startsWith("/")) packageSpecOrDir = "file://" + packageSpecOrDir;
    packageSpecOrDir = resource(packageSpecOrDir);
  }
  if (packageSpecOrDir.isResource)
    packageSpec = await readPackageSpec(packageSpecOrDir);

  let {config, location} = packageSpec;

  if (!config[dependencyField]) config[dependencyField] = {};
  let [depName, depVersionRange] = depNameAndRange.split("@"),
      depVersion = config[dependencyField][depName];
  if (!depVersion || depVersion !== depVersionRange) {
    config[dependencyField][depName] = depVersionRange;
    await resource(location).join("package.json").writeJson(config, true);
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

async function installPackage(
  pNameAndVersion,
  destinationDir,
  lookupDirs = [destinationDir],
  dependencyFields = ["dependencies"],
  packageMap,
  verbose = false
) {
  // will lookup or install a package matching pNameAndVersion.  Will
  // recursivly install dependencies

  if (!packageMap)
    packageMap = await buildPackageMap(lookupDirs);

  if (typeof destinationDir === "string")  
    destinationDir = resource(destinationDir.startsWith("/") ?
      "file://" + destinationDir : destinationDir);

  await destinationDir.ensureExistance();

  let queue = [pNameAndVersion.split("@")], newPackages = [];

  while (queue.length) {
    let [name, version] = queue.shift(),
        installed = await getInstalledPackage(name, version, packageMap);

    if (!installed) {
      verbose && console.log(`[fnp] installing package ${name}@${version}`);
      installed = await packageDownload(version ? name + "@" + version : name, destinationDir);
      packageMap = Object.assign({}, packageMap, {[resource(installed.location).name()]: installed});
      newPackages.push(installed);
    }

    if (!installed) throw new Error(`cannot install package ${name}@${version}!`);


    let {config} = installed,
        deps = Object.assign({}, dependencyFields.reduce((map, key) => Object.assign(map, config[key]), {}));

    for (let name in deps) queue.push([name, deps[name]]);
  }

  return {packageMap, newPackages};
}

async function buildPackageMap(packageDirs) {
  // let packageMap = await buildPackageMap(["/Users/robert/.central-node-packages"])
  return (await getInstalledPackages(packageDirs)).reduce((map, p) => {
    let {config: {name, version}} = p,
        id = `${name}@${version}`
    map[id] = p;
    return map;
  }, {});
}

async function getInstalledPackages(packageInstallDirs) {
  let packages = [];
  for (let dir of packageInstallDirs) {
    dir = resource(typeof dir === "string" && dir.startsWith("/") ?
      dir = "file://" + dir : dir)
    for (let file of await dir.dirList(1))
      packages.push(await readPackageSpec(file));
  }
  return packages;
}

async function getInstalledPackage(pName, versionRange, packageMap) {
  // tries to retrieve a package specified by name or name@versionRange (like
  // foo@^1.2) from packageDirs.

  // let pMap = await buildPackageMap(["/Users/robert/.central-node-packages"])
  // await getInstalledPackage("leveldown", "^1", pMap)

  let gitSpec = gitSpecFromVersion(versionRange || ""), found;

  for (let key in packageMap) {
    let pSpec = packageMap[key],
        // {config: {name, version}} = 
        [name, version] = key.split("@");

    if (name !== pName) continue;

    if (!versionRange || (gitSpec && gitSpec.inFileName === version)) {
      found = pSpec;
      break;
    }

    if (!semver.parse(version || ""))
      version = pSpec.config.version;
    if (semver.satisfies(version, versionRange)) {
      found = pSpec; break;
    }
  }

  return found;
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
// let pMap = await buildPackageMap([packageDir])
// let p = await getInstalledPackage("pouchdb", null, pMap)
// let p = await getInstalledPackage("lively.resources", undefined, pMap);
// let p = await getInstalledPackage("lively.user", undefined, pMap);

// import { depGraph, buildStages } from "./dependencies.js";
// import {BuildProcess} from "./build.js";
// await depGraph(p, pMap)
// let stages = await buildStages(p, pMap)
// let build = new BuildProcess(stages, pMap);
// await build.run()


// context.env
// await x(`/bin/sh -c 'env'`, {cwd: context.location, env: context.env});
