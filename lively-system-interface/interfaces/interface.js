import { parseJsonLikeObj } from '../helpers.js';
import { obj, Path } from 'lively.lang';

import { transform } from 'lively.ast';
import * as modules from 'lively.modules';

function todo (methodName) {
  throw new Error(`${methodName} is not yet implemented!`);
}

export class AbstractCoreInterface {
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // lively.vm
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async dynamicCompletionsForPrefix (moduleName, prefix, options) { todo('dynamicCompletionsForPrefix'); }
  runEval (source, options) { todo('runEval'); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // resources
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  resourceExists (url) { todo('resourceExists'); }
  resourceEnsureExistance (url, optContent) { todo('resourceEnsureExistance'); }
  resourceMkdir (url) { todo('resourceMkdir'); }
  resourceRead (url) { todo('resourceRead'); }
  resourceRemove (url) { todo('resourceRemove'); }
  resourceWrite (url, source) { todo('resourceWrite'); }
  resourceCreateFiles (baseDir, spec) { todo('resourceCreateFiles'); }
  resourceDirList (baseDir, depth, opts) { todo('resourceDirList'); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // system related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  normalizeSync (name, parentName, isPlugin) { todo('normalizeSync'); }
  normalize (name, parent, parentAddress) { todo('normalize'); }
  printSystemConfig () { todo('printSystemConfig'); }
  getConfig () { todo('getConfig'); }
  setConfig (conf) { todo('setConfig'); }
  getPackages (options) { todo('getPackages'); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  isModuleLoaded (name, isNormalized) { todo('isModuleLoaded'); }
  doesModuleExist (name, isNormalized) { todo('doesModuleExist'); }

  async getModules () {
    return (await this.getPackages()).flatMap(ea => ea.modules);
  }

  async getModule (name) {
    return (await this.getModules()).find(ea => ea.name === name);
  }

  async getPackage (name) {
    name = name.replace(/\/+$/, '');
    return (await this.getPackages()).find(ea => ea.address === name || ea.name === name);
  }

  async getPackageForModule (name) { todo('getPackageForModule'); }

  systemConfChange (source) {
    let jso = parseJsonLikeObj(source);
    let exceptions = ['baseURL'];
    exceptions.forEach(ea => delete jso[ea]);
    // Object.keys(jso).forEach(k => modules.System[k] = jso[k]);
    return this.setConfig(jso);
  }

  async resourcesOfPackage (packageOrAddress, exclude) { todo('resourcesOfPackage'); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // package related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async registerPackage (packageURL) { todo('registerPackage'); }
  async importPackage (packageURL) { todo('importPackage'); }
  async removePackage (packageURL) { todo('removePackage'); }
  async reloadPackage (packageURL) { todo('reloadPackage'); }
  async packageConfChange (source, confFile) { todo('packageConfChange'); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  importModule (name) { todo('importModule'); }
  forgetModule (name, opts) { todo('forgetModule'); }
  reloadModule (name, opts) { todo('reloadModule'); }
  moduleFormat (moduleName) { todo('moduleFormat'); }
  moduleRead (moduleName) { todo('moduleRead'); }
  moduleSourceChange (moduleName, newSource, options) { todo('moduleSourceChange'); }
  importsAndExportsOf (modId, sourceOrAst) { todo('importsAndExportsOf'); }
  keyValueListOfVariablesInModule (moduleName, sourceOrAst) { todo('keyValueListOfVariablesInModule'); }

  moduleWrite (moduleName, newSource) {
    return this.moduleSourceChange(moduleName, newSource);
  }

  async getLoadedModules (ignoredPackages) {
    const pkgs = await this.getPackages();
    let items = [];

    for (const p of pkgs) {
      let excluded = Path('lively.ide.exclude').get(p) || [];
      excluded = excluded.map(ea => ea.includes('*') ? new RegExp(ea.replace(/\*/g, '.*')) : ea);
      for (const m of p.modules) {
        if (excluded.some(ex => ex instanceof RegExp ? ex.test(m.name) : m.name.includes(ex))) continue;
        items.push({ package: p, module: m });
      }
    }

    return items;
  }

  async getResourcesOfLoadedPackages (ignoredPackages) {
    const pkgs = await this.getPackages({ excluded: ignoredPackages });
    const items = [];

    for (const p of pkgs) {
      const excluded = (Path('lively.ide.exclude').get(p) || []).map(ea =>
        ea.includes('*') ? new RegExp(ea.replace(/\*/g, '.*')) : ea);
      excluded.push('.git', 'node_modules', '.module_cache');
      items.push(...(await this.resourcesOfPackage(p, excluded))
        .filter(({ url }) => !url.endsWith('/') && !excluded.some(ex => ex instanceof RegExp ? ex.test(url) : url.includes(ex)))
        .sort((a, b) => {
          if (a.isLoaded && !b.isLoaded) return -1;
          if (!a.isLoaded && b.isLoaded) return 1;
          if (a.nameInPackage.toLowerCase() < b.nameInPackage.toLowerCase()) return -1;
          if (a.nameInPackage.toLowerCase() === b.nameInPackage.toLowerCase()) return 0;
          return 1;
        })
        .map(resource => {
          return { package: p, resource };
        }));
    }

    return items;
  }
}

export class RemoteCoreInterface extends AbstractCoreInterface {
  constructor () {
    super();
    this.currentEval = null;
  }

  runEval (source, options) {
    throw new Error('Not yet implemented');
  }

  runEvalAndStringify (source, opts) {
    if (this.currentEval) { return this.currentEval.then(() => this.runEvalAndStringify(source, opts)); }

    return this.currentEval = Promise.resolve().then(async () => {
      let result = await this.runEval(`
        Promise.resolve((async ${transform.wrapInFunction(source)})())
          .then(function(result) { return JSON.stringify(result); })
          .catch(function(err) { return {isError: true, value: err}; })
          .then(function(result) {
            if (!result || typeof result === "string") return result;
            return JSON.stringify(result.isError ?
              {isError: true, value: (result.value + "\\n" + result.value.stack) || String(result.value)} :
              result)
          });`,
      {
        targetModule: 'lively://remote-lively-system/runEvalAndStringify',
        promiseTimeout: 30 * 1000,
        waitForPromise: true,
        ...opts
      });

      if (result && result.isError) { throw new Error(String(result.value || result.error)); }

      if (!result || !result.value) return null;

      let val = result.promisedValue || await result.value;

      if (!val) return;

      if (val === 'undefined') return undefined;
      if (val === 'null') return null;
      if (val === 'true') return true;
      if (val === 'false') return false;

      let parsedResult;
      try { parsedResult = JSON.parse(val); } catch (e) { return val; }

      if (parsedResult && parsedResult.isError) { throw new Error(String(parsedResult.value)); }

      return parsedResult;
    }).then(
      result => { delete this.currentEval; return result; },
      err => { delete this.currentEval; return Promise.reject(err); });
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // lively.vm
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async dynamicCompletionsForPrefix (moduleName, prefix, options) {
    const contextFetch = obj.isString(options.context) ? options.context : false;
    options = obj.dissoc(options, ['systemInterface', 'System', 'context']);
    let src = `
      var prefix = ${JSON.stringify(prefix)},
          opts = ${JSON.stringify(options)};
      opts.context = ${contextFetch};
      opts.classTransform = (await System.import("lively.classes")).classToFunctionTransform;
      var { runEval, completions } = await System.import("lively.vm");
      var evalFn = code => runEval(code, opts);
      if (typeof System === "undefined") delete opts.targetModule;
      completions.getCompletions(evalFn, prefix).then(function(result) {
        if (result.isError) throw result.value;
        return {
          completions: result.completions,
          prefix: result.startLetters
        }
      });`;
    return this.runEvalAndStringify(src);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // resources
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  evalWithResource (url, method, arg) {
    return this.runEvalAndStringify(`
      var {resource} = (typeof lively !== "undefined" && lively.resources)
                    || await System.import("lively.resources");
      await resource("${url}").${method}(${arg ? JSON.stringify(arg) : ''});
    `);
  }

  resourceExists (url) { return this.evalWithResource(url, 'exists'); }
  resourceEnsureExistance (url, optContent) {
    return this.evalWithResource(url, 'ensureExistance', optContent);
  }

  resourceMkdir (url) { return this.evalWithResource(url, 'mkdir'); }
  resourceRead (url) { return this.evalWithResource(url, 'read'); }
  resourceRemove (url) { return this.evalWithResource(url, 'remove'); }
  resourceWrite (url, source) { return this.evalWithResource(url, 'write', source); }
  resourceCreateFiles (baseDir, spec) {
    return this.runEvalAndStringify(`var {createFiles} = await System.import("lively.resources"); await createFiles("${baseDir}", ${JSON.stringify(spec)})`);
  }

  resourceDirList (url, depth, opts) {
    return this.runEvalAndStringify(`
      var {resource} = await System.import("lively.resources");
      (await resource("${url}").dirList(${JSON.stringify(depth)}, ${JSON.stringify(opts)}))
        .map(({url}) => ({url}))`);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // system related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  livelySystemAccessor (varName = 'livelySystem') {
    return `${this.livelyModulesAccessor()};
      var ${varName} = (typeof lively !== "undefined" && lively.systemInterface)
      || System.get(System.decanonicalize("lively-system-interface"))
      || (await modules.importPackage("lively-system-interface"));
    if (!${varName}) throw new Error("lively-system-interface not available!");`;
  }

  livelyModulesAccessor (varName = 'modules') {
    return `${varName} = System.get(System.decanonicalize("lively.modules"))`;
  }

  normalizeSync (name, parentName, isPlugin) {
    return this.runEvalAndStringify(`${this.livelyModulesAccessor()}, modules.System.decanonicalize(${JSON.stringify(name)}, ${JSON.stringify(parentName)}, ${isPlugin})`);
  }

  normalize (name, parent, parentAddress) {
    return this.runEvalAndStringify(`${this.livelyModulesAccessor()}, modules.System.normalize(${JSON.stringify(name)}, ${JSON.stringify(parent)}, ${JSON.stringify(parentAddress)})`);
  }

  printSystemConfig () {
    return this.runEvalAndStringify(`${this.livelyModulesAccessor()}, modules.printSystemConfig()`);
  }

  getConfig () {
    return this.runEvalAndStringify(`${this.livelyModulesAccessor()}; var c = Object.assign({}, modules.System.getConfig()); for (var name in c) if (name.indexOf("__lively.modules__") === 0 || name.indexOf("loads") === 0) delete c[name]; c`);
  }

  setConfig (conf) {
    return this.runEvalAndStringify(`${this.livelyModulesAccessor()}, modules.System.config(${JSON.stringify(conf)})`);
  }

  getPackages (options) {
    options = { excluded: [], ...options };
    options.excluded = options.excluded.map(String);
    return this.runEvalAndStringify(`
      ${this.livelySystemAccessor()};
      var options = ${JSON.stringify(options)};
      var { syncEval } = await System.import('lively.vm');
      options.excluded = options.excluded.map(ea => {
        let evaled = syncEval(ea).value;
        return typeof evaled === "function" ? evaled : ea;
      });
      await livelySystem.localInterface.getPackages(options)
        .map(ea => Object.assign({}, ea, {System: null}));`);
  }

  getPackageForModule (moduleId) {
    return this.runEvalAndStringify(`
      ${this.livelySystemAccessor()};
      await livelySystem.localInterface.getPackageForModule(${JSON.stringify(moduleId)})`);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // package related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  isModuleLoaded (name, isNormalized) {
    return this.runEvalAndStringify(`${this.livelyModulesAccessor()}, modules.isModuleLoaded("${name}", ${isNormalized})`);
  }

  doesModuleExist (name, isNormalized) {
    return this.runEvalAndStringify(`${this.livelyModulesAccessor()}, modules.doesModuleExist("${name}", ${isNormalized})`);
  }

  async registerPackage (packageURL) {
    return this.runEvalAndStringify(`${this.livelyModulesAccessor()}, modules.registerPackage(${JSON.stringify(packageURL)})`);
  }

  async importPackage (packageURL) {
    return this.runEvalAndStringify(`${this.livelyModulesAccessor()}, modules.importPackage(${JSON.stringify(packageURL)})`);
  }

  async removePackage (packageURL) {
    return this.runEvalAndStringify(`${this.livelyModulesAccessor()}, modules.removePackage(${JSON.stringify(packageURL)})`);
  }

  async reloadPackage (packageURL, opts) {
    return this.runEvalAndStringify(`${this.livelyModulesAccessor()}, modules.reloadPackage(${JSON.stringify(packageURL)}, ${JSON.stringify(opts)})`);
  }

  packageConfChange (source, confFile) {
    return this.runEvalAndStringify(`
      ${this.livelySystemAccessor()};
      await livelySystem.localInterface.packageConfChange(${JSON.stringify(source)}, ${JSON.stringify(confFile)})`);
  }

  async resourcesOfPackage (packageOrAddress, exclude = ['.git', 'node_modules', '.module_cache', 'lively.next-node_modules']) {
    if (packageOrAddress.address) packageOrAddress = packageOrAddress.address;
    return this.runEvalAndStringify(`
      ${this.livelySystemAccessor()};
      await livelySystem.localInterface.resourcesOfPackage(${JSON.stringify(packageOrAddress)}, ${JSON.stringify(exclude)});`);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async getModule (name) {
    let spec = (await this.getModules()).find(ea => ea.name === name);
    return spec ? modules.module(spec.name) : null;
  }

  importModule (name) {
    return this.runEvalAndStringify(`${this.livelyModulesAccessor()}, modules.System.import(${JSON.stringify(name)})`);
  }

  forgetModule (name, opts) {
    return this.runEvalAndStringify(`${this.livelyModulesAccessor()}, modules.module(${JSON.stringify(name)}).unload(${JSON.stringify(opts)})`);
  }

  reloadModule (name, opts) {
    return this.runEvalAndStringify(`${this.livelyModulesAccessor()}, modules.module(${JSON.stringify(name)}).reload(${JSON.stringify(opts)})`);
  }

  moduleFormat (moduleName) {
    return this.runEvalAndStringify(`${this.livelyModulesAccessor()}, modules.module(${JSON.stringify(moduleName)}).format();`);
  }

  moduleRead (moduleName) {
    return this.runEvalAndStringify(`${this.livelyModulesAccessor()}, modules.module(${JSON.stringify(moduleName)}).source()`);
  }

  moduleSourceChange (moduleName, newSource, options) {
    return this.runEvalAndStringify(`${this.livelyModulesAccessor()}, modules.module(${JSON.stringify(moduleName)}).changeSource(${JSON.stringify(newSource)}, ${JSON.stringify(options)})`);
  }

  keyValueListOfVariablesInModule (moduleName, sourceOrAst) {
    return this.runEvalAndStringify(`
      ${this.livelySystemAccessor()};
      await livelySystem.localInterface.keyValueListOfVariablesInModule(${JSON.stringify(moduleName)}, ${JSON.stringify(sourceOrAst)})`);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // imports/exports
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  importsAndExportsOf (modId, sourceOrAst) {
    return this.runEvalAndStringify(`${this.livelyModulesAccessor()}, ({
      imports: await modules.module(${JSON.stringify(modId)}).imports(),
      exports: await modules.module(${JSON.stringify(modId)}).exports()})`);
  }

  exportsOfModules (options) {
    return this.runEvalAndStringify(`
      ${this.livelySystemAccessor()}
      const options = ${JSON.stringify(options)};
      options.excludedPackages = [${
         options.excludedPackages.map(k =>
            (typeof k === 'function') ? k.toString() : JSON.stringify(k)).join(',')}]
      await livelySystem.localInterface.exportsOfModules(options)`);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // search
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  searchInPackage (packageURL, searchString, options) {
    return this.runEvalAndStringify(`
      ${this.livelySystemAccessor()};
      await livelySystem.localInterface.searchInPackage(${JSON.stringify(packageURL)}, ${JSON.stringify(searchString)}, ${JSON.stringify(options)})`);
  }

  // -=-=-=-
  // tests
  // -=-=-=-

  async loadMochaTestFile (file, testsByFile = []) {
    return this.runEvalAndStringify(`
      ${this.livelySystemAccessor()};
      var {testsByFile} = await livelySystem.localInterface.loadMochaTestFile(${JSON.stringify(file)}, ${JSON.stringify(testsByFile)}), result;
      result = {testsByFile}`);
  }

  async runMochaTests (grep, testsByFile, onChange, onError) {
    if (grep && grep instanceof RegExp) { grep = { isRegExp: true, value: String(grep).replace(/^\/|\/$/g, '') }; }
    return this.runEvalAndStringify(`
      var grep = ${JSON.stringify(grep)};
      if (grep && grep.isRegExp) grep = new RegExp(grep.value);
      ${this.livelySystemAccessor()};
      var {testsByFile, isError, value: error} = await livelySystem.localInterface.runMochaTests(grep, ${JSON.stringify(testsByFile || [])}), result;
      error = error ? String(error.stack || error) : null;
      if (testsByFile) {
        testsByFile.forEach(ea =>
          ea.tests.forEach(ea => {
            if (!ea.error) return;
            var {message, stack, actual, expected} = ea.error;
            ea.error = {
              message: message || String(ea.error),
              stack: stack,
              actual, exected
            }
          }));
      }
      result = {testsByFile, isError, error};`);
  }
}
