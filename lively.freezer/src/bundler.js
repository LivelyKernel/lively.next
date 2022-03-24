import { resource } from 'lively.resources';
import * as ast from 'lively.ast';
import * as classes from 'lively.classes';
import { arr, string, Path, fun, obj } from 'lively.lang';
import { module } from 'lively.modules/index.js';
import { localInterface } from 'lively-system-interface';
import { rewriteToCaptureTopLevelVariables, insertCapturesForExportedImports } from 'lively.source-transform/capturing.js';
import { es5Transpilation } from 'lively.source-transform';
import { classNameOfId, moduleOfId } from 'lively.serializer2/snapshot-navigation.js';
import { locateClass, requiredModulesOfSnapshot, serialize } from 'lively.serializer2';
import { LoadingIndicator } from 'lively.components';
import * as Rollup from 'esm://cache/rollup@2.28.2';
import jsonPlugin from 'esm://cache/@rollup/plugin-json';
import { fixSourceForBugsInGoogleClosure, translateToEsm, compileOnServer } from './util/helpers.js';
// fixme: requires newer Babel version to import latest version...

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

const ESM_CDNS = ['jspm.dev', 'jspm.io', 'skypack.dev'];

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

export class LivelyRollup {
  constructor (props = {}) {
    this.setup(props);
  }

  setup ({
    excludedModules = [],
    snapshot,
    rootModule,
    globalName,
    asBrowserModule = true,
    useTerser = true,
    redirect = {
      fs: modules.module('lively.freezer/node-fs-wrapper.js').id,
      'https://dev.jspm.io/npm:ltgt@2.1.3/index.dew.js': 'https://dev.jspm.io/npm:ltgt@2.2.1/index.dew.js' // this is always needed
    },
    includePolyfills = true
  }) {
    this.useTerser = useTerser; // needed because google closure sometimes does crazy stuff during optimization
    this.includePolyfills = includePolyfills; // wether or not to include the pointer event polyfill
    this.snapshot = snapshot; // the snapshot to be used as a base for developing a bundled app
    this.rootModule = rootModule; // alternatively to the snapshot, we can also use a root module as an entry point
    this.globalName = globalName; // The global variable name to export the root module export via.
    this.asBrowserModule = asBrowserModule; // Wether or not to export this module as a browser loadable one. This will stub some nodejs packages like fs.
    this.redirect = redirect; //  Hard redirect of certain packages that overriddes any other resolution mechanisms. Why is this needed?
    this.excludedModules = excludedModules; // Set of package names whose modules to exclude from the bundle.

    this.globalMap = {}; // accumulates the package -> url mappings that are provided by each of the packages
    this.dynamicParts = {}; // parts loaded via loadPart/loadObjectsFromPartsbinFolder/resource("part://....") // deprecated
    this.dynamicModules = new Set(); // modules loaded via System.import(...)
    this.modulesWithDynamicLoads = new Set(); // collection of all modules that include System.import()
    this.hasDynamicImports = false; // Internal flag that indicates wether or not we need to perform code splitting or not.
    this.globalModules = {}; // Collection of global modules, which are not imported via ESM. Can be ditched?
    this.importedModules = []; // Collection of all the required modules from the passed snapshot. This is not popuplated if we utilize rootModule.
    this.resolved = {};
    this.assetsToCopy = [];
    this.requiredMasterComponents = new Set(); // populated after the snapshot and modules with dynamic loads have been fully analyzed. No longer needed with component modules.
  }

  /**
   * More or less unnessecary convenience method that extracts the required modules from a given snapshot.
   * (Alongside the required assets)
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
    if (!path.startsWith('.')) return System.normalize(path);
    return resource(await System.normalize(moduleId)).join('..').join(path).withRelativePartsResolved().url;
  }

  /**
   * Clear the id of a module from any host specific information.
   * @param { string } id - The id of the module.
   */
  normalizedId (id) {
    return id.replace(System.baseURL, '').replace('local://lively-object-modules/', '');
  }

