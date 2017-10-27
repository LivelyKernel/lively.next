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
        if (obj) return {executed: true, exports: obj, dependencies: []};
      }
      if (G.System) {
        let obj = G.System.get(G.System.decanonicalize(name, parentName));
        if (obj) return {executed: true, exports: obj, dependencies: []};
      }
      throw new Error(`Module ${name} cannot be found in lively.freezer bundle!`)
    },
    register(id, dependencies, defineFn) {
      let module = this.add(id, dependencies),
          body = defineFn((name, val) => {
            if (typeof name === "string") {
              module.exports[name] = val
            } else {
              // * export
              for (let prop in name) module.exports[prop] = name[prop];
            }
          });
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
    sortForLoad(entry) {
      let g = {}, r = lively.FreezerRuntime.registry
      for (let modName in r) g[modName] = r[modName].dependencies;
      return linearizeGraph(g, entry);
      function linearizeGraph(depGraph, startNode) {
        // establish unique list of keys
        var remaining = [], remainingSeen = {}, uniqDepGraph = {}, inverseDepGraph = {};
        for (let key in depGraph) {
          if (!remainingSeen.hasOwnProperty(key)) { remainingSeen[key] = true; remaining.push(key); }
          var deps = depGraph[key], uniqDeps = {};
          if (deps) {
            uniqDepGraph[key] = [];
            for (let dep of deps) {
              if (uniqDeps.hasOwnProperty(dep) || key === dep) continue;
              let inverse = inverseDepGraph[dep] || (inverseDepGraph[dep] = []);
              if (!inverse.includes(key)) inverse.push(key);
              uniqDeps[dep] = true;
              uniqDepGraph[key].push(dep);
              if (!remainingSeen.hasOwnProperty(dep)) {
                remainingSeen[dep] = true;
                remaining.push(dep);
              }
            }
          }
        }
        // for each iteration find the keys with the minimum number of dependencies
        // and add them to the result group list
        var groups = [];
        while (remaining.length) {
          var minDepCount = Infinity, minKeys = [], minKeyIndexes = [], affectedKeys = [];
          for (var i = 0; i < remaining.length; i++) {
            var key = remaining[i];
            let deps = uniqDepGraph[key] || [];
            if (deps.length > minDepCount) continue;
      
            // if (deps.length === minDepCount && !minKeys.some(ea => deps.includes(ea))) {
            if (deps.length === minDepCount && !deps.some(ea => minKeys.includes(ea))) {
              minKeys.push(key);
              minKeyIndexes.push(i);
              affectedKeys.push(...inverseDepGraph[key] || []);
              continue;
            }
            minDepCount = deps.length;
            minKeys = [key];
            minKeyIndexes = [i];
            affectedKeys = (inverseDepGraph[key] || []).slice();
          }
          for (var i = minKeyIndexes.length; i--;) {
            var key = remaining[minKeyIndexes[i]];
            inverseDepGraph[key] = [];
            remaining.splice(minKeyIndexes[i], 1);
          }
          for (var key of affectedKeys) {
            uniqDepGraph[key] = uniqDepGraph[key].filter(ea => !minKeys.includes(ea));
          }
          groups.push(...minKeys);
        }
        return groups;
      }
    },

    load(moduleId) {
      let modulesToLoad = this.sortForLoad(moduleId);
      for (let modName of modulesToLoad) {
        let m = this.get(modName);
        if (!m || m.executed) continue;
        this.updateImports(m);
        m.execute();
      }
      return this.get(moduleId).exports;
      
      // let entry = this.resolveSync(moduleId);
      // let moduleList = [entry], modulesToImport = [];
      // while (moduleList.length) {
      //   let next = moduleList.shift();
      //   if (next.executed) continue;
      //   modulesToImport.unshift(next);
      //   for (let depId of next.dependencies) {
      //     let depMod = this.resolveSync(depId, next.id);
      //     if (!depMod.executed) moduleList.push(depMod);
      //   }
      // }
      // for (let m of modulesToImport) {
      //   this.updateImports(m);
      //   m.execute();
      // }
      // return entry.exports;
    }
  }
}
