import { obj } from "lively.lang";
import PackageConfiguration from "./packages/configuration.js";
import { getPackage, Package } from "./packages/package.js";


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// interface
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function importPackage(System, packageURL) { return getPackage(System, packageURL).import(); }
function registerPackage(System, packageURL, optPkgConfig) {
  return getPackage(System, packageURL).register(optPkgConfig);
}
function removePackage(System, packageURL) {
  return getPackage(System, packageURL).remove();
}
function reloadPackage(System, packageURL, opts) {
  return getPackage(System, packageURL).reload(opts);
}

function getPackages(System) {
  // Note does not return package instances but spec objects that can be JSON
  // stringified(!) like
  // ```
  // [{
  //   address: package-address,
  //   modules: [module-name-1, module-name-2, ...],
  //   name: package-name,
  //   names: [package-name, ...]
  //   version: semver version number
  // }, ... ]
  // ```
  return Package.allPackages(System).map(p => {
    return {
      ...obj.select(p, [
        "name", "main", "map", "meta",
        "url", "address", "version"
      ]),
      modules: p.modules().map(m =>
        ({name: m.id, deps: m.directRequirements().map(ea => ea.id)}))
    }
  })
}

function applyConfig(System, packageConfig, packageURL) {
  let p = getPackage(System, packageURL),
      configResult = new PackageConfiguration(p).applyConfig(packageConfig);
  configResult.subPackages = configResult.subPackages.map(url => getPackage(System, url));
  return configResult;
}

export {
  Package,
  getPackage,
  importPackage,
  registerPackage,
  removePackage,
  reloadPackage,
  applyConfig,
  getPackages
};
