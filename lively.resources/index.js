/* global System,babel */
export { default as Resource } from './src/resource.js';
import { unregisterExtension, registerExtension, parseQuery, extensions, createFiles, resource } from './src/helpers.js';
import { resourceExtension as httpResourceExtension } from './src/http-resource.js';
import { resourceExtension as fileResourceExtension } from './src/fs-resource.js';
import { resourceExtension as localResourceExtension } from './src/local-resource.js';
import { resourceExtension as esmResourceExtension } from './src/esm-resource.js';
import { newUUID } from 'lively.lang/string.js';
import { waitFor } from 'lively.lang/promise.js';

registerExtension(localResourceExtension);
registerExtension(httpResourceExtension);
registerExtension(fileResourceExtension);
registerExtension(esmResourceExtension);

export async function createFileSpec (baseDir, depth = 'infinity', opts) {
  let files = await baseDir.dirList(depth, opts); let spec = {};
  for (let file of files) {
    let content = file.isDirectory() ? {} : await file.read();
    let path = file.asFile().relativePathFrom(baseDir).split('/');
    let parentDir = spec;
    for (let pathPart of path.slice(0, -1)) {
      if (!parentDir[pathPart]) parentDir[pathPart] = {};
      parentDir = parentDir[pathPart];
    }
    parentDir[path[path.length - 1]] = content;
  }
  return spec;
}

export async function importModuleViaNative (url) {
  let parentNode = document.head;
  let xmlNamespace = parentNode.namespaceURI;
  let useBabelJsForScriptLoad = false;
  let SVGNamespace = 'http://www.w3.org/2000/svg';
  let evalId = newUUID();
  let XLINKNamespace = 'http://www.w3.org/1999/xlink';

  let script = document.createElementNS(xmlNamespace, 'script');

  script.setAttribute('type', 'module');
  parentNode.appendChild(script);
  script.innerText = `import * as m from '${url}'; window['${evalId}'] = m;`;

  script.setAttributeNS(null, 'async', true);
  const mod = await waitFor(30 * 1000, () => window[evalId]);
  delete window[evalId];
  script.remove();
  return mod;
}

export function loadViaScript (url, onLoadCb) {
  // load JS code by inserting a <script src="..." /> tag into the
  // DOM. This allows cross domain script loading and JSONP

  let parentNode = document.head;
  let xmlNamespace = parentNode.namespaceURI;
  let useBabelJsForScriptLoad = false;
  let SVGNamespace = 'http://www.w3.org/2000/svg';
  let XLINKNamespace = 'http://www.w3.org/1999/xlink';

  return new Promise((resolve, reject) => {
    let script = document.createElementNS(xmlNamespace, 'script');

    if (useBabelJsForScriptLoad && typeof babel !== 'undefined') {
      script.setAttribute('type', 'text/babel');
    } else {
      script.setAttribute('type', 'text/ecmascript');
    }

    parentNode.appendChild(script);
    script.setAttributeNS(null, 'id', url);

    script.namespaceURI === SVGNamespace
      ? script.setAttributeNS(XLINKNamespace, 'href', url)
      : script.setAttribute('src', url);

    script.onload = resolve;
    script.onerror = reject;
    script.setAttributeNS(null, 'async', true);
  });
}

export async function ensureFetch () {
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

  if ('fetch' in System.global && 'Headers' in System.global) return Promise.resolve();
  let thisModuleId = System.decanonicalize('lively.resources');
  let fetchInterface;
  if (System.get('@system-env').node) {
    try {
      fetchInterface = System._nodeRequire('fetch-ponyfill');
    } catch (err) {
      let moduleId = (await System.normalize('fetch-ponyfill', thisModuleId)).replace('file://', '');
      ({ default: fetchInterface } = await System.import(moduleId));
    }
  } else {
    fetchInterface = await System.import('fetch-ponyfill', thisModuleId);
  }
  Object.assign(System.global, fetchInterface());
}

export { registerExtension, unregisterExtension, parseQuery, extensions, createFiles, resource };
