// require("systemjs");

// var lang = require("lively.lang");

(function() {

  function get(url, thenDo) {
    var res, rej, p;
    if (typeof Promise === "function") p = new Promise(function(resolve, reject) { res = resolve; rej = reject; });
    var xhr = new XMLHttpRequest();
    xhr.onerror = function(err) { thenDo && thenDo(err); rej && rej(err); };
    xhr.onreadystatechange = function() {
      if (xhr.readyState == XMLHttpRequest.DONE) {
        thenDo && thenDo(null, xhr.responseText)
        res && res(xhr.responseText)
      }
    };
    xhr.open('GET', url, true); xhr.send(null);
    return p;
  }

  // var root = (function() {
  //   var l = document.location;
  //   return `${l.protocol}//${l.hostname}:${l.port}`
  // })();

  // configures current SystemJS instance to load lively.vm + deps
  function configure(vmPath) {
    return Promise.resolve(System.config({
            "transpiler": "babel",
            "babelOptions": {"stage": 2},
              map: {
                "lively.vm": vmPath,
                "babel": "lively.vm/node_modules/babel-core/browser.js",
                "path": "@empty",
                "module": "@empty",
                "fs": "@empty"

              },
              // packages: {"acorn": { format: "cjs", },},
              paths: {"lively.vm/*": vmPath + "/*"},
              packageConfigPaths: [
                "lively.vm/node_modules/lively.ast/node_modules/*/package.json",
                "lively.vm/node_modules/*/package.json",
                "lively.vm/package.json"]
            }))
  }

  // async load of ./index.js
  function load(vmPath) {
    return configure(vmPath)
      .then(function() { return System.import("lively.vm")})
      .then(function(vm) {
        if (!window.lively) window.lively = {};
        window.lively.vm = vm;
        vm.setBootstrapFunction(bootstrap); // vm.bootstrap = bootstrap;
        vm.setLoadFunction(load); // vm.load = load;
        vm.setConfigureFunction(configure); // vm.configure = configure;
        return vm;
      });
  }

  function bootstrap(vmPath) {
    var vm = window.lively && window.lively.vm;

    return new Promise(function(resolve) { return resolve(!vm || !vm.es6 ? load(vmPath) : vm); })
      .then(function(vm) {
        console.log("[lively.vm bootstrap] loaded boot vm");
        // FIXME remove loaded global stuff?
        vm.es6._init(); // create a new System instance
        vm.es6.wrapModuleLoad();
        return load(vmPath);
      })
      .then(function(vm) {
        console.log("[lively.vm bootstrap] loaded bootstraped vm");
        return vm;
      });
  }

  // a hack: to force non esm files that have es6 syntax in them to be
  // transpiled. SystemJS only transpiles proper es6 modules
  var es5CompatFiles = [];
  System._ensureES5Transpile = function(files) {
    es5CompatFiles.push.apply(es5CompatFiles, files);
    if (!System.__es5CompatFetchHookInstalled) {
      System.__es5CompatFetchHookInstalled = true;
      System.fetch = function(load) {
        return this.constructor.prototype.fetch.call(this, load)
          .then(function(source) {
            if (es5CompatFiles.some(function(f) { return load.name.indexOf(f) > -1; })) {
              console.log("[_ensureES5Transpile] " + load.name);
              source = load.source = babel.transform(source, {stage: 2}).code;
            }
            return source;
          });
      }
    }
  }

  if (!window.lively) window.lively = {};
  if (!window.lively.vm) window.lively.vm = {};

  if (window.lively.vm.setBootstrapFunction) window.lively.vm.setBootstrapFunction(bootstrap);
  else window.lively.vm.bootstrap = bootstrap;
  if (window.lively.vm.setLoadFunction) window.lively.vm.setLoadFunction(load);
  else window.lively.vm.load = load;
  if (window.lively.vm.setConfigureFunction) window.lively.vm.setConfigureFunction(configure);
  else window.lively.vm.configure = configure;
})();
