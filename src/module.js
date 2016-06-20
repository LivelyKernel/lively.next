import { parse, query } from "lively.ast";
import { arr, obj, graph } from "lively.lang";
import { computeRequireMap } from  "./dependencies.js";
import { moduleSourceChange } from "./change.js";
import { scheduleModuleExportsChange } from "./import-export.js";
import { livelySystemEnv } from "./system.js";
import { getPackages } from "./packages.js";
import { isURL, join } from "./url-helpers.js";

export default function module(System, moduleName, parent) {
  var sysEnv = livelySystemEnv(System),
      id = System.decanonicalize(moduleName, parent);
  return sysEnv.loadedModules[id] || (sysEnv.loadedModules[id] = new ModuleInterface(System, id));
}


// ModuleInterface is primarily used to provide an API that integrates the System
// loader state with lively.modules extensions.
// It does not hold any mutable state.
class ModuleInterface {

  constructor(System, id) {
    // We assume module ids to be a URL with a scheme
    if (!isURL(id))
      throw new Error(`ModuleInterface constructor called with ${id} that does not seem to be a fully normalized module id.`);
    this.System = System;
    this.id = id;

    // Under what variable name the recorder becomes available during module
    // execution and eval
    this.recorderName = "__lvVarRecorder";
    this._recorder = null;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // properties
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  // returns Promise<string>
  fullName() { return this.id; }

  // returns Promise<string>
  source() {
    if (this.id.match(/^http/) && this.System.global.fetch) {
      return this.System.global.fetch(this.id).then(res => res.text());
    }
    if (this.id.match(/^file:/) && this.System.get("@system-env").node) {
      const path = this.id.replace(/^file:\/\//, "");
      return new Promise((resolve, reject) =>
        this.System._nodeRequire("fs").readFile(path, (err, content) =>
          err ? reject(err) : resolve(String(content))));
    }
    return Promise.reject(new Error(`Cannot retrieve source for ${this.id}`));
  }

  async ast() {
    return parse(await this.source());
  }

  metadata() {
    var load = this.System.loads ? this.System.loads[this.id] : null;
    return load ? load.metadata : null;
  }

  format() {
    // assume esm by default
    var meta = this.metadata();
    return meta ? meta.format : "esm";
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // loading
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async load() {
    return this.System.get(this.id) || await this.System.import(this.id);
  }

  isLoaded() { return !!this.System.get(this.id); }

  unloadEnv() {
    this._recorder = null;
    // FIXME this shouldn't be necessary anymore....
    delete livelySystemEnv(this.System).loadedModules[this.id];
  }

  unloadDeps(opts) {
    opts = obj.merge({forgetDeps: true, forgetEnv: true}, opts);
    this.dependents().forEach(ea => {
      this.System.delete(ea.id);
      if (this.System.loads) delete this.System.loads[ea.id];
      if (opts.forgetEnv) ea.unloadEnv();
    });
  }

  unload(opts) {
    opts = obj.merge({forgetDeps: true, forgetEnv: true}, opts);
    if (opts.forgetDeps) this.unloadDeps(opts);
    this.System.delete(this.id);
    if (this.System.loads) {
      delete this.System.loads[this.id];
    }
    if (this.System.meta)
      delete this.System.meta[this.id];
    if (opts.forgetEnv)
      this.unloadEnv();
  }

  async reload(opts) {
    opts = obj.merge({reloadDeps: true, resetEnv: true}, opts);
    var toBeReloaded = [this];
    if (opts.reloadDeps) toBeReloaded = this.dependents().concat(toBeReloaded);
    this.unload({forgetDeps: opts.reloadDeps, forgetEnv: opts.resetEnv});
    await Promise.all(toBeReloaded.map(ea => ea.id !== this.id && ea.load()));
    await this.load();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // change
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async changeSourceAction(changeFunc) {
    const source = await this.source(),
          newSource = await changeFunc(source);
    return this.changeSource(newSource, {evaluate: true});
  }

  async changeSource(newSource, options) {
    const oldSource = await this.source();
    return moduleSourceChange(this.System, this.id, oldSource, newSource, this.format(), options);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // dependencies
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  dependents() {
    // which modules (module ids) are (in)directly import module with id
    // Let's say you have
    // module1: export var x = 23;
    // module2: import {x} from "module1.js"; export var y = x + 1;
    // module3: import {y} from "module2.js"; export var z = y + 1;
    // `dependents` gives you an answer what modules are "stale" when you
    // change module1 = module2 + module3
    return graph.hull(graph.invert(computeRequireMap(this.System)), this.id)
            .map(mid => module(this.System, mid));
  }

  requirements() {
    // which modules (module ids) are (in)directly required by module with id
    // Let's say you have
    // module1: export var x = 23;
    // module2: import {x} from "module1.js"; export var y = x + 1;
    // module3: import {y} from "module2.js"; export var z = y + 1;
    // `module("./module3").requirements()` will report ./module2 and ./module1
    return graph.hull(computeRequireMap(this.System), this.id)
            .map(mid => module(this.System, mid));
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module environment
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  // What variables to not transform during execution, i.e. what variables
  // should not be accessed as properties of recorder
  get dontTransform() {
    return [
      "__lvVarRecorder",
      "global", "self",
      "_moduleExport", "_moduleImport",
      "fetch" // doesn't like to be called as a method, i.e. __lvVarRecorder.fetch
    ].concat(query.knownGlobals);
  }

  // FIXME... better to make this read-only, currently needed for loading
  // global modules, from instrumentation.js
  set recorder(v) { return this._recorder = v; }

  get recorder() {
    if (this._recorder) return this._recorder;

    const S = this.System;
    return this._recorder = Object.create(S.global, {

      System: {configurable: true, writable: true, value: S},

      _moduleExport: {
        value: (name, val) => {
          scheduleModuleExportsChange(S, this.id, name, val, true/*add export*/);
        }
      },

      _moduleImport: {
        value: (depName, key) => {
          var depId = S.normalizeSync(depName, this.id),
              depExports = S._loader.modules[depId];
          if (!depExports)
            throw new Error(`import of ${key} failed: ${depName} (tried as ${this.id}) is not loaded!`);
          if (key == undefined)
            return depExports.module;
          if (!depExports.module.hasOwnProperty(key))
            console.warn(`import from ${depExports}: Has no export ${key}!`);
          return depExports.module[key];
        }
      }

    });
  }

  define(varName, value) { return this.recorder[varName] = value; }
  undefine(varName) { delete this.recorder[varName]; }

  env() { return this; }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // package related
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  package() {
    return getPackages(this.System).find(ea =>
      ea.modules.some(mod => mod.name === this.id));
  }

  pathInPackage() {
    var p = this.package();
    return p && this.id.indexOf(p.address) === 0 ?
      join("./", this.id.slice(p.address.length)) :
      this.id;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // imports and exports
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async imports(optAstOrSource) {
    const parsed = optAstOrSource ?
            (typeof optAstOrSource === "string" ?
              parse(optAstOrSource) : optAstOrSource) :
            await this.ast(),
          scope = query.scopes(parsed),
          imports = scope.importDecls.reduce((imports, node) => {
            var nodes = query.nodesAtIndex(parsed, node.start),
                importStmt = arr.without(nodes, scope.node)[0];
            if (!importStmt) return imports;

            var from = importStmt.source ? importStmt.source.value : "unknown module";
            if (!importStmt.specifiers.length) // no imported vars
              return imports.concat([{
                local:      null,
                imported:   null,
                fromModule: from
              }]);

            return imports.concat(importStmt.specifiers.map(importSpec => {
              var imported;
              if (importSpec.type === "ImportNamespaceSpecifier") imported = "*";
              else if (importSpec.type === "ImportDefaultSpecifier" ) imported = "default";
              else if (importSpec.type === "ImportSpecifier" ) imported = importSpec.imported.name;
              else if (importStmt.source) imported = importStmt.source.name;
              else imported = null;
              return {
                local:      importSpec.local ? importSpec.local.name : null,
                imported:   imported,
                fromModule: from
              }
            }))
          }, []);

    return arr.uniqBy(imports, (a, b) =>
      a.local == b.local && a.imported == b.imported && a.fromModule == b.fromModule);

  }

  async exports(optAstOrSource) {

    const parsed = optAstOrSource ?
            (typeof optAstOrSource === "string" ?
              parse(optAstOrSource) : optAstOrSource) :
            await this.ast(),
          scope = query.scopes(parsed),
          exports = scope.exportDecls.reduce((exports, node) => {

      var exportsStmt = query.statementOf(scope.node, node);
      if (!exportsStmt) return exports;

      var from = exportsStmt.source ? exportsStmt.source.value : null;

      if (exportsStmt.type === "ExportAllDeclaration") {
        return exports.concat([{
          local:           null,
          exported:        "*",
          fromModule:      from
        }])
      }

      if (exportsStmt.specifiers && exportsStmt.specifiers.length) {
        return exports.concat(exportsStmt.specifiers.map(exportSpec => {
          return {
            local:           from ? null : exportSpec.local ? exportSpec.local.name : null,
            exported:        exportSpec.exported ? exportSpec.exported.name : null,
            fromModule:      from
          }
        }))
      }

      if (exportsStmt.declaration && exportsStmt.declaration.declarations) {
        return exports.concat(exportsStmt.declaration.declarations.map(decl => {
          return {
            local:           decl.id.name,
            exported:        decl.id.name,
            type:            exportsStmt.declaration.kind,
            fromModule:      null
          }
        }))
      }

      if (exportsStmt.declaration) {
        return exports.concat({
          local:           exportsStmt.declaration.id.name,
          exported:        exportsStmt.declaration.id.name,
          type:            exportsStmt.declaration.type === "FunctionDeclaration" ?
                            "function" : exportsStmt.declaration.type === "ClassDeclaration" ?
                              "class" : null,
          fromModule:      null
        })
      }
      return exports;
    }, []);

    return arr.uniqBy(exports, (a, b) =>
      a.local == b.local && a.exported == b.exported && a.fromModule == b.fromModule);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module records
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  record() {
    const rec = this.System._loader.moduleRecords[this.id];
    if (!rec) return null;
    if (!rec.hasOwnProperty("__lively_modules__"))
      rec.__lively_modules__ = {evalOnlyExport: {}};
    return rec;
  }

  updateRecord(doFunc) {
    var record = this.record();
    if (!record) throw new Error(`es6 environment global of ${this.id}: module not loaded, cannot get export object!`);
    record.locked = true;
    try {
      return doFunc(record);
    } finally { record.locked = false; }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // search
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async search(searchStr) {
    const src = await this.source();
    let re;
    if (searchStr instanceof RegExp) {
      let flags = 'g'; // add 'g' flag
      if (searchStr.ignoreCase) flags += 'i';
      if (searchStr.multiline) flags += 'm';
      re = RegExp(searchStr.source, flags);
    } else {
      re = RegExp(searchStr, 'g');
    }

    let match, res = [];
    while ((match = re.exec(src)) !== null) {
      res.push([match.index, match[0].length]);
    }
    for (let i = 0, j = 0, line = 1, start = 0; i < src.length && j < res.length; i++) {
      if (src[i] == '\n') {
        line++;
        start = i + 1;
      }
      const [idx, length] = res[j];
      if (i == idx) {
        res[j] = { file: this.id, line, column: i - start, length };
        j++;
      }
    }
    return res;
  }
}