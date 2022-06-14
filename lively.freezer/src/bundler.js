/* global process */
import { resource } from 'lively.resources';
import * as ast from 'lively.ast';
import * as classes from 'lively.classes';
import { arr, string, Path, fun, obj } from 'lively.lang';
import { es5Transpilation, ensureComponentDescriptors } from 'lively.source-transform';
import { rewriteToCaptureTopLevelVariables, insertCapturesForExportedImports } from 'lively.source-transform/capturing.js';
import { locateClass, requiredModulesOfSnapshot } from 'lively.serializer2';
import { classNameOfId, moduleOfId } from 'lively.serializer2/snapshot-navigation.js';
import config from 'lively.morphic/config.js'; // can be imported without problems in nodejs
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

const SYSTEMJS_STUB = `
var G = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
if (!G.System) G.System = G.lively.FreezerRuntime;`;

const CLASS_INSTRUMENTATION_MODULES = [
  'lively.morphic',
  'lively.components',
  'lively.ide',
  'lively.halos',
  'lively.user',
  'lively.bindings',
  'lively-system-interface', // required to make inspector serializable
  'typeshift.components',
  'lively.collab',
  'https://jspm.dev/npm:rollup@2.28.2' // this contains a bunch of class definitions which right now screws up the closure compiler
];

const ESM_CDNS = ['jspm.dev', 'jspm.io', 'skypack.dev', 'esm://cache'];

