/*global require, module*/
const { findMatchingPackageSpec, readPackageSpec, gitSpecFromVersion } = require("./lookup.js");
const { basename, join: j } = require("path");
const fs = require("fs");
const { inspect } = require("util");

const debug = true;

module.exports = {
  installDependenciesOfPackage,
  addDependencyToPackage,
  installPackage,
  buildPackage,
  buildPackageMap,
  getInstalledPackages,
  findMatchingPackageSpec,
  readPackageSpec
}

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
  const { BuildProcess } = require("./build.js");
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
  const { packageDownload } = require("./download.js");

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
  // let packageMap = buildPackageMap(["/Users/robert/.central-node-packages"])
  return getInstalledPackages(packageDirs).reduce((map, p) => {
    let {config: {name, version}} = p;
    return Object.assign(map, {[`${name}@${version}`]: p})
  }, {});
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
// await x(`/bin/sh -c 'env'`, {cwd: context.location, env: context.env});