/* global System */
import { obj, string, arr } from 'lively.lang';
import { resource, createFiles } from 'lively.resources';
import * as ast from 'lively.ast';
import * as modules from 'lively.modules';
import * as vm from 'lively.vm';

import { parseJsonLikeObj } from '../helpers.js';
import { AbstractCoreInterface } from './interface.js';
import { classToFunctionTransform } from 'lively.classes';

export class LocalCoreInterface extends AbstractCoreInterface {
  get name () { return 'local'; }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // lively.vm
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async dynamicCompletionsForPrefix (moduleName, prefix, options) {
    const result = await vm.completions.getCompletions(
      code => vm.runEval(code.replace('return ', ''), { targetModule: moduleName, classTransform: classToFunctionTransform, ...options }), prefix);
    if (result.isError) throw result.value;
    return {
      completions: result.completions,
      prefix: result.startLetters
    };
  }

  runEval (source, options) {
    return vm.runEval(source, { classTransform: classToFunctionTransform, ...options });
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // resources
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  resourceExists (url) { return resource(url).exists(); }
  resourceEnsureExistance (url, optContent) { return resource(url).ensureExistance(optContent); }
  resourceMkdir (url) { return resource(url).mkdir(); }
  resourceRead (url) { return resource(url).read(); }
  resourceRemove (url) { return resource(url).remove(); }
  resourceWrite (url, source) { return resource(url).write(source); }
  resourceCreateFiles (baseDir, spec) { return createFiles(baseDir, spec); }
  resourceDirList (url, depth, opts) { return resource(url).dirList(depth, opts); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // system related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  normalizeSync (name, parentName, isPlugin) {
    return System.decanonicalize(name, parentName, isPlugin);
  }

  normalize (name, parent, parentAddress) {
    return System.normalize(name, parent, parentAddress);
  }

  printSystemConfig () {
    return modules.printSystemConfig();
  }

  getConfig () {
    return System.getConfig();
  }

  setConfig (conf) {
    modules.System.config(conf);
  }

  getPackages (options) {
    const { excluded = [] } = { ...options };
    let excludedURLs = excluded.filter(ea => typeof ea === 'string');
    const excludeFns = excluded.filter(ea => typeof ea === 'function');
    excludedURLs = excludedURLs.concat(excludedURLs.map(url =>
      System.decanonicalize(url.replace(/\/?$/, '/')).replace(/\/$/, '')));
    return modules.getPackages().filter(p =>
      !excludedURLs.includes(p.url) && !excludeFns.some(fn => fn(p.url)));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // package related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async registerPackage (packageURL) {
    return modules.registerPackage(packageURL);
  }

  async importPackage (packageURL) {
    return modules.importPackage(packageURL);
  }

  async removePackage (packageURL) {
    return modules.removePackage(packageURL);
  }

  async reloadPackage (packageURL, opts) {
    return modules.reloadPackage(packageURL, opts);
  }

  async packageConfChange (source, confFile) {
    const S = modules.System;
    const config = parseJsonLikeObj(source);
    const newSource = JSON.stringify(config, null, 2);

    await modules.module(confFile).changeSource(newSource, { doEval: false });
    S.set(confFile, S.newModule(config)); // FIXME, do this in lively.modules

    const p = await this.getPackageForModule(confFile);
    if (p) modules.applyPackageConfig(config, p.address);
  }

  async resourcesOfPackage (packageOrAddress, exclude = ['.git', 'node_modules', '.module_cache']) {
    try {
      const url = packageOrAddress.address ? packageOrAddress.address : packageOrAddress;
      const p = modules.getPackage(url);

      return (await p.resources(undefined, [...exclude, ...p.lively?.ide?.exclude || []]))
        .map(ea => Object.assign(ea, { package: ea.package.url }));
    } catch (e) {
      console.warn(`resourcesOfPackage error for ${packageOrAddress}: ${e}`); // eslint-disable-line no-console
      return [];
    }
  }

  getPackageForModule (moduleId) {
    const p = modules.getPackageOfModule(moduleId);
    return p ? p.asSpec() : p;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  isModuleLoaded (name, isNormalized) {
    return modules.isModuleLoaded(name, isNormalized);
  }

  doesModuleExist (name, isNormalized) {
    return modules.isModuleLoaded(name, isNormalized);
  }

  getModule (name) {
    return modules.module(name);
  }

  importModule (name) {
    return modules.System.import(name);
  }

  forgetModule (name, opts) {
    return modules.module(name).unload(opts);
  }

  reloadModule (name, opts) {
    return modules.module(name).reload(opts);
  }

  moduleFormat (moduleName) {
    return modules.module(moduleName).format();
  }

  moduleRead (moduleName) {
    return modules.module(moduleName).source();
  }

  moduleSourceChange (moduleName, newSource, options) {
    return modules.module(moduleName).changeSource(newSource, options);
  }

  async keyValueListOfVariablesInModule (moduleName, sourceOrAstOrNothing) {
    if (!sourceOrAstOrNothing) { sourceOrAstOrNothing = await this.resourceRead(moduleName); }

    const parsed = typeof sourceOrAstOrNothing === 'string'
      ? ast.parse(sourceOrAstOrNothing)
      : sourceOrAstOrNothing;
    const id = this.normalizeSync(moduleName);
    const scope = modules.module(id).env().recorder;
    const importsExports = await this.importsAndExportsOf(id, parsed);

    const toplevel = ast.query.topLevelDeclsAndRefs(parsed);
    const decls = arr.sortByKey(ast.query.declarationsOfScope(toplevel.scope, true), 'start');
    const imports = arr.pluck(toplevel.scope.importSpecifiers, 'name');

    let col1Width = 0;

    return decls.map(v => {
      let nameLength = v.name.length;
      const isExport = importsExports.exports.find(ea => ea.local === v.name);
      const isImport = imports.includes(v.name);
      if (isExport) nameLength += ' [export]'.length;
      if (isImport) nameLength += ' [import]'.length;
      col1Width = Math.max(col1Width, nameLength);

      return {
        isExport: isExport,
        isImport: isImport,
        name: v.name,
        value: scope[v.name],
        node: v,
        printedName: v.name + (isExport ? ' [export]' : '') + (isImport ? ' [import]' : ''),
        printedValue: obj.inspect(scope[v.name], { maxDepth: 1 }).replace(/\n/g, '')
      };
    })
      .map(val => ({
        isListItem: true,
        value: val,
        string: val.printedName + string.indent(' = ' + val.printedValue, ' ', col1Width - val.printedName.length)
      }));
  }

  async importsAndExportsOf (modId, sourceOrAst) {
    return {
      imports: await modules.module(modId).imports(sourceOrAst),
      exports: await modules.module(modId).exports(sourceOrAst)
    };
  }

  exportsOfModules (options) {
    return modules.ExportLookup.run(System, options);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // search
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  searchInPackage (packageURL, searchString, options) {
    return modules.getPackage(packageURL).search(searchString, options);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // tests
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  async runMochaTests (grep, testsByFile, onChange, onError) {
    const { runMochaTests } = await System.import('lively-system-interface/commands/mocha-tests.js');
    return runMochaTests(grep, testsByFile, onChange, onError);
  }

  async loadMochaTestFile (file, testsByFile) {
    const { loadMochaTestFile } = await System.import('lively-system-interface/commands/mocha-tests.js');
    return loadMochaTestFile(file, testsByFile);
  }
}
