/*global System*/
import { WebDAVResource } from "./src/http-resource.js";
import { NodeJSFileResource } from "./src/fs-resource.js";

export function resource(url) {
  if (!url) throw new Error("lively.resource resource constructor: expects url but got " + url);
  if (url.isResource) return url;
  url = String(url);
  if (url.match(/^http/i)) return new WebDAVResource(url);
  if (url.match(/^file/i)) return new NodeJSFileResource(url);
  throw new Error(`Cannot find resource type for url ${url}`);
}

export async function createFiles(baseDir, fileSpec) {
  var base = resource(baseDir).asDirectory();
  await base.ensureExistance();
  for (var name in fileSpec) {
    if (!fileSpec.hasOwnProperty(name)) continue;
    let resource = base.join(name)
    if (typeof fileSpec[name] === "object") {
      await createFiles(resource, fileSpec[name])
    } else {
      await resource.write(fileSpec[name]);
    }
  }
  return base;
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
      script.setAttributeNS(this.XLINKNamespace, 'href', url) :
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

  if ("fetch" in System.global) return Promise.resolve();
  var thisModuleId = System.decanonicalize("lively.resources"),
      fetchInterface;
  if (System.get("@system-env").node) {
    var moduleId = (await System.normalize("fetch-ponyfill", thisModuleId)).replace("file://", "")
    fetchInterface = System._nodeRequire(moduleId)
  } else {
    fetchInterface = await System.import("fetch-ponyfill", thisModuleId)
  } 
  Object.assign(System.global, fetchInterface())
}
