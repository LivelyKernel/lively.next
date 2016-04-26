/*global System*/

System.normalizeSync = wrap(System.normalizeSync, function(proceed, name, parentName, isPlugin) {
  return fixNormalize(proceed(name, parentName, isPlugin))
});

System.normalize = wrap(System.normalize, function(proceed, name, parentName, parentAddress) {
  var System = this;
  return proceed(name, parentName, parentAddress)
    .then(fixNormalize)
});

function fixNormalize(normalized) {
  normalized = normalized.replace(/\/\.js$/, "/index.js");
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
  baseURL: "/",
  transpiler: "babel",
  defaultJSExtensions: true,
  map: {
    "babel": "lively.modules/node_modules/babel-core/browser.js",
    "lively.modules": "../..",
    "lively.lang": "lively.modules/node_modules/lively.lang",
    "lively.vm": "lively.modules/node_modules/lively.vm",
    "lively.ast": "lively.modules/node_modules/lively.ast",
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
    "lively.modules/node_modules/lively.lang": {main: "index.js"},
    "lively.modules/node_modules/lively.ast": {main: "index.js"},
    "lively.modules/node_modules/lively.vm": {main: "index.js"},
  },
  packageConfigPaths: [
    "lively.modules/node_modules/lively.vm/package.json",
    "lively.modules/node_modules/lively.ast/package.json",
    "lively.modules/node_modules/lively.lang/package.json",
    "lively.modules/package.json"
  ]
})

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function systemConfPrint() {
  var S = System;
  var json = {
    baseURL: S.baseURL,
    transpiler: S.transpiler,
    defaultJSExtensions: S.defaultJSExtensions,
    map: S.map,
    meta: S.meta,
    packages: S.packages,
    paths: S.paths,
    packageConfigPaths: S.packageConfigPaths,
  }
  return JSON.stringify(json, null, 2);
}


function log(msg) {
  console.log(msg);
  var stringified = typeof msg === "object" ? JSON.stringify(msg, null, 2) : String(msg);
  document.querySelector("#log").insertAdjacentHTML("beforeend", '<li><pre>' + stringified + '</li>');
}


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