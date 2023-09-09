/* global System,process,self,WorkerGlobalScope,location,global */
/* eslint-disable no-use-before-define */
import { arr, obj, promise } from 'lively.lang';
import { remove as removeHook, install as installHook, isInstalled as isHookInstalled } from './hooks.js';
import { classHolder } from './cycle-breaker.js';
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

const isNode = System.get('@system-env').node;

const GLOBAL = typeof window !== 'undefined'
  ? window
  : (typeof global !== 'undefined'
      ? global
      : (typeof self !== 'undefined' ? self : this));

const defaultOptions = {
  notificationLimit: null
};

function safeAssign (proceed, ...args) {
  if (Object.isFrozen(args[0])) return args;
  return proceed(...args);
}

export function wrapModuleResolution (System) {
  // System.resolve and System.prepareImport
  if (!isHookInstalled(Object, 'assign', 'safeAssign')) {
    installHook(Object, 'assign', safeAssign, 'safeAssign');
  }

  if (!isHookInstalled(System, 'normalize', 'normalizeHook')) {
    installHook(System, 'normalize', normalizeHook, 'normalizeHook');
  }
  if (!isHookInstalled(System, 'resolve', 'normalizeHook')) {
    installHook(System, 'resolve', normalizeHook, 'normalizeHook');
  }
  if (!isHookInstalled(System, 'decanonicalize', 'decanonicalizeHook')) {
    installHook(System, 'decanonicalize', decanonicalizeHook, 'decanonicalizeHook');
  }
  if (!isHookInstalled(System, 'normalizeSync', 'decanonicalizeHook')) {
    installHook(System, 'normalizeSync', decanonicalizeHook, 'decanonicalizeHook');
  }
  if (!isHookInstalled(System, 'resolveSync', 'decanonicalizeHook')) {
    installHook(System, 'resolveSync', decanonicalizeHook, 'decanonicalizeHook');
  }
  if (!isHookInstalled(System, 'newModule', 'newModule_volatile')) {
    installHook(System, 'newModule', newModule_volatile, 'newModule_volatile');
  }

  if (!System.registry['REGISTRY']._originalRegistry) {
    const { proxy: wrappedRegistry, revoke } = Proxy.revocable(System.registry['REGISTRY'], {
      set: function (target, key, mod) {
        if (moduleLoadPromises[key]) {
          moduleLoadPromises[key].resolve(mod);
          delete moduleLoadPromises[key];
        }
        target[key] = mod;
        return true;
      }
    });
    wrappedRegistry._revoke = revoke;
    wrappedRegistry._originalRegistry = System.registry['REGISTRY'];
    Object.getOwnPropertySymbols(System.registry).map(sym => {
      if (System.registry[sym] === wrappedRegistry._originalRegistry) System.registry[sym] = wrappedRegistry;
    });
    System.registry['REGISTRY'] = wrappedRegistry;
  }
}

export function unwrapModuleResolution (System) {
  removeHook(Object, 'assign', 'safeAssign');
  removeHook(System, 'normalize', 'normalizeHook');
  removeHook(System, 'decanonicalize', 'decanonicalizeHook');
  removeHook(System, 'normalizeSync', 'decanonicalizeHook');
  removeHook(System, 'newModule', 'newModule_volatile');
  const wrappedRegistry = System.registry['REGISTRY'];
  if (wrappedRegistry._originalRegistry) {
    Object.getOwnPropertySymbols(System.registry).map(sym => {
      if (System.registry[sym] === wrappedRegistry) {
        System.registry[sym] = wrappedRegistry._originalRegistry;
      }
    });
    System.registry['REGISTRY'] = wrappedRegistry._originalRegistry;
    wrappedRegistry._revoke();
  }
}

