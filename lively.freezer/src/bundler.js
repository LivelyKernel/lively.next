/* global process */
import { resource } from 'lively.resources';
import * as ast from 'lively.ast';
import * as classes from 'lively.classes';
import { arr, string, Path, fun, obj } from 'lively.lang';
import {
  es5Transpilation,
  replaceImportedNamespaces,
  replaceExportedVarDeclarations,
  ensureComponentDescriptors,
  replaceExportedNamespaces
} from 'lively.source-transform';
import {
  rewriteToCaptureTopLevelVariables,
  insertCapturesForFunctionDeclarations,
  insertCapturesForExportedImports
} from 'lively.source-transform/capturing.js';
import config from 'lively.morphic/config.js'; // can be imported without problems in nodejs
import { GlobalInjector } from 'lively.modules/src/import-modification.js';
import {
  fixSourceForBugsInGoogleClosure,
  gzip,
  brotli,
  ROOT_ID,
  generateLoadHtml,
  instrumentStaticSystemJS,
  compileOnServer
} from './util/helpers.js';
import { joinPath, ensureFolder } from 'lively.lang/string.js';

const separator = `__${'Separator'}__`; // obscure formatting to prevent breaking builds when this files in included

const GLOBAL_FETCH = `var G = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;`;
const SYSTEMJS_STUB = `
${GLOBAL_FETCH}
if (!G.System) G.System = G.lively.FreezerRuntime;`;

const CLASS_INSTRUMENTATION_MODULES = [
  'lively.morphic',
  'lively.components',
  'lively.ide',
  'lively.halos',
  'lively.bindings',
  'lively-system-interface', // required to make inspector serializable
  'typeshift.components',
  'lively.collab',
  'https://jspm.dev/npm:rollup@2.28.2' // this contains a bunch of class definitions which right now screws up the closure compiler
];

const ESM_CDNS = ['jspm.dev', 'jspm.io', 'skypack.dev', 'esm://cache', 'esm://run'];

// fixme: Why is a blacklist nessecary if there is a whitelist?
const CLASS_INSTRUMENTATION_MODULES_EXCLUSION = ['lively.lang'];

const ADVANCED_EXCLUDED_MODULES = [
  'lively.ast',
  'lively.vm',
  'lively.ide',
  'lively.modules',
  'babel-plugin-transform-jsx',
  'lively-system-interface',
  'lively.storage',
  'lively.collab',
  'localconfig.js'
];

const baseURL = typeof System !== 'undefined' ? System.baseURL : ensureFolder(process.env.lv_next_dir || process.cwd());

/**
 * Custom warn() that is triggered by RollupJS to inidicate problems with the bundle.
 * @param { object } warning - The warning object.
 * @param { function } warn - The custom error function to utilize for logging the warning.
 */
export function customWarn (warning, warn, bundler) {
  if (warning.code === 'UNRESOLVED_IMPORT') {
    // add the import to the source map to link to empty
    arr.pushIfNotIncluded(bundler.excludedModules, warning.source);
  }
  if (!bundler.verbose) return;
  switch (warning.code) {
    case 'THIS_IS_UNDEFINED':
    case 'EVAL':
    case 'MODULE_LEVEL_DIRECTIVE':
      return;
    case 'CIRCULAR_DEPENDENCY':
      bundler.resolver.setStatus({ status: warning.message });
      return;
    case 'SOURCEMAP_ERROR':
      // FIXME: for the time being, these are caused by babel
      // once we remove babel, these should go away
      // do not need to be filtered any more.
      return;
    case 'SHIMMED_EXPORT':
      if (warning.exporter === '@empty') return;
      if (warning.exporter.startsWith('\x00')) return;
      bundler.resolver.setStatus({ status: warning.message });
      return;
  }
  warn(warning);
}

/**
 * Generates unique id for a importer, importee pair.
 * This is for internal and debugging purpose only.
 * @param {string} id - The id of the imported module.
 * @param {string} importer - The id of the importing module.
 * @returns {string} A unique id for the module pair.
 */
function resolutionId (id, importer) {
  if (!importer) return id;
  else return importer + ' -> ' + id;
}

/**
 * For a given id, returns wether or not it is imported
 * from one of the supported ESM CDNs.
 * @param { string } id - The id of the module in question.
 * @param { string } importer - The importing module.
 * @param { object } resolver - The resolver for the current build context (browser or node.js).
 * @returns { boolean } Wether or not the module was served from an ESM CDN.
 */
function isCdnImport (id, importer, resolver) {
  if (ESM_CDNS.find(cdn => id.includes(cdn) || importer.includes(cdn)) && importer && importer !== ROOT_ID) {
    const { url } = resource(resolver.ensureFileFormat(importer)).root(); // get the cdn host root
    return ESM_CDNS.find(cdn => url.includes(cdn));
  }
  return false;
}

export default class LivelyRollup {
  constructor (props = {}) {
    this.setup(props);
  }

