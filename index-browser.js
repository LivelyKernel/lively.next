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

  var root = (function() {
    var l = document.location;
    return `${l.protocol}//${l.hostname}:${l.port}`
  })();

  // configures current SystemJS instance to load lively.vm + deps
  function configure(vmPath) {
    return get(vmPath + "/dist/es6-runtime-config-browser.json")
      .then(conf => {
        var config = JSON.parse(conf);
        config.baseURL = "/";
        config.map["lively.vm"] = vmPath;
        config.paths = {["lively.vm/*"]: vmPath + "/*"}
        System.config(config);
        return config;
      })
  }

  // async load of ./index.js
  function load(vmPath) {
    return configure(vmPath)
      .then(function() { return System.import("lively.vm")})
      .then(vm => {
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

    return new Promise((resolve, reject) => resolve(!vm || !vm.es6 ? load(vmPath) : vm))
      .then(vm => {
        console.log("[lively.vm bootstrap] loaded boot vm");
        // FIXME remove loaded global stuff?
        vm.es6._init(); // create a new System instance
        vm.es6.wrapModuleLoad();
        return load(vmPath);
      })
      .then(vm => {
        console.log("[lively.vm bootstrap] loaded bootstraped vm");
        return vm;
      });
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
