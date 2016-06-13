import * as modules from "lively.modules";
import { resource, createFiles } from "lively.resources";
import { parseJsonLikeObj } from "../helpers.js";
import { arr, obj } from "lively.lang";

export class LocalSystemInterface {

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
  
  getModules() {
    return arr.flatmap(this.getPackages(), ea => ea.modules);
  }
  
  getModule(name) {
    return this.getModules().find(ea => ea.name === name);
  }
  
  getPackage(name) {
    name = name.replace(/\/+$/, "");
    return this.getPackages().find(ea => ea.address === name || ea.name === name);
  }
  
  getPackageForModule(name) {
    // name = "http://localhost:9001/lively.resources/package.json"
    // this.getPackageForModule("http://localhost:9001/lively.resources/package.json")
    var p = this.getPackages().find(ea => ea.modules.some(mod => mod.name === name));
    if (p) return p;
  
    return arr.sortBy(
              this.getPackages().filter(ea => name.indexOf(ea.address) === 0),
              ea => ea.address.length);
  }
  
  systemConfChange(source) {
    var jso = parseJsonLikeObj(source),
        exceptions = ["baseURL"];
    exceptions.forEach(ea => delete jso[ea]);
    // Object.keys(jso).forEach(k => modules.System[k] = jso[k]);
    this.setConfig(jso);
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
    if (p) lively.modules.applyPackageConfig(config, p.address);
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
  
  async moduleRead(moduleName) {
    return this.resourceRead(await this.normalize(moduleName));
  }

  async moduleWrite(moduleName, source) {
    return this.resourceWrite(await this.normalize(moduleName), source);
  }

  moduleSourceChange(moduleName, newSource, options) {
    return modules.moduleSourceChange(moduleName, newSource, options);
  }

  keyValueListOfVariablesInModule(moduleName, sourceOrAst) {
  
    var ast = typeof sourceOrAst === "string" ?
          lively.ast.parse(sourceOrAst) : sourceOrAst,
        id = this.normalizeSync(moduleName),
        format = this.moduleFormat(id),
        scope = modules.moduleEnv(id).recorder,
        importsExports = modules.importsAndExportsOf(id, ast),
  
        toplevel = lively.ast.query.topLevelDeclsAndRefs(ast),
        decls = lively.ast.query.declarationsOfScope(toplevel.scope, true).sortByKey("start"),
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
        printedValue: lively.lang.obj.inspect(scope[v.name], {maxDepth: 1}).replace(/\n/g, "")
      }
    })
    .map(val => ({
      isListItem: true,
      value: val,
      string: val.printedName + lively.lang.string.indent(" = " + val.printedValue, " ", col1Width-val.printedName.length)
    }));
  }

}