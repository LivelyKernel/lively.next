/* global System */
import { parse, nodes, isValidIdentifier } from 'lively.ast';
const { funcCall, member, literal } = nodes;
import { evalCodeTransform, evalCodeTransformOfSystemRegisterSetters } from 'lively.vm';
import { string, obj, properties } from 'lively.lang';
import { classToFunctionTransform } from 'lively.classes';

import {
  install as installHook,
  remove as removeHook,
  isInstalled as isHookInstalled
} from './hooks.js';
import module, { detectModuleFormat } from './module.js';
import { BrowserModuleTranslationCache, NodeModuleTranslationCache } from './cache.js';

const isNode = System.get('@system-env').node;

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Functions below are for re-loading modules from change.js. We typically
// start with a load object that skips the normalize / fetch step. Since we need
// to jump in the "middle" of the load process and SystemJS does not provide an
// interface to this, we need to invoke the translate / instantiate / execute
// manually
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
let sourceMapPrefix = '\n//# sourceMapping' + 'URL=data:application/json;base64,';
function inlineSourceMap (sourceMapString) {
  if (!sourceMapString) return '';
  return sourceMapPrefix + string.base64EncodeUnicode(sourceMapString);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// code instrumentation
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

const node_modulesDir = System.decanonicalize('lively.modules/node_modules/');

let exceptions = [
  // id => id.indexOf(resolve("node_modules/")) > -1,
  // id => canonicalURL(id).indexOf(node_modulesDir) > -1,
  id => !id.endsWith('.js') && !id.endsWith('.jsx') && !id.startsWith('https://jspm.dev') && !id.startsWith('esm://'),
  id => id.endsWith('dist/acorn.js') || id.endsWith('dist/escodegen.browser.js') || id.endsWith('bowser.js') || id.endsWith('TweenMax.min.js'),
  id => id.endsWith('babel-core/browser.js') || id.endsWith('system.src.js') || id.includes('systemjs-plugin-babel')
];

function getExceptions () { return exceptions; }
function setExceptions (v) { return exceptions = v; }

export function prepareCodeForCustomCompile (System, source, moduleId, module, debug) {
  source = String(source);

  let {
    sourceAccessorName,
    recorder,
    recorderName,
    dontTransform,
    varDefinitionCallbackName,
    embedOriginalCode = true
  } = module;
  sourceAccessorName = embedOriginalCode ? sourceAccessorName : undefined;

  const options = {
    topLevelVarRecorder: recorder,
    varRecorderName: recorderName,
    sourceAccessorName,
    dontTransform,
    jsx: moduleId.endsWith('.jsx'),
    recordGlobals: true,
    keepPreviouslyDeclaredValues: true,
    declarationWrapperName: varDefinitionCallbackName,
    evalId: module.nextEvalId(),
    classTransform: classToFunctionTransform,
    currentModuleAccessor: funcCall(
      member(
        funcCall(
          member(member('__lvVarRecorder', 'System'), 'get'),
          literal('@lively-env')),
        'moduleEnv'),
      literal(moduleId))
  };
  const isGlobal = recorderName === 'System.global';
  let header = (debug ? `console.log("[lively.modules] executing module ${moduleId}");\n` : '');
  let footer = '';

  if (isGlobal) {
    // FIXME how to update exports in that case?
    delete options.declarationWrapperName;
  } else {
    header += `SystemJS.get("@lively-env").evaluationStart("${moduleId}");\n` +
            `var ${recorderName} = SystemJS.get("@lively-env").moduleEnv("${moduleId}").recorder;\n` +
            (embedOriginalCode ? `\nvar ${sourceAccessorName} = ${JSON.stringify(source)};\n` : '');
    footer += `\nSystemJS.get("@lively-env").evaluationEnd("${moduleId}");`;
  }

  try {
    const rewrittenSource = header + evalCodeTransform(source, options) + footer;
    if (debug && typeof $world !== 'undefined' && $world.get('log') && $world.get('log').isText) $world.get('log').textString = rewrittenSource;
    return { source: rewrittenSource, options };
  } catch (e) {
    console.error(`Error in prepareCodeForCustomCompile of ${moduleId} ${e.stack}`);
    return { source, options };
  }
}

export function prepareTranslatedCodeForSetterCapture (System, source, moduleId, module, options, debug) {
  source = String(source);
  const tfmOptions = {
    ...options,
    classTransform: classToFunctionTransform,
    topLevelVarRecorder: module.recorder,
    varRecorderName: module.recorderName,
    dontTransform: module.dontTransform,
    recordGlobals: true,
    declarationWrapperName: module.varDefinitionCallbackName,
    currentModuleAccessor: funcCall(
      member(
        funcCall(
          member(member('__lvVarRecorder', 'System'), 'get'),
          literal('@lively-env')),
        'moduleEnv'),
      literal(moduleId))
  };

  try {
    const rewrittenSource = evalCodeTransformOfSystemRegisterSetters(source, tfmOptions);
    if (debug && typeof $world !== 'undefined' && $world.get('log') && $world.get('log').isText) $world.get('log').textString += rewrittenSource;
    return rewrittenSource;
  } catch (e) {
    console.error('Error in prepareTranslatedCodeForSetterCapture', e.stack);
    return source;
  }
}

function getCachedNodejsModule (System, load) {
  // On nodejs we might run alongside normal node modules. To not load those
  // twice we have this little hack...
  try {
    const Module = System._nodeRequire('module').Module;
    const id = Module._resolveFilename(load.name
      .replace(/^file:\/\//, '') // unix
      .replace(/^\/([a-z]:\/)/i, '$1')); // windows
    const nodeModule = Module._cache[id];
    return nodeModule;
  } catch (e) {
    System.debug && console.log('[lively.modules getCachedNodejsModule] %s unknown to nodejs', load.name);
  }
  return null;
}

function addNodejsWrapperSource (System, load) {
  // On nodejs we might run alongside normal node modules. To not load those
  // twice we have this little hack...
  const m = getCachedNodejsModule(System, load);
  if (m) {
    load.metadata.format = 'esm';
    load.source = `var exports = System._nodeRequire('${m.id}'); export default exports;\n` +
                properties.allOwnPropertiesOrFunctions(m.exports).map(k =>
                  isValidIdentifier(k)
                    ? `export var ${k} = exports['${k}'];`
                    : `/*ignoring export "${k}" b/c it is not a valid identifier*/`).join('\n');
    System.debug && console.log('[lively.modules customTranslate] loading %s from nodejs module cache', load.name);
    return true;
  }
  System.debug && console.log('[lively.modules customTranslate] %s not yet in nodejs module cache', load.name);
  return false;
}

export async function customTranslate (load) {
  // load like
  // {
  //   address: "file:///Users/robert/Lively/lively-dev/lively.vm/tests/test-resources/some-es6-module.js",
  //   name: "file:///Users/robert/Lively/lively-dev/lively.vm/tests/test-resources/some-es6-module.js",
  //   metadata: { deps: [/*...*/], entry: {/*...*/}, format: "esm", sourceMap: ... },
  //   source: "..."
  // }

  const System = this; const debug = System.debug;
  const meta = load.metadata;
  const ignored = (meta && meta.hasOwnProperty('instrument') && !meta.instrument) ||
              exceptions.some(exc => exc(load.name));

  if (ignored) {
    debug && console.log('[lively.modules customTranslate ignoring] %s', load.name);
    return load.source;
  }

  if (isNode && addNodejsWrapperSource(System, load)) {
    debug && console.log('[lively.modules] loaded %s from nodejs cache', load.name);
    return load.source;
  }

  const start = load.metadata.ts = Date.now();

  const format = detectModuleFormat(load.source, meta);
  const mod = module(System, load.name);
  let instrumented = false;
  const isEsm = format === 'esm';

  mod.setSource(load.source);

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // cache experiment part 1
  let useCache, indexdb, hashForCache;
  try {
    useCache = System.useModuleTranslationCache;
    indexdb = System.global.indexedDB;
    hashForCache = meta.hashForCache = useCache && String(string.hashCode(load.source));
    if (useCache && indexdb && isEsm) {
      let cache = System._livelyModulesTranslationCache ||
               (System._livelyModulesTranslationCache = new BrowserModuleTranslationCache());
      if (cache.constructor !== BrowserModuleTranslationCache) {
        obj.adoptObject(cache, BrowserModuleTranslationCache);
      }
      let stored = await cache.fetchStoredModuleSource(load.name);
      if (stored && stored.hash === hashForCache && stored.timestamp >= BrowserModuleTranslationCache.earliestDate) {
        if (stored.source) {
          meta.format = 'register';
          // the real deps will be populated when the
          // system register code is run, still need
          // to define it here to avoid an
          // undefined entry later!
          meta.deps = [];
          if (stored.sourceMap) meta.sourceMap = JSON.parse(stored.sourceMap);
          debug && console.log('[lively.modules customTranslate] loaded %s from browser cache after %sms', load.name, Date.now() - start);
          return Promise.resolve(stored.source);
        }
      }
    } else if (isNode && useCache && isEsm) {
      let cache =
        System._livelyModulesTranslationCache ||
        (System._livelyModulesTranslationCache = new NodeModuleTranslationCache());
      let stored = await cache.fetchStoredModuleSource(load.name);
      if (
        stored && stored.hash === hashForCache &&
        stored.timestamp >= NodeModuleTranslationCache.earliestDate
      ) {
        if (stored.source) {
          meta.format = 'register';
          meta.deps = []; // the real deps will be populated when the
          // system register code is run, still need
          // to define it here to avoid an
          // undefined entry later!

          debug &&
            console.log(
              '[lively.modules customTranslate] loaded %s from filesystem cache after %sms',
              load.name,
              Date.now() - start);
          return Promise.resolve(stored.source);
        }
      }
    }
  } catch (e) {
    console.error(`[lively.modules customTranslate] error reading module translation cache: ${e.stack}`);
  }
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // FIXME: move all of the stuff below into the transpilation step, it is not needed here, just wrecks performance by
  //        needlessly stringifying AST nodes over and over. We achieve this by implementing a custom plugin called "lively-pre-transpile"
  //        The reason this was placed outside of babel in the first place was that a decade ago, babel was not yet supporting a majority
  //        of the ecmascript syntax out of the box.

  meta.compileOptions = {};
  let source = load.source;

  mod.recorderName = '__lvVarRecorder';
  if (mod.recorder === System.global) { mod.unloadEnv(); }
  load.metadata['lively.modules instrumented'] = true;
  if (isEsm) load.metadata.format = 'esm';
  load.metadata.module = mod;

  if (!instrumented) {
    debug && console.log("[lively.modules] customTranslate ignoring %s b/c don't know how to handle format %s", load.name, load.metadata.format);
  }

  return load.source;
}

export async function postCustomTranslate (load) {
  // FIXME: Move this too into the transpilation step via a custom babel plugin "lively-post-transpile"
  const start = load.metadata.ts;
  if (!load.metadata['lively.modules instrumented']) return; // if we already retrieved the source from cache, not need to store it again
  let translated = load.source;
  const debug = System.debug;
  const indexdb = System.global.indexedDB;
  const useCache = System.useModuleTranslationCache;
  const { hashForCache, compileOptions: options, sourceMap = {} } = load.metadata;
  const mod = load.metadata.module;

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // cache experiment part 2
  if (isNode && useCache) {
    let cache = System._livelyModulesTranslationCache ||
               (System._livelyModulesTranslationCache = new NodeModuleTranslationCache());
    try {
      await cache.cacheModuleSource(load.name, hashForCache, translated, await mod.exports(), sourceMap);
      debug && console.log('[lively.modules customTranslate] stored cached version in filesystem for %s', load.name);
    } catch (e) {
      console.error(`[lively.modules customTranslate] failed storing module cache: ${e.stack}`);
    }
  } else if (useCache && indexdb) {
    let cache = System._livelyModulesTranslationCache ||
               (System._livelyModulesTranslationCache = new BrowserModuleTranslationCache());
    try {
      await cache.cacheModuleSource(load.name, hashForCache, translated, await mod.exports(), sourceMap);
      debug && console.log('[lively.modules customTranslate] stored cached version for %s', load.name);
    } catch (e) {
      console.error(`[lively.modules customTranslate] failed storing module cache: ${e.stack}`);
    }
  }
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  debug && console.log('[lively.modules customTranslate] done %s after %sms', load.name, Date.now() - start);
  load.source = translated;
}

async function instrumentSourceOfEsmModuleLoad (System, load) {
  // brittle, since it relies on the particular format that SystemJS returns us!
  // The result of System.translate is source code for a call to
  // System.register that can't be run standalone. We parse the necessary
  // details from it that we will use to re-define the module
  // (dependencies, setters, execute)
  // Note: this only works for esm modules!
  load.source = await customTranslate.bind(System)(load); // do that beforehand
  // invoke the babel transpiler directly without doing the funny Systemjs dance
  const localDeps = [];
  let declareSource = await System.translate(load, { depNames: localDeps, esmLoad: true });
  declareSource += `//# sourceURL=${load.name}!transpiled`;
  if (load.metadata.sourceMap) declareSource += inlineSourceMap(JSON.stringify(load.metadata.sourceMap));
  return { declare: eval(declareSource), localDeps };
}

function instrumentSourceOfGlobalModuleLoad (System, load) {
  return System.translate(load).then(translated => ({ translated }));
}

export {
  getExceptions, setExceptions,
  instrumentSourceOfEsmModuleLoad, instrumentSourceOfGlobalModuleLoad
};
