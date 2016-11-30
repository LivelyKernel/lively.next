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