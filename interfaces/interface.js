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

  normalizeSync(name, parentName, isPlugin) {
    return modules.System.decanonicalize(name, parentName, isPlugin);
  }
  
  normalize(name, parent, parentAddress) {
    return modules.System.normalize(name, parent, parentAddress);
  }
  
  printSystemConfig() {
    return modules.printSystemConfig();
  }
  
  getConfig() {
    return modules.System.getConfig();
  }
  
  setConfig(conf) {
    modules.System.config(conf);
  }
  
  getPackages() {
    return modules.getPackages();
  }
  
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

  importModule(name) {
    return modules.System.import(name);
  }
  
  forgetModule(name, opts) {
    return modules.module(name).unload(opts);
  }

  reloadModule(name, opts) {
    return modules.module(name).reload(opts);
  }
  
  moduleFormat(moduleName) {
    var loads = modules.System.loads;
    return loads && loads[moduleName] && loads[moduleName].metadata && loads[moduleName].metadata.format;
  }
  
  async moduleRead(moduleName) {
    return this.resourceRead(await this.normalize(moduleName));
  }

  async moduleWrite(moduleName, source) {
    return this.resourceWrite(await this.normalize(moduleName), source);
  }

  moduleSourceChange(moduleName, newSource, options) {
    return modules.module(moduleName).changeSource(newSource, options);
  }

  keyValueListOfVariablesInModule(moduleName, sourceOrAst) {
  
    var ast = typeof sourceOrAst === "string" ?
          lively.ast.parse(sourceOrAst) : sourceOrAst,
        mod = modules.module(moduleName),
        format = mod.metadata.format,
        scope = mod.env.recorder,
  
        toplevel = lively.ast.query.topLevelDeclsAndRefs(ast),
        decls = lively.ast.query.declarationsOfScope(toplevel.scope, true).sortByKey("start"),
        imports = toplevel.scope.importDecls.pluck("name"),
  
        col1Width = 0;

    return mod.exports().then(exports => {
        decls.map(v => {
        var nameLength = v.name.length,
            isExport = exports.find(ea => ea.local === v.name),
            isImport = imports.include(v.name);
        if (isExport) nameLength += " [export]".length;
        if (isImport) nameLength += " [import]".length;
        col1Width = Math.max(col1Width, nameLength);
        return {
            isExport: isExport,
            isImport: isImport,
            name: v.name,
            value: scope[v.name],
            node: v,
            printedName: v.name + (isExport ? " [export]" : "") + (isImport ? " [import]" : ""),
            printedValue: lively.lang.obj.inspect(scope[v.name], {maxDepth: 1}).replace(/\n/g, "")
        }
        })
        .map(val => ({
        isListItem: true,
        value: val,
        string: val.printedName + lively.lang.string.indent(" = " + val.printedValue, " ", col1Width-val.printedName.length)
        }));
      });
    }
}
