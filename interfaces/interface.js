import { parseJsonLikeObj } from "../helpers.js";
import { arr, obj } from "lively.lang";
import { resource } from "lively.resources";
import { transform } from "lively.ast";
import { module } from "lively.modules";

function todo(methodName) {
  throw new Error(`${methodName} is not yet implemented!`);
}

export class AbstractCoreInterface {

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // lively.vm
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async dynamicCompletionsForPrefix(moduleName, prefix, options) { todo("dynamicCompletionsForPrefix") }
  runEval(source, options)                                       { todo("runEval") }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // resources
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  resourceExists(url)                      { todo("resourceExists") }
  resourceEnsureExistance(url, optContent) { todo("resourceEnsureExistance") }
  resourceMkdir(url)                       { todo("resourceMkdir") }
  resourceRead(url)                        { todo("resourceRead") }
  resourceRemove(url)                      { todo("resourceRemove") }
  resourceWrite(url, source)               { todo("resourceWrite") }
  resourceCreateFiles(baseDir, spec)       { todo("resourceCreateFiles") }
  resourceDirList(baseDir, depth, opts)    { todo("resourceDirList") }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // system related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  normalizeSync(name, parentName, isPlugin) { todo("normalizeSync") }
  normalize(name, parent, parentAddress)    { todo("normalize") }
  printSystemConfig()                       { todo("printSystemConfig") }
  getConfig()                               { todo("getConfig") }
  setConfig(conf)                           { todo("setConfig") }
  getPackages(options)                      { todo("getPackages") }
  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  isModuleLoaded(name, isNormalized) { todo("isModuleLoaded"); }
  doesModuleExist(name, isNormalized) { todo("doesModuleExist"); }

  async getModules() {
    return arr.flatmap(await this.getPackages(), ea => ea.modules);
  }
  
  async getModule(name) {
    return (await this.getModules()).find(ea => ea.name === name);
  }
  
  async getPackage(name) {
    name = name.replace(/\/+$/, "");
    return (await this.getPackages()).find(ea => ea.address === name || ea.name === name);
  }
  
  async getPackageForModule(name) {
    return (await this.getPackages())
      .find(ea => ea.modules.some(mod => mod.name === name));
  }
  
  systemConfChange(source) {
    var jso = parseJsonLikeObj(source),
        exceptions = ["baseURL"];
    exceptions.forEach(ea => delete jso[ea]);
    // Object.keys(jso).forEach(k => modules.System[k] = jso[k]);
    return this.setConfig(jso);
  }

  async resourcesOfPackage(packageOrAddress, {exclude, ignoredPackages}) { todo("resourcesOfPackage"); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-  
  // package related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async registerPackage(packageURL)         { todo("registerPackage") }
  async importPackage(packageURL)           { todo("importPackage") }
  async removePackage(packageURL)           { todo("removePackage") }
  async reloadPackage(packageURL)           { todo("reloadPackage") }
  async packageConfChange(source, confFile) { todo("packageConfChange") }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  importModule(name)                                       { todo("importModule") }
  forgetModule(name, opts)                                 { todo("forgetModule") }
  reloadModule(name, opts)                                 { todo("reloadModule") }
  moduleFormat(moduleName)                                 { todo("moduleFormat") }
  moduleRead(moduleName)                                   { todo("moduleRead") }
  moduleSourceChange(moduleName, newSource, options)       { todo("moduleSourceChange") }
  importsAndExportsOf(modId, sourceOrAst)                  { todo("importsAndExportsOf") }
  keyValueListOfVariablesInModule(moduleName, sourceOrAst) { todo("keyValueListOfVariablesInModule") }

  moduleWrite(moduleName, newSource) {
    return this.moduleSourceChange(moduleName, newSource);
  }

}


export class RemoteCoreInterface extends AbstractCoreInterface {

  constructor() {
    super();
    this.currentEval = null;
  }

  runEval(source, options) {
    throw new Error("Not yet implemented")
  }

