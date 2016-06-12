/*global System, fetch*/

import { WebDAVResource } from "./src/http-resource.js";

import { NodeJSFileResource } from "./src/fs-resource.js";

var isNode = System.get("@system-env").node;

export function resource(url) {
  if (!url) throw new Error("lively.resource resource constructor: expects url but got " + url);
  if (url.isResource) return url;
  if (url.match(/^http/i)) return new WebDAVResource(url);
  if (url.match(/^file/i) && isNode) return new NodeJSFileResource(url);
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
