import { graph, arr, obj } from "lively.lang";
import { loadedModules } from "./system.js";

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

export { computeRequireMap };
