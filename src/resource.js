import { resource } from "lively.resources";
import { install as installHook, remove as removeHook, isInstalled as isHookInstalled } from "./hooks.js";

function fetch_resource(proceed, load) {
  const System = this,
        res = System.resource(load.name);
  if (load.name.match(/^lively:\/\//)) {
    load.metadata.format = "esm";
  }

  if (res) {
    return res.read();
  }
  return proceed(load);
}

function lively_protocol(proceed, url) {
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
  if (!isHookInstalled(System, "fetch", fetch_resource)) {
    installHook(System, "fetch", fetch_resource);
  }
  if (!isHookInstalled(System, "resource", lively_protocol)) {
    installHook(System, "resource", lively_protocol);
  }
}

function unwrapResource(System) {
  removeHook(System, "fetch", fetch_resource);
  removeHook(System, "resource", lively_protocol);
  removeHook(System, "resource", resource);
}

export { wrapResource, unwrapResource };
