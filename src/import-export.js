import { moduleRecordFor, updateModuleRecordOf } from "./system.js"

export { runScheduledExportChanges, scheduleModuleExportsChange };

function scheduleModuleExportsChange(System, moduleId, name, value, addNewExport) {
  var pendingExportChanges = System["__lively.modules__"].pendingExportChanges,
      rec = moduleRecordFor(System, moduleId);
  if (rec && (name in rec.exports || addNewExport)) {
    var pending = pendingExportChanges[moduleId] || (pendingExportChanges[moduleId] = {});
    pending[name] = value;
  }
}

function runScheduledExportChanges(System, moduleId) {
  var pendingExportChanges = System["__lively.modules__"].pendingExportChanges,
      keysAndValues = pendingExportChanges[moduleId];
  if (!keysAndValues) return;
  clearPendingModuleExportChanges(System ,moduleId);
  updateModuleExports(System, moduleId, keysAndValues);
}

function clearPendingModuleExportChanges(System, moduleId) {
  var pendingExportChanges = System["__lively.modules__"].pendingExportChanges;
  delete pendingExportChanges[moduleId];
}

function updateModuleExports(System, moduleId, keysAndValues) {
  var debug = System["__lively.modules__"].debug;

  updateModuleRecordOf(System, moduleId, (record) => {

    var newExports = [], existingExports = [];

    Object.keys(keysAndValues).forEach(name => {
      var value = keysAndValues[name];
      debug && console.log("[lively.vm es6 updateModuleExports] %s export %s = %s", moduleId, name, String(value).slice(0,30).replace(/\n/g, "") + "...");

      var isNewExport = !(name in record.exports);
      if (isNewExport) record.__lively_vm__.evalOnlyExport[name] = true;
      // var isEvalOnlyExport = record.__lively_vm__.evalOnlyExport[name];
      record.exports[name] = value;

      if (isNewExport) newExports.push(name);
      else existingExports.push(name);
    });


    // if it's a new export we don't need to update dependencies, just the
    // module itself since no depends know about the export...
    // HMM... what about *-imports?
    newExports.forEach(name => {
      var oldM = System._loader.modules[moduleId].module,
          m = System._loader.modules[moduleId].module = new oldM.constructor(),
          pNames = Object.getOwnPropertyNames(record.exports);
      for (var i = 0; i < pNames.length; i++) (function(key) {
        Object.defineProperty(m, key, {
          configurable: false, enumerable: true,
          get() { return record.exports[key]; }
        });
      })(pNames[i]);
      // Object.defineProperty(System._loader.modules[fullname].module, name, {
      //   configurable: false, enumerable: true,
      //   get() { return record.exports[name]; }
      // });
    });

    // For exising exports we find the execution func of each dependent module and run that
    // FIXME this means we run the entire modules again, side effects and all!!!
    if (existingExports.length) {
      debug && console.log("[lively.vm es6 updateModuleExports] updating %s dependents of %s", record.importers.length, moduleId);
      for (var i = 0, l = record.importers.length; i < l; i++) {
        var importerModule = record.importers[i];
        if (!importerModule.locked) {
          var importerIndex = importerModule.dependencies.indexOf(record);
          importerModule.setters[importerIndex](record.exports);
          importerModule.execute();
        }
      }
    }

  });
}
