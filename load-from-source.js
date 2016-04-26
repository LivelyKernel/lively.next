// lively.vm.es6._init();
// lively.modules.System.import("lively.ast/index.js").then(ast => lively.ast = ast).catch(show.curry("%s"))
// lively.modules.System.import("lively.vm/index.js").then(m => { lively.vm = m; lively.lang.VM = m }).catch(show.curry("%s"))
// System.import("http://localhost:9001/lively.modules/index.js").then(m => lively.modules = m).catch(show.curry("%s"))

var isNode = typeof process !== "undefined" && process.platform && typeof require !== "undefined";
var GLOBAL = isNode ? global : window;

if (isNode && !GLOBAL.System) require("systemjs");

GLOBAL.System = new (GLOBAL.System.constructor)(); // new system for bootstrap

var livelyModulesDir = (function computeLivelyModulesDir() {
  if (isNode) return "file://" + __dirname;

  if (typeof document !== "undefined") {
    var loadScript = [].slice.apply(document.querySelectorAll("script")).find(script => script.src.match(/load-from-source.js$/));
    if (loadScript)
      return loadScript.src.split("/").slice(0,-1).join("/");
  }
  
  return URL.root ?
    URL.root.withFilename("lively.modules").toString() :
    document.location.origin + "/lively.modules";
  
})();

System.normalizeSync = wrap(System.normalizeSync, function(proceed, name, parentName, isPlugin) {
  return fixNormalizeResult(proceed(name = fixNormalizeInput(name, parentName), parentName, isPlugin))
});

System.normalize = wrap(System.normalize, function(proceed, name, parentName, parentAddress) {
  var System = this;
  return proceed(name = fixNormalizeInput(name, parentName), parentName, parentAddress)
    .then(fixNormalizeResult)
});

function fixNormalizeInput(name, parent) {
  if (name === "..") return "../index.js";
  return name;
}

function fixNormalizeResult(normalized) {
  var base = normalized.replace(/\.js$/, "").replace(/([^:])\/[\/]+/g, "$1/");
  if (base in System.packages) {
    var main = System.packages[base].main;
    if (main) {
      return base.replace(/\/$/, "") + "/" + main.replace(/^\.?\//, "");
    }
  }
  return normalized;
}

System.config({
  baseURL: isNode ? "file://" + __dirname.replace(/\/$/, "") : "/",
  transpiler: "babel",
  defaultJSExtensions: true,
  map: {
    "lively.modules": livelyModulesDir,
    "babel": livelyModulesDir + "/node_modules/babel-core/browser.js",
    "lively.lang": livelyModulesDir + "/node_modules/lively.lang",
    "lively.vm": livelyModulesDir + "/node_modules/lively.vm",
    "lively.ast": livelyModulesDir + "/node_modules/lively.ast",
    "acorn": livelyModulesDir + "/node_modules/lively.ast/node_modules/acorn",
      "path": "@empty",
      "fs": "@empty",
      "events": "@empty",
      "util": "@empty",
      "os": "@empty",
      "child_process": "@empty",
  },
  meta: {
    "https://cdnjs.cloudflare.com/ajax/libs/fetch/0.11.0/fetch.js": {
      "format": "global",
      "exports": "fetch"
    }
  },
  packages: {
    [livelyModulesDir +"/node_modules/lively.lang"]: {main: "index.js"},
    [livelyModulesDir +"/node_modules/lively.ast"]: {main: "index.js"},
    [livelyModulesDir +"/node_modules/lively.vm"]: {main: "index.js"},
  },
  packageConfigPaths: [
    livelyModulesDir +"/package.json",
    livelyModulesDir +"/node_modules/lively.vm/package.json",
    livelyModulesDir +"/node_modules/lively.ast/package.json",
    livelyModulesDir +"/node_modules/lively.lang/package.json",
    livelyModulesDir +"/node_modules/lively.ast/node_modules/acorn/package.json"
  ]
})

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function wrap(func, wrapper) {
  // A `wrapper` is another function that is being called with the arguments
  // of `func` and a proceed function that, when called, runs the originally
  // wrapped function.
  // Example:
  // function original(a, b) { return a+b }
  // var wrapped = fun.wrap(original, function logWrapper(proceed, a, b) {
  //   alert("original called with " + a + "and " + b);
  //   return proceed(a, b);
  // })
  // wrapped(3,4) // => 7 and a message will pop up
  var __method = func;
  var wrappedFunc = function wrapped() {
    var args = Array.prototype.slice.call(arguments);
    var wrapperArgs = wrapper.isWrapper ? args : [__method.bind(this)].concat(args);
    return wrapper.apply(this, wrapperArgs);
  };
  wrappedFunc.isWrapper = true;
  wrappedFunc.originalFunction = __method;
  return wrappedFunc;
}
