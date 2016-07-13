import { parse, query } from "lively.ast";
import { arr, obj, graph } from "lively.lang";
import { computeRequireMap } from  "./dependencies.js";
import { moduleSourceChange } from "./change.js";
import { scheduleModuleExportsChange } from "./import-export.js";
import { livelySystemEnv } from "./system.js";
import { getPackages } from "./packages.js";
import { isURL, join } from "./url-helpers.js";
import { subscribe } from "./notify.js";

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

    if (!isURL(id) && !/^@/.test(id))
      throw new Error(`ModuleInterface constructor called with ${id} that does not seem to be a fully normalized module id.`);
    this.System = System;
    this.id = id;

    // Under what variable name the recorder becomes available during module
    // execution and eval
    this.recorderName = "__lvVarRecorder";
    this._recorder = null;
    
    // cached values
    this._source = null;
    this._ast = null;
    this._scope = null;
    
    subscribe(System, "modulechange", (data) => {
      if (data.module === this.id) this.reset();
    });
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // properties
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  // returns Promise<string>
  fullName() { return this.id; }

  // returns Promise<string>
  source() {
    // rk 2016-06-24:
    // We should consider using lively.resource here. Unfortunately
    // System.fetch (at least with the current systemjs release) will not work in
    // all cases b/c modules once loaded by the loaded get cached and System.fetch
    // returns "" in those cases

    if (this.id === "@empty") return Promise.resolve("")

    if (this._source) return Promise.resolve(this._source);
    if (this.id.match(/^http/) && this.System.global.fetch) {
      return this.System.global.fetch(this.id).then(res => res.text());
    }

    if (this.id.match(/^file:/) && this.System.get("@system-env").node) {
      const path = this.id.replace(/^file:\/\//, "");
      return new Promise((resolve, reject) =>
        this.System._nodeRequire("fs").readFile(path, (err, content) =>
          err ? reject(err) : resolve(this._source = String(content))));
    }

    if (this.id.match(/^lively:/) && typeof $world !== "undefined") {
      // This needs to go into a separate place for "virtual" lively modules
      var morphId = arr.last(this.id.split("/"));
      var m = $world.getMorphById(morphId);
      return Promise.resolve(m ? m.textContent : "");
    }

    return Promise.reject(new Error(`Cannot retrieve source for ${this.id}`));
  }

  async ast() {
    if (this._ast) return this._ast;
    return this._ast = parse(await this.source());
  }
  
  async scope() {
    if (this._scope) return this._scope;
    const ast = await this.ast();
    return this._scope = query.topLevelDeclsAndRefs(ast).scope;
  }
  
  async resolvedScope() {
    return this._scope = query.resolveReferences(await this.scope());
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
  
  reset() {
    this._source = null;
    this._ast = null;
    this._scope = null;
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
    opts = obj.merge({reset: true, forgetDeps: true, forgetEnv: true}, opts);
    if (opts.reset) this.reset();
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

  addDependencyToModuleRecord(dependency, setter = function() {}) {
    // `dependency is another module, setter is the function that gets
    // triggered when a dependency's binding changes so that "this" module is updated
    var record = this.record(),
        dependencyRecord = dependency.record();

    if (record && dependencyRecord) {
      // 1. update the record so that when its dependencies change and cause a
      // re-execute, the correct code (new version) is run
      var depIndex, hasDepenency = record.dependencies.some((ea, i) => {
        if (!ea) return; depIndex = i; return ea && ea.name === dependency.id; });
      if (!hasDepenency) {
        record.dependencies.push(dependencyRecord)
      } else if (dependencyRecord !== record.dependencies[depIndex] /*happens when a dep is reloaded*/)
        record.dependencies.splice(depIndex, 1, dependencyRecord);

      // setters are for updating module bindings, the position of the record
      // in dependencies should be the same as the position of the setter for that
      // dependency...
      if (!hasDepenency || !record.setters[depIndex])
        record.setters[hasDepenency ? depIndex : record.dependencies.length-1] = setter;

      // 2. update records of dependencies, so that they know about this module as an importer
      var impIndex, hasImporter = dependencyRecord.importers.some((imp, i) => {
        if (!imp) return; impIndex = i; return imp && imp.name === this.id });
      if (!hasImporter) dependencyRecord.importers.push(record);
      else if (record !== dependencyRecord.importers[impIndex])
        dependencyRecord.importers.splice(impIndex, 1, record);
    }
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
    ].concat(arr.withoutAll(query.knownGlobals, ["pt", "rect", "rgb", "$super", "show"]));
  }

  // FIXME... better to make this read-only, currently needed for loading
  // global modules, from instrumentation.js
  set recorder(v) { return this._recorder = v; }

  get recorder() {
    if (this._recorder) return this._recorder;

    const S = this.System, self = this;

    return this._recorder = Object.create(S.global, {

      System: {configurable: true, writable: true, value: S},

      _moduleExport: {
        value: (name, val) => {
          scheduleModuleExportsChange(S, self.id, name, val, true/*add export*/);
        }
      },

      _moduleImport: {
        value: (depName, key) => {
          var depId = S.decanonicalize(depName, self.id),
              depExports = S.get(depId);

          if (!depExports) {
            console.warn(`import of ${key} failed: ${depName} (tried as ${self.id}) is not loaded!`);
            return undefined;
          }

          self.addDependencyToModuleRecord(
            module(S, depId),
            // setter is only installed if there isn't a setter already. In
            // those cases we make sure that at least the module varRecorder gets
            // updated, which is good enough for "virtual modules"
            imports => Object.assign(self.recorder, imports));

          if (key == undefined) return depExports;

          if (!depExports.hasOwnProperty(key))
            console.warn(`import from ${depExports}: Has no export ${key}!`);

          return depExports[key];
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

  async imports() {
    const parsed = await this.ast(),
          scope = await this.scope();
    return query.imports(scope);
  }

  async exports() {
    const parsed = await this.ast(),
          scope = await this.scope();
    return query.exports(scope);
  }
  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // bindings
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async _localDeclForRefAt(pos) {
    const scope = await this.resolvedScope(),
          ref = query.refAt(pos, scope);
    if (ref && ref.decl) ref.decl.module = this;
    return ref && {decl: ref.decl, id: ref.declId};
  }
  
  async _importForNSRefAt(pos) {
    // if pos points to "x" of a property "m.x" with an import * as "m"
    // then this returns [<importStmt>, <m>, "x"]
    const scope = await this.resolvedScope(),
          ast = scope.node,
          nodes = query.nodesAtIndex(ast, pos);
    if (nodes.length < 2) return [null, null];
    const id = nodes[nodes.length - 1],
          member = nodes[nodes.length - 2];
    if (id.type != "Identifier" ||
        member.type != "MemberExpression" ||
        member.computed ||
        member.object.type !== "Identifier" ||
        !member.object.decl ||
        member.object.decl.type !== "ImportDeclaration") {
      return [null, null];
    }
    const name = member.object.name,
          spec = member.object.decl.specifiers.find(s => s.local.name === name);
    if (spec.type !== "ImportNamespaceSpecifier") return [null, null];
    return [member.object.decl, spec.local, id.name];
  }

  async _resolveImportedDecl(decl) {
    if (!decl) return [];
    const {start, name, type} = decl.id;
    const imports = await this.imports(),
          im = imports.find(i => i.node.start == start && // can't rely on
                                 i.node.name == name &&   // object identity
                                 i.node.type == type);
    if (im) {
      const imM = module(this.System, im.fromModule, this.id);
      return [decl].concat(await imM.bindingPathForExport(im.imported));
    }
    return [decl];
  }

  async bindingPathForExport(name) {
    await this.resolvedScope();
    const exports = await this.exports(),
          ex = exports.find(e => e.exported === name);
    if (ex.fromModule) {
      const imM = module(this.System, ex.fromModule, this.id);
      const decl = {decl: ex.node, id: ex.declId};
      decl.decl.module = this;
      return [decl].concat(await imM.bindingPathForExport(ex.imported));
    } else {
      if (ex && ex.decl) ex.decl.module = this;
      return this._resolveImportedDecl({decl: ex.decl, id: ex.declId});
    }
  }

  async bindingPathForRefAt(pos) {
    const decl = await this._localDeclForRefAt(pos);
    if (decl) {
      return await this._resolveImportedDecl(decl);
    } else {
      const [imDecl, id, name] = await this._importForNSRefAt(pos);
      if (!imDecl) return [];
      imDecl.module = this;
      const imM = module(this.System, imDecl.source.value, this.id);
      return [{decl: imDecl, id}].concat(await imM.bindingPathForExport(name));
    }
  }
  
  async definitionForRefAt(pos) {
    const path = await this.bindingPathForRefAt(pos);
    if (path.length < 1) return null;
    return path[path.length - 1].decl;
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

  async search(searchStr, options) {
    options = Object.assign({excludedModules: []}, options);

    if (options.excludedModules.some(ex => {
        if (typeof ex === "string") return ex === this.id;
        if (ex instanceof RegExp) return ex.test(this.id);
        return false;
      })) return [];

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
    while ((match = re.exec(src)) !== null)
      res.push([match.index, match[0].length]);

    for (let i = 0, j = 0, line = 1, lineStart = 0;
         i < src.length && j < res.length;
         i++) {
      if (src[i] == '\n') {
        line++;
        lineStart = i + 1;
      }
      const [idx, length] = res[j];
      if (i !== idx) continue;
      var lineEnd = src.slice(lineStart).indexOf("\n");
      if (lineEnd === -1) lineEnd = src.length;
      else lineEnd += lineStart;
      res[j] = {
        module: this,
        length,
        line, column: i - lineStart,
        lineString: src.slice(lineStart, lineEnd)
      };
      j++;
    }

    return res;
  }
  
  toString() { return `module(${this.id})`; }
}
