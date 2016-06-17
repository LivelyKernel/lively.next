import * as ast from "lively.ast";
import { arr, obj, graph } from "lively.lang";
import { computeRequireMap } from  "./dependencies.js";
import { moduleSourceChange } from "./change.js";
import { scheduleModuleExportsChange } from "./import-export.js";

const urlTester = /[a-z][a-z0-9\+\-\.]/i;

function isURL(id) { return urlTester.test(id); }

export default function module(System, moduleName, parent) {
  return new ModuleInterface(System, System.decanonicalize(moduleName, parent));
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
    return ast.parse(await this.source());
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
    delete this.System.get("@lively-env").loadedModules[this.id];
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

  env() {
    const ext = this.System.get("@lively-env");
    if (ext.loadedModules[this.id]) return ext.loadedModules[this.id];

    const env = {
      loadError: undefined,
      recorderName: "__lvVarRecorder",
      dontTransform: [
        "__lvVarRecorder",
        "global", "self",
        "_moduleExport", "_moduleImport",
        "fetch" // doesn't like to be called as a method, i.e. __lvVarRecorder.fetch
      ].concat(ast.query.knownGlobals),
      recorder: Object.create(this.System.global, {
        _moduleExport: {
          get() {
            return (name, val) => {
              scheduleModuleExportsChange(this.System, this.id, name, val, true/*add export*/);
            }
          }
        },
        _moduleImport: {
          get: function() {
            return (imported, name) => {
              var id = this.System.normalizeSync(imported, this.id),
                  imported = this.System._loader.modules[id];
              if (!imported) throw new Error(`import of ${name} failed: ${imported} (tried as ${id}) is not loaded!`);
              if (name == undefined) return imported.module;
              if (!imported.module.hasOwnProperty(name))
                console.warn(`import from ${imported}: Has no export ${name}!`);
              return imported.module[name];
            }
          }
        }
      })
    }

    env.recorder.System = this.System;
    return ext.loadedModules[this.id] = env;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // imports and exports
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async imports() {
    const parsed = await this.ast(),
          scope = ast.query.scopes(parsed),
          imports = scope.importDecls.reduce((imports, node) => {
            var nodes = ast.query.nodesAtIndex(parsed, node.start),
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

  async exports() {
    const parsed = await this.ast(),
          scope = ast.query.scopes(parsed),
          exports = scope.exportDecls.reduce((exports, node) => {

      var exportsStmt = ast.query.statementOf(scope.node, node);
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
    const record = this.System._loader.moduleRecords[this.id];
    if (!record) return null;
    if (!record.hasOwnProperty("__lively_modules__"))
      record.__lively_modules__ = {evalOnlyExport: {}};
    return record;
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
    const src = await this.source(),
          re = new RegExp(searchStr, "g");
    let match, res = [];
    while ((match = re.exec(src)) !== null) {
      res.push(match.index);
    }
    for (let i = 0, j = 0, line = 1; i < src.length && j < res.length; i++) {
      if (src[i] == '\n') line++;
      if (i == res[j]) {
        res[j] = this.id + ":" + line;
        j++;
      }
    }
    return res;
  }
}