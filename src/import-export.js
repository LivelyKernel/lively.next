import * as ast from "lively.ast";
import { arr } from "lively.lang"
import { moduleRecordFor, updateModuleRecordOf, sourceOf } from "./system.js"

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
    if (newExports.length) {
      var m = System.get(moduleId);
      if (Object.isFrozen(m)) {
        console.warn("[lively.vm es6 updateModuleExports] Since module %s is frozen a new module object was installed in the system. Note that only(!) exisiting module bindings are updated. New exports that were added will only be available in already loaded modules after those are reloaded!", moduleId);
        System.set(moduleId, System.newModule(record.exports))
      } else {
        debug && console.log("[lively.vm es6 updateModuleExports] adding new exports to %s", moduleId);
        newExports.forEach(name => {
          Object.defineProperty(m, name, {
            configurable: false, enumerable: true,
            get() { return record.exports[name]; },
            set() { throw new Error("exports cannot be changed from the outside") }
          });
        });
      }
    }

    // For exising exports we find the execution func of each dependent module and run that
    // FIXME this means we run the entire modules again, side effects and all!!!
    if (existingExports.length) {
      debug && console.log("[lively.vm es6 updateModuleExports] updating %s dependents of %s", record.importers.length, moduleId);
      for (var i = 0, l = record.importers.length; i < l; i++) {
        var importerModule = record.importers[i];
        if (!importerModule.locked) {
          var importerIndex = importerModule.dependencies.indexOf(record);
          importerModule.setters[importerIndex](record.exports);
          // rk 2016-06-09: for now don't re-execute dependent modules on save,
          // just update module bindings
          if (false) {
            importerModule.execute();
          } else {
            runScheduledExportChanges(System, importerModule.name);
          }
        }
      }
    }

  });
}


function importsAndExportsOf(System, moduleId, sourceOrAst) {
  var parsed = typeof sourceOrAst === "string" ?
        ast.parse(sourceOrAst) : sourceOrAst,
      scope = ast.query.scopes(parsed);

  // compute imports
  var imports = scope.importDecls.reduce((imports, node) => {
    var nodes = ast.query.nodesAtIndex(parsed, node.start);
    var importStmt = arr.without(nodes, scope.node)[0];
    if (!importStmt) return imports;

    var from = importStmt.source ? importStmt.source.value : "unknown module";
    if (!importStmt.specifiers.length) // no imported vars
      return imports.concat([{
        local:           null,
        imported:        null,
        fromModule:      from
      }]);

    return imports.concat(importStmt.specifiers.map(importSpec => {
      var imported;
      if (importSpec.type === "ImportNamespaceSpecifier") imported = "*";
      else if (importSpec.type === "ImportDefaultSpecifier" ) imported = "default";
      else if (importSpec.type === "ImportSpecifier" ) imported = importSpec.imported.name;
      else if (importStmt.source) imported = importStmt.source.name;
      else imported = null;
      return {
        local:           importSpec.local ? importSpec.local.name : null,
        imported:        imported,
        fromModule:      from
      }
    }))
  }, []);

  var exports = scope.exportDecls.reduce((exports, node) => {

    var exportsStmt = ast.query.statementOf(scope.node, node);
    if (!exportsStmt) return exports;

    var from = exportsStmt.source ? exportsStmt.source.value : null;

    if (exportsStmt.type === "ExportAllDeclaration") {
      return exports.concat([{
        local:           null,
        exported:        "*",
        fromModule:      from
      }])
    }

    if (exportsStmt.specifiers && exportsStmt.specifiers.length) {
      return exports.concat(exportsStmt.specifiers.map(exportSpec => {
        return {
          local:           from ? null : exportSpec.local ? exportSpec.local.name : null,
          exported:        exportSpec.exported ? exportSpec.exported.name : null,
          fromModule:      from
        }
      }))
    }

    if (exportsStmt.declaration && exportsStmt.declaration.declarations) {
      return exports.concat(exportsStmt.declaration.declarations.map(decl => {
        return {
          local:           decl.id.name,
          exported:        decl.id.name,
          type:            exportsStmt.declaration.kind,
          fromModule:      null
        }
      }))
    }

    if (exportsStmt.declaration) {
      return exports.concat({
        local:           exportsStmt.declaration.id.name,
        exported:        exportsStmt.declaration.id.name,
        type:            exportsStmt.declaration.type === "FunctionDeclaration" ?
                          "function" : exportsStmt.declaration.type === "ClassDeclaration" ?
                            "class" : null,
        fromModule:      null
      })
    }

    return exports;

  }, []);

  return {
    imports: arr.uniqBy(imports, (a, b) => a.local == b.local && a.imported == b.imported && a.fromModule == b.fromModule),
    exports: arr.uniqBy(exports, (a, b) => a.local == b.local && a.exported == b.exported && a.fromModule == b.fromModule)
  }
}

export { runScheduledExportChanges, scheduleModuleExportsChange, importsAndExportsOf };
