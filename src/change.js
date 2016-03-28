import { moduleRecordFor } from "./system.js";
import { instrumentSourceOfModuleLoad } from "./instrumentation.js";
import { scheduleModuleExportsChange } from "./import-export.js";

export { moduleSourceChange }


function moduleSourceChange(System, moduleName, newSource, options) {
  var debug = System["__lively.modules__"].debug,
      load = {
        status: 'loading',
        source: newSource,
        name: null,
        linkSets: [],
        dependencies: [],
        metadata: {format: "esm"}
      };
  
  return System.normalize(moduleName)
    .then(moduleId => {
      load.name = moduleId;
      return System.get(moduleId) ? Promise.resolve() : System.import(moduleId)
    })
    .then((_) => instrumentSourceOfModuleLoad(System, load))
    .then(updateData => {
      var record = moduleRecordFor(System, load.name),
          _exports = (name, val) => scheduleModuleExportsChange(System, load.name, name, val),
          declared = updateData.declare(_exports);

      System.__lively_vm__.evaluationDone(load.name);

      // ensure dependencies are loaded
      debug && console.log("[lively.vm es6] sourceChange of %s with deps", load.name, updateData.localDeps);

      return Promise.all(
        // gather the data we need for the update, this includes looking up the
        // imported modules and getting the module record and module object as
        // a fallback (module records only exist for esm modules)
        updateData.localDeps.map(depName =>
          System.normalize(depName, load.name)
            .then(depFullname => {
                var depModule = System.get(depFullname),
                    record = moduleRecordFor(System, depFullname);
                return depModule && record ?
                  {name: depName, fullname: depFullname, module: depModule, record: record} :
                  System.import(depFullname).then((module) => ({
                    name: depName,
                    fullname: depFullname,
                    module: System.get(depFullname) || module,
                    record: moduleRecordFor(System, depFullname)
                  }));
            })))

      .then(deps => {
        // 1. update dependencies
        record.dependencies = deps.map(ea => ea.record);
        // hmm... for house keeping... not really needed right now, though
        var prevLoad = System.loads && System.loads[load.name];
        if (prevLoad) {
          prevLoad.deps = deps.map(ea => ea.name);
          prevLoad.depMap = deps.reduce((map, dep) => { map[dep.name] = dep.fullname; return map; }, {});
          if (prevLoad.metadata && prevLoad.metadata.entry) {
            prevLoad.metadata.entry.deps = prevLoad.deps;
            prevLoad.metadata.entry.normalizedDeps = deps.map(ea => ea.fullname);
            prevLoad.metadata.entry.declare = updateData.declare;
          }
        }
        // 2. run setters to populate imports
        deps.forEach((d,i) => declared.setters[i](d.module));
        // 3. execute module body
        return declared.execute();
      });
    });
}