  runEvalAndStringify(source, opts) {
    if (this.currentEval)
      return this.currentEval.then(() => this.runEvalAndStringify(source, opts));

    return this.currentEval = Promise.resolve().then(async () => {
      var result = await this.runEval(`
var result;
try {
  result = JSON.stringify(await (async ${transform.wrapInFunction(source)})());
} catch (e) { result = {isError: true, value: e}; }
!result || typeof result === "string" ?
  result :
  JSON.stringify(result.isError ?
    {isError: true, value: result.value.stack || String(result.value)} :
    result)
;`, Object.assign({
      targetModule: "lively://remote-lively-system/runEvalAndStringify",
      promiseTimeout: 2000,
      waitForPromise: true,
    }, opts));

      if (result && result.isError)
        throw new Error(String(result.value));
  
      if (!result || !result.value) return null;
      
      if (result.value === "undefined") return undefined;
      if (result.value === "null") return null;
      if (result.value === "true") return true;
      if (result.value === "false") return false;
  
      try {
        return JSON.parse(result.value);
      } catch (e) {
        throw new Error(`Could not JSON.parse the result of runEvalAndStringify: ${result.value}\n(Evaluated expression:\n ${source})`);
      }
    }).then(
      result => { delete this.currentEval; return result; },
      err => { delete this.currentEval; return Promise.reject(err); });
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // lively.vm
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async dynamicCompletionsForPrefix(moduleName, prefix, options) {
    options = obj.dissoc(options, ["systemInterface", "System", "context"]);
    var src = `
      var livelySystem = System.get(System.decanonicalize("lively-system-interface")),
          mName = ${JSON.stringify(moduleName)},
          prefix = ${JSON.stringify(prefix)},
          opts = ${JSON.stringify(options)};
      await livelySystem.localInterface.dynamicCompletionsForPrefix(mName, prefix, opts);`;
    return this.runEvalAndStringify(src);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // resources
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  evalWithResource(url, method, arg) {
    return this.runEvalAndStringify(`var {resource} = await System.import("lively.resources"); await resource("${url}").${method}(${arg ? JSON.stringify(arg) : ""})`);
  }

  resourceExists(url) { return this.evalWithResource(url, "exists"); }
  resourceEnsureExistance(url, optContent) { return this.evalWithResource(url, "ensureExistance", optContent); }
  resourceMkdir(url) { return this.evalWithResource(url, "mkdir"); }
  resourceRead(url) { return this.evalWithResource(url, "read");}
  resourceRemove(url) { return this.evalWithResource(url, "remove");}
  resourceWrite(url, source) { return this.evalWithResource(url, "write", source); }
  resourceCreateFiles(baseDir, spec) {
    return this.runEvalAndStringify(`var {createFiles} = await System.import("lively.resources"); await createFiles("${baseDir}", ${JSON.stringify(spec)})`);
  }
  resourceDirList(url, depth, opts) {
    return this.runEvalAndStringify(`
      var {resource} = await System.import("lively.resources");
      (await resource("${url}").dirList(${JSON.stringify(depth)}, ${JSON.stringify(opts)}))
        .map(({url}) => ({url}))`);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // system related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  normalizeSync(name, parentName, isPlugin) {
    return this.runEvalAndStringify(`lively.modules.System.decanonicalize(${JSON.stringify(name)}, ${JSON.stringify(parentName)}, ${isPlugin})`);
  }

  normalize(name, parent, parentAddress) {
    return this.runEvalAndStringify(`lively.modules.System.normalize(${JSON.stringify(name)}, ${JSON.stringify(parent)}, ${JSON.stringify(parentAddress)})`);
  }

  printSystemConfig() {
    return this.runEvalAndStringify(`lively.modules.printSystemConfig()`);
  }

  getConfig() {
    return this.runEvalAndStringify(`var c = Object.assign({}, lively.modules.System.getConfig()); for (var name in c) if (name.indexOf("__lively.modules__") === 0 || name.indexOf("loads") === 0) delete c[name]; c`);
  }

  setConfig(conf) {
    return this.runEvalAndStringify(`lively.modules.System.config(${JSON.stringify(conf)})`);
  }

  getPackages(options) {
    return this.runEvalAndStringify(`
      var livelySystem = System.get(System.decanonicalize("lively-system-interface"));
      await livelySystem.localInterface.getPackages(${JSON.stringify(options)})
        .map(ea => Object.assign({}, ea, {System: null}));`);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // package related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  isModuleLoaded(name, isNormalized) {
    return this.runEvalAndStringify(`lively.modules.isModuleLoaded("${name}", ${isNormalized})`);
  }

  doesModuleExist(name, isNormalized) {
    return this.runEvalAndStringify(`lively.modules.doesModuleExist("${name}", ${isNormalized})`);
  }

  async registerPackage(packageURL) {
    return this.runEvalAndStringify(`lively.modules.registerPackage(${JSON.stringify(packageURL)})`);
  }

  async importPackage(packageURL) {
    return this.runEvalAndStringify(`lively.modules.importPackage(${JSON.stringify(packageURL)})`);
  }

  async removePackage(packageURL) {
    return this.runEvalAndStringify(`lively.modules.removePackage(${JSON.stringify(packageURL)})`);
  }

  async reloadPackage(packageURL, opts) {
    return this.runEvalAndStringify(`lively.modules.reloadPackage(${JSON.stringify(packageURL)}, ${JSON.stringify(opts)})`);
  }

  packageConfChange(source, confFile) {
    return this.runEvalAndStringify(`
      var livelySystem = System.get(System.decanonicalize("lively-system-interface"));
      await livelySystem.localInterface.packageConfChange(${JSON.stringify(source)}, ${JSON.stringify(confFile)})`);
  }

  async resourcesOfPackage(packageOrAddress, exclude = [".git", "node_modules", ".module_cache"]) {
    if (packageOrAddress.address) packageOrAddress = packageOrAddress.address;
    return this.runEvalAndStringify(`
      var livelySystem = System.get(System.decanonicalize("lively-system-interface"));
      await livelySystem.localInterface.resourcesOfPackage(${JSON.stringify(packageOrAddress)}, ${JSON.stringify(exclude)});`);
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async getModule(name) {
    var spec = (await this.getModules()).find(ea => ea.name === name);
    return spec ? module(spec.name) : null;
  }

  importModule(name) {
    return this.runEvalAndStringify(`lively.modules.System.import(${JSON.stringify(name)})`);
  }

  forgetModule(name, opts) {
    return this.runEvalAndStringify(`lively.modules.module(${JSON.stringify(name)}).unload(${JSON.stringify(opts)})`);
  }

  reloadModule(name, opts) {
    return this.runEvalAndStringify(`lively.modules.module(${JSON.stringify(name)}).reload(${JSON.stringify(opts)})`);
  }

  moduleFormat(moduleName) {
    return this.runEvalAndStringify(`lively.modules.module(${JSON.stringify(moduleName)}).format();`);
  }

  moduleRead(moduleName) {
    return this.runEvalAndStringify(`lively.modules.module(${JSON.stringify(moduleName)}).source()`);
  }

  moduleSourceChange(moduleName, newSource, options) {
    return this.runEvalAndStringify(`lively.modules.module(${JSON.stringify(moduleName)}).changeSource(${JSON.stringify(newSource)}, ${JSON.stringify(options)})`);
  }

  keyValueListOfVariablesInModule(moduleName, sourceOrAst) {
    return this.runEvalAndStringify(`
      var livelySystem = System.get(System.decanonicalize("lively-system-interface"));
      await livelySystem.localInterface.keyValueListOfVariablesInModule(${JSON.stringify(moduleName)}, ${JSON.stringify(sourceOrAst)})`);
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // imports/exports
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  importsAndExportsOf(modId, sourceOrAst) {
    return this.runEvalAndStringify(`({
      imports: await lively.modules.module(${JSON.stringify(modId)}).imports(),
      exports: await lively.modules.module(${JSON.stringify(modId)}).exports()})`);
  }

  exportsOfModules(options) {
    return this.runEvalAndStringify(`
      var livelySystem = System.get(System.decanonicalize("lively-system-interface"));
      await livelySystem.localInterface.exportsOfModules(${JSON.stringify(options)})`);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // search
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  searchInPackage(packageURL, searchString, options) {
    return this.runEvalAndStringify(`
      var livelySystem = System.get(System.decanonicalize("lively-system-interface"));
      await livelySystem.localInterface.searchInPackage(${JSON.stringify(packageURL)}, ${JSON.stringify(searchString)}, ${JSON.stringify(options)})`);
  }


  // -=-=-=-
  // tests
  // -=-=-=-

  async loadMochaTestFile(file, testsByFile = []) {
    return this.runEvalAndStringify(`
      var livelySystem = System.get(System.decanonicalize("lively-system-interface")),
          {testsByFile} = await livelySystem.localInterface.loadMochaTestFile(${JSON.stringify(file)}, ${JSON.stringify(testsByFile)}), result;
      result = {testsByFile}`);
  }

  async runMochaTests(grep, testsByFile, onChange, onError) {
    if (grep && grep instanceof RegExp)
      grep = {isRegExp: true, value:  String(grep).replace(/^\/|\/$/g, "")};
    return this.runEvalAndStringify(`
      var grep = ${JSON.stringify(grep)};
      if (grep && grep.isRegExp)
        grep = new RegExp(grep.value);
      var livelySystem = System.get(System.decanonicalize("lively-system-interface")),
          {testsByFile, isError, value: error} = await livelySystem.localInterface.runMochaTests(grep, ${JSON.stringify(testsByFile || [])}), result;
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
      result = {testsByFile, isError, error}`);
  }
}
