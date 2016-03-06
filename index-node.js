/*global module,exports,require*/



require("systemjs");

var lang = require("lively.lang");

// configures current SystemJS instance to load lively.vm + deps
function configure() {
  var vmConfig = require("./dist/es6-runtime-config.json")  
  vmConfig.map["lively.vm"] = __dirname
  vmConfig.paths = {["lively.vm/*"]: __dirname + "/*"}
  System.config(vmConfig);
}

// async load of ./index.js
function load() {
  return new Promise((resolve, reject) => {
    configure();
    System.import("lively.vm")
      .then(index => lang.obj.extend(module.exports, index))
      .then(vm => {
        lang.obj.extend(module.exports, vm);
        vm.setBootstrapFunction(bootstrap); // vm.bootstrap = bootstrap;
        vm.setLoadFunction(load); // vm.load = load;
        vm.setConfigureFunction(configure); // vm.configure = configure;
        return vm;
      })
      .then(resolve)
      .catch(reject)
  })
}

function bootstrap() {
  var vm = module.exports;

  return new Promise((resolve, reject) => resolve(!vm || !vm.es6 ? load() : vm))
    .then(vm => {
      console.log("[lively.vm bootstrap] loaded boot vm");
      // 1. remove bootVMs nodejs modules from loading cache, not its node_modules
      // though!
      var cache = System._nodeRequire('module').Module._cache,
          toRemove = Object.keys(cache).filter(name => !name.match("node_modules"));
      toRemove.forEach(ea => delete cache[ea]);

      vm.es6._init(); // create a new System instance
      vm.es6.wrapModuleLoad();
      return load();
    }).then(vm => { console.log("[lively.vm bootstrap] loaded bootstraped vm"); return vm; })
}

// Will be populated with index.js exports
module.exports = {
  load: load,
  configure: configure,
  bootstrap: bootstrap
};
