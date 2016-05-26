import * as ast from "lively.ast";
import { arr } from "lively.lang"
import { moduleRecordFor, updateModuleRecordOf, sourceOf } from "./system.js"

export { runScheduledExportChanges, scheduleModuleExportsChange, importsAndExportsOf };

function scheduleModuleExportsChange(System, moduleId, name, value, addNewExport) {
  var pendingExportChanges = System.get("@lively-env").pendingExportChanges,
      rec = moduleRecordFor(System, moduleId);
  if (rec && (name in rec.exports || addNewExport)) {
    var pending = pendingExportChanges[moduleId] || (pendingExportChanges[moduleId] = {});
    pending[name] = value;
  }
}

function runScheduledExportChanges(System, moduleId) {
  var pendingExportChanges = System.get("@lively-env").pendingExportChanges,
      keysAndValues = pendingExportChanges[moduleId];
  if (!keysAndValues) return;
  clearPendingModuleExportChanges(System, moduleId);
  updateModuleExports(System, moduleId, keysAndValues);
}

function clearPendingModuleExportChanges(System, moduleId) {
  var pendingExportChanges = System.get("@lively-env").pendingExportChanges;
  delete pendingExportChanges[moduleId];
}

function updateModuleExports(System, moduleId, keysAndValues) {
  var debug = System.debug;
  updateModuleRecordOf(System, moduleId, (record) => {

    var newExports = [], existingExports = [];

    Object.keys(keysAndValues).forEach(name => {
      var value = keysAndValues[name];
      debug && console.log("[lively.vm es6 updateModuleExports] %s export %s = %s", moduleId, name, String(value).slice(0,30).replace(/\n/g, "") + "...");

      var isNewExport = !(name in record.exports);
      if (isNewExport) record.__lively_modules__.evalOnlyExport[name] = true;
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


async function importsAndExportsOf(System, moduleName, parent) {
  var id = await System.normalize(moduleName, parent),
      source = await sourceOf(System, id),
      parsed = ast.parse(source),
      scope = ast.query.scopes(parsed);

  // compute imports
  var imports = scope.importDecls.reduce((imports, node) => {
    var nodes = ast.query.nodesAtIndex(parsed, node.start);
    var importStmt = arr.without(nodes, scope.node)[0];
    if (!importStmt) return imports;

    var from = importStmt.source ? importStmt.source.value : "unknown module";
    if (!importStmt.specifiers.length) // no imported vars
      return imports.concat([{
        localModule:     id,
        local:           null,
        imported:        null,
        fromModule:      from,
        importStatement: importStmt
      }]);

    return imports.concat(importStmt.specifiers.map(importSpec => {
      var imported;
      if (importSpec.type === "ImportNamespaceSpecifier") imported = "*";
      else if (importSpec.type === "ImportDefaultSpecifier") imported = "default";
      else if (importStmt.source) imported = importStmt.source.name;
      else imported = null;
      return {
        localModule:     id,
        local:           importSpec.local ? importSpec.local.name : null,
        imported:        imported,
        fromModule:      from,
        importStatement: importStmt
      }
    }))
  }, []);

  var exports = scope.exportDecls.reduce((exports, node) => {
    var nodes = ast.query.nodesAtIndex(parsed, node.start);
    var exportsStmt = arr.without(nodes, scope.node)[0];
    if (!exportsStmt) return exports;

    if (exportsStmt.type === "ExportAllDeclaration") {
      var from = exportsStmt.source ? exportsStmt.source.value : null;
      return exports.concat([{
        localModule:     id,
        local:           null,
        exported:        "*",
        fromModule:      from,
        exportStatement: exportsStmt
      }])
    }

    return exports.concat(exportsStmt.specifiers.map(exportSpec => {
      return {
        localModule:     id,
        local:           exportSpec.local ? exportSpec.local.name : null,
        exported:        exportSpec.exported ? exportSpec.exported.name : null,
        fromModule:      id,
        exportStatement: exportsStmt
      }
    }))
  }, []);

  return {
    imports: arr.uniqBy(imports, (a, b) => a.local == b.local && a.imported == b.imported && a.fromModule == b.fromModule),
    exports: arr.uniqBy(exports, (a, b) => a.local == b.local && a.exported == b.exported && a.fromModule == b.fromModule)
  }
}
