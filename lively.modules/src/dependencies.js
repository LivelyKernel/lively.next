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

  return Object.keys(System._loader.moduleRecords).reduce((requireMap, k) => {
    requireMap[k] = System._loader.moduleRecords[k].dependencies.filter(Boolean).map(ea => ea.name);
    return requireMap;
  }, {});
}

export { computeRequireMap };
