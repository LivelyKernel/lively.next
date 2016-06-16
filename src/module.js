import { graph } from "lively.lang";
import { computeRequireMap } from './dependencies.js';

// Module class is primarily used to provide a nice API
// It does not hold any mutable state
export default class Module {
  constructor(System, id) {
    this.System = System;
    this.id = id;
  }
  
  source(parent) {
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
  
  get metadata() {
    var load = this.System.loads ? this.System.loads[this.id] : null;
    return load ? load.metadata : null;
  }
  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // dependencies
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  
  get dependents() {
    // which modules (module ids) are (in)directly import module with id
    // Let's say you have
    // module1: export var x = 23;
    // module2: import {x} from "module1.js"; export var y = x + 1;
    // module3: import {y} from "module2.js"; export var z = y + 1;
    // `findDependentsOf` gives you an answer what modules are "stale" when you
    // change module1 = module2 + module3
    return graph.hull(graph.invert(computeRequireMap(this.System)), this.id);
  }

  get requirementsOf() {
    // which modules (module ids) are (in)directly required by module with id
    // Let's say you have
    // module1: export var x = 23;
    // module2: import {x} from "module1.js"; export var y = x + 1;
    // module3: import {y} from "module2.js"; export var z = y + 1;
    // `findRequirementsOf("./module3")` will report ./module2 and ./module1
    return graph.hull(computeRequireMap(this.System), this.id);
  }
  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module environment
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  get env() {
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
  // module records
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  
  get record() {
    const record = this.System._loader.moduleRecords[this.id];
    if (!record) return null;
    if (!record.hasOwnProperty("__lively_modules__"))
      record.__lively_modules__ = {evalOnlyExport: {}};
    return record;
  }
  
  updateModuleRecordOf(doFunc) {
    var record = this.record;
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
    const re = new RegExp(searchStr, "g");
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