  setup ({
    snapshot,
    rootModule,
    resolver,
    excludedModules = [],
    autoRun = false,
    asBrowserModule = true,
    useTerser = false,
    isResurrectionBuild = false,
    includePolyfills = true,
    includeLivelyAssets = true,
    compress = true,
    minify = true,
    captureModuleScope = true,
    verbose = false
  }) {
    this.verbose = verbose; // wether or not to log the warnings to the console that happen during build
    this.resolver = resolver; // resolves the modules to the respective urls, for either client or browser
    this.useTerser = useTerser; // needed because google closure sometimes does crazy stuff during optimization
    this.includePolyfills = includePolyfills; // wether or not to include the pointer event polyfill
    this.snapshot = null; // DEPRECATED
    if (rootModule) { this.rootModuleId = resolver.resolveModuleId(rootModule); } // the root module to use as an entry point
    this.autoRun = autoRun; // If root module is specified then this flag indicates that the main function of the module is to be invoked on load.
    this.asBrowserModule = asBrowserModule; // Wether or not to export this module as a browser loadable one. This will stub some nodejs packages like fs.
    this.excludedModules = excludedModules; // Set of package names whose modules to exclude from the bundle.
    this.captureModuleScope = captureModuleScope; // Wether or not the scopes of the modules should be captured. This is needed for supporting meta programming capabilities in the bundle.
    this.isResurrectionBuild = isResurrectionBuild; // If set to true, this will make the lively.core modules hot swappable. This requires not only scope capturing but also embedding of constructs in the build that allow for hot swapping of the modules in the static build scripts.
    this.includeLivelyAssets = includeLivelyAssets; // If set to true, will include the default fonts and css from lively.next into the bundle. Disabling this is probably a bad idea.
    this.compress = compress; // If true, this will perform custom compression of the files to brotli and gzip.
    this.minify = minify; // If true, will invoke the google closure minification to further reduce source code size.

    this.globalMap = {}; // accumulates the package -> url mappings that are provided by each of the packages
    this.modulesWithDynamicLoads = new Set(); // collection of all modules that include System.import()
    this.hasDynamicImports = false; // Internal flag that indicates wether or not we need to perform code splitting or not.
    this.globalModules = {}; // Collection of global modules, which are not imported via ESM. Can be ditched?
    this.resolved = {};
    this.projectAssets = [];
    this.customFontFiles = [];
    this.projectsInBundle = new Set();

    this.resolver.setStatus({ label: 'Freezing in Progress' });
  }

  /**
   * Wether or not we need the (soon to be replaced) 0.21 version of SystemJS instead of SystemJS 6.x.x.
   */
  get needsOldSystem () {
    return this.isResurrectionBuild || !this.excludedModules.includes('lively.modules');
  }

  /**
   * Depending in the configuration of the bundle, we return a different
   * kind of resolution context. This can be plain flatn, or flatn combined with
   * systemjs custom import maps for either node.js or the browser.
   * @returns { "node"|"systemjs-node"|"systemjs-browser" }
   */
  getResolutionContext () {
    if (!this.asBrowserModule) { return 'systemjs-node'; } else { return 'systemjs-browser'; }
    // fixme: how to configure "system-node"
  }

  /**
   * Dispatches the responsibility of resolving relative imports to the loaded SystemJS.
   * @param { string } moduleId - The module from where the import happens.
   * @param { string } path - The relative path to be imported.
   */
  // FIXME: the reason this is async is because we still keep the browser resolver around...
  async resolveRelativeImport (moduleId, path) {
    if (!path.startsWith('.')) return this.resolver.normalizeFileName(path);
    // how to achieve that without the nasty file handle
    return await this.resolver.normalizeFileName(
      string.joinPath(await this.resolver.normalizeFileName(moduleId), '..', path));
  }

  /**
   * Clear the id of a module from any host specific information.
   * @param { string } id - The id of the module.
   */
  normalizedId (id) {
    return id.replace(baseURL, '').replace('local://lively-object-modules/', '').replace('local_projects/', '').replace('https://jspm.dev/', 'esm://cache/');
  }

  /**
   * Given a module, determine the options we need to pass to the class transform
   * such that it transforms the custom class definitions in our modules
   * in a way that makes sense in a frozen build.
   * @param { Module } mod - The module object to transform the class definitions for.
   * @returns { object } The transform options.
   */
  getTransformOptions (modId, parsedSource) {
    if (modId === '@empty.js') return {};
    let version, name;
    const pkg = this.resolver.resolvePackage(modId);
    if (pkg) {
      name = pkg.name;
      version = pkg.version;
    } else {
      // assuming the module comes from jspm
      version = modId.split('@')[1];
      name = modId.split('npm:')[1].split('@')[0];
    }
    const classToFunction = {
      classHolder: ast.parse(`((lively.FreezerRuntime || lively.frozenModules).recorderFor("${this.normalizedId(modId)}", __contextModule__))`),
      functionNode: { type: 'Identifier', name: 'initializeES6ClassForLively' },
      transform: classes.classToFunctionTransform,
      currentModuleAccessor: ast.parse(`({
        pathInPackage: () => {
           return "${this.resolver.pathInPackageFor(modId)}"
        },
        unsubscribeFromToplevelDefinitionChanges: () => () => {},
        subscribeToToplevelDefinitionChanges: () => () => {},
        package: () => { 
          return {
            name: "${name}",
            version: "${version}"
          } 
        } 
      })`).body[0].expression
    };
    return {
      captureImports: false, // we do not need to support inline evals within bundled modules,
      exclude: [
        'System',
        '__contextModule__',
        ...this.resolver.dontTransform(modId, [...ast.query.knownGlobals, ...GlobalInjector.getGlobals(null, parsedSource)]),
        ...arr.range(0, 50).map(i => `__captured${i}__`)
      ],
      classToFunction
    };
  }

