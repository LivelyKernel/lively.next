import { isURL, urlResolve, join } from '../url-helpers.js';
import { arr, obj } from "lively.lang";

export function normalizeInsidePackage(System, urlOrName, packageURL) {
  return isURL(urlOrName) ?
    urlOrName : // absolute
    urlResolve(join(urlOrName[0] === "." ? packageURL : System.baseURL, urlOrName)); // relative to either the package or the system:
}

export function normalizePackageURL(System, packageURL) {
  if (allPackageNames(System).some(ea => ea === packageURL))
    return packageURL;

  var url = System.decanonicalize(packageURL.replace(/[\/]+$/, "") + "/");

  if (!isURL(url))
    throw new Error(`Strange package URL: ${url} is not a valid URL`)

  // ensure it's a directory
  if (!url.match(/\.js/)) url = url;
  else if (url.indexOf(url + ".js") > -1) url = url.replace(/\.js$/, "");
  else url = url.split("/").slice(0,-1).join("/");

  if (url.match(/\.js$/))
    throw new Error("packageURL is expected to point to a directory but seems to be a .js file: " + url);

  return String(url).replace(/\/$/, "");
}


export function allPackageNames(System) {
  let sysPackages = System.packages,
      livelyPackages = packageStore(System);
  return arr.uniq(Object.keys(sysPackages).concat(Object.keys(livelyPackages)))
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// We add instances of Package to the System which basically serves as
// "database" for all module / package related state.
// This also makes it easy to completely replace the module / package state by
// simply replacing the System instance
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// System.get("@lively-env").packages["http://localhost:9011/lively-system-interface/node_modules/lively.vm"] = new Package(System, System.decanonicalize("lively.vm/"))

export function packageStore(System) {
  return System.get("@lively-env").packages;
}

export function addToPackageStore(System, p) {
  var pInSystem = System.getConfig().packages[p.url] || {};
  p.mergeWithConfig(pInSystem);
  var store = packageStore(System);
  store[p.url] = p;
  return p;
}

export function removeFromPackageStore(System, o) {
  var store = packageStore(System);
  delete store[o.url];
}

export function findPackageNamed(System, name) {
  return obj.values(packageStore(System))
    .find(ea => ea.name === name);
}
