import { arr } from 'lively.lang';
import { loadedModules } from './system.js';

function computeRequireMap (System) {
  if (System.loads) {
    let store = System.loads;
    let modNames = arr.uniq(Object.keys(loadedModules(System)).concat(Object.keys(store)));
    return modNames.reduce((requireMap, k) => {
      let depMap = store[k] ? store[k].depMap : {};
      requireMap[k] = Object.keys(depMap).map(localName => {
        let resolvedName = depMap[localName];
        if (resolvedName === '@empty') return `${resolvedName}/${localName}`;
        return resolvedName;
      });
      return requireMap;
    }, {});
  }

  // A fresh loader has no dependency records until its first import.
  const records = System._loader?.moduleRecords || {};
  return Object.keys(records).reduce((requireMap, k) => {
    requireMap[k] = records[k].dependencies.filter(Boolean).map(ea => ea.name);
    return requireMap;
  }, {});
}

export { computeRequireMap };
