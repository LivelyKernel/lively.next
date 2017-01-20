/* global System */
import { resource } from "lively.resources";
import { BrowserModuleTranslationCache, rememberToCache } from "./instrumentation.js";
import module, { detectModuleFormat } from "./module.js";
import {
  install as installHook,
  remove as removeHook,
  isInstalled as isHookInstalled
} from "./hooks.js";

async function fetchResourceCached(proceed, load) {
   var cache = System._livelyModulesTranslationCache
               || (System._livelyModulesTranslationCache = new BrowserModuleTranslationCache()),
       modulePath = load.name.replace(System.baseURL, ""),
       p = lively.modules.module(modulePath).package(),
       combinedPackage = await cache.fetchStoredModuleSource(p.name),
       currentPackageHash = System.get("@lively-env").packageCache.packageHashIndex[p.name];
    if (!combinedPackage || combinedPackage.hash != currentPackageHash) {
       combinedPackage = await resource(System.baseURL + "combined/" + p.name + ".json").makeProxied().read();
       if (JSON.parse(combinedPackage).isError) {
           rememberToCache(p.name, modulePath);
           return null;
       }
       cache.cacheModuleSource(p.name, currentPackageHash, combinedPackage);
       combinedPackage = JSON.parse(combinedPackage);  
    } else {
       combinedPackage = JSON.parse(combinedPackage.source);
    }
    if (combinedPackage) {
       if (combinedPackage[modulePath.slice(modulePath.indexOf(p.name))]) {
          return combinedPackage[modulePath.slice(modulePath.indexOf(p.name))];
       } else {
          // the combined package is missing a file that is meant to be there, so
          // ask the server to update the combined package to also include that file
          rememberToCache(p.name, modulePath);
       }
    }
    return null;
}

async function fetchResource(proceed, load) {
  var result, error, System = this;
  if (System.get("@lively-env").packageCache.cachedFetch) {
      result = await fetchResourceCached(proceed, load);
      if (result) return result;
  }
  console.log("fetching: ", load.name, System.get("@lively-env").packageCache.cachedFetch);
  var res = System.resource(load.name);

  if (!res) return proceed(load);
  try { result = await res.read(); } catch (e) { error = e }

  // if we are in a browser we try to use the proxy when cors requests fail
  if (error && System.get("@system-env").browser) {
    var isWebResource = res.url.startsWith("http"),
        isCrossDomain = !res.url.startsWith(document.location.origin)
    if (isWebResource && isCrossDomain) {
      try {
        result = await res.makeProxied().read();
        error = null;
      } catch (e) {}
    }
  }

  if (error) throw error;

  return result;
}


// FIXME!!!
const livelyURLRe = /^lively:\/\/([^\/]+)\/(.*)$/;
function livelyProtocol(proceed, url) {
  const match = url.match(livelyURLRe);
  if (!match) return proceed(url);
  var [_, worldId, id] = match;
  return {
    read() {
      var m = typeof $world !== "undefined" && $world.getMorphWithId(id);
      return Promise.resolve(m ? m.textString : `/*Could not locate ${id}*/`);
    },
    write(source) {
      var m = typeof $world !== "undefined" && $world.getMorphWithId(id);
      if (!m) return Promise.reject(`Could not save morph ${id}`);
      m.textString = source;
      return Promise.resolve(this);
    }
  };
}


export function wrapResource(System) {
  System.resource = resource;
  if (isHookInstalled(System, "fetch", fetchResource))
    removeHook(System, "fetch", "fetchResource");
  installHook(System, "fetch", fetchResource);
  if (isHookInstalled(System, "resource", "livelyProtocol"))
    removeHook(System, "fetch", "livelyProtocol");
  installHook(System, "resource", livelyProtocol);
}

export function unwrapResource(System) {
  removeHook(System, "fetch", "fetchResource");
  removeHook(System, "resource", "livelyProtocol");
  delete System.resource;
}
