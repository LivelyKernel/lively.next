// pre-loading the dependencies here so we don't have to configure SystemJS
// with all the sub-sub-sub packages

function requireFromPackage(moduleName, pkgName) {
var path = require("path"),
    module = require("module"),
    lookupPaths = [path.join(require.resolve(pkgName), "../node_modules")],
    id = module._resolveFilename(moduleName, {paths: lookupPaths});
  return require(id);
}

requireFromPackage("socket.io", "lively.server");
requireFromPackage("socket.io-client", "lively.2lively");