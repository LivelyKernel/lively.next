/*global System,babel*/
export { default as Resource } from "./src/resource.js";
export { parseQuery } from "./src/helpers.js";
import { resourceExtension as httpResourceExtension } from "./src/http-resource.js";
import { resourceExtension as fileResourceExtension } from "./src/fs-resource.js";
import { resourceExtension as localResourceExtension } from "./src/local-resource.js";

var extensions = extensions || []; // [{name, matches, resourceClass}]

registerExtension(localResourceExtension);
registerExtension(httpResourceExtension);
registerExtension(fileResourceExtension);

export function resource(url, opts) {
  if (!url) throw new Error("lively.resource resource constructor: expects url but got " + url);
  if (url.isResource) return url;
  url = String(url);
  for (var i = 0; i < extensions.length; i++)
    if (extensions[i].matches(url))
      return new extensions[i].resourceClass(url, opts);
  throw new Error(`Cannot find resource type for url ${url}`);
}

export async function createFiles(baseDir, fileSpec, opts) {
  // creates resources as specified in fileSpec, e.g.
  // {"foo.txt": "hello world", "sub-dir/bar.js": "23 + 19"}
  // supports both sync and async resources
  let base = resource(baseDir, opts).asDirectory();
  await base.ensureExistance();
  for (let name in fileSpec) {
    if (!fileSpec.hasOwnProperty(name)) continue;
    let resource = base.join(name);
    typeof fileSpec[name] === "object" ?
      await createFiles(resource, fileSpec[name], opts) :
      await resource.write(fileSpec[name]);
  }
  return base;
}

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
      var moduleId = (await System.normalize("fetch-ponyfill", thisModuleId)).replace("file://", "")
      fetchInterface = System._nodeRequire(moduleId)
    }
  } else {
    fetchInterface = await System.import("fetch-ponyfill", thisModuleId)
  }
  Object.assign(System.global, fetchInterface())
}

export function registerExtension(extension) {
  // extension = {name: STRING, matches: FUNCTION, resourceClass: RESOURCE}
  // name: uniquely identifying this extension
  // predicate matches gets a resource url (string) passed and decides if the
  // extension handles it
  // resourceClass needs to implement the Resource interface
  var {name} = extension;
  extensions = extensions.filter(ea => ea.name !== name).concat(extension);
}

export function unregisterExtension(extension) {
  var name = typeof extension === "string" ? extension : extension.name;
  extensions = extensions.filter(ea => ea.name !== name);
}