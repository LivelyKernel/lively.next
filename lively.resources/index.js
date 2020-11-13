/*global System,babel*/
export { default as Resource } from "./src/resource.js";
import { unregisterExtension, registerExtension, parseQuery, extensions, createFiles, resource } from './src/helpers.js';
import { resourceExtension as httpResourceExtension } from "./src/http-resource.js";
import { resourceExtension as fileResourceExtension } from "./src/fs-resource.js";
import { resourceExtension as localResourceExtension } from "./src/local-resource.js";
import { newUUID } from "lively.lang/string.js";
import { waitFor } from "lively.lang/promise.js";

registerExtension(localResourceExtension);
registerExtension(httpResourceExtension);
registerExtension(fileResourceExtension);

export async function createFileSpec(baseDir, depth = "infinity", opts) {
  let files = await baseDir.dirList(depth, opts), spec = {};
  for (let file of files) {
    let content = file.isDirectory() ? {} : await file.read(),
        path = file.asFile().relativePathFrom(baseDir).split("/"),
        parentDir = spec;
    for (let pathPart of path.slice(0, -1)) {
      if (!parentDir[pathPart]) parentDir[pathPart] = {};
      parentDir = parentDir[pathPart];
    }
    parentDir[path[path.length-1]] = content;
  }
  return spec;
}

export async function importModuleViaNative(url) {
  var parentNode = document.head,
      xmlNamespace = parentNode.namespaceURI,
      useBabelJsForScriptLoad = false,
      SVGNamespace = "http://www.w3.org/2000/svg",
      evalId = newUUID(),
      XLINKNamespace = "http://www.w3.org/1999/xlink";

  var script = document.createElementNS(xmlNamespace, 'script');

  script.setAttribute('type', "module");
  parentNode.appendChild(script);
  script.innerText = `import m from '${url}'; window['${evalId}'] = m;`

  script.setAttributeNS(null, 'async', true);
  const mod = await waitFor(30 * 1000, () => window[evalId]);
  delete window[evalId];
  script.remove();
  return mod;
}

export function loadViaScript(url, onLoadCb) {
  // load JS code by inserting a <script src="..." /> tag into the
  // DOM. This allows cross domain script loading and JSONP

    var parentNode = document.head,
        xmlNamespace = parentNode.namespaceURI,
        useBabelJsForScriptLoad = false,
        SVGNamespace = "http://www.w3.org/2000/svg",
        XLINKNamespace = "http://www.w3.org/1999/xlink";

  return new Promise((resolve, reject) => {
    var script = document.createElementNS(xmlNamespace, 'script');

    if (useBabelJsForScriptLoad && typeof babel !== "undefined") {
      script.setAttribute('type', "text/babel");
    } else {
      script.setAttribute('type', 'text/ecmascript');
    }

    parentNode.appendChild(script);
    script.setAttributeNS(null, 'id', url);

    script.namespaceURI === SVGNamespace ?
      script.setAttributeNS(XLINKNamespace, 'href', url) :
      script.setAttribute('src', url);

    script.onload = resolve;
    script.onerror = reject;
    script.setAttributeNS(null, 'async', true);
  });
}

export async function ensureFetch() {
  /*
    Usage like

    if (typeof fetch === "undefined" && typeof lively !== "undefined" && lively.resources) {
      console.log("Installing fetch polyfill...")
      lively.resources.ensureFetch().then(function() {
        console.log("fetch polyfill installed")
      }).catch(function(err) {
        console.error("Error installing fetch:");
        console.error(err);
      });
    }
  */

  if ("fetch" in System.global && "Headers" in System.global) return Promise.resolve();
  var thisModuleId = System.decanonicalize("lively.resources"),
      fetchInterface;
  if (System.get("@system-env").node) {
    try {
      fetchInterface = System._nodeRequire("fetch-ponyfill");
    } catch (err) {
      var moduleId = (await System.normalize("fetch-ponyfill", thisModuleId)).replace("file://", "");
      ({ default: fetchInterface } = await System.import(moduleId));
    }
  } else {
    fetchInterface = await System.import("fetch-ponyfill", thisModuleId)
  }
  Object.assign(System.global, fetchInterface())
}



export { registerExtension, unregisterExtension, parseQuery, extensions, createFiles, resource };
