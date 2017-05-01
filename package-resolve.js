/*global require*/
"format cjs";

var path = require("path");
var fs = require("fs");
var Module = require("module");
var semver = require("./semver.min.js");
var { x: execSync } = require("child_process");

process.env.CENTRAL_NODE_PACKAGE_DIR = "/Users/robert/.central-node-packages"

let centralPackageDir = process.env.CENTRAL_NODE_PACKAGE_DIR,
    knownPackageDirs = fs.readdirSync(centralPackageDir)

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

let orig__resolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain) {
  try {
    let result = orig__resolveFilename.call(this, request, parent, isMain);
    // console.log(`${request} => ${result}`);
    return result;
  } catch (err) {
    let parentId = parent ? parent.filename || parent.id : "",
        // _ = console.log(`[_resolveFilename] searching for "${request}" from ${parentId}`),
        config = findPackageConfig(parentId),
        deps = config && depMap(config),
        basename = request.split("/")[0],
        globalModulesMatching = findPathToModule(basename, deps[basename]),
        // _2 = console.log(`globalModulesMatching: ${globalModulesMatching.join(", ")}`),
        resolved = resolveModuleInGlobalPackage(globalModulesMatching, basename, request);

    if (resolved) return resolved;

    throw err;
  }
}

function findPackageConfig(modulePath) {
  let dir = path.dirname(modulePath), config = null;
  while (true) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      config = JSON.parse(fs.readFileSync(path.join(dir, "package.json")));
      break;
    }
    let nextDir = path.dirname(dir);
    if (nextDir === dir) break;
    dir = nextDir;
  }
  return config;
}

function depMap(packageConfig) {
  return ["peerDependencies","dependencies","devDependencies", "optionalDependencies"]
    .reduce((deps, field) => {
       if (!packageConfig[field]) return deps;
      for (let name in packageConfig[field])
        Object.assign(deps, packageConfig[field]);
      return deps;
    }, {});
}

function findPathToModule(modName, modVersionRange = "*") {
  return knownPackageDirs.filter(ea => {
    let [name, version] = ea.split("@");
    return name === modName && semver.satisfies(version, modVersionRange);
  });
}

function resolveModuleInGlobalPackage(globalModulesMatching, basename, request) {
  for (let modName of globalModulesMatching) {
    let dir = path.join(centralPackageDir, modName),
        fullpath;
    if (basename === request) {
      let config = findPackageConfig(path.join(dir, "index.js"));
      if (!config || !config.main) fullpath = path.join(dir, "index.js");
      else fullpath = path.join(dir, config.main);
    } else fullpath = path.join(dir, request.slice(basename.length));
    if (fs.existsSync(fullpath)) return fullpath;
    if (fs.existsSync(fullpath + ".js")) return fullpath + ".js";
  }
}

