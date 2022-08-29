/* global process, global */
import { dirname, join as j } from 'path';
import fs from 'fs';
import { inspect } from 'util';
import semver from 'semver';
import node_fetch from 'node-fetch';
export { default as parseArgs } from 'minimist';

import { packageDownload } from './download.js';
import { PackageMap, PackageSpec } from './package-map.js';
import { BuildProcess } from './build.js';
export * from './util.js';

if (!global.fetch) {
  Object.assign(
    global,
    { fetch: node_fetch },
    ['Response', 'Headers', 'Request'].reduce((all, name) =>
      Object.assign(all, node_fetch[name]), {}));
}

const debug = false;

function resetPackageMap () { PackageMap._cache = {}; }

function ensurePathFormat (dirOrArray) {
  // for flatn pure we expect directories to be specified in normal file system
  // form like /home/foo/bar/, not as lively.resources or as URL file://...
  // This ensures that...
  if (Array.isArray(dirOrArray)) return dirOrArray.map(ensurePathFormat);
  if (dirOrArray.isResource) return dirOrArray.path();
  if (dirOrArray.startsWith('file://')) dirOrArray = dirOrArray.replace('file://', '');
  return dirOrArray;
}

function buildPackageMap (packageCollectionDirs, individualPackageDirs, devPackageDirs) {
  if (packageCollectionDirs) packageCollectionDirs = ensurePathFormat(packageCollectionDirs);
  if (individualPackageDirs) individualPackageDirs = ensurePathFormat(individualPackageDirs);
  if (devPackageDirs) devPackageDirs = ensurePathFormat(devPackageDirs);
  return PackageMap.build(packageCollectionDirs, individualPackageDirs, devPackageDirs);
}

function ensurePackageMap (packageCollectionDirs, individualPackageDirs, devPackageDirs) {
  if (packageCollectionDirs) packageCollectionDirs = ensurePathFormat(packageCollectionDirs);
  if (individualPackageDirs) individualPackageDirs = ensurePathFormat(individualPackageDirs);
  if (devPackageDirs) devPackageDirs = ensurePathFormat(devPackageDirs);
  return PackageMap.ensure(packageCollectionDirs, individualPackageDirs, devPackageDirs);
}

function packageDirsFromEnv () {
  let env = process.env;
  return {
    packageCollectionDirs: [...new Set((env.FLATN_PACKAGE_COLLECTION_DIRS || '').split(':').filter(Boolean))],
    individualPackageDirs: [...new Set((env.FLATN_PACKAGE_DIRS || '').split(':').filter(Boolean))],
    devPackageDirs: [...new Set((env.FLATN_DEV_PACKAGE_DIRS || '').split(':').filter(Boolean))]
  };
}

function setPackageDirsOfEnv (packageCollectionDirs, individualPackageDirs, devPackageDirs) {
  packageCollectionDirs = ensurePathFormat(packageCollectionDirs);
  individualPackageDirs = ensurePathFormat(individualPackageDirs);
  devPackageDirs = ensurePathFormat(devPackageDirs);
  process.env.FLATN_PACKAGE_COLLECTION_DIRS = packageCollectionDirs.join(':');
  process.env.FLATN_PACKAGE_DIRS = individualPackageDirs.join(':');
  process.env.FLATN_DEV_PACKAGE_DIRS = devPackageDirs.join(':');
}

async function buildPackage (
  packageSpecOrDir,
  packageMapOrDirs,
  dependencyFields = ['dependencies'],
  verbose = false,
  forceBuild = false
) {
  if (typeof packageSpecOrDir === 'string' || packageSpecOrDir.isResource) { packageSpecOrDir = ensurePathFormat(packageSpecOrDir); }
  if (Array.isArray(packageMapOrDirs)) { packageMapOrDirs = ensurePathFormat(packageMapOrDirs); }

  let packageSpec = typeof packageSpecOrDir === 'string'
    ? PackageSpec.fromDir(packageSpecOrDir)
    : packageSpecOrDir;
  let packageMap = Array.isArray(packageMapOrDirs)
    ? buildPackageMap(packageMapOrDirs)
    : packageMapOrDirs;
  return await BuildProcess.for(packageSpec, packageMap, dependencyFields, forceBuild, verbose).run();
}

