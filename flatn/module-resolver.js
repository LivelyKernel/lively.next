/* global require,process,__dirname, module */
let path = require('path');
let fs = require('fs');
let { ensurePackageMap, packageDirsFromEnv } = require('./flatn-cjs.js');

process.execPath = process.argv[0] = path.join(__dirname, 'bin/node');

/**
 * Handles the proper base name resolution of @ prefixed package names or
 * SystemJS specific import mappings.
 * @param { string } request - The module reference.
 * @param { object } config - The package config the module belongs to.
 * @param {  'node-import'|'node-require'|'system-browser'|'system-node' } context - The resolution context.
 */
function resolveBaseName (request, config, context) {
  let map; let baseName = request;
  if (context.startsWith('systemjs-') && (map = config.systemjs?.map)) {
    const envName = context === 'systemjs-node' ? 'node' : '~node';
    let remapping;
    if (remapping = map[request]?.[envName] || map[request]) {
      baseName = remapping;
    }
  }
  if (baseName.match(/^https?\:\/\//)) return baseName;
  if (baseName.startsWith('@')) return baseName.split('/').slice(0, 2).join('/');
  return baseName.split('/')[0];
}

/**
 * Traverses the directory chain starting from the provided module until one of
 * the package dirs is reached.
 * @param { string } modulePath - The path to the module from where to traverse.
 * @param { function } cb - The callback to invoke for each directory.
 * @param { string } The final directory we ended at.
 */
function traverseUntilPkgDir (modulePath, cb) {
  let dir = path.dirname(modulePath);
  let { packageCollectionDirs, individualPackageDirs, devPackageDirs } = packageDirsFromEnv();
  while (true) {
    cb(dir);
    if (devPackageDirs.includes(dir)) break; // dev package dirs directly define pkg locations, do they are no "parent" dirs.
    let nextDir = path.dirname(dir);
    if (nextDir === dir) break;
    if (packageCollectionDirs.includes(nextDir)) break;
    if (individualPackageDirs.includes(nextDir)) break;
    dir = nextDir;
  }
  return dir;
}

/**
 * Accumulate all found package.json files and merge them into one
 * until we reach one of the packageCollectionDirs or individualPackageDirs
 * @param { string } modulePath - The absolute path of the module from where we want to gather all the effective package.json files.
 * @returns { object } The synthesized 
 */
function findPackageConfig (modulePath) {
  let configs = [];
  traverseUntilPkgDir(modulePath, (dir) => {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      configs.push(JSON.parse(fs.readFileSync(path.join(dir, 'package.json'))));
    }
  });
  return configs.reduce(function (configA, configB) {
    return Object.assign(configA, configB);
  }, {});
}

function depMap (packageConfig) {
  return ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']
    .reduce((deps, field) => {
      if (!packageConfig[field]) return deps;
      Object.assign(deps, packageConfig[field]);
      return deps;
    }, {});
}

function resolveExportMapping(mapping, context) {
  if (!mapping) throw Error('Cannot resolve undefined mapping!');
  if (typeof mapping === 'string') return mapping;
  let adjustedPath;
  if (Array.isArray(mapping)) {
    for (let subMapping of mapping) {
      adjustedPath = resolveExportMapping(subMapping, context);
      if (adjustedPath) {
        mapping = adjustedPath;
        break; 
      }
    }
  }
  if (typeof mapping === 'object') {
    switch (context) {
      case 'node-require': adjustedPath = mapping.node || mapping.require || mapping.default; break;
      case 'node-import': adjustedPath = mapping.node || mapping.import || mapping.default; break;
      default: adjustedPath = mapping.default;
    }
    return resolveExportMapping(adjustedPath, context);
  }
  
  return adjustedPath;
}

/**
 * Given {name, version, path} from resolveFlatPackageToModule, will find the
 * full path to the module inside of the package, using the module request.
 * @param { object } requesterPackage - The package from where the module should be loaded.
 * @param { string } basename - The base name of the package.
 * @param { string } request - The import string for the module.
 * @param { 'node-require'|'node-import'|'system-browser'|'system-node' } context - Aside from resolving the module exclusively according to NPM standard, we can further adhere to the systemjs overrides sometimes defined within the package.json.
 * @returns { string } The absolute path to the module.
 */
function findModuleInPackage (requesterPackage, basename, request, context) {
  let { name, location: pathToPackage, exports: exportMappings } = requesterPackage;
  let fullpath;
  const isNode = context.includes('node');

  if (name === request) {
    let config = findPackageConfig(path.join(pathToPackage, 'index.js'));
    if (!isNode && config.browser && typeof config.browser === 'string') {
      fullpath = path.join(pathToPackage, config.browser);
    } else if (exportMappings?.['.']) {
      let adjustedPath = resolveExportMapping(exportMappings['.'], context);
      fullpath = path.join(pathToPackage, adjustedPath);
    } else if (typeof exportMappings === 'string') {
      fullpath = path.join(pathToPackage, exportMappings);
    } else if (context.includes('import') && exportMappings?.import) {
      fullpath = path.join(pathToPackage, resolveExportMapping(exportMappings.import, context));
    } else if (context.includes('require') && exportMappings?.require) {
      fullpath = path.join(pathToPackage, resolveExportMapping(exportMappings.require, context));
    } else if (config.main) {
      fullpath = path.join(pathToPackage, config.main);
    } else { // final fallback 
      fullpath = path.join(pathToPackage, 'index.js');
    }
  } else {
    let subpath = './' + request.slice(basename.length + 1);
    let adjustedPath = subpath;
    if (exportMappings?.[subpath]) {
      adjustedPath = resolveExportMapping(exportMappings[subpath], context);
    } else if (exportMappings) {
      // check if there is a matching wildcard in the exports that we can utilize
      const matchingMapping = Object.entries(exportMappings).find(([match, mapping]) => {
        if (match.endsWith('*') && subpath.startsWith(match.slice(0, -1))) return true;
      });
      if (matchingMapping) {
        let [wildcard, mapping] = matchingMapping;
        mapping = resolveExportMapping(mapping, context);
        adjustedPath = adjustedPath.slice(wildcard.length - 1);
        adjustedPath = mapping.replace('*', adjustedPath);
      }
    }

    fullpath = path.join(pathToPackage, adjustedPath);
  }

  if (fs.existsSync(fullpath)) {
    return !fs.statSync(fullpath).isDirectory()
      ? fullpath
      : fs.existsSync(fullpath + '.js')
        ? fullpath + '.js'
        : path.join(fullpath, 'index.js');
  }
  if (fs.existsSync(fullpath + '.js')) return fullpath + '.js';
  if (fs.existsSync(fullpath + '.json')) return fullpath + '.json';
  // packageConfig.main field wrong? yes, this happens...
  if (fullpath !== path.join(pathToPackage, 'index.js') &&
     fs.existsSync(path.join(pathToPackage, 'index.js'))) { return path.join(pathToPackage, 'index.js'); }
  return null;
}

/**
 * Resolve a module path/name to a url pointing to the file of the module (if present)
 * @param { string } request - The module name or partial path we want to resolve.
 * @param { string } parentId - The url of the module from which the requested module is imported from.
 * @param { 'node-require'|'node-import'|'system-browser'|'system-node' } context - Aside from resolving the package.json exclusively according to NPM standard, we can further adhere to the systemjs overrides sometimes defined within the package.json.
 */
function flatnResolve (request, parentId = '', context = 'node') {
  let config = findPackageConfig(parentId);
  let deps = config ? depMap(config) : {};
  let basename = resolveBaseName(request, config, context);
  let { packageCollectionDirs, individualPackageDirs, devPackageDirs } = packageDirsFromEnv();
  let packageMap = ensurePackageMap(packageCollectionDirs, individualPackageDirs, devPackageDirs);
  let packageFound = packageMap.lookup(basename, deps[basename]) ||
                   packageMap.lookup(request, deps[request])/* for package names with "/" */;
  
  let resolved;
  if (!packageFound && deps[basename]?.startsWith('npm:')) {
    let version;
    [basename, version] = deps[basename].match(/npm:(.*)@(.*)/).slice(1);
    packageFound = packageMap.lookup(basename, version);
    resolved = packageFound && findModuleInPackage(packageFound, basename, basename, context);
  } else {
    resolved = packageFound && findModuleInPackage(packageFound, basename, request, context);
  }

  if (basename === '@empty') return '@empty';
  if (basename && basename.match(/^https?\:\/\//)) return basename;
  if (resolved) return resolved;
  process.env.FLATN_VERBOSE && console.error(`Failing to require "${request}" from ${parentId}`);
  return null;
}

function findPackagePathForModule (modulePath) {
  let dir;
  traverseUntilPkgDir(modulePath, (curr) => dir = curr);
  return dir;
}

module.exports = { flatnResolve, findModuleInPackage, depMap, findPackageConfig, findPackagePathForModule };