// Accessible system-wide via System.get("@lively-env")
function livelySystemEnv (System) {
  return {
    moduleEnv (id) { return classHolder.module(System, id); },

    // TODO this is just a test, won't work in all cases...
    get itself () { return System.get(System.decanonicalize('lively.modules/index.js')); },

    evaluationStart (moduleId) {
      classHolder.module(System, moduleId).evaluationStart();
    },

    evaluationEnd (moduleId) {
      classHolder.module(System, moduleId).evaluationEnd();
    },

    dumpConfig () {
      return JSON.stringify({
        baseURL: System.baseURL,
        transpiler: System.transpiler,
        map: System.map,
        meta: System.meta,
        packages: System.CONFIG.packages,
        paths: System.paths,
        packageConfigPaths: System.packageConfigPaths
      }, null, 2);
    },

    get packageRegistry () { return System['__lively.modules__packageRegistry']; },
    set packageRegistry (x) { System['__lively.modules__packageRegistry'] = x; },

    // this is where the canonical state of the module system is held...
    packages: System['__lively.modules__packages'] || (System['__lively.modules__packages'] = {}),
    loadedModules: System['__lively.modules__loadedModules'] || (System['__lively.modules__loadedModules'] = {}),
    pendingExportChanges: System['__lively.modules__pendingExportChanges'] || (System['__lively.modules__pendingExportChanges'] = {}),
    notifications: System['__lively.modules__notifications'] || (System['__lively.modules__notifications'] = []),
    notificationSubscribers: System['__lively.modules__notificationSubscribers'] || (System['__lively.modules__notificationSubscribers'] = {}),
    options: System['__lively.modules__options'] || (System['__lively.modules__options'] = obj.deepCopy(defaultOptions)),
    onLoadCallbacks: System['__lively.modules__onLoadCallbacks'] || (System['__lively.modules__onLoadCallbacks'] = []),
    modulePackageMapCache: System['__lively.modules__modulePackageMapCache']
  };
}

