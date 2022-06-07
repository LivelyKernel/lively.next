/*global require,process,__dirname, module*/
var path = require("path");
var fs = require("fs");
var Module = require("module");
var { x: execSync } = require("child_process");
var { ensurePackageMap, packageDirsFromEnv } = require("./flatn-cjs.js");

process.execPath = process.argv[0] = path.join(__dirname, "bin/node");

function resolveBaseName(request, config, context) {
  let map, baseName = request;
  // support the custom systemjs remapping
  if (context.startsWith('systemjs-') && (map = config.systemjs?.map)) {
    const envName = context === 'systemjs-node' ? 'node' : '~node';
    let remapping;
    if (remapping = map[request]?.[envName] || map[request]) {
      baseName = remapping;
    }
  }
  return baseName.startsWith('@') ? baseName.split("/").slice(0, 2).join('/') : baseName.split('/')[0];
}

/**
 * Resolve a module path/name to a url pointing to the file of the module (if present)
 * @param { string } request - The module name or partial path we want to resolve.
 * @param { string } parentId - The url of the module from which the requested module is imported from.
 * @param { 'node'|'system-browser'|'system-node' } context - Aside from resolving the package.json exclusively according to NPM standard, we can further adhere to the systemjs overrides sometimes defined within the package.json.
 */
function flatnResolve(request, parentId="", context='node') {
   let config = findPackageConfig(parentId),
       deps = config ? depMap(config) : {},
       basename = resolveBaseName(request, config, context),
       {packageCollectionDirs, individualPackageDirs, devPackageDirs} = packageDirsFromEnv(),
       packageMap = ensurePackageMap(packageCollectionDirs, individualPackageDirs, devPackageDirs),
       packageFound = packageMap.lookup(basename, deps[basename])
                   || packageMap.lookup(request, deps[request])/*for package names with "/"*/,
       resolved = packageFound && findModuleInPackage(packageFound, basename, request);
   
   if (resolved) return resolved;
   process.env.FLATN_VERBOSE && console.error(`Failing to require "${request}" from ${parentId}`);
   return null;
}

function findPackageConfig(modulePath) {
  let dir = path.dirname(modulePath), configs = [];
  // accumulate all found package.json files and merge them into one
  // until we reach one of the packageCollectionDirs or individualPackageDirs
  let {packageCollectionDirs, individualPackageDirs, devPackageDirs} = packageDirsFromEnv();
  while (true) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      configs.push(JSON.parse(fs.readFileSync(path.join(dir, "package.json"))));
    }
    let nextDir = path.dirname(dir);
    if (nextDir === dir) break;
    if (packageCollectionDirs.includes(nextDir)) break;
    if (individualPackageDirs.includes(nextDir)) break;
    dir = nextDir;
  }
  return configs.reduce(function(configA, configB) {
    return Object.assign(configA, configB);
  }, {});
}

function depMap(packageConfig) {
  return [ "dependencies","devDependencies", "peerDependencies", "optionalDependencies"]
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

module.exports = { flatnResolve, findModuleInPackage, depMap, findPackageConfig };
