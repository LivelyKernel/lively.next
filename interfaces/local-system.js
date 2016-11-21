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
    var S = modules.System,
        config = parseJsonLikeObj(source);
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

  moduleRead(moduleName) {
    return modules.module(moduleName).source();
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
    return modules.getPackage(packageURL).search(searchString, options);
  }

  // -=-=-=-
  // tests
  // -=-=-=-

  async loadMochaTestFile(file, testsByFile = []) {
    var tester = await System.import("mocha-es6/index.js"),
        {mocha, tests, file: url} = await tester.loadTestFile(file, {});

    var prev = testsByFile.findIndex(ea => ea.file === url);
    if (prev > -1) testsByFile.splice(prev, 1, {file: url, tests});
    else testsByFile.push({file: url, tests});
    return {mocha, testsByFile};
  }

  async runMochaTests(grep, testsByFile, onChange, onError) {
    for (let {file} of testsByFile) {
      var {mocha} = await this.loadMochaTestFile(file, testsByFile);
      if (grep) mocha = mocha.grep(grep);
      await mochaRun(mocha);
    }
    return {mocha, testsByFile};

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    function mochaRun(mocha) {
      return new Promise((resolve, reject) => {
        var files = arr.compact(mocha.suite.suites).map(({file}) => file),
          tests = lively.lang.chain(testsByFile)
            .filter(ea => files.includes(ea.file))
            .pluck("tests").flatten().value();

        if (!tests || !tests.length)
          return reject(new Error(`Trying to run tests of ${files.join(", ")} but cannot find them in loaded tests!`));
        mocha.reporter(function Reporter(runner) {
          runner.on("test", test => {
            try {
              var t = tests.find(ea => ea.fullTitle === test.fullTitle());
              t.state = "running";
              typeof onChange === "function" && onChange(t, "test")
            } catch (e) { typeof onError === "function" && onError(e, "test"); }
          });

          runner.on("pass", test => {
            try {
              var t = tests.find(ea => ea.fullTitle === test.fullTitle());
              t.state = "succeeded";
              t.duration = test.duration;
              typeof onChange === "function" && onChange(t, "pass");
            } catch (e) { typeof onError === "function" && onError(e, "pass"); }
          });

          runner.on("fail", (test, error) => {
            try {
              var t = tests.find(ea => ea.fullTitle === test.fullTitle());
              if (t) attachErrorToTest(t, error, test.duration);
              else { // "test" is a hook...
                var parentTests = arr.invoke(test.parent.tests, "fullTitle")
                tests
                  .filter(ea => parentTests.includes(ea.fullTitle))
                  .forEach(ea => attachErrorToTest(ea, error, test.duration))
              }

              typeof onChange === "function" && onChange(t, "fail");

              function attachErrorToTest(test, error, duration) {
                test.state = "failed";
                test.duration = test.duration;
                test.error = error;
              }

            } catch (e) { typeof onError === "function" && onError(e, "fail"); }
          });

        });

        mocha.run(failures => resolve({testsByFile, mocha}));
      });
    }
  }

}