// fixme: Why is a blacklist nessecary if there is a whitelist?
const CLASS_INSTRUMENTATION_MODULES_EXCLUSION = [
  'lively.lang'
];

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
export function customWarn (warning, warn) {
  switch (warning.code) {
    case 'THIS_IS_UNDEFINED':
    case 'EVAL':
    case 'MODULE_LEVEL_DIRECTIVE':
      return;
  }
  warn(warning);
}

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
    captureModuleScope = true
  }) {
    this.resolver = resolver; // resolves the modules to the respective urls, for either client or browser
    this.useTerser = useTerser; // needed because google closure sometimes does crazy stuff during optimization
    this.includePolyfills = includePolyfills; // wether or not to include the pointer event polyfill
    this.snapshot = snapshot; // the snapshot to be used as a base for developing a bundled app
    if (rootModule) { this.rootModuleId = resolver.resolveModuleId(rootModule); } // alternatively to the snapshot, we can also use a root module as an entry point
    this.autoRun = autoRun; // If root module is specified then this flag indicates that the main function of the module is to be invoked on load.
    this.asBrowserModule = asBrowserModule; // Wether or not to export this module as a browser loadable one. This will stub some nodejs packages like fs.
    this.excludedModules = excludedModules; // Set of package names whose modules to exclude from the bundle.
    this.captureModuleScope = captureModuleScope; // Wether or not the scopes of the modules should be captured. This is needed for supporting meta programming capabilities in the bundle.
    this.isResurrectionBuild = isResurrectionBuild; // If set to true, this will make the lively.core modules hot swappable. This requires not only scope capturing but also embedding of constructs in the build that allow for hot swapping of the modules in the static build scripts.
    this.includeLivelyAssets = includeLivelyAssets; // If set to true, will include the default fonts and css from lively.next into the bundle.
    this.compress = compress; // If true, this will perform custom compression of the files to brotli and gzip.
    this.minify = minify; // If true, will invoke the google closure minification to further reduce source code size.

    this.globalMap = {}; // accumulates the package -> url mappings that are provided by each of the packages
    this.dynamicParts = {}; // parts loaded via loadPart/loadObjectsFromPartsbinFolder/resource("part://....") // deprecated
    this.dynamicModules = new Set(); // modules loaded via System.import(...)
    this.modulesWithDynamicLoads = new Set(); // collection of all modules that include System.import()
    this.hasDynamicImports = false; // Internal flag that indicates wether or not we need to perform code splitting or not.
    this.globalModules = {}; // Collection of global modules, which are not imported via ESM. Can be ditched?
    this.importedModules = []; // Collection of all the required modules from the passed snapshot. This is not popuplated if we utilize rootModule.
    this.resolved = {};
    this.assetsToCopy = [];
  }

  /**
   * More or less unnessecary convenience method that extracts the required modules from a given snapshot.
   * (Alongside the required assets). This only includes the modules that are directly required to
   * deserialize the given snapshot. It does not compute the convex hull of the root module.
   * @param { object } snap - The snapshot to be analyzed.
   */
  async getRequiredModulesFromSnapshot (snap) {
    return requiredModulesOfSnapshot(snap);
  }

  /**
   * Dispatches the responsibility of resolving relative imports to the loaded SystemJS.
   * Fixme: This heavily relies on a preinitialized module system, making it hard to invoke
   *        this code from the console. This needs to be resolved differently.
   * @param { string } moduleId - The module from where the import happens.
   * @param { string } path - The relative path to be imported.
   */
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
    return id.replace(baseURL, '').replace('local://lively-object-modules/', '');
  }

  /**
   * Given a module, determine the options we need to pass to the class transform
   * such that it transforms the custom class definitions in our modules
   * in a way that makes sense in a frozen build.
   * @param { Module } mod - The module object to transform the class definitions for.
   */
  getTransformOptions (modId) {
    if (modId === '@empty') return {};
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
      classHolder: ast.parse(`(lively.FreezerRuntime.recorderFor("${this.normalizedId(modId)}"))`),
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
      exclude: [
        'System',
        ...this.resolver.dontTransform(modId),
        ...arr.range(0, 50).map(i => `__captured${i}__`)
      ],
      classToFunction
    };
  }

  /**
   * Throws an error if a excluded package (as per config) is directly imported
   * by the root module. This heuristic is somewhat sketchy, but it sometimes works
   * for the benefit of the doubt.
   */
  checkIfImportedPackageExcluded (importedModules) {
    const excludedPackages = arr.compact(this.excludedModules.map(id => this.resolver.resolvePackage(id)));
    const importedPackages = importedModules.map(id => this.resolver.resolvePackage(id));
    const conflicts = arr.intersect(excludedPackages, importedPackages);
    if (conflicts.length > 0) {
      const multiple = conflicts.length > 1;
      const error = Error(`Package${multiple ? 's' : ''} ${conflicts.map(p => `"${p.name}"`)}\n${multiple ? 'are' : 'is'} directly required by part, yet set to be excluded.`);
      error.name = 'Exclusion Conflict';
      error.reducedExclusionSet = arr.withoutAll(this.excludedModules, conflicts.map(p => p.name));
      throw error;
    }
  }

  /**
   * Returns the source code of the root module for the current freeze build.
   * This can be either a module as specified by the config or a synthesized
   * snapshot module of the entry point is a morph or world object.
   * @returns { string } The source code of the root module.
   */
  async getRootModule () {
    if (this.rootModuleId) {
      if (!this.autoRun) { // if there is no main function specified, we just export the entire module in the root module
        return `export * from "${this.rootModuleId}";`;
      }
      return await this.synthesizeMainModule();
    }
    return await this.synthesizeSnapshotModule();
  }

  /**
   * Returns the source code of a synthesized modules that creates plain
   * morphic world and then calls the configured main method with that
   * world as the argument.
   */
  async synthesizeMainModule () {
    let mainModuleSource = await resource(this.resolver.ensureFileFormat(await this.resolver.normalizeFileName('lively.freezer/src/util/main-module.js'))).read();
    return mainModuleSource.replace('prepare()', `const { main, WORLD_CLASS = World, TITLE } = await System.import('${this.rootModuleId}')`);
  }

  /**
   * Returns the source code of a synthesized module that imports all modules that
   * are required to successfully deserialize the snapshot that for the frozen part.
   */
  async synthesizeSnapshotModule () {
    const snapshotModuleSource = await resource(this.resolver.ensureFileFormat(await this.resolver.normalizeFileName('lively.freezer/src/util/snapshot-module.js'))).read();
    const { requiredModules } = await this.getRequiredModulesFromSnapshot(this.snapshot);
    this.checkIfImportedPackageExcluded(requiredModules); // consequence of this may an exception and termination of this process
    return arr.uniq(requiredModules.map(path => `import "${path}"`)).join('\n') +
      (this.excludedModules.includes('localconfig.js') ? '' : await this.resolver.load(string.joinPath(baseURL, 'localconfig.js'))) +
     snapshotModuleSource.replace('{"SNAPSHOT": "PLACEHOLDER"}', JSON.stringify(JSON.stringify(obj.dissoc(this.snapshot, ['preview', 'packages']))));
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
    // if (this.redirect[moduleId]) return false; // skip redirected modules by default
    if (sourceCode && this.resolver.detectFormatFromSource(sourceCode) === 'global') return false; // skip global modules since they are non esm
    if (importModuleId && resource(moduleId).host() !== resource(importModuleId).host()) {
      return false; // 3rd party modules are not to be captured
    }
    if (!this.wasFetchedFromEsmCdn(moduleId)) return true;
    // fixme: Maybe utilize the required modules of the snapshot if present...
    // fixme: If no snapshot but main module instead, utilize the required modules (convex hull) of that main module for the set of captured modules
    // fixem: maybe also just always capture if not explicitly told not to. Since rollup already computes the convex hull
    // return this.isComponentModule(moduleId) || this.isComponentModule(importModuleId) || !this.wasFetchedFromEsmCdn(moduleId); // fixme: Dont we actually need the convex hull of the imports of the component modules?
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
  async instrumentDynamicLoads (source, moduleId) {
    const parsed = ast.parse(source);
    const nodesToReplace = [];
    let importUrls = [];

    ast.AllNodesVisitor.run(parsed, (node, path) => {
      if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
        if (node.callee.property.name === 'import' && node.callee.object.name === 'System' && node.arguments.length === 1) {
          // evaluate the imported expression on the spot
          // this forces lively.modules into the system. This can not be supported
          try {
            const idx = importUrls.push(eval(ast.stringify(node.arguments[0])));
            nodesToReplace.push({
              target: node.arguments[0],
              replacementFunc: (target, current) => {
                // if the result has not been computed, log an error
                if (importUrls[idx - 1]) { return `"${importUrls[idx - 1]}"`; }
                return current; // what to do with these???
              }
            });
            nodesToReplace.push({
              target: node.callee, replacementFunc: () => 'import'
            });
          } catch (err) {

          }
        }
      }
    });

    importUrls = (await Promise.all(importUrls)).map(res => res.isError ? undefined : res.value); // fixme: detect if there was an error

    // last minute discovery of dynamic imports
    if (!this.hasDynamicImports) this.hasDynamicImports = importUrls.length > 0;

    return ast.transform.replaceNodes(nodesToReplace, source).source;
  }

  /**
   * A custom transform() callback for RollupJS.
   * @param { string } source - The source code of a module.
   * @param { string } id - The id of the module to be transformed.
   */
  async transform (source, id) {
    if (id.startsWith('\0') || id.endsWith('.json')) {
      return source;
    }

    if (this.needsDynamicLoadTransform(source)) {
      source = await this.instrumentDynamicLoads(source, id);
    }

    if (id === ROOT_ID) return source;
    // this capturing stuff needs to behave differently when we have dynamic imports. Why??
    if (this.needsScopeToBeCaptured(id, null, source) || this.needsClassInstrumentation(id, source)) {
      source = this.captureScope(source, id);
    }

    return source;
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
    if (!importer) return this.resolver.resolveModuleId(id);

    // handle ESM CDN imports
    if (isCdnImport(id, importer, this.resolver)) {
      if (id.startsWith('.')) {
        id = resource(importer).parent().join(id).withRelativePartsResolved().url;
      } else {
        id = resource(importer).root().join(id).withRelativePartsResolved().url;
      }
    }

    // fixme: this is another one of these super weird pruning strategies...
    // if we are imported from a non dynamic context this does not apply
    const dynamicContext = this.dynamicModules.has(this.resolver.resolveModuleId(importer)) ||
                            this.dynamicModules.has(this.resolver.resolveModuleId(id));
    if (!dynamicContext) {
      if (this.excludedModules.includes(id)) return false;
    } else {
      this.dynamicModules.add(this.resolver.resolveModuleId(id, importer));
    }

    const importingPackage = this.resolver.resolvePackage(importer);
    // honor the systemjs options within the package config
    if (importingPackage && importingPackage.map) {
      this.globalMap = { ...this.globalMap, ...importingPackage.map };
      if (importingPackage.map[id] || this.globalMap[id]) {
        if (!importingPackage.map[id] && this.globalMap[id]) {
          console.warn(`[freezer] No mapping for "${id}" provided by package "${importingPackage.name}". Guessing "${this.globalMap[id]}" based on past resolutions. Please consider adding a map entry to this package config in oder to make the package definition sound and work independently of the current setup!`);
        }
        id = importingPackage.map[id] || this.globalMap[id];
        if (id['~node']) id = id['~node'];
        importer = importingPackage.url;
      }
    }

    if (id.startsWith('.')) { // handle some kind of relative import
      try {
        return this.resolved[resolutionId(id, importer)] = await this.resolveRelativeImport(importer, id);
      } catch (err) {
        return null;
      }
    }

    if (!id.endsWith('.js') && !isCdnImport) {
      return this.resolved[resolutionId(id, importer)] = await this.resolver.normalizeFileName(id);
    }

    if (!dynamicContext && this.excludedModules.includes(id)) return false;
    // this needs to be done by flatn if we are running in nodejs. In the client, this also may lead to bogus
    // results since we are not taking into account in package.json
    return this.resolved[resolutionId(id, importer)] = this.resolver.resolveModuleId(id, importer);
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
    // id = this.redirect[id] || id;
    if (this.excludedModules.includes(id)) {
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
    }

    if (id === ROOT_ID) {
      const res = await this.getRootModule();
      return res;
    }
    const pkg = this.resolver.resolvePackage(id);
    if (pkg && this.excludedModules.includes(pkg.name) &&
        !id.endsWith('.json') &&
        !this.dynamicModules.has(pkg.name) &&
        !this.dynamicModules.has(id)) {
      return '';
    }

    let s = await this.resolver.load(id);
    if (id.endsWith('.json')) {
      return s;
    }
    s = fixSourceForBugsInGoogleClosure(id, s);

    return s;
  }

  async buildStart () {
    this.resolver.setStatus({ status: 'Bundling...' });
    if (this.snapshot) this.getAssetsFromSnapshot(this.snapshot);
    await this.resolver.whenReady();
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
  captureScope (source, id) {
    let classRuntimeImport = '';
    const recorderName = '__varRecorder__';
    const recorderString = this.captureModuleScope
      ? `const ${recorderName} = lively.FreezerRuntime.recorderFor("${this.normalizedId(id)}");\n`
      : '';
    const captureObj = { name: recorderName, type: 'Identifier' };
    const parsed = ast.parse(source);
    const tfm = fun.compose(rewriteToCaptureTopLevelVariables, ast.transform.objectSpreadTransform);
    const opts = this.getTransformOptions(this.resolver.resolveModuleId(id));

    if (this.needsClassInstrumentation(id)) {
      classRuntimeImport = 'import { initializeClass as initializeES6ClassForLively } from "lively.classes/runtime.js";\n';
    } else {
      opts.classToFunction = false;
    }
    let instrumented = parsed;
    if (this.isComponentModule(id)) {
      instrumented = ensureComponentDescriptors(parsed, this.normalizedId(id));
    }

    let defaultExport = '';
    if (this.captureModuleScope) {
      instrumented = insertCapturesForExportedImports(tfm(parsed, captureObj, opts), { captureObj });

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

    return recorderString + classRuntimeImport + ast.stringify(instrumented) + defaultExport;
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
    moduleId = this.resolver.resolveModuleId(moduleId);
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
    let code = ''; let importMap = false;
    const globals = {};

    if (!systemJsEnabled) {
      code += `${this.asBrowserModule ? 'var fs = {};' : 'var fs = require("fs");'} var _missingExportShim, show, System, require, timing, lively, Namespace, localStorage;`;
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
      if (this.isResurrectionBuild) {
        code += await resource('https://raw.githubusercontent.com/systemjs/systemjs/0.21/dist/system.src.js').read();
      } else {
        code += await resource('https://raw.githubusercontent.com/systemjs/systemjs/6.12.1/dist/system.js').read();
      }
      // stub the globals
      code += `(${instrumentStaticSystemJS.toString()})(System);\n`;

      if (this.isResurrectionBuild) { // for the time being and where we are still tied to old SystemJS
        for (const id of this.excludedModules.concat(this.asBrowserModule ? ['fs', 'events'] : [])) {
          code += `System.set("${id}", System.newModule({ default: {} }));\n`;
        }
      } else {
        // generate a import map
        importMap = '<script type="systemjs-importmap">\n{\n"imports": {\n';
        importMap += this.excludedModules
          .concat(this.asBrowserModule ? ['fs', 'events'] : [])
          .map(id => `"${id}": "./@empty"`).join(',\n');
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
    const regeneratorSource = await resource('https://unpkg.com/regenerator-runtime@0.13.7/runtime.js').read();
    const polyfills = includePolyfills ? await resource(this.resolver.ensureFileFormat(await this.resolver.normalizeFileName('lively.freezer/deps/fetch.umd.js'))).read() : '';
    runtimeCode = `(${runtimeCode.slice(0, -1).replace('export ', '')})();\n`;
    if (!this.hasDynamicImports) {
      // If there are no dynamic imports, we compile without systemjs and
      // can stub it with our FreezerRuntime
      runtimeCode += SYSTEMJS_STUB;
    }
    runtimeCode += regeneratorSource;
    runtimeCode += polyfills;
    return es5Transpilation(runtimeCode);
  }

  getAssetsFromSnapshot ({ snapshot: snap }) {
    Object.entries(snap).map(([k, v]) => {
      if (!classNameOfId(snap, k) || !moduleOfId(snap, k).package) return;
      const klass = locateClass({
        className: classNameOfId(snap, k),
        module: moduleOfId(snap, k)
      });
      const toBeCopied = Object.entries(klass[Symbol.for('lively.classes-properties-and-settings')].properties)
        .map(([key, settings]) => settings.copyAssetOnFreeze && key)
        .filter(Boolean);
      for (const prop of toBeCopied) {
        if (!v.props[prop]) continue; // may be styled and not present in snapshot
        if (v.props[prop].value.startsWith('assets')) continue; // already copied
        const path = v.props[prop].value;
        if (path === '' || path.startsWith('data:')) continue; // data URL can not be copied
        const asset = resource(path);
        if (asset.host() !== resource(baseURL).host()) continue;
        asset._from = k;
        if (!this.assetsToCopy.find(res => res.url === asset.url)) { this.assetsToCopy.push(asset); }
        v.props[prop].value = 'assets/' + asset.name(); // this may be causing duplicates
      }
    });
  }

  async generateIndexHtml (importMap, modules) {
    return await generateLoadHtml(this.autoRun, importMap, this.resolver, modules);
  }

  // also emit the files that are the compressed versions of all the files
  // elso emit the assets as files as needed
  async generateBundle (plugin, bundle, depsCode, importMap, opts) {
    const modules = Object.values(bundle);
    const separator = '__Separator__';
    if (this.minify && opts.format !== 'esm') {
      modules.forEach((chunk, i) => {
        chunk.instrumentedCode = `"${separator}",${i};\n` + chunk.code;
      });
      const codeToMinify = modules.map(chunk => chunk.instrumentedCode).join('\n');
      const { min: minfiedCode } = await compileOnServer(codeToMinify, this.resolver, this.useTerser);
      let compiledSnippets = minfiedCode.split(/"__Separator__";\n?/);
      const adjustedSnippets = new Map(); // ensure order
      modules.forEach((snippet, i) => {
        adjustedSnippets.set(i, snippet.code); // populate with original source in case the transpiler kicked the chunk away
      });
      compiledSnippets.forEach((compiledSnippet) => {
        const hit = compiledSnippet.match(/^[0-9]+;\n?/);
        if (!hit) return; // fixme: google closure seems to add some weird polyfill stuff...
        const hint = Number(hit[0].replace(/;\n?/, ''));
        adjustedSnippets.set(hint, compiledSnippet.replace(/^[0-9]+;\n?/, ''));
      });
      compiledSnippets = [...adjustedSnippets.values()];
      for (const [snippet, compiled] of arr.zip(modules, compiledSnippets)) {
        snippet.code = compiled;
      } // override the code attribute
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

    if (this.includeLivelyAssets) {
      const morphicUrl = this.resolver.ensureFileFormat(this.resolver.decanonicalizeFileName('lively.morphic').replace('index.js', ''));
      const fontAwesomeDir = resource(config.css.fontAwesome).parent().parent();
      const cssFiles = await fontAwesomeDir.join('css').dirList();
      const webFonts = await fontAwesomeDir.join('webfonts').dirList();
      const inconsolata = await resource(config.css.inconsolata).parent().dirList();
      for (let file of cssFiles) {
        plugin.emitFile({
          type: 'asset',
          fileName: joinPath(fontAwesomeDir.url.replace(morphicUrl, ''), 'css', file.name()),
          source: await file.read()
        });
      }

      for (let file of webFonts) {
        let source = await file.read();
        if (source instanceof ArrayBuffer) source = new Uint8Array(source);
        plugin.emitFile({
          type: 'asset',
          fileName: joinPath('assets/fontawesome-free-5.12.1/webfonts/', file.name()),
          source
        });
      }

      for (let file of inconsolata) {
        let source = await file.read();
        if (source instanceof ArrayBuffer) source = new Uint8Array(source);
        plugin.emitFile({
          type: 'asset',
          fileName: joinPath('assets/inconsolata/', file.name()),
          source
        });
      }

      for (let file of this.assetsToCopy) {
        let source = await file.read();
        if (source instanceof ArrayBuffer) source = new Uint8Array(source);
        plugin.emitFile({
          type: 'asset',
          fileName: joinPath('assets', file.name()),
          source
        });
      }
    }

    // add the blank import file to make systemjs happy
    plugin.emitFile({
      type: 'asset',
      fileName: '@empty',
      source: ''
    });

    if (this.autoRun) {
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

  // this needs to be extracted into the index.js or also the concrete use case of the lively rollup plugin
  async finishBundle (bundle) {
    let depsCode, importMap, globals, build;
    ({ code: depsCode, globals, importMap } = await this.generateGlobals());
    let res;
    if (this.hasDynamicImports) {
      build = await bundle.generate({ format: 'system', globals });
      res = await this.handleSplittedBuild(build.output, depsCode);
      res.format = 'systemjs';
    } else {
      build = await bundle.generate({
        format: this.asBrowserModule ? 'iife' : 'cjs',
        globals
      });
      res = await this.transpileAndCompressOnServer({
        bundledCode: build.output[0].code,
        depsCode
      });
      res.format = 'global';
    }

    res.assets = this.assetsToCopy;
    res.rollup = this;
    res.importMap = importMap;

    this.resolver.finish();

    return res;
  }

  /**
   * Wrapper for server transpilation for splitted builds.
   * These are concatinated together and separated by markers such that the server transpilation can work on a single file.
   * @param { Object[] } modules - The set of compiled modules
   * @param { string } depsCode - The dependency source code.
   */
  async handleSplittedBuild (modules, depsCode) {
    // it seems like rollup sometimes returns duplicates which are optimized away by closure
    // causing issues when reassigned the minified pieces
    const loadCode = `
        window.frozenPart = {
          renderFrozenPart: (domNode, baseURL) => {
            if (baseURL) System.config( { baseURL });
            if (!baseURL) baseURL = './';
            System.config({
              meta: {
               ${
                modules.map(snippet =>
                  `[baseURL + '${snippet.fileName}']: {format: "system"}`
                ).join(',\n') // makes sure that compressed modules are still recognized as such
                }
              }
            });
            System.import("./${ROOT_ID}").then(m => { System.trace = false; m.renderFrozenPart(domNode); });
          }
        }
      `;
      // concat all snippets and compile them on server
      // insert hint strings
    modules.forEach((snippet, i) => {
      snippet.instrumentedCode = snippet.code.replace('System.register(', `System.register("${i}",`);
    });

    const { min } = await this.transpileAndCompressOnServer({
      depsCode,
      bundledCode: [loadCode, ...modules.map(snippet => snippet.instrumentedCode)].join('"__Separator__";')
    });

    let [compiledLoad, ...compiledSnippets] = min.split(this.useTerser ? /\,System.register\(/ : /"__Separator__";\n?System.register\(/);

    // ensure that all compiled snippets are present
    // clear the hints
    const adjustedSnippets = new Map(); // ensure order
    modules.forEach((snippet, i) => {
      adjustedSnippets.set(i, snippet.code);
    });
    compiledSnippets.forEach((compiledSnippet) => {
      const hint = Number(compiledSnippet.match(/\"[0-9]+\"/)[0].slice(1, -1));
      adjustedSnippets.set(hint, compiledSnippet.replace(/\"[0-9]+\"\,/, 'System.register('));
    });
    compiledSnippets = [...adjustedSnippets.values()];

    modules.load = { min: compiledLoad };
    for (const [snippet, compiled] of arr.zip(modules, compiledSnippets)) { snippet.min = compiled; }
    return modules;
  }

  async transpileAndCompressOnServer ({
    depsCode = '',
    bundledCode,
    fileName = '',
    optimize = true
  }) {
    this.resolver.setStatus({ title: 'Freezing Part', status: 'Optimizing...' });
    const code = depsCode + bundledCode;

    // write file
    if (!optimize) { return { code, min: code }; }
    const res = await compileOnServer(code, this.resolver, fileName, this.useTerser); // seems to be faster for now
    return res;
  }
}
