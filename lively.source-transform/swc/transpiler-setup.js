// SWC WASM transpiler integration for lively.modules / SystemJS.
// Drop-in replacement for setupBabelTranspiler, with automatic Babel fallback.

import { initWasm, swcTransform, isAvailable } from './browser-transform.js';
import { setupBabelTranspiler } from '../babel/plugin.js';

// Extra identifiers that must never be captured (browser APIs that break
// when accessed as properties of __lvVarRecorder).
const BROWSER_DONT_TRANSFORM = [
  'global', 'self', 'undefined',
  '_moduleExport', '_moduleImport',
  'localStorage',
  'prompt', 'alert', 'fetch', 'getComputedStyle',
  // CJS variables — these are local to the module wrapper but appear as
  // undeclared globals in the raw source that gets transpiled.
  'exports', 'module', 'require'
];

/**
 * Build a LivelyTransformConfig JSON object from a lively.modules Module.
 */
function buildSwcConfig (module, opts = {}) {
  const recorderName = module.recorderName;
  const isGlobal = recorderName === 'System.global';
  const dontTransform = [
    ...BROWSER_DONT_TRANSFORM,
    recorderName,
    module.sourceAccessorName,
    ...(module.dontTransform || [])
  ].filter(Boolean);

  const config = {
    captureObj: recorderName,
    moduleId: module.id,
    exclude: dontTransform,
    captureImports: !opts.noScopeCapture,
    enableExportSplit: true,
    enableComponentTransform: !opts.noScopeCapture,
    enableNamespaceTransform: false,
    enableDynamicImportTransform: false,
    // Our existing SystemJS transform rewrites System.register() setters —
    // not needed here since the WASM module's System.register wrapping
    // (via swc_ecma_transforms_module) handles ESM→System.register conversion.
    enableSystemjsTransform: false,
    enableScopeCapture: !isGlobal && !opts.noScopeCapture
  };

  if (!isGlobal && module.varDefinitionCallbackName) {
    config.declarationWrapper = module.varDefinitionCallbackName;
  }

  // currentModuleAccessor: expression string for import.meta polyfill
  // Equivalent to: recorderName.System.get('@lively-env').moduleEnv(moduleId)
  if (!isGlobal) {
    config.currentModuleAccessor =
      `${recorderName}.System.get("@lively-env").moduleEnv("${module.id}")`;
  }

  // Class-to-function transformation.  Needed for the lively class system
  // (resource classes, morphic, etc.).  Disabled for esm:// CDN packages
  // via opts.classToFunction === false.
  if (opts.classToFunction !== false) {
    config.classToFunction = {
      classHolder: recorderName,
      functionNode: 'initializeES6ClassForLively',
      currentModuleAccessor: config.currentModuleAccessor || 'null'
    };
  }

  return config;
}

class SwcBrowserTranspiler {
  constructor (System, moduleId, env) {
    this.System = System;
    this.moduleId = moduleId;
    this.env = env;
  }

  transpileModule (source, options) {
    const { module } = options;
    if (!module || !isAvailable()) return null;

    const config = buildSwcConfig(module, options);
    const result = swcTransform(source, config);
    if (!result) return null;

    let code = result.code;

    // Destructured assignment parens and default-keyword export fixes are
    // handled in the Rust AST post-processor (Phase 3 in lib.rs).

    let map = result.map ? JSON.parse(result.map) : undefined;

    // Rewrite esm:// URLs to https:// in both sourceURL and source map
    // so browser devtools can resolve them without "unknown url scheme" errors.
    if (module.id.startsWith('esm://')) {
      const httpsUrl = module.id.replace('esm://', 'https://');
      code += '\n//# sourceURL=' + httpsUrl + '!transpiled';
      if (map) {
        if (map.file) map.file = map.file.replace('esm://', 'https://');
        if (map.sources) map.sources = map.sources.map(s => s?.replace('esm://', 'https://') ?? s);
        if (map.sourceRoot) map.sourceRoot = map.sourceRoot.replace('esm://', 'https://');
      }
    }

    return { code, map };
  }
}

