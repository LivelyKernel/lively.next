// empty module that serves as default eval target

var commonjsInterface = require("./commonjs-interface");
var path = require("path");
var lang = require("lively.lang");

// commonjsInterface.envFor("./commonjs-interface").isInstrumented
// commonjsInterface.envFor("./commonjs-interface").recorderName
// commonjsInterface.envFor("./commonjs-interface").recorder
// commonjsInterface.
// commonjsInterface.envFor("./commonjs-interface").loadError


// findDependentModules("/Users/robert/Lively/lively-dev/lively.vm/lib/commonjs-interface.js", require.cache)


function findRequirementsOf(id, moduleMap) {
  // which modules (module ids) are (in)directly required by module with id
  // moduleMap will probably be require.cache
  // var moduleMap = require.cache;

  var depMap = Object.keys(moduleMap).reduce((deps, k) => {
    deps[k] = moduleMap[k].children.map(ea => ea.id); return deps; }, {});

  return requirementsOf(id, [id]);

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function requirementsOf(id, deps) {
    var newRequires = Object.keys(depMap).filter(otherId =>
      depMap[otherId].some(childId => childId === id))
    if (newRequires.length === 0) return deps;
    deps = deps.concat(newRequires);
    for (var i = 0; i < newRequires.length; i++) {
      var newDepsDeep = requirementsOf(newRequires[i], deps);
      newDepsDeep.forEach(dep => deps.indexOf(dep) === -1 && deps.push(dep));
    }
    return deps
  }
}

function xxx() {
  // findRequirementsOf(__filename, require.cache).join("\n")
  var module1 = "../tests/test-resources/some-cjs-module";
  var module2 = "../tests/test-resources/another-cjs-module";
  var module3 = "../tests/test-resources/yet-another-cjs-module";

commonjsInterface
  require(module1)
  require(module3)
  
  var id = commonjsInterface.resolveFileName(module3)
  var id2 = commonjsInterface._requireMap[id][0]
  commonjsInterface._requireMap[id2]
  id2

  var deps = commonjsInterface.findRequirementsOf(id);


  require.cache[commonjsInterface.resolveFileName(module3)].children
  require.cache[commonjsInterface.resolveFileName(module3)].children[0].children
  require.cache[commonjsInterface.resolveFileName(module3)].parent.id
  module.require
  require("module").Module._load
  require("module").Module._resolveFilename
  require.resolve

path.join("/foo/bar", "../org/baz")
path.relative("./org/baz", "/foo/bar")

  lang.graph.hull(commonjsInterface.requireMap, commonjsInterface.resolveFileName(module3))
}
