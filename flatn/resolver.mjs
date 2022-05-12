/*global require,process,__dirname,URL*/
import path from "path";
import fs from "fs";
import Module from "module";
import { ensurePackageMap, packageDirsFromEnv, findPackageConfig } from "./flatn-cjs.js";

process.execPath = process.argv[0] = path.join(import.meta.url, "bin/node");

let counter = 0;

function depMap(packageConfig) {
  return ["peerDependencies","dependencies","devDependencies", "optionalDependencies"]
    .reduce((deps, field) => {
       if (!packageConfig[field]) return deps;
      for (let name in packageConfig[field])
        Object.assign(deps, packageConfig[field]);
      return deps;
    }, {});
}

function findModuleInPackage(requesterPackage, basename, request) {
  // Given {name, version, path} from resolveFlatPackageToModule, will find the
  // full path to the module inside of the package, using the module request
  // let {config: {name, version}, location: pathToPackage} = requesterPackage
  let {name, version, location: pathToPackage} = requesterPackage
  let fullpath;

  if (name === request) {
    let config = findPackageConfig(path.join(pathToPackage, "index.js"));
    if (!config || !config.main) fullpath = path.join(pathToPackage, "index.js");
    else fullpath = path.join(pathToPackage, config.main);
  } else fullpath = path.join(pathToPackage, request.slice(basename.length));

  if (fs.existsSync(fullpath)) {
    return !fs.statSync(fullpath).isDirectory() ?
      fullpath :
      fs.existsSync(fullpath + ".js") ?
        fullpath + ".js" : path.join(fullpath, "index.js");
  }
  if (fs.existsSync(fullpath + ".js")) return fullpath + ".js";
  if (fs.existsSync(fullpath + ".json")) return fullpath + ".json";
  // packageConfig.main field wrong? yes, this happens...
  if (fullpath !== path.join(pathToPackage, "index.js") &&
     fs.existsSync(path.join(pathToPackage, "index.js")))
    return path.join(pathToPackage, "index.js");
  return null;
}



/**
 * @param {string} specifier
 * @param {{
 *   conditions: string[],
 *   parentURL: string | undefined,
 * }} context
 * @param {Function} defaultResolve
 * @returns {Promise<{ url: string }>}
 */

export async function resolve(request, parent, originalResolve) {
  try {
    let result = await originalResolve(request, parent, originalResolve);
    return result;
  } catch (err) {
    let parentId = parent ? parent.parentURL : "",
        config = findPackageConfig(parentId),
        deps = config ? depMap(config) : {},
        basename = request.startsWith('@') ? request.split("/").slice(0, 2).join('/') : request.split('/')[0],
        {packageCollectionDirs, individualPackageDirs, devPackageDirs} = packageDirsFromEnv(),
        packageMap = ensurePackageMap(packageCollectionDirs, individualPackageDirs, devPackageDirs),
        packageFound = packageMap.lookup(basename, deps[basename])
                    || packageMap.lookup(request, deps[request])/*for package names with "/"*/,
        resolved = packageFound && findModuleInPackage(packageFound, basename, request);

    if (resolved) return { url: 'file://' + resolved };
    process.env.FLATN_VERBOSE && console.error(`Failing to require "${request}" from ${parentId}`);
    throw err;
  }
}