async function installPackage (
  pNameAndVersion,
  destinationDir,
  packageMap,
  dependencyFields,
  isDev = false,
  verbose = false
) {
  // will lookup or install a package matching pNameAndVersion.  Will
  // recursively install dependencies

  if (!packageMap) console.warn(`[flatn] install of ${pNameAndVersion}: No package map specified, using empty package map.`);
  if (!packageMap) packageMap = PackageMap.empty();

  if (!dependencyFields) dependencyFields = ['dependencies'];

  destinationDir = ensurePathFormat(destinationDir);

  if (!fs.existsSync(destinationDir)) { fs.mkdirSync(destinationDir); }

  let atIndex = pNameAndVersion.lastIndexOf('@');
  if (atIndex === -1) atIndex = pNameAndVersion.length;
  let name = pNameAndVersion.slice(0, atIndex);
  let version = pNameAndVersion.slice(atIndex + 1);
  let queue = [[name, version]];
  let seen = {};
  let newPackages = [];

  while (queue.length) {
    let [name, version] = queue.shift();
    let installed = packageMap.lookup(name, version);

    if (!installed) {
      (verbose || debug) && console.log(`[flatn] installing package ${name}@${version}`);
      installed = await packageDownload(name, version, destinationDir, verbose);
      if (!installed) { throw new Error(`Could not download package ${name + '@' + version}`); }

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

  if (newPackages.length > 0) { console.log(`[flatn] installed ${newPackages.length} new packages into ${destinationDir}`); }

  return { packageMap, newPackages };
}

function addDependencyToPackage (
  packageSpecOrDir,
  depNameAndRange,
  packageDepDir,
  packageMap,
  dependencyField,
  save = true,
  verbose = false
) {
  if (typeof packageSpecOrDir === 'string' || packageSpecOrDir.isResource) { packageSpecOrDir = ensurePathFormat(packageSpecOrDir); }

  packageDepDir = ensurePathFormat(packageDepDir);

  if (!dependencyField) dependencyField = 'dependencies'; /* vs devDependencies etc. */

  let packageSpec = typeof packageSpecOrDir === 'string'
    ? PackageSpec.fromDir(packageSpecOrDir)
    : packageSpecOrDir;

  let { location } = packageSpec;

  if (!packageSpec[dependencyField]) packageSpec[dependencyField] = {};

  let atIndex = depNameAndRange.lastIndexOf('@');
  if (atIndex === -1) atIndex = depNameAndRange.length;
  let depName = depNameAndRange.slice(0, atIndex);
  let depVersionRange = depNameAndRange.slice(atIndex + 1);
  let depVersion = packageSpec[dependencyField][depName];

  return installPackage(
    depNameAndRange,
    packageDepDir,
    packageMap,
    [dependencyField]/* dependencyFields */,
    false/* isDev */,
    verbose
  ).then(result => {
    if (!save) return result;
    let dep = result.packageMap.lookup(depName, depVersionRange);
    if (!depVersionRange) depVersionRange = dep.version;
    let isRange = semver.validRange(depVersionRange, true);
    let isRealRange = !semver.parse(depVersionRange, true);
    if (!isRange) depVersionRange = '*';
    else if (!isRealRange) depVersionRange = '^' + depVersionRange;
    if (dep) {
      if (!depVersion || !semver.parse(depVersion, true) || !semver.satisfies(depVersion, depVersionRange, true)) {
        packageSpec[dependencyField][depName] = depVersionRange;
        let config = fs.existsSync(j(location, 'package.json'))
          ? JSON.parse(String(fs.readFileSync(j(location, 'package.json'))))
          : { name: depName, version: dep.version };
        if (!config[dependencyField]) config[dependencyField] = {};
        config[dependencyField][depName] = depVersionRange;
        fs.writeFileSync(j(location, 'package.json'), JSON.stringify(config, null, 2));
      }
    }
    return result;
  });
}

async function installDependenciesOfPackage (
  packageSpecOrDir,
  dirToInstallDependenciesInto,
  packageMap,
  dependencyFields,
  verbose
) {
  // Given a package spec of an installed package (retrieved via
  // `PackageSpec.fromDir`), make sure all dependencies (specified in properties
  // `dependencyFields` of package.json) are installed
  if (typeof packageSpecOrDir === 'string' || packageSpecOrDir.isResource) { packageSpecOrDir = ensurePathFormat(packageSpecOrDir); }

  if (dirToInstallDependenciesInto) { dirToInstallDependenciesInto = ensurePathFormat(dirToInstallDependenciesInto); }

  let packageSpec = typeof packageSpecOrDir === 'string'
    ? PackageSpec.fromDir(packageSpecOrDir)
    : packageSpecOrDir;

  if (!packageSpec) { throw new Error(`Cannot resolve package: ${inspect(packageSpec, { depth: 0 })}`); }

  if (!dirToInstallDependenciesInto) dirToInstallDependenciesInto = dirname(packageSpec.location);
  if (!dependencyFields) dependencyFields = ['dependencies'];

  let deps = Object.assign({},
    dependencyFields.reduce((map, key) => Object.assign(map, packageSpec[key]), {}));
  let newPackages = [];

  for (let name in deps) {
    let newPackagesSoFar = newPackages;
    ({ packageMap, newPackages } = await installPackage(
      `${name}@${deps[name]}`,
      dirToInstallDependenciesInto,
      packageMap,
      ['dependencies'],
      false,
      verbose
    ));
    newPackages = newPackages.concat(newPackagesSoFar);
  }

  if ((verbose || debug) && !newPackages.length) { console.log(`[flatn] no new packages need to be installed for ${packageSpec.name}`); }

  return { packageMap, newPackages };
}

export {
  installDependenciesOfPackage,
  addDependencyToPackage,
  installPackage,
  buildPackage,
  buildPackageMap,
  ensurePackageMap,
  setPackageDirsOfEnv,
  packageDirsFromEnv,
  resetPackageMap
};
