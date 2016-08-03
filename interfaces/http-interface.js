import { HttpEvalStrategy } from "lively.vm/lib/eval-strategies.js";
import { AbstractCoreInterface } from "./interface";
import * as ast from "lively.ast";
import { promise } from "lively.lang";

// ast.transform.wrapInFunction("var x = 23; x + foo + bar; class Foo {}; Foo")
// var s = new HttpEvalStrategy("http://localhost:3000/eval")
// s.keysOfObject(_x17, _x18)
// await s.runEval("1 + 2", {targetModule: moduleId()})
// livelySystem.localInterface.dynamicCompletionsForPrefix(moduleName, prefix, options)

// var server = new HTTPCoreInterface("http://localhost:3000/eval")
// server.constructor === HTTPCoreInterface
// server.dynamicCompletionsForPrefix("lively://remote-lively-system/", "proces", {targetModule: "lively://remote-lively-system/"})
// server.runEval("var x = {foo: 23}; x", {targetModule: m})


// var m = "file:///Users/robert/Lively/LivelyKernel2/packages/lively-system-interface/index.js"
// var source = await server.resourceRead(m)
// await server.importsAndExportsOf(m, source)
// await server.importModule(m)
// await server.keyValueListOfVariablesInModule(m, source)
// var result = await server.resourceWrite("file:///Users/robert/Lively/LivelyKernel2/test.js", "bar2")
// var result = await server.resourceRead("file:///Users/robert/Lively/LivelyKernel2/test.js")
// var result = await server.normalizeSync("lively.modules")
// var result = await server.normalize("lively.modules")
// var result = await server.printSystemConfig("lively.modules")
// var result = await server.getConfig()
// var result = await server.moduleFormat("file:///Users/robert/Lively/LivelyKernel2/packages/lively-system-interface/index.js")
// var result = await server.moduleFormat("file:///Users/robert/Lively/LivelyKernel2/test.js")
// var result = await server.getPackages()
// result
// var result = await server.getModules()
// System.getConfig

export class HTTPCoreInterface extends AbstractCoreInterface {

  constructor(url) {
    super();
    this.currentEval = null;
    this.url = url;
    this.server = new HttpEvalStrategy(url);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // lively.vm
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async dynamicCompletionsForPrefix(moduleName, prefix, options) {
    return this.runEvalAndStringify(`await livelySystem.localInterface.dynamicCompletionsForPrefix(${JSON.stringify(moduleName)}, ${JSON.stringify(prefix)}, ${JSON.stringify(options)})`);
  }

  runEvalAndStringify(source, opts) {
    if (this.currentEval) return this.currentEval.then(() => this.runEvalAndStringify(source, opts));
    return this.currentEval = Promise.resolve().then(async () => {
      var result = await this.runEval(`
var result;
try {
  result = JSON.stringify(await (async ${ast.transform.wrapInFunction(source)})());
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

  runEval(source, options) {
    return this.server.runEval(source, options);
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

  getPackages() {
    return this.runEvalAndStringify(`lively.lang.obj.values(lively.lang.obj.values(lively.modules.getPackages()).map(ea => Object.assign({}, ea, {System: null})))`);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // package related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async registerPackage(packageURL) {
    return this.runEvalAndStringify(`lively.modules.registerPackage(${JSON.stringify(packageURL)})`);
  }

  async importPackage(packageURL) {
    return this.runEvalAndStringify(`lively.modules.importPackage(${JSON.stringify(packageURL)})`);
  }

  async removePackage(packageURL) {
    return this.runEvalAndStringify(`lively.modules.removePackage(${JSON.stringify(packageURL)})`);
  }

  async reloadPackage(packageURL) {
    return this.runEvalAndStringify(`lively.modules.reloadPackage(${JSON.stringify(packageURL)})`);
  }

  packageConfChange(source, confFile) {
    return this.runEvalAndStringify(`await livelySystem.localInterface.packageConfChange(${JSON.stringify(source)}, ${JSON.stringify(confFile)})`);
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

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

  moduleSourceChange(moduleName, newSource, options) {
    return this.runEvalAndStringify(`lively.modules.module(${JSON.stringify(moduleName)}).changeSource(${JSON.stringify(newSource)}, ${JSON.stringify(options)})`);
  }

  importsAndExportsOf(modId, sourceOrAst) {
    return this.runEvalAndStringify(`({
      imports: await lively.modules.module(${JSON.stringify(modId)}).imports(),
      exports: await lively.modules.module(${JSON.stringify(modId)}).exports()})`);
  }

  keyValueListOfVariablesInModule(moduleName, sourceOrAst) {
    return this.runEvalAndStringify(`await livelySystem.localInterface.keyValueListOfVariablesInModule(${JSON.stringify(moduleName)}, ${JSON.stringify(sourceOrAst)})`);
  }

}