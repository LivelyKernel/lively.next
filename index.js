import semver from "./semver.min.js"
import { packageDownload } from "./download.js";
import { readPackageSpec, gitSpecFromVersion } from "./lookup.js";

const { resource } = lively.resources;

export async function installPackage(
  pNameAndVersion,
  destinationDir,
  lookupDirs = [destinationDir],
  dependencyFields = ["dependencies"],
  packageMap
) {
  // will lookup or install a package matching pNameAndVersion.  Will
  // recursivly install dependencies

  if (!packageMap)
    packageMap = await buildPackageMap(lookupDirs);

  if (typeof destinationDir === "string")  
    destinationDir = resource(destinationDir.startsWith("/") ?
      "file://" + destinationDir : destinationDir);

  await destinationDir.ensureExistance();

  let queue = [pNameAndVersion.split("@")], packages = [];

  while (queue.length) {
    let [name, version] = queue.shift(),
        installed =
          (await getInstalledPackage(name, version, packageMap)) ||
          (await packageDownload(version ? name + "@" + version : name, destinationDir));

    if (!installed) throw new Error(`cannot install package ${name}@${version}!`);

    packages.push(installed);

    let {config} = installed,
        deps = Object.assign({}, ...dependencyFields.map(key => config[key] || {}));

    for (let name in deps) queue.push([name, deps[name]]);
  }
  return packages;
}

export async function buildPackageMap(packageDirs) {
  // let packgeMap = await buildPackageMap(["/Users/robert/.central-node-packages"])
  return (await getInstalledPackages(packageDirs)).reduce((map, p) => {
    let {config: {name, version}} = p,
        id = `${name}@${version}`
    map[id] = p;
    return map;
  }, {});
}

export async function getInstalledPackages(packageInstallDirs) {
  let packages = [];
  for (let dir of packageInstallDirs) {
    dir = resource(typeof dir === "string" && dir.startsWith("/") ?
      dir = "file://" + dir : dir)
    for (let file of await dir.dirList(1))
      packages.push(await readPackageSpec(file));
  }
  return packages;
}

export async function getInstalledPackage(pName, versionRange, packageMap) {
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
