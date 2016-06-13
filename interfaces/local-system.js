import * as modules from "lively.modules";
import * as ast from "lively.ast";
import * as vm from "lively.vm";
import { resource, createFiles } from "lively.resources";
import { parseJsonLikeObj } from "../helpers.js";
import { obj, string } from "lively.lang";

import { AbstractSystemInterface } from "./interface";

export class LocalSystemInterface extends AbstractSystemInterface {

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // lively.vm
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async dynamicCompletionsForPrefix(moduleName, prefix, options) {
    options = lively.lang.obj.merge({targetModule: moduleName}, options);
    var result = await vm.completions.getCompletions(code => vm.runEval(code, options), prefix);
    if (result.isError) throw result.value;
    return {
      completions: result.completions,
      prefix: result.startLetters
    }
  }

  runEval(source, options) {
    return vm.runEval(source, options);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // resources
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  resourceExists(url) { return resource(url).exists(); }
  resourceEnsureExistance(url, optContent) { return resource(url).ensureExistance(optContent); }
  resourceMkdir(url) { return resource(url).mkdir(); }
  resourceRead(url) { return resource(url).read(); }
  resourceRemove(url) { return resource(url).remove(); }
  resourceWrite(url, source) { return resource(url).write(source); }
  resourceCreateFiles(baseDir, spec) { return createFiles(baseDir, spec); }

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
    return obj.values(modules.getPackages());
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-  
  // package related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async importPackage(packageURL) {
    return modules.importPackage(packageURL);
  }

  async removePackage(packageURL) {
    return modules.removePackage(packageURL);
  }

  async reloadPackage(packageURL) {
    return modules.reloadPackage(packageURL);
  }

  async packageConfChange(source, confFile) {
  
    var S = modules.System;
    var config = parseJsonLikeObj(source);
    await this.resourceWrite(confFile, JSON.stringify(config, null, 2));
  
    var p = this.getPackageForModule(confFile);
    S.set(confFile, S.newModule(config));
    if (p && config.systemjs) S.packages[p.address] = config.systemjs;
    if (p && config.systemjs) S.config({packages: {[p.address]: config.systemjs}})
    if (p) modules.applyPackageConfig(config, p.address);
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  importModule(name) {
    return modules.System.import(name);
  }
  
  forgetModule(name, opts) {
    return modules.forgetModule(name, opts);
  }

  reloadModule(name, opts) {
    return modules.reloadModule(name, opts);
  }
  
  moduleFormat(moduleName) {
    var loads = modules.System.loads;
    return loads && loads[moduleName] && loads[moduleName].metadata && loads[moduleName].metadata.format;
  }

  moduleSourceChange(moduleName, newSource, options) {
    return modules.moduleSourceChange(moduleName, newSource, options);
  }

  importsAndExportsOf(modId, sourceOrAst) {
    return modules.importsAndExportsOf(modId, sourceOrAst);
  }

  keyValueListOfVariablesInModule(moduleName, sourceOrAst) {
  
    var parsed = typeof sourceOrAst === "string" ?
          ast.parse(sourceOrAst) : sourceOrAst,
        id = this.normalizeSync(moduleName),
        format = this.moduleFormat(id),
        scope = modules.moduleEnv(id).recorder,
        importsExports = this.importsAndExportsOf(id, parsed),
  
        toplevel = ast.query.topLevelDeclsAndRefs(parsed),
        decls = ast.query.declarationsOfScope(toplevel.scope, true).sortByKey("start"),
        imports = toplevel.scope.importDecls.pluck("name"),
  
        col1Width = 0;
  
    return decls.map(v => {
      var nameLength = v.name.length,
          isExport = importsExports.exports.find(ea => ea.local === v.name),
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
        printedValue: obj.inspect(scope[v.name], {maxDepth: 1}).replace(/\n/g, "")
      }
    })
    .map(val => ({
      isListItem: true,
      value: val,
      string: val.printedName + string.indent(" = " + val.printedValue, " ", col1Width-val.printedName.length)
    }));
  }

}