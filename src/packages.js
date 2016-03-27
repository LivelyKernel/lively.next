import { arr } from "lively.lang";
import { getSystem } from "./system.js";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// packages
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function registerPackage(System, packageURL) {
  System = getSystem(System);

  packageURL = String(packageURL).replace(/\/$/, "");
  var packageInSystem = System.packages[packageURL] || (System.packages[packageURL] = {});

  var packageConfigURL = packageURL + "/package.json";
  
  System.meta[packageConfigURL] = {format: "json"}
  
  return System.import(packageConfigURL)
    .then(config => {
      arr.pushIfNotIncluded(System.packageConfigPaths, packageConfigURL);
      return config;
    })
    .catch((err) => {
      delete System.meta[packageConfigURL];
      var name = packageURL.split("/").slice(-1)[0];
      return {name: name}
    })
    .then(pkgConfig => {
      System.config({map: {[pkgConfig.name]: packageURL}});
      packageInSystem.main = (pkgConfig.systemjs && pkgConfig.systemjs.main) || pkgConfig.main || "index.js";
      return pkgConfig.name;
    });
}

export { registerPackage };
