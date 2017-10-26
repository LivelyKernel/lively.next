/*global self,global*/

/*

Code in here will not be directly executed but stringified and embedded in bundles!

*/
 
export function runtimeDefinition() {
  var G = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  if (typeof G.lively !== "object") G.lively = {};
  var version, registry = {};

  if (G.lively.FreezerRuntime) {
    let [myMajor, myMinor, myPatch] = version.split(".").map(Number),
        [otherMajor, otherMinor, otherPatch] = G.lively.FreezerRuntime.version.split(".").map(Number),
        update = false;
    if (isNaN(otherMajor) || (!isNaN(myMajor) && myMajor > otherMajor)) update = true;
    if (!update && (isNaN(otherMinor) || (!isNaN(myMinor) && myMinor > otherMinor))) update = true;
    if (!update && (isNaN(otherPatch) || (!isNaN(myPatch) && myPatch > otherPatch))) update = true;
    if (!update) return;
    registry = G.lively.FreezerRuntime.registry;
  }

  G.lively.FreezerRuntime = {
    version, registry,
    get(moduleId) { return this.registry[moduleId]; },
    set(moduleId, module) { return this.registry[moduleId] = module; },
    add(id, dependencies = [], exports = {}, executed = false) {
      let module = {id, dependencies, executed, exports, execute: () => {}, setters: []};
      this.set(id, module);
      return module;
    },
    resolveSync(name, parentName) {
      let mod = this.get(name);
      if (mod) return mod;
      // try global
      if (!name.includes("/")) {
        let parts = name.split("."), obj = G;
        while (obj && parts.length) obj = obj[parts.shift()];
        if (obj) return obj;
      }
      if (G.System) {
        let obj = G.System.get(G.System.decanonicalize(name, parentName));
        if (obj) return obj;
      }
      throw new Error(`Module ${name} cannot be found in lively.freezer bundle!`)
    },
    register(id, dependencies, defineFn) {
      let module = this.add(id, dependencies),
          body = defineFn((name, val) => module.exports[name] = val);
      module.execute = body.execute;
      module.setters = body.setters;
      return module;
    },
    updateImports(module) {
      for (let i = 0; i < module.dependencies.length; i++) {
        let depName = module.dependencies[i],
            mod = this.resolveSync(depName, module.id);
        module.setters[i](mod.exports);
      }
    },
    load(moduleId) {
      let entry = this.resolveSync(moduleId);
      let moduleList = [entry], modulesToImport = [];
      while (moduleList.length) {
        let next = moduleList.shift();
        if (next.executed) continue;
        modulesToImport.unshift(next);
        for (let depId of next.dependencies) {
          let depMod = this.resolveSync(depId, next.id);
          if (!depMod.executed) moduleList.push(depMod);
        }
      }
      for (let m of modulesToImport) {
        this.updateImports(m);
        m.execute();
      }
      return entry.exports;
    }
  }
}
