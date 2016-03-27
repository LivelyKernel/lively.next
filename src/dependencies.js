import { graph, arr } from "lively.lang";
import { loadedModules } from "./system.js";
export { findDependentsOf, findRequirementsOf, computeRequireMap };

// function forgetModuleDeps(moduleName, opts) {
//   opts = obj.merge({forgetDeps: true, forgetEnv: true}, opts)
//   var id = resolve(moduleName),
//       deps = findDependentsOf(id);
//   deps.forEach(ea => {
//     currentSystem().delete(ea);
//     if (currentSystem().loads) delete currentSystem().loads[ea];
//     opts.forgetEnv && forgetEnvOf(ea);
//   });
//   return id;
// }

// function forgetModule(moduleName, opts) {
//   opts = obj.merge({forgetDeps: true, forgetEnv: true}, opts);
//   var id = opts.forgetDeps ? forgetModuleDeps(moduleName, opts) : resolve(moduleName);
//   currentSystem().delete(moduleName);
//   currentSystem().delete(id);
//   if (currentSystem().loads) {
//     delete currentSystem().loads[moduleName];
//     delete currentSystem().loads[id];
//   }
//   if (opts.forgetEnv) {
//     forgetEnvOf(id);
//     forgetEnvOf(moduleName);
//   }
// }

// function reloadModule(moduleName, opts) {
//   opts = obj.merge({reloadDeps: true, resetEnv: true}, opts);
//   var id = resolve(moduleName),
//       toBeReloaded = [id];
//   if (opts.reloadDeps) toBeReloaded = findDependentsOf(id).concat(toBeReloaded);
//   forgetModule(id, {forgetDeps: opts.reloadDeps, forgetEnv: opts.resetEnv});
//   return Promise.all(toBeReloaded.map(ea => ea !== id && importES6Module(ea)))
//       .then(() => importES6Module(id));
// }

// // function computeRequireMap() {
// //   return Object.keys(_currentSystem.loads).reduce((requireMap, k) => {
// //     requireMap[k] = lang.obj.values(_currentSystem.loads[k].depMap);
// //     return requireMap;
// //   }, {});
// // }

function computeRequireMap(System) {
  if (System.loads) {
    var store = System.loads,
        modNames = arr.uniq(Object.keys(loadedModules(System)).concat(Object.keys(store)));
    return modNames.reduce((requireMap, k) => {
      var depMap = store[k] ? store[k].depMap : {};
      requireMap[k] = Object.keys(depMap).map(localName => {
        var resolvedName = depMap[localName];
        if (resolvedName === "@empty") return `${resolvedName}/${localName}`;
        return resolvedName;
      })
      return requireMap;
    }, {});
  }

  return Object.keys(System._loader.moduleRecords).reduce((requireMap, k) => {
    requireMap[k] = System._loader.moduleRecords[k].dependencies.filter(Boolean).map(ea => ea.name);
    return requireMap;
  }, {});
}

function findDependentsOf(System, name) {
  // which modules (module ids) are (in)directly import module with id
  // Let's say you have
  // module1: export var x = 23;
  // module2: import {x} from "module1.js"; export var y = x + 1;
  // module3: import {y} from "module2.js"; export var z = y + 1;
  // `findDependentsOf` gives you an answer what modules are "stale" when you
  // change module1 = module2 + module3
  return System.normalize(name)
    .then(id => graph.hull(graph.invert(computeRequireMap(System)), id));
}

function findRequirementsOf(System, name) {
  // which modules (module ids) are (in)directly required by module with id
  // Let's say you have
  // module1: export var x = 23;
  // module2: import {x} from "module1.js"; export var y = x + 1;
  // module3: import {y} from "module2.js"; export var z = y + 1;
  // `findRequirementsOf("./module3")` will report ./module2 and ./module1
  return System.normalize(name)
    .then(id => graph.hull(computeRequireMap(System), id));
}
