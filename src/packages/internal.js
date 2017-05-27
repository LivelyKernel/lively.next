import { isURL, urlResolve, join } from '../url-helpers.js';
import { arr, obj } from "lively.lang";

export function normalizeInsidePackage(System, urlOrNameOrMap, packageURL) {
  // for env dependend rules like {"node": "./foo.js", "~node": "./bar.js"}
  if (typeof urlOrNameOrMap === "object") {
    let map = urlOrNameOrMap,
        env = System.get("@system-env");
    let found = lively.lang.arr.findAndGet(Object.keys(map), key => {
      let negate = false, pred = key;
      if (pred.startsWith("~")) { negate = true; pred = pred.slice(1); }
      let matches = env[pred]; if (negate) matches = !matches;
      return matches ? map[key] : null;
    });
    if (found) normalizePackageURL(System, found, packageURL);
  }

  let urlOrName = urlOrNameOrMap;
  return isURL(urlOrName) ?
    // absolute
    urlOrName :
    // relative to either the package or the system:
    urlResolve(join(urlOrName[0] === "." ? packageURL : System.baseURL, urlOrName));
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