/**
 * Setup the SWC WASM transpiler on a SystemJS instance.
 * Falls back to Babel if WASM loading fails.
 */
export async function setupSwcTranspiler (System) {
  console.log('[lively.swc] setupSwcTranspiler called, baseURL:', System.baseURL);
  // First set up Babel as the baseline (handles all the System.global, trace, etc.)
  setupBabelTranspiler(System);

  // When ?babelOnly is in the URL, skip SWC entirely — used to capture
  // gold-standard Babel translations for comparison testing.
  if (typeof location !== 'undefined' && location.search?.includes('babelOnly')) {
    console.log('[lively.swc] babelOnly mode — staying with Babel transpiler');
    return;
  }

  // Then try to load SWC WASM and override the translate hook
  try {
    await initWasm(System.baseURL);
  } catch (err) {
    console.warn('[lively.swc] WASM init failed, staying with Babel transpiler.');
    return;
  }

  // Store reference to the original Babel translate
  const babelTranslate = System.translate;
  // Expose for benchmarking (both translators in same context)
  try { window.__babelTranslate = babelTranslate; } catch(e) {}

  function swcTranslate (load, opts) {
    const shortName = (load.name || '').replace('http://localhost:9011/', '').replace('esm://ga.jspm.io/', 'esm:');

    if (!load.metadata?.module) {
      const t0 = performance.now();
      const r = babelTranslate.call(this, load, opts);
      console.log(`[babel] ${shortName} (no module meta) ${(performance.now() - t0).toFixed(1)}ms`);
      return r;
    }

    // CDN packages (esm://) are pre-compiled third-party code.
    // They still need full scope capture (recorder, defVar) — Babel applies
    // it to ALL modules including CDN ones. Without it, the recorder-based
    // class system can't track CDN exports properly.
    // Only classToFunction is disabled (CDN code doesn't use lively classes).
    const t0 = performance.now();
    const transpiler = new SwcBrowserTranspiler(this, load.name, {});
    const result = transpiler.transpileModule(load.source, { ...opts, module: load.metadata.module });

    if (!result) {
      // SWC returned null — fall back to Babel
      const t1 = performance.now();
      const r = babelTranslate.call(this, load, opts);
      console.log(`[babel] ${shortName} (SWC returned null) ${(performance.now() - t1).toFixed(1)}ms`);
      return r;
    }

    // Validate generated code doesn't have syntax errors
    try { new Function(result.code); } catch (e) {
      if (e instanceof SyntaxError) {
        const t1 = performance.now();
        const r = babelTranslate.call(this, load, opts);
        console.log(`[babel] ${shortName} (SyntaxError: ${e.message}) ${(performance.now() - t1).toFixed(1)}ms`);
        return r;
      }
    }

    const elapsed = (performance.now() - t0).toFixed(1);
    console.log(`[swc] ${shortName} ${elapsed}ms`);

    // Rewrite esm:// in source map so devtools can resolve it
    if (result.map && load.name?.startsWith('esm://')) {
      if (result.map.file) result.map.file = result.map.file.replace('esm://', 'https://');
      if (result.map.sources) result.map.sources = result.map.sources.map(s => s?.replace('esm://', 'https://') ?? s);
    }
    load.metadata.sourceMap = result.map;
    return result.code;
  }

  // Override the translate hook.
  // SystemJS 0.21 with the lively.fetch loader plugin routes transpilation
  // through the registered transpiler module ('lively.transpiler.babel'),
  // NOT through System.translate directly. We need to override both.
  System.translate = async (load, opts) => swcTranslate.call(System, load, opts);
  System._loader.transpilerPromise = Promise.resolve({ translate: swcTranslate });

  // Re-register the transpiler module with SWC's translate.
  // System.newModule() returns a frozen namespace, so we can't mutate it —
  // we must replace the whole module registration.
  System.set('lively.transpiler.babel', System.newModule({
    default: SwcBrowserTranspiler,
    translate: swcTranslate
  }));

  console.log('[lively.swc] WASM transpiler active');
}

export { SwcBrowserTranspiler, buildSwcConfig };
