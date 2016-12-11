import { resource } from "lively.resources";
import { install as installHook, remove as removeHook, isInstalled as isHookInstalled } from "./hooks.js";

async function fetchResource(proceed, load) {
  const System = this,
        res = System.resource(load.name);

  if (load.name.match(/^lively:\/\//))
    load.metadata.format = "esm";

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

function livelyProtocol(proceed, url) {
  if (!url.match(/^lively:\/\//)) return proceed(url);
  const match = url.match(/^lively:\/\/([^\/]+)\/(.*)$/),
        worldId = match[1],
        localObjectName = match[2];
  return {
    read() {
      return Promise.resolve((typeof $morph !== "undefined"
           && $morph(localObjectName)
           && $morph(localObjectName).textString)
          || `/*Could not locate ${localObjectName}*/`);
    },
    write(source) {
      if (typeof $morph !== "undefined"
           && $morph(localObjectName)
           && $morph(localObjectName).textString) {
        $morph(localObjectName).textString = source;
        return Promise.resolve(source);
      } else {
        return Promise.reject(`Could not save morph ${localObjectName}`);
      }
    }
  };
}

function wrapResource(System) {
  if (!System.resource) {
    System.resource = resource;
  }
  if (!isHookInstalled(System, "fetch", fetchResource)) {
    installHook(System, "fetch", fetchResource);
  }
  if (!isHookInstalled(System, "resource", livelyProtocol)) {
    installHook(System, "resource", livelyProtocol);
  }
}

function unwrapResource(System) {
  removeHook(System, "fetch", fetchResource);
  removeHook(System, "resource", livelyProtocol);
  removeHook(System, "resource", resource);
}

export { wrapResource, unwrapResource };
