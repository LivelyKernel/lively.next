import { obj, string, arr } from "lively.lang";
import { resource, createFiles } from "lively.resources";
import * as ast from "lively.ast";
import * as modules from "lively.modules";
import * as vm from "lively.vm";

import { loadMochaTestFile, runMochaTests } from "../commands/mocha-tests.js";
import { parseJsonLikeObj } from "../helpers.js";
import { AbstractCoreInterface } from "./interface";

export class LocalCoreInterface extends AbstractCoreInterface {

  get name() { return "local"; }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // lively.vm
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async dynamicCompletionsForPrefix(moduleName, prefix, options) {
    var result = await vm.completions.getCompletions(
      code => vm.runEval(code, {targetModule: moduleName, ...options}), prefix);
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
  resourceDirList(url, depth, opts) { return resource(url).dirList(depth, opts); }

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

  getPackages(options) {
    let {excluded = []} = {...options},
        excludedURLs = excluded.filter(ea => typeof ea === "string"),
        excludeFns = excluded.filter(ea => typeof ea === "function");
    excludedURLs = excludedURLs.concat(excludedURLs.map(url => 
      System.decanonicalize(url.replace(/\/?$/, "/")).replace(/\/$/, "")));
    return modules.getPackages().filter(p =>
      !excludedURLs.includes(p.url) && !excludeFns.some(fn => fn(p.url)));
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

  async reloadPackage(packageURL, opts) {
    return modules.reloadPackage(packageURL, opts);
  }

  async packageConfChange(source, confFile) {
    let S = modules.System,
        config = parseJsonLikeObj(source),
        newSource = JSON.stringify(config, null, 2);

    await modules.module(confFile).changeSource(newSource, {doEval: false});
    S.set(confFile, S.newModule(config)); // FIXME, do this in lively.modules

    var p = await this.getPackageForModule(confFile);
    if (p) modules.applyPackageConfig(config, p.address);
  }

  async resourcesOfPackage(packageOrAddress, exclude = [".git", "node_modules", ".module_cache"]) {
    try {
      var url = packageOrAddress.address ? packageOrAddress.address : packageOrAddress,
          p = modules.getPackage(url);
      return (await p.resources(undefined, exclude))
              .map(ea => Object.assign(ea, {package: ea.package.url}))
    } catch (e) {
      console.warn(`resourcesOfPackage error for ${packageOrAddress}: ${e}`);
      return [];
    }
  }

  getPackageForModule(moduleId) {
    let p = modules.getPackageOfModule(moduleId);
    return p ? p.asSpec() : p;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  isModuleLoaded(name, isNormalized) {
    return modules.isModuleLoaded(name, isNormalized);
  }

  doesModuleExist(name, isNormalized) {
    return modules.isModuleLoaded(name, isNormalized);
  }

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

  moduleRead(moduleName) {
    return modules.module(moduleName).source();
  }

  moduleSourceChange(moduleName, newSource, options) {
    return modules.module(moduleName).changeSource(newSource, options);
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
        imports = arr.pluck(toplevel.scope.importSpecifiers, "name"),

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

  async importsAndExportsOf(modId, sourceOrAst) {
    return {
      imports: await modules.module(modId).imports(sourceOrAst),
      exports: await modules.module(modId).exports(sourceOrAst)
    }
  }

  exportsOfModules(options) {
    return modules.ExportLookup.run(modules.System, options);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // search
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  searchInPackage(packageURL, searchString, options) {
    return modules.getPackage(packageURL).search(searchString, options);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // tests
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  runMochaTests(grep, testsByFile, onChange, onError) {
    return runMochaTests(grep, testsByFile, onChange, onError);
  }
  loadMochaTestFile(file, testsByFile) {
    return loadMochaTestFile(file, testsByFile);
  }

}