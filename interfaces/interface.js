import { parseJsonLikeObj } from "../helpers.js";
import { arr } from "lively.lang";

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

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // system related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  normalizeSync(name, parentName, isPlugin) { todo("normalizeSync") }
  normalize(name, parent, parentAddress)    { todo("normalize") }
  printSystemConfig()                       { todo("printSystemConfig") }
  getConfig()                               { todo("getConfig") }
  setConfig(conf)                           { todo("setConfig") }
  getPackages()                             { todo("getPackages") }
  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  
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

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-  
  // package related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

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
  moduleSourceChange(moduleName, newSource, options)       { todo("moduleSourceChange") }
  importsAndExportsOf(modId, sourceOrAst)                  { todo("importsAndExportsOf") }
  keyValueListOfVariablesInModule(moduleName, sourceOrAst) { todo("keyValueListOfVariablesInModule") }

  async moduleRead(moduleName) {
    return this.resourceRead(await this.normalize(moduleName));
  }

  async moduleWrite(moduleName, source) {
    return this.resourceWrite(await this.normalize(moduleName), source);
  }

}