  /**
   * Given a module, determine the options we need to pass to the class transform
   * such that it transforms the custom class definitions in our modules
   * in a way that makes sense in a frozen build.
   * @param { Module } mod - The module object to transform the class definitions for.
   */
  getTransformOptions (mod) {
    if (mod.id === '@empty') return {};
    let version, name;
    const pkg = mod.package();
    if (pkg) {
      name = pkg.name;
      version = pkg.version;
    } else {
      // assuming the module if from jspm
      version = mod.id.split('@')[1];
      name = mod.id.split('npm:')[1].split('@')[0];
    }
    const classToFunction = {
      classHolder: ast.parse(`(lively.FreezerRuntime.recorderFor("${this.normalizedId(mod.id)}"))`),
      functionNode: { type: 'Identifier', name: 'initializeES6ClassForLively' },
      transform: classes.classToFunctionTransform,
      currentModuleAccessor: ast.parse(`({
        pathInPackage: () => {
           return "${mod.pathInPackage()}"
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
        ...mod.dontTransform,
        ...arr.range(0, 50).map(i => `__captured${i}__`)],
      classToFunction
    };
  }

  /**
   * Throws an error if a excluded package (as per config) is directly imported
   * by the root module. This heuristic is somewhat sketchy, but it sometimes works
   * for the benefit of the doubt.
   */
  checkIfImportedPackageExcluded () {
    const excludedPackages = arr.compact(this.excludedModules.map(id => module(id).package()));
    const importedPackages = this.importedModules.map(id => module(id).package());
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
    if (this.rootModule) {
      if ((await this.rootModule.exports()).length > 0) {
        return `export * from "${this.rootModule.id}";`;
      }
      return await this.rootModule.source();
    }
    return await this.synthesizeSnapshotModule();
  }

  /**
   * Returns the source code of a synthesized module that imports all modules that
   * are required to successfully deserialize the snapshot that for the frozen part.
   */
  async synthesizeSnapshotModule () {
    const snapshotModuleSource = await module('lively.freezer/src/util/snapshot-module.js').source();
    const { requiredModules } = await this.getRequiredModulesFromSnapshot(this.snapshot);

    this.importedModules = requiredModules;
    this.checkIfImportedPackageExcluded();
    return arr.uniq((await this.getRequiredModulesFromSnapshot(this.snapshot)).requiredModules.map(path => `import "${path}"`)).join('\n') +
      (this.excludedModules.includes('localconfig.js') ? '' : await resource(System.baseURL).join('localconfig.js').read()) +
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
  needsScopeToBeCaptured (moduleId, importModuleId) {
    if (this.isResurrectionBuild) return !this.wasFetchedFromEsmCdn(moduleId);
    return this.isComponentModule(moduleId) || this.isComponentModule(importModuleId); // fixme: Dont we actually need the convex hull of the imports of the component modules?
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
    if (moduleSource && moduleSource.match(/extends\ (Morph|Image|Ellipse|HTMLMorph|Path|Polygon|Text|InteractiveMorph|ViewModel)/)) return true;
    if (CLASS_INSTRUMENTATION_MODULES_EXCLUSION.some(pkgName => moduleId.includes(pkgName))) { return false; }
    if (CLASS_INSTRUMENTATION_MODULES.some(pkgName => moduleId.includes(pkgName) || pkgName === moduleId) || this.isComponentModule(moduleId)) {
      return true;
    }
  }

  /**
   * Returns wether or not the given module id belongs to a component module.
   * @param { string } moduleId - The module id.
   */
  isComponentModule (moduleId) {
    return moduleId.endsWith('.cp.js');
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
        if (node.callee.property.name === 'import' && node.callee.object.name === 'System') {
          // evaluate the imported expression on the spot
          const idx = importUrls.push(localInterface.runEval(ast.stringify(node.arguments[0]), {
            targetModule: moduleId
          }));
          nodesToReplace.push({
            target: node.arguments[0],
            replacementFunc: () => {
              // if the result has not been computed, log an error
              if (importUrls[idx - 1]) { return `"${importUrls[idx - 1]}"`; }
            }
          });
          nodesToReplace.push({
            target: node.callee, replacementFunc: () => 'import'
          });
        }
      }
    });

    importUrls = (await Promise.all(importUrls)).map(res => res.value); // fixme: detect if there was an error

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
    if (id === '__root_module__' || id.endsWith('.json')) {
      return source;
    }

    if (this.needsDynamicLoadTransform(source)) {
      source = await this.instrumentDynamicLoads(source, id);
    }
    // this capturing stuff needs to behave differently when we have dynamic imports. Why??
    if (this.needsScopeToBeCaptured(id) || this.needsClassInstrumentation(id, source)) {
      source = this.captureScope(source, id);
    }

    return source;
  }

  async resolveId (id, importer) {
    if (id === 'fs') return 'fs';
    if (this.resolved[id]) return this.resolved[id];
    if (id === '__root_module__') return id;
    if (id.startsWith('[PART_MODULE]')) return id;
    if (!importer) return id;
    const isCdnImport = ESM_CDNS.find(cdn => id.includes(cdn) || importer.includes(cdn));
    if (importer && importer !== '__root_module__' && isCdnImport) {
      const { url } = resource(importer).root();
      if (ESM_CDNS.find(cdn => url.includes(cdn))) {
        if (id.startsWith('.')) {
          id = resource(importer).parent().join(id).withRelativePartsResolved().url;
        } else {
          id = resource(url).join(id).withRelativePartsResolved().url;
        }
        if (this.redirect[id]) {
          id = this.redirect[id];
        }
      }
    }
    const importingPackage = module(importer).package();
    if (['lively.ast', 'lively.modules'].includes(id) && this.excludedModules.includes(id)) {
      return id;
    }

    // if we are imported from a non dynamic context this does not apply
    const dynamicContext = this.dynamicModules.has(module(importer).id) || this.dynamicModules.has(module(id).id);
    if (!dynamicContext) {
      if (importingPackage && this.excludedModules.includes(importingPackage.name)) return false;
      if (this.excludedModules.includes(id)) return false;
    } else {
      this.dynamicModules.add(module(id).id);
    }

    if (importingPackage && importingPackage.map) this.globalMap = { ...this.globalMap, ...importingPackage.map };
    if (importingPackage && importingPackage.map[id] || this.globalMap[id]) {
      if (!importingPackage.map[id] && this.globalMap[id]) {
        console.warn(`[freezer] No mapping for "${id}" provided by package "${importingPackage.name}". Guessing "${this.globalMap[id]}" based on past resolutions. Please consider adding a map entry to this package config in oder to make the package definition sound and work independently of the current setup!`);
      }
      id = importingPackage.map[id] || this.globalMap[id];
      if (id['~node']) id = id['~node'];
      importer = importingPackage.url;
    }
    if (id.startsWith('.')) {
      id = await this.resolveRelativeImport(importer, id);
      if (!dynamicContext && this.excludedModules.includes(id)) return false;
    }
    if (!id.endsWith('.js') && !isCdnImport) {
      const normalizedId = await System.normalize(id);
      return this.resolved[id] = normalizedId;
    }
    return this.resolved[id] = module(id).id; // this does not seem to work for non .js modules
  }

  async load (id) {
    id = this.redirect[id] || id;
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

    if (id === '__root_module__') {
      const res = await this.getRootModule();
      return res;
    }
    if (id === 'fs') {
      return 'const fs = require("fs"); export default fs;';
    }
    const mod = module(id);
    const pkg = mod.package();
    if (pkg && this.excludedModules.includes(pkg.name) &&
        !mod.id.endsWith('.json') &&
        !this.dynamicModules.has(pkg.name) &&
        !this.dynamicModules.has(mod.id)) {
      return '';
    }
    if (id.endsWith('.json')) {
      // return await resource(mod.id).read();
      return translateToEsm(mod._source || await mod.source());
    }
    let s = await mod.source();

    s = fixSourceForBugsInGoogleClosure(id, s);

    return s;
  }

  warn (warning, warn) {
    switch (warning.code) {
      case 'THIS_IS_UNDEFINED':
      case 'EVAL':
      case 'MODULE_LEVEL_DIRECTIVE':
        return;
    }
    warn(warning);
  }

  captureScope (source, id) {
    let classRuntimeImport = '';
    const recorderString = `const __varRecorder__ = lively.FreezerRuntime.recorderFor("${this.normalizedId(id)}");\n`;
    const tfm = fun.compose(rewriteToCaptureTopLevelVariables, ast.transform.objectSpreadTransform);
    const captureObj = { name: '__varRecorder__', type: 'Identifier' };
    // id = 'lively.vm/index.js'
    const mod = module(id);
    // source = mod._source
    const parsed = ast.parse(source);
    // opts = {}

    const opts = this.getTransformOptions(mod);
    if (this.needsClassInstrumentation(id)) { classRuntimeImport = 'import { initializeClass as initializeES6ClassForLively } from "lively.classes/runtime.js";\n'; } else { opts.classToFunction = false; }
    const instrumented = insertCapturesForExportedImports(tfm(parsed, captureObj, opts), { captureObj });
    const imports = [];
    let defaultExport = '';
    const toBeReplaced = [];

    ast.custom.forEachNode(instrumented, (n) => {
      if (n.type === 'ImportDeclaration') arr.pushIfNotIncluded(imports, n);
      if (n.type === 'Literal' && typeof n.value === 'string' && n.value.match(/^styleguide:\/\/.+\/.+/)) {
        if (!this.requiredMasterComponents.has(n.value)) console.log('DID NOT CAPTURE', n.value);
        this.requiredMasterComponents.add(n.value);
      }
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

    return recorderString + classRuntimeImport + ast.stringify(instrumented) + defaultExport;
  }

  deriveVarName (moduleId) { return string.camelize(arr.last(moduleId.split('/')).replace(/\.js|\.min/g, '').split('.').join('')); }

  async wrapStandalone (moduleId) {
    const mod = module(moduleId);
    if (!mod._source) await mod.source();
    const globalVarName = this.deriveVarName(moduleId);
    let code;
    if (mod.format() === 'global') {
      code = `var ${globalVarName} = (function() {
         var fetchGlobals = prepareGlobal("${mod.id}");
         ${mod._source};
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
                ${mod._source} 
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

  async generateGlobals (systemJsEnabled) {
    let code = '';
    const globals = {};

    if (!systemJsEnabled) {
      code += `${this.asBrowserModule ? 'var fs = {};' : 'var fs = require("fs");'} var _missingExportShim, show, System, require, timing, lively, Namespace, localStorage;`;
    }

    // this is no longer an issue due to removal of all non ESM modules from our system. Can be removed?
    for (const modId in this.globalModules) {
      const { code: newCode, global: newGlobal } = await this.wrapStandalone(modId);
      code += newCode;
      globals[modId] = newGlobal;
    }

    if (systemJsEnabled) {
      // we can use the stripped down https://raw.githubusercontent.com/systemjs/systemjs/master/dist/s.js
      // however that does not allow us to transition to the dynamic lively.modules system
      code += await resource('https://raw.githubusercontent.com/systemjs/systemjs/0.21/dist/system.src.js').read();
      // code += await resource(System.decanonicalize('systemjs/dist/system.js')).read();
      // code += await resource('https://raw.githubusercontent.com/systemjs/systemjs/master/dist/s.js').read();
      // code += await resource('https://raw.githubusercontent.com/systemjs/systemjs/master/dist/extras/named-register.js').read();
      // stub the globals
      code += `
         const _origGet = System.get.bind(System);
         System.get = (id, recorder = true) => (lively.FreezerRuntime && lively.FreezerRuntime.get(id, recorder)) || _origGet(id);
      `;
      // if (this.asBrowserModule) code += 'System.global = window;\n'
      code += `
         const _origDecanonicalize = System.decanonicalize.bind(System);
         System.decanonicalize = (id) =>
            lively.FreezerRuntime ? lively.FreezerRuntime.decanonicalize(id) : _origDecanonicalize(id);
      `;
      code += 'window._missingExportShim = () => {};\n';
      code += `
         const _originalRegister = System.register.bind(System);
         System.register = (name, deps, def) => {
           if (typeof name !== 'string') {
             def = deps;
             deps = name;
             return _originalRegister(deps, (exports, module) => {
               let res = def(exports, module);
               if (!res.setters) res.setters = [];
               return res;
             });
           }
           return _originalRegister(name, deps, (exports, module) => {
             let res = def(exports, module);
             if (!res.setters) res.setters = [];
             return res;
           })
        };
      `;
      // map fs as global
      code += `System.set('stub-transpiler', System.newModule({
        translate: (load) => {
           return load.source;
        }
      }));\n`;
      code += `System.config({
        transpiler: 'stub-transpiler'
      });\n`;
      code += 'System.trace = false;\n';
      for (const id of this.excludedModules.concat(this.asBrowserModule ? ['fs', 'events'] : [])) {
        // code += `"${id}": "@empty",`
        code += `System.set("${id}", System.newModule({ default: {} }));\n`;
        // code += `System.register("${id}", [], (exports) => ({ execute: () => { console.log('loaded ${id}'); exports({ default: {} }) }, setters: []}));\n`;
      }
    } else {
      for (const id of this.excludedModules) {
        const varName = globals[id] = this.deriveVarName(id);
        code += `var ${varName} = {};\n`;
      }
    }

    return {
      code, globals
    };
  }

  async getRuntimeCode () {
    let runtimeCode = await module('lively.freezer/src/util/runtime.js').source();
    runtimeCode = `(${runtimeCode.slice(0, -1).replace('export ', '')})();\n`;
    if (!this.hasDynamicImports) {
      // If there are no dynamic imports, we compile without systemjs and
      // can stub it with our FreezerRuntime
      runtimeCode += `
var G = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
if (!G.System) G.System = G.lively.FreezerRuntime;`;
    }
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
        if (asset.host() !== resource(System.baseURL).host()) continue;
        asset._from = k;
        if (!this.assetsToCopy.find(res => res.url === asset.url)) { this.assetsToCopy.push(asset); }
        v.props[prop].value = 'assets/' + asset.name(); // this may be causing duplicates
      }
    });
    console.log('[ASSETS]', this.assetsToCopy);
  }

  async rollup (compressBundle, output) {
    const li = LoadingIndicator.open('Freezing Part', { status: 'Bundling...' });
    let depsCode, bundledCode, splitModule;

    if (this.snapshot) this.getAssetsFromSnapshot(this.snapshot);

    await li.whenRendered();
    try {
      const bundle = await Rollup.rollup({
        input: this.rootModule ? this.rootModule.id : '__root_module__',
        shimMissingExports: true,
        onwarn: (warning, warn) => { return this.warn(warning, warn); },
        plugins: [{
          resolveId: async (id, importer) => {
            const res = await this.resolveId(id, importer);
            return res;
          },
          resolveDynamicImport: (id, importer) => {
            // schedule a request to initiate a nested rollup that bundles
            // the dynamically loaded bundles separately
            this.dynamicModules.add(module(id).id);
            const res = this.resolveId(id, importer); // dynamic imports are never excluded
            if (res && obj.isString(res)) {
              return {
                external: false,
                id: res
              };
            }
            return res;
          },
          load: async (id) => {
            const src = await this.load(id);
            return src;
          },
          transform: async (source, id) => { return await this.transform(source, id); }
        }, jsonPlugin()]
      });
      let globals;
      ({ code: depsCode, globals } = await this.generateGlobals(this.hasDynamicImports));
      if (this.hasDynamicImports) {
        splitModule = (await bundle.generate({ format: 'system', globals }));
      } else { bundledCode = (await bundle.generate({ format: this.asBrowserModule ? 'iife' : 'cjs', globals, name: this.globalName || 'frozenPart' })).output[0].code; }
    } finally {
      li.remove();
    }

    let res;
    if (splitModule) {
      res = splitModule.output;
      // it seems like rollup sometimes returns duplicates which are optimized away by closure
      // causing issues when reassigned the minified pieces
      // res = arr.uniqBy(res, (snipped1, snipped2) => snipped1.code === snipped2.code);
      const loadCode = `
        
        window.frozenPart = {
          renderFrozenPart: (domNode, baseURL) => {
            if (baseURL) System.config( { baseURL });
            if (!baseURL) baseURL = './';
            System.config({
              meta: {
               ${
                res.map(snippet => `[baseURL + '${snippet.fileName}']: {format: "system"}`).join(',\n') // makes sure that compressed modules are still recognized as such
                }
              }
            });
            System.import("__root_module__.js").then(m => { System.trace = false; m.renderFrozenPart(domNode); });
          }
        }
      `;
      // concat all snippets and compile them on server
      // insert hint strings
      res.forEach((snippet, i) => {
        snippet.instrumentedCode = snippet.code.replace('System.register(', `System.register("${i}",`);
      });

      const { min } = await this.transpileAndCompressOnServer({
        depsCode,
        bundledCode: [loadCode, ...res.map(snippet => snippet.instrumentedCode)].join('\n'),
        output,
        compressBundle: false
      });

      // let [compiledLoad, ...compiledSnippets] = [depsCode + loadCode, ...res.map(snippet => snippet.instrumentedCode)]
      let [compiledLoad, ...compiledSnippets] = min.split(this.useTerser ? /\,System.register\(/ : /\nSystem.register\(/);

      // ensure that all compiled snippets are present
      // clear the hints
      const adjustedSnippets = new Map(); // ensure order
      res.forEach((snippet, i) => {
        adjustedSnippets.set(i, snippet.code);
      });
      compiledSnippets.forEach((compiledSnippet) => {
        const hint = Number(compiledSnippet.match(/\"[0-9]+\"/)[0].slice(1, -1));
        adjustedSnippets.set(hint, compiledSnippet.replace(/\"[0-9]+\"\,/, 'System.register('));
      });
      compiledSnippets = [...adjustedSnippets.values()];

      res.load = { min: compiledLoad };
      for (const [snippet, compiled] of arr.zip(res, compiledSnippets)) { snippet.min = compiled; }
    } else {
      res = await this.transpileAndCompressOnServer({
        depsCode, bundledCode: bundledCode, output, compressBundle
      });
    }

    res.format = !this.hasDynamicImports ? 'global' : 'systemjs';
    for (const part in this.dynamicParts) {
      this.getAssetsFromSnapshot(this.dynamicParts[part]);
    }
    // extract the master components
    res.masterComponents = {};
    for (const comp of this.requiredMasterComponents) {
      const snap = serialize(await resource(comp).read());
      this.getAssetsFromSnapshot(snap);
      res.masterComponents[comp] = snap;
    }
    res.dynamicParts = this.dynamicParts;
    res.assets = this.assetsToCopy;
    // res.masterComponents = this.requiredMasterComponents];

    res.rollup = this;

    return res;
  }

  async transpileAndCompressOnServer ({
    depsCode = '',
    bundledCode,
    output,
    fileName = '',
    compressBundle,
    addRuntime = true,
    optimize = true,
    includePolyfills = this.includePolyfills && this.asBrowserModule
  }) {
    const li = LoadingIndicator.open('Freezing Part', { status: 'Optimizing...' });
    const runtimeCode = addRuntime ? await this.getRuntimeCode() : '';
    const regeneratorSource = addRuntime ? await resource('https://unpkg.com/regenerator-runtime@0.13.7/runtime.js').read() : '';
    let polyfills = '';
    polyfills += !includePolyfills ? '' : await module('lively.freezer/deps/fetch.umd.js').source();

    const code = runtimeCode + polyfills + regeneratorSource + depsCode + bundledCode;

    // write file
    if (!optimize) { li.remove(); return { code, min: code }; }
    const res = await compileOnServer(code, li, fileName, this.useTerser); // seems to be faster for now
    // res = await compileViaGoogle(code, li, fileName);

    li.remove();
    return res;
  }
}
