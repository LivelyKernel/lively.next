import module from './module.js';
import { obj } from 'lively.lang';

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// Changing exports of module
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export function scheduleModuleExportsChange (System, moduleId, nameOrValues, value, addNewExport) {
  let pendingExportChanges = System.get('@lively-env').pendingExportChanges;
  let rec = module(System, moduleId).record();
  if (rec && (nameOrValues in rec.exports || addNewExport)) {
    let pending = pendingExportChanges[moduleId] || (pendingExportChanges[moduleId] = {});
    if (obj.isString(nameOrValues)) {
      pending[nameOrValues] = value;
    } else {
      for (let name in nameOrValues) {
        pending[name] = nameOrValues[name];
      }
    }
  }
}

function clearPendingModuleExportChanges (System, moduleId) {
  let pendingExportChanges = System.get('@lively-env').pendingExportChanges;
  delete pendingExportChanges[moduleId];
}

function updateModuleExports (System, moduleId, keysAndValues) {
  let debug = System.debug;
  module(System, moduleId).updateRecord((record) => {
    let newExports = []; let existingExports = [];

    Object.keys(keysAndValues).forEach(name => {
      let value = keysAndValues[name];
      debug && console.log('[lively.vm es6 updateModuleExports] %s export %s = %s', moduleId, name, String(value).slice(0, 30).replace(/\n/g, '') + '...');

      let isNewExport = !(name in record.exports);
      if (isNewExport) record.__lively_modules__.evalOnlyExport[name] = true;
      // var isEvalOnlyExport = record.__lively_vm__.evalOnlyExport[name];
      record.exports[name] = value;

      if (isNewExport) newExports.push(name);
      else existingExports.push(name);
    });

    // if it's a new export we don't need to update dependencies, just the
    // module itself since no depends know about the export...
    // HMM... what about *-imports?
    if (newExports.length) {
      let m = System.get(moduleId);
      if (Object.isFrozen(m)) {
        console.warn('[lively.vm es6 updateModuleExports] Since module %s is frozen a new module object was installed in the system. Note that only(!) exisiting module bindings are updated. New exports that were added will only be available in already loaded modules after those are reloaded!', moduleId);
        System.set(moduleId, System.newModule(record.exports));
      } else {
        debug && console.log('[lively.vm es6 updateModuleExports] adding new exports to %s', moduleId);
        newExports.forEach(name => {
          Object.defineProperty(m, name, {
            configurable: false,
            enumerable: true,
            get () { return record.exports[name]; },
            set () { throw new Error('exports cannot be changed from the outside'); }
          });
        });
      }
    }

    if (existingExports.length) {
      debug && console.log('[lively.vm es6 updateModuleExports] updating %s dependents of %s', record.importers.length, moduleId);
      for (let i = 0, l = record.importers.length; i < l; i++) {
        let importerModule = record.importers[i];
        let importerIndex;
        if (!importerModule.locked) {
          // via the module bindings to importer modules we refresh the values
          // bound in those modules by triggering the setters defined in the
          // records of those modules
          let found = importerModule.dependencies.some((dep, i) => {
            importerIndex = i;
            return dep && dep.name === record.name;
          });

          if (found) {
            if (debug) {
              let mod = module(System, importerModule.name);
              console.log(`[lively.vm es6 updateModuleExports] calling setters of ${mod.package().name}/${mod.pathInPackage()}`);
            }

            // We could run the entire module again with
            //   importerModule.execute();
            // but this has too many unwanted side effects, so just run the
            // setters:
            module(System, importerModule.name).evaluationStart();
            importerModule.setters[importerIndex](record.exports);
            module(System, importerModule.name).evaluationEnd();
          }
        }
      }
    }
  });
}

export function runScheduledExportChanges (System, moduleId) {
  let pendingExportChanges = System.get('@lively-env').pendingExportChanges;
  let keysAndValues = pendingExportChanges[moduleId];
  if (!keysAndValues) return;
  clearPendingModuleExportChanges(System, moduleId);
  updateModuleExports(System, moduleId, keysAndValues);
}
