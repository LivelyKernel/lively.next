// pre-loading the dependencies here so we don't have to configure SystemJS
// with all the sub-sub-sub packages

function requireFromPackage(moduleName, pkgName) {
  var path = require("path"),
      module = require("module");
  try {
    var lookupPaths = [path.join(require.resolve(pkgName), "../node_modules")];
  } catch (e) {
    console.error(`[requireFromPackage] failure resolving ${pkgName}: ${e.stack || e}`);
    return;
  }
  try {
    var id = module._resolveFilename(moduleName, {paths: lookupPaths});
  } catch (e) {
    console.error(`[requireFromPackage] failure resolving ${moduleName} from ${lookupPaths[0]}: ${e.stack || e}`);
    return;
  }
  return require(id);
}

requireFromPackage("socket.io", "lively.server");
requireFromPackage("socket.io-client", "lively.2lively");


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


var fs = require("fs");
var path = require("path");
var j = path.join

var ignore = [
  ".bin", "babel-preset-es2015-rollup", "rollup-plugin-babel", "rollup", "recast",
  'repeating',
  'private',
  'minimatch',
  'path-is-absolute',
  'mkdirp',
  'once',
  'esprima-fb',
  'glob',
  'lodash',
  'regenerate',
  'minimist',
  'jsesc' 
  ];

function recursively_map_node_modules(dir, maxDepth = 10, depth = 0) {
  // copy so that only dependent modules get to know their uppers

  if (depth > maxDepth) return;

  var subDirs = map_node_modules(dir);
  subDirs
    .filter(ea => !fs.lstatSync(ea).isSymbolicLink())
    .forEach(ea => recursively_map_node_modules(ea, maxDepth, depth + 1));
}

function map_node_modules(dir, knownPackages) {
  var confFile = j(dir, "package.json"),
      node_modulesDir = j(dir, "node_modules");
  if (!fs.existsSync(node_modulesDir)) return [];
  var node_modulesPackages = fs.readdirSync(node_modulesDir).filter(ea => ignore.indexOf(ea) === -1)
  console.log(`In ${node_modulesDir}:\n  ${node_modulesPackages.join("\n  ")}`);  
  return node_modulesPackages.map(ea => j(node_modulesDir, ea))
}

// module.exports = recursively_map_node_modules;


var dir = __dirname + "/..";

recursively_map_node_modules(dir)
