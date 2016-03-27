import { obj, arr } from "lively.lang";
import { getSystem } from "./src/system.js";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// module access
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function moduleRecordFor(System, fullname) {
  System = getSystem(System);
  var record = System._loader.moduleRecords[fullname];
  if (!record) return null;
  return record;
}

function updateModuleRecordOf(fullname, doFunc) {
  var record = moduleRecordFor(fullname);
  if (!record) throw new Error(`es6 environment global of ${fullname}: module not loaded, cannot get export object!`);
  record.locked = true;
  try {
    doFunc(record);
  } finally { record.locked = false; }
}

function sourceOf(System, moduleName, parent) {
  System = getSystem(System);
  return System.normalize(moduleName, parent)
    .then(id => {
      var load = (System.loads && System.loads[id]) || {
        status: 'loading', address: id, name: id,
        linkSets: [], dependencies: [], metadata: {}};
      return System.fetch(load);
    });
}


export {
  moduleRecordFor,
  updateModuleRecordOf,
  sourceOf
}
