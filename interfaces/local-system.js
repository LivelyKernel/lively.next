import * as modules from "lively.modules";
import * as ast from "lively.ast";
import * as vm from "lively.vm";
import { resource, createFiles } from "lively.resources";
import { parseJsonLikeObj } from "../helpers.js";
import { obj, string, arr } from "lively.lang";

import { AbstractCoreInterface } from "./interface";

export class LocalCoreInterface extends AbstractCoreInterface {

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

  async registerPackage(packageURL) {
    return modules.registerPackage(packageURL);
  }

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
  
    var p = await this.getPackageForModule(confFile);
    S.set(confFile, S.newModule(config));
    if (p && config.systemjs) S.packages[p.address] = config.systemjs;
    if (p && config.systemjs) S.config({packages: {[p.address]: config.systemjs}})
    if (p) modules.applyPackageConfig(config, p.address);
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  getModule(name) {
    return modules.module(name);
  }

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
    return modules.module(moduleName).format();
  }

  moduleSourceChange(moduleName, newSource, options) {
    return modules.module(moduleName).changeSource(newSource, options);
  }

  async importsAndExportsOf(modId, sourceOrAst) {
    return {
      imports: await modules.module(modId).imports(sourceOrAst),
      exports: await modules.module(modId).exports(sourceOrAst)}
  }

  async keyValueListOfVariablesInModule(moduleName, sourceOrAstOrNothing) {
    if (!sourceOrAstOrNothing)
      sourceOrAstOrNothing = await this.resourceRead(moduleName);

    var parsed = typeof sourceOrAstOrNothing === "string" ?
          ast.parse(sourceOrAstOrNothing) : sourceOrAstOrNothing,
        id = this.normalizeSync(moduleName),
        format = this.moduleFormat(id),
        scope = modules.module(id).env().recorder,
        importsExports = await this.importsAndExportsOf(id, parsed),
  
        toplevel = ast.query.topLevelDeclsAndRefs(parsed),
        decls = arr.sortByKey(ast.query.declarationsOfScope(toplevel.scope, true), "start"),
        imports = arr.pluck(toplevel.scope.importDecls, "name"),
  
        col1Width = 0;
  
    return decls.map(v => {
      var nameLength = v.name.length,
          isExport = importsExports.exports.find(ea => ea.local === v.name),
          isImport = arr.include(imports, v.name);
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

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // search
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  searchInPackage(packageURL, searchString, options) {
    return modules.searchInPackage(packageURL, searchString, options);
  }

}