function systems () {
  if (!System.constructor.systems) System.constructor.systems = {};
  return System.constructor.systems;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// System creation + access interface
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function nameOfSystem (System) {
  return Object.keys(systems()).some(name => systems()[name] === System);
}

function getSystem (nameOrSystem, config) {
  return nameOrSystem && typeof nameOrSystem !== 'string'
    ? nameOrSystem
    : systems()[nameOrSystem] || (systems()[nameOrSystem] = makeSystem(config));
}

function removeSystem (nameOrSystem) {
  // FIXME "unload" code...???
  const name = nameOrSystem && typeof nameOrSystem !== 'string'
    ? nameOfSystem(nameOrSystem)
    : nameOrSystem;
  delete systems()[name];
}

import { customTranslate, postCustomTranslate } from './instrumentation.js';
import { wrapResource, fetchResource } from './resource.js';
import { emit } from 'lively.notifications';
import { join, urlResolve } from './url-helpers.js';
import { resource } from 'lively.resources';

function makeSystem (cfg) {
  return prepareSystem(new System.constructor(), cfg);
}

function prepareSystem (System, config) {
  System.trace = true;
  delete System.get;
  config = config || {};

  Object.getOwnPropertySymbols(System).map(sym => {
    if ('lastRegister' in System[sym]) System['REGISTER_INTERNAL'] = System[sym];
    else if (System[sym].baseURL) System['CONFIG'] = System[sym];
    else System['METADATA'] = System[sym];
  });

  Object.getOwnPropertySymbols(System.registry).map(sym => {
    System.registry['REGISTRY'] = System.registry[sym];
  });

  const useModuleTranslationCache = config.hasOwnProperty('useModuleTranslationCache')
    ? config.useModuleTranslationCache
    : !urlQuery().noModuleCache;
  System.useModuleTranslationCache = useModuleTranslationCache;

  if (config._nodeRequire) System._nodeRequire = config._nodeRequire;

  System.set('@lively-env', System.newModule(livelySystemEnv(System)));

  const isWorker = typeof WorkerGlobalScope !== 'undefined';

  if (isWorker) {
    System.set('@system-env',
      System.newModule({ ...System.get('@system-env'), browser: true, worker: true, location }));
  }

  const isElectron =
    typeof process !== 'undefined' &&
    process.versions &&
    process.versions.electron;

  if (isElectron) {
    System.set('@system-env',
      System.newModule({ electron: isElectron, ...System.get('@system-env') }));
  }

  const basePlugin = {
    fetch: function (load, proceed) {
      // this should be disabled if we are not yet bootstrapping
      if (this.transpiler !== 'lively.transpiler') return proceed(load);
      return fetchResource.call(this, proceed, load);
    },
    translate: function (load, opts) {
      return customTranslate.call(this, load, opts);
    },
    instantiate: async function (load, proceed) {
      await postCustomTranslate.call(this, load);
      return instantiate_triggerOnLoadCallbacks.call(this, proceed, load);
    },
    locate: function (load) { return locateHook.call(this, load); }
  };
  const fetchPlugin = System.newModule(basePlugin);
  const cjsPlugin = System.newModule(basePlugin);

  System.set('lively.fetch', fetchPlugin);
  System.set('cjs', cjsPlugin);
  System.config({
    meta: {
      '*': {
        loader: 'lively.fetch'
      },
      'node:*': {
        loader: false,
        format: 'esm'
      },
      cjs: {
        loader: false
      },
      'lively.fetch': {
        loader: false
      }
    }
  });

  wrapResource(System);
  wrapModuleResolution(System);
  let map;
  if (isElectron) {
    const electronCoreModules = ['electron'];
    map = electronCoreModules.reduce((map, ea) => {
      map[ea] = '@node/' + ea; return map;
    }, {});
    config.map = obj.merge(map, config.map);
  }

  if (isNode) {
    const nodejsCoreModules = ['addons', 'assert', 'buffer', 'child_process',
      'cluster', 'console', 'crypto', 'dgram', 'dns', 'domain', 'events', 'fs',
      'http', 'https', 'module', 'net', 'os', 'path', 'punycode', 'querystring',
      'readline', 'repl', 'stream', 'stringdecoder', 'timers', 'tls',
      'tty', 'url', 'util', 'v8', 'vm', 'zlib', 'constants', 'worker_threads', 'process'];
    map = nodejsCoreModules.reduce((map, ea) => { map[ea] = map['node:' + ea] = '@node/' + ea; return map; }, {});
    config.map = obj.merge(map, config.map);
    // for sth l ike map: {"lively.lang": "node_modules:lively.lang"}
    // cfg.paths = obj.merge({"node_modules:*": "./node_modules/*"}, cfg.paths);
  }

  config.packageConfigPaths = config.packageConfigPaths || ['./node_modules/*/package.json'];

  if (!config.transpiler && System.transpiler === 'traceur') {
    const initialSystem = GLOBAL.System;
    if (initialSystem.transpiler === 'lively.transpiler') {
      System.set('lively.transpiler', initialSystem.get('lively.transpiler'));
      System._loader.transpilerPromise = initialSystem._loader.transpilerPromise;
      System.config({
        transpiler: 'lively.transpiler',
        babelOptions: Object.assign(initialSystem.babelOptions || {}, config.babelOptions)
      });
    } else {
      System.config({
        map: {
          'plugin-babel': initialSystem.map['plugin-babel'],
          'systemjs-babel-build': initialSystem.map['systemjs-babel-build']
        },
        transpiler: initialSystem.transpiler,
        babelOptions: Object.assign(initialSystem.babelOptions || {}, config.babelOptions)
      });
    }
  }

  System.config(config);

  return System;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// FIXME! proper config!
function urlQuery () {
  if (typeof document === 'undefined' || !document.location) return {};
  return (document.location.search || '').replace(/^\?/, '').split('&')
    .reduce(function (query, ea) {
      const split = ea.split('='); const key = split[0]; let value = split[1];
      if (value === 'true' || value === 'false') value = eval(value);
      else if (!isNaN(Number(value))) value = Number(value);
      query[key] = value;
      return query;
    }, {});
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// name resolution extensions
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
const dotSlashStartRe = /^\.?\//;
const trailingSlashRe = /\/$/;
const jsExtRe = /\.js$/;
const cjsExtRe = /\.cjs$/;
const jsxExtRe = /\.jsx$/;
const nodeExtRe = /\.node$/;
const jsonExtRe = /\.json$/;
const jsonJsExtRe = /(.*\.json)\.js$/i;
const jsxJsExtRe = /(.*\.jsx)\.js$/i;
const cjsJsExtRe = /(.*\.cjs)\.js$/i;
const doubleSlashRe = /.\/{2,}/g;
const nodeModRe = /\@node.*/;

function preNormalize (System, name, parent) {
// console.log(`> [preNormalize] ${name}`);

  if (name === '..') name = '../index.js'; // Fix ".."

  // rk 2016-07-19: sometimes SystemJS doStringMap() will resolve path into
  // names with double slashes which causes module id issues later. This fixes
  // that...
  // name = name.replace(/([^:])\/\/+/g, "$1\/");
  name = name.replace(doubleSlashRe, (match) => match[0] === ':' ? match : match[0] + '/');

  // systemjs' decanonicalize has by default not the fancy
  // '{node: "events", "~node": "@empty"}' mapping but we need it
  const { packageRegistry } = System.get('@lively-env');
  if (packageRegistry) {
    const pkg = parent && packageRegistry.findPackageHavingURL(parent);
    if (pkg) {
      const { map, url: packageURL } = pkg;
      let mappedObject = (map && map[name]) || System.map[name];
      if (mappedObject) {
        if (typeof mappedObject === 'object') {
          mappedObject = normalize_doMapWithObject(mappedObject, pkg, System);
        }
        if (typeof mappedObject === 'string' && mappedObject !== '') {
          name = mappedObject;
        }
        // relative to package
        if (name.startsWith('.')) name = urlResolve(join(packageURL, name));
      }
    }
  }
  // <snip> experimental
  if (packageRegistry) {
    let resolved = packageRegistry.resolvePath(name, parent);
    if (resolved) {
      if (resolved.endsWith('/') && !name.endsWith('/')) resolved = resolved.slice(0, -1);
      if (!resolved.endsWith('/') && name.endsWith('/')) resolved = resolved + '/';
      name = resolved;
    }
  }
  // </snap> experimental

  System.debug && console.log(`>> [preNormalize] ${name}`);
  return name;
}

function postNormalize (System, normalizeResult, isSync) {
// console.log(`> [postNormalize] ${normalizeResult}`);
  // lookup package main
  const base = normalizeResult.replace(jsExtRe, '');

  // rk 2017-05-13: FIXME, we currently use a form like
  // System.decanonicalize("lively.lang/") to figure out the package base path...
  if (normalizeResult.endsWith('/')) {
    // console.log(`>> [postNormalize] ${normalizeResult}`);
    return normalizeResult;
  }

  const { packageRegistry } = System.get('@lively-env');
  if (packageRegistry) {
    const referencedPackage = packageRegistry.findPackageWithURL(base);
    if (referencedPackage) {
      let main = (referencedPackage.main || 'index.js').replace(dotSlashStartRe, '');
      let withMain = base.replace(trailingSlashRe, '') + '/' + main;
      // console.log(`>> [postNormalize] ${withMain} (main 1)`);
      return withMain;
    }
  } else {
    if (base in System.CONFIG.packages) {
      let main = System.CONFIG.packages[base].main;
      if (main) {
        let withMain = base.replace(trailingSlashRe, '') + '/' + main.replace(dotSlashStartRe, '');
        // console.log(`>> [postNormalize] ${withMain} (main 2)`);
        return withMain;
      }
    }
  }

  // Fix issue with accidentally adding .js
  const jsonPath = normalizeResult.match(jsonJsExtRe);
  // if (!jsExtRe.test(normalizeResult) &&
  //   !jsxExtRe.test(normalizeResult) &&
  //   !jsonExtRe.test(normalizeResult) &&
  //   !nodeModRe.test(normalizeResult) &&
  //   !nodeExtRe.test(normalizeResult)) {
  //   // make sure this is not a package name
  //   normalizeResult += '.js';
  // }
  System.debug && console.log(`>> [postNormalize] ${jsonPath ? jsonPath[1] : normalizeResult}`);
  return jsonPath ? jsonPath[1] : normalizeResult;
}

async function checkExistence (url, System) {
  System._fileCheckMap = System._fileCheckMap || {};
  if (url in System._fileCheckMap) return System._fileCheckMap[url];
  // first consult if this file has been cached by local storage before
  const cache = System._livelyModulesTranslationCache;
  if (cache && (await cache.fetchStoredModuleSource(url))) {
    return System._fileCheckMap[url] = true;
  }
  return System._fileCheckMap[url] = await resource(url).exists();
}

async function normalizeHook (proceed, name, parent, parentAddress) {
  const System = this;
  if (System.transpiler !== 'lively.transpiler') return await proceed(name, parent, true);
  if (parent && name === 'cjs') {
    return 'cjs';
  }
  if (parent && parent.endsWith('!cjs')) {
    // SystemJS 0.21.6 runs into trouble when the parent url includes a plain plugin,
    // so removing it here seems to solve that issue
    parent = parent.replace('!cjs', '');
  }
  if (name === 'lively.fetch') return name;
  if (name === '@system-env') return name;
  if (name.startsWith('node:')) name = '@node/' + name.slice(5); // some jspm bullshit
  const stage1 = preNormalize(System, name, parent);
  const stage2 = await proceed(stage1, parent, true);
  let stage3 = postNormalize(System, stage2 || stage1, false);
  const isNodePath = stage3.startsWith('file:');
  System.debug && console.log(`[normalize] ${name} => ${stage3}`);
  if (
    // Make sure we did not ask for a js or jsx file in the initial query.
    !jsExtRe.test(name) &&
    !jsxExtRe.test(name) &&
    !cjsExtRe.test(name) &&
    // Make sure SystemJS has not yet resolved to a json or node module.
    // If this happens, the resolution algorithm most likely has already
    // figured out things and we assume that it has come up with a reasonable
    // answer.
    !jsonExtRe.test(stage3) &&
    !nodeModRe.test(stage3) &&
    !nodeExtRe.test(stage3) &&
    // Make sure that the module as not been loaded.
    !(System.loads && System.loads[stage3]) &&
    !stage3.startsWith('node:')
  ) {
    if (jsExtRe.test(stage3)) {
      if (await checkExistence(stage3, System)) return stage3;
      const indexjs = stage3.replace('.js', '/index.js');
      if (await checkExistence(indexjs, System) || !isNodePath) return indexjs;
      return stage3.replace('.js', '/index.node');
    } else if (!stage3.includes('jspm.dev') && stage3 !== '@empty') {
      if (await checkExistence(stage3 + '.js', System)) return stage3 + '.js';
      if (await checkExistence(stage3 + '/index.js', System)) return stage3 + '/index.js';
    }
  }

  if (jsxJsExtRe.test(stage3)) stage3 = stage3.replace('.jsx.js', '.jsx');
  return stage3;
}

function decanonicalizeHook (proceed, name, parent, isPlugin) {
  let plugin;
  const System = this;
  const stage1 = preNormalize(System, name, parent);
  if (parent && parent.endsWith('!cjs')) {
    parent = parent.replace('!cjs', '');
  }
  let stage2 = proceed(stage1, parent, isPlugin);
  if (stage1.endsWith('/')) {
    const main = this.CONFIG.packages[stage1.replace(/\/*$/, '')]?.main;
    // SystemJS 0.21 has appended the main module, which is something we do not like
    // if we decanonicalize a '/' terminated url
    if (stage2.endsWith(main)) stage2 = stage2.replace(main, '');
  }
  let stage3 = postNormalize(System, stage2, true);
  if (plugin) stage3 += plugin;
  System.debug && console.log(`[normalizeSync] ${name} => ${stage3}`);
  return stage3;
}

function locateHook (load) {
  return load.address;
}

let moduleLoadPromises;
moduleLoadPromises = moduleLoadPromises || {};

async function whenSystemModuleLoaded (moduleName) {
  return System.get(moduleName) || (moduleLoadPromises[moduleName] || (moduleLoadPromises[moduleName] = promise.deferred())).promise;
}

function normalize_doMapWithObject (mappedObject, pkg, loader) {
  // SystemJS allows stuff like {events: {"node": "@node/events", "~node": "@empty"}}
  // for conditional name lookups based on the environment. The resolution
  // process in SystemJS is asynchronous, this one here synch. to support
  // decanonicalize and a one-step-load
  const env = loader.get(pkg.map['@env'] || '@system-env');
  // first map condition to match is used
  let resolved;
  for (const e in mappedObject) {
    const negate = e[0] === '~';
    const value = normalize_readMemberExpression(negate ? e.substr(1) : e, env);
    if (!negate && value || negate && !value) {
      resolved = mappedObject[e];
      break;
    }
  }

  if (resolved) {
    if (typeof resolved !== 'string') { throw new Error('Unable to map a package conditional to a package conditional.'); }
  }
  return resolved;

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function normalize_readMemberExpression (p, value) {
    const pParts = p.split('.');
    while (pParts.length) { value = value[pParts.shift()]; }
    return value;
  }
}

function normalize_packageOfURL (url, System) {
  // given a url like "http://localhost:9001/lively.lang/lib/base.js" finds the
  // corresponding package name in loader.packages, like "http://localhost:9001/lively.lang"
  // ... actually it returns the package
  const packageNames = Object.keys(System.CONFIG.packages || {});
  const matchingPackages = packageNames
    .map(pkgName =>
      url.indexOf(pkgName) === 0
        ? { url: pkgName, penalty: url.slice(pkgName.length).length }
        : null)
    .filter(ea => !!ea);
  const pName = matchingPackages.length
    ? matchingPackages.reduce((matchingPkg, ea) =>
      matchingPkg.penalty > ea.penalty ? ea : matchingPkg).url
    : null;
  const systemPackage = pName && System.CONFIG.packages[pName];
  return systemPackage ? { systemPackage, packageURL: pName } : null;
}

function newModule_volatile (proceed, exports) {
  const freeze = Object.freeze;
  Object.freeze = x => x;
  const m = proceed(exports);
  Object.freeze = freeze;
  return m;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// debugging
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function printSystemConfig (System) {
  System = getSystem(System);
  const json = {
    baseURL: System.baseURL,
    transpiler: System.transpiler,
    map: System.map,
    meta: System.meta,
    packages: System.CONFIG.packages,
    paths: System.paths,
    packageConfigPaths: System.packageConfigPaths,
    bundles: System.bundles
  };
  return JSON.stringify(json, null, 2);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// on-load / import extensions
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function instantiate_triggerOnLoadCallbacks (proceed, load) {
  const System = this;
  proceed(load);
  // Wait until module is properly loaded, i.e. added to the System module cache.
  // Then find those callbacks in System.get("@lively-env").onLoadCallbacks that
  // resolve to the loaded module, trigger + remove them

  const timeout = {};
  whenSystemModuleLoaded(load.name).then(result => {
    if (result === timeout) {
      console.warn(`[lively.modules] instantiate_triggerOnLoadCallbacks for ${load.name} timed out`);
      return;
    }
    const modId = load.name;
    const mod = classHolder.module(System, modId);
    const callbacks = System.get('@lively-env').onLoadCallbacks;

    for (let i = callbacks.length; i--;) {
      const { moduleName, resolved, callback } = callbacks[i];
      const id = resolved ? moduleName : System.decanonicalize(moduleName);
      if (id !== modId) continue;
      callbacks.splice(i, 1);
      try { callback(mod); } catch (e) { console.error(e); }
    }

    emit('lively.modules/moduleloaded', { module: load.name }, Date.now(), System);

    if (System._loadingIndicator) {
      System._loadingIndicator.remove();
      System._loadingIndicator = null;
    }
  });
}

export function whenLoaded (System, moduleName, callback) {
  const modId = System.decanonicalize(moduleName);
  if (System.get(modId)) {
    try { callback(classHolder.module(System, modId)); } catch (e) { console.error(e); }
    return;
  }
  System.get('@lively-env').onLoadCallbacks.push({ moduleName, resolved: false, callback });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// module state
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function loadedModules (System) { return System.get('@lively-env').loadedModules; }

function knownModuleNames (System) {
  const fromSystem = System.loads
    ? Object.keys(System.loads)
    : Object.keys(System.get('@lively-env').loadedModules);
  return arr.uniq(fromSystem.concat(Object.keys(loadedModules(System))));
}

function searchLoadedModules (System, searchStr, options) {
  return Promise.all(
    obj.values(loadedModules(System))
      .map(m => m.search(searchStr, options)))
    .then(res => res.flat());
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// exports
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export {
  getSystem, removeSystem, prepareSystem,
  printSystemConfig,
  livelySystemEnv,
  loadedModules, knownModuleNames,
  searchLoadedModules
};
