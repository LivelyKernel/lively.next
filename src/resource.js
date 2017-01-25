import { resource } from "lively.resources";
import {
  install as installHook,
  remove as removeHook,
  isInstalled as isHookInstalled
} from "./hooks.js";

async function fetchResource(proceed, load) {
  const System = this,
        res = System.resource(load.name);

  if (!res) return proceed(load);

  var result, error;
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
