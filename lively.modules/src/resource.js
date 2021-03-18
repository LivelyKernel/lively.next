/* global Buffer */
import { resource, Resource } from 'lively.resources';
import {
  install as installHook,
  remove as removeHook,
  isInstalled as isHookInstalled
} from './hooks.js';

let brotli, fetch;
if (System.get('@system-env').node) {
  fetch = System._nodeRequire('node-fetch');
  brotli = System._nodeRequire('brotli');
}

let jsFileHashMap;

async function fetchResource (proceed, load) {
  const System = this;
  const largeModuleSize = 250 * 1000;
  let res = System.resource(load.name);
  const useNodeFetch = System.get('@system-env').node && !res.isNodeJSFileResource;

  if (useNodeFetch) res = await fetch(load.name);
  if (!res) return proceed(load);

  let result, error;

  // first check if this file is present inside the js file hash map
  // an wether our locally stored and translated one already matches that
  // criteria
  if (!jsFileHashMap && !System.get('@system-env').node) jsFileHashMap = await System.resource(System.baseURL).join('__JS_FILE_HASHES__').readJson();

  const useCache = System.useModuleTranslationCache;
  const indexdb = System.global.indexedDB;
  const cache = System._livelyModulesTranslationCache;
  if (!System.get('@system-env').node && useCache && indexdb && cache) {
    const stored = await cache.fetchStoredModuleSource(load.name);
    if (stored && (jsFileHashMap[load.name.replace(System.baseURL, '/')] == stored.hash || load.name.includes('jspm'))) {
      load.metadata.instrument = false; // skip instrumentation
      return stored.source;
    }
  }

  if (res.isResource && res.ext() && res.ext().startsWith('css')) {
    return ''; // ignore css modules
  }

  try { result = res.isResource ? await res.read() : res; } catch (e) { error = e; }

  // if we are in a browser we try to use the proxy when cors requests fail
  if (error && System.get('@system-env').browser) {
    const isWebResource = res.url.startsWith('http');
    const isCrossDomain = !res.url.startsWith(document.location.origin);
    if (isWebResource && isCrossDomain) {
      try {
        result = await res.makeProxied(System.baseURL).read();
        error = null;
      } catch (e) {}
    }
  }

  if (error) throw error;

  if (useNodeFetch) {
    // since we run outside of a browser, it is likely not handling brotli decompression
    // out of the box if needed
    const { _headers } = result.headers || {};
    const [encoding] = _headers && _headers['content-encoding'] || [];
    if (encoding == 'br') {
      result = Buffer.from(brotli.decompress(await result.buffer())).toString();
    } else {
      result = await result.text();
    }
  }

  if (result.length > largeModuleSize && $world && !System._loadingIndicator) {
    System._loadingIndicator = $world.execCommand('open loading indicator', {
      label: 'loading module',
      status: load.name.replace(System.baseURL, '')
    });
    await promise.delay(500);
    if (System._loadingIndicator) { await System._loadingIndicator.whenRendered(); }
  }

  return result;
}

// FIXME!!!
const livelyURLRe = /^lively:\/\/([^\/]+)\/(.*)$/;
function livelyProtocol (proceed, url) {
  const match = url.match(livelyURLRe);
  if (!match) return proceed(url);
  const [_, worldId, id] = match;
  return {
    read () {
      const m = typeof $world !== 'undefined' && $world.getMorphWithId(id);
      return Promise.resolve(m ? m.textString : `/*Could not locate ${id}*/`);
    },
    write (source) {
      const m = typeof $world !== 'undefined' && $world.getMorphWithId(id);
      if (!m) return Promise.reject(`Could not save morph ${id}`);
      m.textString = source;
      return Promise.resolve(this);
    }
  };
}

export function wrapResource (System) {
  System.resource = resource;
  if (isHookInstalled(System, 'fetch', fetchResource)) { removeHook(System, 'fetch', 'fetchResource'); }
  installHook(System, 'fetch', fetchResource);
  if (isHookInstalled(System, 'resource', 'livelyProtocol')) { removeHook(System, 'fetch', 'livelyProtocol'); }
  installHook(System, 'resource', livelyProtocol);
}

export function unwrapResource (System) {
  removeHook(System, 'fetch', 'fetchResource');
  removeHook(System, 'resource', 'livelyProtocol');
  delete System.resource;
}

class LivelyResource extends Resource {
  get canDealWithJSON () { return false; }

  get morphId () {
    const match = this.url.match(livelyURLRe);
    const [_, worldId, id] = match;
    return id;
  }

  async read () {
    const id = this.morphId;
    const m = typeof $world !== 'undefined' && $world.getMorphWithId(id);
    return Promise.resolve(m ? m.textString : `/*Could not locate ${id}*/`);
  }

  async write (source) {
    const id = this.morphId;
    const m = typeof $world !== 'undefined' && $world.getMorphWithId(id);
    if (!m) return Promise.reject(`Could not save morph ${id}`);
    m.textString = source;
    return Promise.resolve(this);
  }

  async exists () {
    // checks if the morph exists
    return typeof $world !== 'undefined' && $world.getMorphWithId(this.morphId);
  }

  async remove () {
    // removes the morph
    typeof $world !== 'undefined' && $world.getMorphWithId(this.morphId).remove();
    return true;
  }
}

export const resourceExtension = {
  name: 'lively.modules',
  matches: (url) => url.match(livelyURLRe),
  resourceClass: LivelyResource
};

import { registerExtension } from 'lively.resources';
import { promise } from 'lively.lang';
registerExtension(resourceExtension);