  /**
   * Returns the source code of the root module for the current freeze build.
   * This needs to be a module as specified by the config.
   * @returns { string } The source code of the root module.
   */
  async getRootModule () {
    if (this.rootModuleId) {
      if (!this.autoRun) { // if there is no main function specified, we just export the entire module in the root module
        return `export * from "${this.rootModuleId}";`;
      }
      return await this.synthesizeMainModule();
    }
  }

  /**
   * Returns the source code of a synthesized modules that creates plain
   * morphic world and then calls the configured main method with that
   * world as the argument.
   */
  async synthesizeMainModule () {
    let mainModuleSource = await resource(this.resolver.ensureFileFormat(await this.resolver.normalizeFileName('lively.freezer/src/util/main-module.js'))).read();
    mainModuleSource = mainModuleSource.replaceAll('TRACE', this.isResurrectionBuild ? 'true' : 'false');
    return mainModuleSource.replace('prepare()', `const { main, WORLD_CLASS = World, TITLE } = await System.import('${this.rootModuleId}')`);
  }

  /**
   * Determines if a given module requires the scope to be captured.
   * Capturing the scope means that the module gets exposed to the static runtime
   * and allows deserialization to work in the bundled instances.
   * In principle, the following modules need the scope to be captured:
   * 1. component modules (.cp.js)
   * 2. Any modules that are imported by the component modules.
   * 3. Any objects that we want to copy at runtime... but how do we identify those? All the modules that require custom class transformations? Any modules that are not 3rd party?
   * @param { string } moduleId - The id of the module.
   * @param { string } importModuleId - The id of the module that imported the module.
   */
  needsScopeToBeCaptured (moduleId, importModuleId, sourceCode = false) {
    if (sourceCode && this.resolver.detectFormatFromSource(sourceCode) === 'global') return false; // skip global modules since they are non esm
    if (this.isResurrectionBuild && this.wasFetchedFromEsmCdn(moduleId)) return true;
    if (importModuleId && resource(moduleId).host() !== resource(importModuleId).host()) {
      return false;
    }
    return !this.wasFetchedFromEsmCdn(moduleId); // just capture anything that is a core module
  }

  /**
   * Returns wether or not a particular module was loaded from an ESM server.
   * @param { string } moduleId - The module in question.
   * @returns { boolean }
   */
  wasFetchedFromEsmCdn (moduleId) {
    return !!ESM_CDNS.find(url => moduleId.includes(url));
  }

  /**
   * Determine if the given module needs the class definitions to be instrumented.
   * Reminder: We need this instrumentation to make our custom property definition work
   * among other things, which is needed for deserialization etc.
   * This is particulary tricky. We can check for the following:
   * 1. Wether or not we directly subclass Morph, ViewModel etc... but that only works for direct subcclasses in a module. What happens to further derived subclasses?
   * 2. For further derived subsclasses we need to gather class derivation info during code analysis.... that is quite annoying...
   * 3. Rejecting all modules coming from a esm cdn (those surely do not rely on our custom stuff)
   * @param { string } moduleId - The id of the module.
   * @param { string } moduleSource - The source code of the module.
   */
  needsClassInstrumentation (moduleId, moduleSource) {
    if (CLASS_INSTRUMENTATION_MODULES_EXCLUSION.some(pkgName => moduleId.includes(pkgName))) { return false; } // is explicitly excluded
    if (CLASS_INSTRUMENTATION_MODULES.some(pkgName => moduleId.includes(pkgName) || pkgName === moduleId)) { // belongs to lively package
      return true;
    }
    if (this.isResurrectionBuild) return true;
    if (this.wasFetchedFromEsmCdn(moduleId)) return false; // never instrument stuff from ESM cdns
    if (this.isComponentModule(moduleId)) return true; // defines components
    if (moduleSource && moduleSource.match(/extends\ (Morph|Image|Ellipse|HTMLMorph|Path|Polygon|Text|InteractiveMorph|ViewModel)/)) return true; // contains lively class defs, but...
    // fixme: ...how about 3rd party derivations of lively classes in non lively modules (such as local project?) i.e: [class CustomMorph extends MyMorph] extends Morph ?
    return false;
  }

  /**
   * Returns wether or not the given module id belongs to a component module.
   * @param { string } moduleId - The module id.
   */
  isComponentModule (moduleId) {
    return moduleId.endsWith('.cp.js');
  }

  isLivelyCoreModule (moduleId) {
    return moduleId.includes('lively.');
  }

