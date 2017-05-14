/*global require, module*/
import { packageDownload } from "./download.js";
import { PackageMap, PackageSpec } from "./package-map.js";
import { BuildProcess } from "./build.js";

import { basename, dirname, isAbsolute, normalize as normPath, join as j } from "path";
import fs from "fs";
import { inspect } from "util";

// FIXME for resources
import node_fetch from "./deps/node-fetch.js";
if (!global.fetch) {
  Object.assign(
    global,
    {fetch: node_fetch.default},
    ["Response", "Headers", "Request"].reduce((all, name) =>
      Object.assign(all, node_fetch[name]), {}));
}

const debug = false;

export {
  installDependenciesOfPackage,
  addDependencyToPackage,
  installPackage,
  buildPackage,
  buildPackageMap,
  ensurePackageMap,
  setPackageDirsOfEnv,
  packageDirsFromEnv
}


function buildPackageMap(packageCollectionDirs, individualPackageDirs, devPackageDirs) {
  return PackageMap.build(packageCollectionDirs, individualPackageDirs, devPackageDirs);
}

function ensurePackageMap(packageCollectionDirs, individualPackageDirs, devPackageDirs) {
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
      {name, version} = packageSpec;
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

  let {location} = packageSpec;

  if (!packageSpec[dependencyField]) packageSpec[dependencyField] = {};
  let [depName, depVersionRange] = depNameAndRange.split("@"),
      depVersion = packageSpec[dependencyField][depName];
  if (!depVersion || depVersion !== depVersionRange) {
    packageSpec[dependencyField][depName] = depVersionRange;
    let config = JSON.parse(String(fs.readFileSync(j(location, "package.json"))));
    if (!config[dependencyField]) config[dependencyField] = {}
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

  let deps = Object.assign({},
        dependencyFields.reduce((map, key) => Object.assign(map, packageSpec[key]), {})),
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
    console.log(`[flatn] no new packages need to be installed for ${packageSpec.name}`);

  return {packageMap, newPackages};
}
