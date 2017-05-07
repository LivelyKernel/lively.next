/*global require, module*/
import { readPackageSpec, gitSpecFromVersion } from "./lookup.js";
import { packageDownload } from "./download.js";
import { BuildProcess } from "./build.js";
import { basename, dirname, isAbsolute, normalize as normPath, join as j } from "path";
import fs from "fs";
import { inspect } from "util";

// FIXME for resources
import node_fetch from "./deps/node-fetch.js";
import { PackageMap } from "./package-map.js";
if (!global.fetch) {
  Object.assign(
    global,
    {fetch: node_fetch.default},
    ["Response", "Headers", "Request"].reduce((all, name) =>
      Object.assign(all, node_fetch[name]), {}));
}

const debug = true;

export {
  installDependenciesOfPackage,
  addDependencyToPackage,
  installPackage,
  buildPackage,
  buildPackageMap,
  readPackageSpec
}


function buildPackageMap(packageCollectionDirs, individualPackageDirs, devPackageDirs) {
  return PackageMap.build(packageCollectionDirs, individualPackageDirs, devPackageDirs);
}


async function buildPackage(packageSpecOrDir, packageMapOrDirs, verbose = false) {
  let packageSpec = typeof packageSpecOrDir === "string"
        ? readPackageSpec(packageSpecOrDir)
        : packageSpecOrDir,
      packageMap = Array.isArray(packageMapOrDirs)
        ? buildPackageMap(packageMapOrDirs)
        : packageMapOrDirs,
      {name, version} = packageSpec.config;
  // packageMap[`${name}@${version}`] = packageSpec;
  // let key = isDev ? name : `${name}@${version}`;
  // packageMap.add(key, packageSpec);
  return await BuildProcess.for(packageSpec, packageMap).run();
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
      if (deps[name] in seen) continue;
      queue.push([name, deps[name]]);
      seen[deps[name]] = true;
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
    packageMap,
    undefined,
    false,
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
  // `readPackageSpec`), make sure all dependencies (specified in properties
  // `dependencyFields` of package.json) are installed

  let packageSpec = typeof packageSpecOrDir === "string"
    ? readPackageSpec(packageSpecOrDir)
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
// await x(`/bin/sh -c 'env'`, {cwd: context.location, env: context.env});