  /**
   * Returns true if the given module contains code of the sort of System.import(...) which we need
   * to convert into plain import() calls for rollup to consume correctly.
   * @param { string } moduleId - The module id.
   */
  needsDynamicLoadTransform (sourceCode) {
    return sourceCode.includes('System.import'); // good enough
  }

  /**
   * Prepares the source code of a given module such that all SystemJS
   * dependent import calls are replaced by native import() such that
   * rollup is able to perform proper code splitting.
   * @param { string } source - The source code of the module to transform.
   * @param { string } moduleId - The module id.
   */
  instrumentDynamicLoads (parsed, moduleId) {
    return ast.ReplaceVisitor.run(parsed, (node) => {
      if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
        if (node.callee.property.name === 'import' && node.callee.object.name === 'System' && node.arguments.length === 1) {
          // evaluate the imported expression on the spot
          // this forces lively.modules into the system. This can not be supported
          try {
            const resolvedImport = eval(ast.stringify(node.arguments[0]));
            if (resolvedImport) this.hasDynamicImports = true;
            return ast.parse(`import("${resolvedImport}")`).body[0].expression;
          } catch (err) {
            return node;
          }
        }
      }
      return node;
    });
  }

  /**
   * A custom transform() callback for RollupJS.
   * @param { string } source - The source code of a module.
   * @param { string } id - The id of the module to be transformed.
   */
  async transform (source, id) {
    const originalSource = source;
    if (id.startsWith('\0') || id.endsWith('.json') || this.excludedModules.find(m => id.startsWith(m))) {
      return source;
    }
    // We use the string 'projectAsset' there in regular code to enable correct reconciliation.
    if (!id.includes('lively.ide/components/helpers.js')) {
      const projectAssetRegex = /projectAsset\('(?<assetName>.*)'\)/g;
      const currentlyTransformedProject = id.match(/local_projects\/([^\/]*)\//)?.[1];

      if (currentlyTransformedProject) this.projectsInBundle.add(currentlyTransformedProject);

      const assetNameRewriter = (match, assetName) => {
        const newName = currentlyTransformedProject + '__' + assetName;

        this.projectAssets.push({
          oldName: assetName,
          newName,
          project: currentlyTransformedProject
        });
        return `projectAsset(\'${newName}\')`;
      };

      source = source.replaceAll(projectAssetRegex, assetNameRewriter);
    }

    let parsed = ast.parse(source);

    if (this.needsDynamicLoadTransform(source)) {
      parsed = this.instrumentDynamicLoads(parsed, id);
    }

    if (id === ROOT_ID) return ast.stringify(parsed);
    // this capturing stuff needs to behave differently when we have dynamic imports. Why??
    const instrumentClasses = this.needsClassInstrumentation(id, source);
    if (this.needsScopeToBeCaptured(id, null, source) || instrumentClasses) {
      const sourceHash = string.hashCode(await this.resolver.load(id));
      parsed = await this.captureScope(parsed, id, sourceHash, instrumentClasses);
    }

    return ast.stringify(parsed);
  }

  /**
   * A custom resolve() callback for RollupJS
   * @param { string } id - The module id to be resolved.
   * @param { string } importer - The module id that is importing said module.
   */
  async resolveId (id, importer) {
    if (this.resolved[resolutionId(id, importer)]) return this.resolved[resolutionId(id, importer)];
    if (id === ROOT_ID) return id;
    // handle standalone
    if (!importer) return this.resolver.resolveModuleId(id, importer, this.getResolutionContext());

    // handle ESM CDN imports
    if (isCdnImport(id, importer, this.resolver)) {
      if (id.startsWith('.')) {
        id = resource(importer).parent().join(id).withRelativePartsResolved().url;
      } else {
        id = resource(importer).root().join(id).withRelativePartsResolved().url;
      }
    }

    const importingPackage = this.resolver.resolvePackage(importer);
    // honor the systemjs options within the package config
    const mapping = importingPackage?.systemjs?.map;
    if (mapping) {
      this.globalMap = { ...this.globalMap, ...mapping };
      if (mapping[id] || this.globalMap[id]) {
        if (!mapping[id] && this.globalMap[id]) {
          console.warn(`[freezer] No mapping for "${id}" provided by package "${importingPackage.name}". Guessing "${this.globalMap[id]}" based on past resolutions. Please consider adding a map entry to this package config in oder to make the package definition sound and work independently of the current setup!`); // eslint-disable-line no-console
        }
        if (this.excludedModules.includes(id)) return id;
        let remapped = mapping[id] || this.globalMap[id];
        const ctx = this.asBrowserModule ? '~node' : 'node';
        if (remapped[ctx]) remapped = remapped[ctx];
        if (typeof remapped === 'string') id = remapped;
      }
    }

    let absolutePath;

    if (id.startsWith('.')) { // handle some kind of relative import
      try {
        absolutePath = await this.resolveRelativeImport(importer, id);
        if (this.belongsToExcludedPackage(absolutePath)) return null;
        return this.resolved[resolutionId(id, importer)] = absolutePath;
      } catch (err) {
        return null;
      }
    }

    // this needs to be done by flatn if we are running in nodejs. In the client, this also may lead to bogus
    // results since we are not taking into account in package.json

    absolutePath = this.resolver.resolveModuleId(id, importer, this.getResolutionContext());
    if (this.belongsToExcludedPackage(absolutePath)) return id;
    return this.resolved[resolutionId(id, importer)] = absolutePath;
  }

  belongsToExcludedPackage (id) {
    if (id === null) return true;
    const pkg = this.resolver.resolvePackage(id);
    if (pkg && this.excludedModules.includes(pkg.name)) {
      return true;
    }
    return false;
  }

  /**
   * A custom resolveDynamicImport() which takes into account some of
   * the excluded modules.
   * @param { AstNode } node - The ast node that represents the dynamic import call site.
   * @param { string } importer - The id of the module where the dynamic import is triggered from.
   */
  resolveDynamicImport (node, importer) {
    if (node.type && this.isLivelyCoreModule(importer)) return null;
    const id = node;
    const res = this.resolveId(id, importer);
    if (res && obj.isString(res)) {
      return {
        external: false,
        id: res
      };
    }
    return res;
  }

  /**
   * A custom load() for RollupJS. This handles the fetching of the source code
   * for a given module id.
   * @param { string } id - The module id to getch the source code for.
   * @returns { string } The source code.
   */
  async load (id) {
    if (this.excludedModules.find(m => id.startsWith(m))) {
      if (id === 'lively.ast') {
        return `
        let nodes = {}, query = {}, transform = {}, BaseVisitor = Object;
        export { nodes, query, transform, BaseVisitor };`;
      }
      if (id === 'lively.modules') {
        return `
        let scripting = {};
        export { scripting };`;
      }
      return '';
    }

    if (id === ROOT_ID) {
      const res = await this.getRootModule();
      return res;
    }
    const pkg = this.resolver.resolvePackage(id);
    if (pkg && this.excludedModules.includes(pkg.name) &&
        !id.endsWith('.json')) {
      return '';
    }

    let s = await this.resolver.load(id);
    if (id.endsWith('.json')) {
      return s;
    }
    s = fixSourceForBugsInGoogleClosure(id, s);

    return s;
  }

  async buildStart (plugin) {
    this.resolver.setStatus({ status: 'Bundling...' });
    await this.resolver.whenReady();
    if (this.autoRun) {
      plugin.emitFile({
        type: 'chunk',
        id: ROOT_ID
      });
    }
  }

  /**
   * Instruments code of a module such that the scope of the module
   * i.e. the class/function/variable definitions are captured and can
   * be accessed at runtime. This is essential to enable serialization
   * in bundles or allow resurrection builds that can be incrementally
   * enhanced dynamically later on.
   * @param { string } source - The source code of the module to be instrumented.
   * @param { string } id - The id of the module.
   * @returns { string } The instrumented source code.
   */
  async captureScope (parsed, id, hashCode, instrumentClasses) {
    let classRuntimeImport = '';
    const recorderName = '__varRecorder__';
    const declsAndRefs = ast.query.topLevelDeclsAndRefs(parsed);
    const exports = [];
    for (let exp of ast.query.exports(declsAndRefs.scope)) {
      if (exp.local && exp.exported !== 'default' && exp.exported !== exp.local) {
        // retrieve all the exports of the module
        exports.push(JSON.stringify('__rename__' + exp.local + '->' + exp.exported));
        continue;
      }
      if (exp.exported === '*') {
        // retrieve all the exports of the module
        exports.push(JSON.stringify('__reexport__' + this.normalizedId(await this.resolveId(exp.fromModule, id))));
        continue;
      }
      if (exp.exported === 'default') {
        exports.push(JSON.stringify('__default__' + exp.local)); // in order to capture this
      }
      exports.push(JSON.stringify(exp.exported));
    }
    const localLivelyVar = declsAndRefs.declaredNames.includes('lively');
    const recorderString = this.captureModuleScope
      ? `${localLivelyVar ? GLOBAL_FETCH : ''} const ${recorderName} = (${localLivelyVar ? 'G.' : ''}lively.FreezerRuntime || ${localLivelyVar ? 'G.' : ''}lively.frozenModules).recorderFor("${this.normalizedId(id)}", __contextModule__);\n`
      : '';
    const moduleHash = `${recorderName}.__module_hash__ = ${hashCode};\n`;
    const moduleExports = `${recorderName}.__module_exports__ = ${recorderName}.__module_exports__ || [${exports.join(',')}];\n`;
    const captureObj = { name: recorderName, type: 'Identifier' };
    const tfm = fun.compose(rewriteToCaptureTopLevelVariables, ast.transform.objectSpreadTransform);
    const opts = this.getTransformOptions(this.resolver.resolveModuleId(id), parsed);
    const currentModuleAccessor = opts.classToFunction.currentModuleAccessor;

    if (instrumentClasses) {
      classRuntimeImport = `import { initializeClass as initializeES6ClassForLively } from "${this.isResurrectionBuild ? 'livelyClassesRuntime.js' : 'lively.classes/runtime.js'}";\n`;
    } else {
      opts.classToFunction = false;
    }

    let instrumented = parsed;
    const normalizedId = this.normalizedId(id);
    if (this.isComponentModule(id)) {
      instrumented = ensureComponentDescriptors(parsed, normalizedId, recorderName);
    }

    let defaultExport = '';
    if (this.captureModuleScope) {
      instrumented = replaceExportedVarDeclarations(parsed, recorderName, normalizedId);
      if (this.isResurrectionBuild) {
        instrumented = await replaceImportedNamespaces(instrumented, id, this);
        instrumented = await replaceExportedNamespaces(instrumented, id, this);
      }
      instrumented = tfm(instrumented, captureObj, opts);
      instrumented = insertCapturesForExportedImports(instrumented, { captureObj });
      instrumented = insertCapturesForFunctionDeclarations(instrumented, {
        declarationWrapper: ast.nodes.member(captureObj, ast.nodes.literal(normalizedId + '__define__')),
        currentModuleAccessor
      });

      const imports = [];
      const toBeReplaced = [];

      ast.custom.forEachNode(instrumented, (n) => {
        if (n.type === 'ImportDeclaration') arr.pushIfNotIncluded(imports, n);
        if (n.type === 'ExportDefaultDeclaration') {
          let exp;
          switch (n.declaration.type) {
            case 'Literal':
              exp = Path('declaration.raw').get(n);
              break;
            case 'Identifier':
              exp = Path('declaration.name').get(n);
              break;
            case 'ClassDeclaration':
            case 'FunctionDeclaration':
              exp = Path('declaration.id.name').get(n);
              break;
          }
          if (exp) defaultExport = `${captureObj.name}.default = ${exp};\n`;
        }
      });
      for (const stmts of Object.values(arr.groupBy(imports, imp => imp.source.value))) {
        const toBeMerged = stmts.filter(stmt => stmt.specifiers.every(spec => spec.type === 'ImportSpecifier'));
        if (toBeMerged.length > 1) {
        // merge statements
        // fixme: if specifiers are not named, these can not be merged
        // fixme: properly handle default export
          const mergedSpecifiers = arr.uniqBy(
            toBeMerged.map(stmt => stmt.specifiers).flat(),
            (spec1, spec2) =>
              spec1.type === 'ImportSpecifier' &&
            spec2.type === 'ImportSpecifier' &&
            spec1.imported.name === spec2.imported.name &&
            spec1.local.name === spec2.local.name
          );
          toBeMerged[0].specifiers = mergedSpecifiers;
          toBeReplaced.push(...toBeMerged.slice(1).map(stmt => {
            stmt.body = [];
            stmt.type = 'Program';
            return stmt;
          }));
        }
      }
    }

    instrumented.body = [
      ...ast.parse(recorderString).body,
      ...ast.parse(this.isResurrectionBuild ? moduleHash + moduleExports : '').body,
      ...ast.parse(classRuntimeImport).body,
      ...instrumented.body,
      ...ast.parse(defaultExport).body
    ];

    return instrumented;
  }

  /**
   * Automatically generates a variable name from a module id.
   * This variable name can be used for storing the module scope
   * in the bundle source code.
   * @returns { string } The variable name.
   */
  deriveVarName (moduleId) { return string.camelize(arr.last(moduleId.split('/')).replace(/\.js|\.min/g, '').split('.').join('')); }

  /**
   * Generates the source code of a module that should be loaded as a global module.
   * Global modules are populating the global name space after they are executed.
   * This requires us to capture the sideeffects on the global scope in order to extract
   * the exports for the module scope.
   * @param { string } moduleId - The id of the module.
   */
  async wrapStandalone (moduleId) {
    moduleId = this.resolver.resolveModuleId(moduleId, undefined, this.getResolutionContext());
    const source = await resource(moduleId).read();
    const globalVarName = this.deriveVarName(moduleId);
    let code;
    if (this.resolver.detectFormat(moduleId) === 'global') {
      code = `var ${globalVarName} = (function() {
         var fetchGlobals = prepareGlobal("${moduleId}");
         ${source};
         return fetchGlobals();
      })();\n`;
    } else {
      code = `
      var ${globalVarName};
        (function(module /* exports, require */) {
         // optional parameters
         var exports = arguments.length > 0 && arguments[1] !== undefined ? arguments[1] : {};
         var require = arguments.length > 1 && arguments[2] !== undefined ? arguments[2] : function () {};
  
         // try to simulate node.js context
         var exec = function(exports, require) {
            ${source} 
         };
         exec(exports, require);
         if (typeof module.exports !== 'function' && Object.keys(module.exports).length === 0) Object.assign(module.exports, exports);
         if (typeof module.exports !== 'function' && Object.keys(module.exports).length === 0) {
            exec(); // try to run as global
         }
         ${globalVarName} = module.exports;
       })({exports: {}});\n`;
    }
    return { code, global: globalVarName };
  }

  async generateGlobals (systemJsEnabled = this.hasDynamicImports) {
    let code = await this.getRuntimeCode();
    let importMap = false;
    const globals = {};

    if (!systemJsEnabled) {
      code += `${this.asBrowserModule ? 'var fs = {};' : 'var fs = require("fs");'} var _missingExportShim = () => {}, show, System, require, timing, lively, Namespace, localStorage;`;
    }

    // this is no longer an issue due to removal of all non ESM modules from our system. Can be removed? Not entirely....
    for (const modId in this.globalModules) {
      const { code: newCode, global: newGlobal } = await this.wrapStandalone(modId);
      code += newCode;
      globals[modId] = newGlobal;
    }

    if (systemJsEnabled) {
      // we can use the stripped down https://raw.githubusercontent.com/systemjs/systemjs/master/dist/s.js
      // however that does not allow us to transition to the dynamic lively.modules system
      // so we can only utilize s.js in case we do not want to resurrect
      if (this.needsOldSystem) {
        code += await resource(this.resolver.ensureFileFormat(await this.resolver.normalizeFileName('lively.freezer/src/util/system.0.21.js'))).read();
      } else {
        code += await resource(this.resolver.ensureFileFormat(await this.resolver.normalizeFileName('lively.freezer/src/util/system.6.js'))).read();
      }
      // stub the globals
      code += `(${instrumentStaticSystemJS.toString()})(System);\n`;

      if (this.needsOldSystem) { // for the time being and where we are still tied to old SystemJS
        for (const id of this.excludedModules.concat(this.asBrowserModule ? ['fs', 'events'] : [])) {
          code += `System.set("${id}", System.newModule({ default: {} }));\n`;
        }
      } else {
        // generate a import map
        importMap = '<script type="systemjs-importmap">\n{\n"imports": {\n';
        importMap += this.excludedModules
          .concat(this.asBrowserModule ? ['fs', 'events'] : [])
          .map(id => `"${id}": "./@empty.js"`).join(',\n');
        importMap += '\n  }\n}\n</script>';
      }
    } else {
      for (const id of this.excludedModules) {
        const varName = globals[id] = this.deriveVarName(id);
        code += `var ${varName} = {};\n`;
      }
    }

    return {
      code, globals, importMap
    };
  }

  async getRuntimeCode () {
    const includePolyfills = this.includePolyfills && this.asBrowserModule;
    let runtimeCode = await resource(this.resolver.ensureFileFormat(await this.resolver.normalizeFileName('lively.freezer/src/util/runtime.js'))).read();
    const regeneratorSource = await resource(this.resolver.ensureFileFormat(await this.resolver.normalizeFileName('lively.freezer/src/util/regenerator-runtime.js'))).read();
    const polyfills = includePolyfills ? await resource(this.resolver.ensureFileFormat(await this.resolver.normalizeFileName('lively.freezer/deps/fetch.umd.js'))).read() : '';
    runtimeCode = `(${runtimeCode.slice(0, -1).replace('export ', '')})();\n`;
    if (!this.hasDynamicImports) {
      // If there are no dynamic imports, we compile without systemjs and
      // can stub it with our FreezerRuntime
      runtimeCode += SYSTEMJS_STUB;
    }
    if (this.isResurrectionBuild) {
      runtimeCode += 'lively.isResurrectionBuild = true;';
    }
    runtimeCode += regeneratorSource;
    runtimeCode += polyfills;
    return es5Transpilation(runtimeCode);
  }

  generateAssetPreloads () {
    return arr.compact(arr.uniq(this.customFontFiles.map(fontFile => {
      return `<link rel="preload" href="${joinPath('./assets', `${fontFile.name()}`)}" as="font">`;
    }))).join('\n');
  }

  async generateIndexHtml (importMap, modules) {
    return await generateLoadHtml({
      ...this.autoRun || {},
      head: (this.autoRun?.head || '') + this.generateAssetPreloads()
    }, importMap, this.resolver, modules, this.isResurrectionBuild);
  }

  async generateBundle (plugin, bundle, depsCode, importMap, opts) {
    const modules = Object.values(bundle);
    modules.forEach(chunk => {
      if (chunk.code) {
        if (this.isResurrectionBuild) chunk.code = chunk.code.replace('System.register', 'BootstrapSystem.register');
	chunk.code = chunk.code.replace("'use strict'", "var __contextModule__ = typeof module !== 'undefined' ? module : arguments[1];\n");
      }
    });
    if (this.minify && opts.format !== 'esm') {
      modules.forEach((chunk, i) => {
        chunk.instrumentedCode = `"${separator}",${i};\n` + chunk.code;
      });
      let codeToMinify = modules.map(chunk => chunk.instrumentedCode).join('\n');
      const { min: minfiedCode } = await compileOnServer(codeToMinify, this.resolver, this.useTerser);
      let compiledSnippets = minfiedCode.split(new RegExp(`"${separator}";\n?`));
      const adjustedSnippets = new Map(); // ensure order
      modules.forEach((snippet, i) => {
        adjustedSnippets.set(i, snippet.code); // populate with original source in case the transpiler kicked the chunk away
      });
      compiledSnippets.forEach((compiledSnippet, i) => {
        const hit = compiledSnippet.match(/^[0-9]+;\n?/);
        if (!hit) return; // fixme: google closure seems to add some weird polyfill stuff...
        const hint = Number(hit[0].replace(/;\n?/, ''));
        adjustedSnippets.set(hint, compiledSnippet.replace(/^[0-9]+;\n?/, ''));
      });
      const polyfills = compiledSnippets[0];
      compiledSnippets = [...adjustedSnippets.values()];
      compiledSnippets[0] = polyfills + compiledSnippets[0];
      for (const [snippet, compiled] of arr.zip(modules, compiledSnippets)) {
        snippet.code = compiled.replace("'use strict';", '');
      } // override the code attribute
    }

    if (this.isResurrectionBuild) {
      plugin.emitFile({
        type: 'asset',
        fileName: 'livelyClassesRuntime.js',
        source: await this.resolver.load(await this.resolver.normalizeFileName('lively.classes/build/runtime.js'))
      });
    }

    if (this.compress) {
      for (let chunk of modules) {
        plugin.emitFile({
          type: 'asset',
          fileName: chunk.fileName + '.gz',
          source: await gzip(chunk.code)
        });
        plugin.emitFile({
          type: 'asset',
          fileName: chunk.fileName + '.br',
          source: await brotli(chunk.code)
        });
      }
    }

    const morphicUrl = this.resolver.ensureFileFormat(this.resolver.decanonicalizeFileName('lively.morphic').replace('index.js', ''));
    if (this.includeLivelyAssets) {
      const fontBundleDir = resource(config.css.fontBundle).parent();
      const fontFiles = await fontBundleDir.dirList();

      for (let file of fontFiles) {
        file.beBinary();
        let source = await file.read();
        if (source instanceof ArrayBuffer) source = new Uint8Array(source); // this fucks up font files...
        plugin.emitFile({
          type: 'asset',
          fileName: joinPath(fontBundleDir.url.replace(morphicUrl, ''), file.name()),
          source
        });
      }

      const assetDir = resource(config.css.fontBundle).parent().parent();
      const morphicCSS = assetDir.join('morphic.css');
      morphicCSS.beBinary();
      let source = await morphicCSS.read();
      if (source instanceof ArrayBuffer) source = new Uint8Array(source); // this fucks up font files...
      plugin.emitFile({
        type: 'asset',
        fileName: joinPath(assetDir.url.replace(morphicUrl, ''), 'morphic.css'),
        source
      });
    }

    const livelyDir = resource(morphicUrl).join('..').withRelativePartsResolved();
    const projectsDir = resource(livelyDir).join('local_projects');
    let bundledProjectCSS = '';
    let bundledProjectFontCSS = '';
    // In contrast to `assets`, we cannot tell which CSS and font files are actually used. We need to collect them for the project to be bundled and all its dependencies.
    for (let [project] of this.projectsInBundle.entries()) {
      const indexCSSFile = projectsDir.join(project).join('index.css');
      const indexCSSContents = await indexCSSFile.read();
      bundledProjectCSS = indexCSSContents + '\n' + bundledProjectCSS;
      const fontCSSFile = projectsDir.join(project).join('fonts.css');
      // Inside of the projects, font files are in the assets folder, with font.css being a hierarchy above.
      // Inside of the bundles, font.css itself is part of the assets folder.
      const fontCSSContents = (await fontCSSFile.read()).replaceAll(/\.\/assets\//g, './');
      bundledProjectFontCSS = fontCSSContents + '\n' + bundledProjectFontCSS;

      const assetDir = await projectsDir.join(project).join('assets');
      // Each project can have multiple font files
      if (await assetDir.exists()) {
        const fontFiles = (await assetDir.dirList()).filter(f => f.url.includes('woff2'));
        this.customFontFiles.push(...fontFiles);
        for (let file of fontFiles) {
          file.beBinary();
          let source = await file.read();
          if (source instanceof ArrayBuffer) source = new Uint8Array(source);
          plugin.emitFile({
            type: 'asset',
            fileName: joinPath('assets', file.name()),
            source
          });
        }
      }
    }

    const bundledCSS = bundledProjectFontCSS + '\n' + bundledProjectCSS;
    plugin.emitFile({
      type: 'asset',
      fileName: joinPath('assets', 'bundle.css'),
      source: bundledCSS
    });

    for (let asset of this.projectAssets) {
      const file = resource(projectsDir).join(asset.project).join('assets').join(`${asset.oldName}`);
      file.beBinary();
      let source = await file.read();
      if (source instanceof ArrayBuffer) source = new Uint8Array(source);
      plugin.emitFile({
        type: 'asset',
        fileName: joinPath('assets', `${asset.newName}`),
        source
      });
    }
    // add the blank import file to make systemjs happy
    plugin.emitFile({
      type: 'asset',
      fileName: '@empty.js',
      source: ''
    });

    if (this.autoRun) {
      depsCode += `lively.FreezerRuntime.availableFonts = ${JSON.stringify(await this.resolver.availableFonts(bundledProjectFontCSS))}`;
      plugin.emitFile({
        type: 'asset',
        fileName: 'deps.js',
        source: depsCode
      });
      plugin.emitFile({
        type: 'asset',
        fileName: 'index.html',
        source: await this.generateIndexHtml(importMap, modules)
      });
    }

    this.resolver.finish();
  }
}
