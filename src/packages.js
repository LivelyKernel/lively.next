import { arr } from "lively.lang";
import { getSystem } from "./system.js";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// packages
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function registerPackage(System, packageURL) {
  System = getSystem(System);

  packageURL = String(packageURL).replace(/\/$/, "");
  System.packages[packageURL] || (System.packages[packageURL] = {});

  var packageConfigURL = packageURL + "/package.json";
  
  System.meta[packageConfigURL] = {format: "json"}
  
  return System.import(packageConfigURL)
    .then(config => {
      arr.pushIfNotIncluded(System.packageConfigPaths, packageConfigURL);
      return config.name;
    })
    .catch((err) => {
      delete System.meta[packageConfigURL];
      return packageURL.split("/").slice(-1)[0];
    })
    .then(name => {
      System.config({map: {[name]: packageURL}})
      return name;
    });
}

export { registerPackage };
