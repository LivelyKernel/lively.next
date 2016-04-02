var System = lively.vm.es6.currentSystem();

System.normalizeSync = System.normalizeSync.getOriginal().wrap(function(proceed, name, parentName, isPlugin) {
  return packageMainRedirect(packageJSONNoJs(proceed(name, parentName, isPlugin)));
})

System.normalize = System.normalize.getOriginal().wrap(function(proceed, name, parentName, parentAddress) {
  var System = this;
  return proceed(name, parentName, parentAddress)
    .then(result => packageMainRedirect(packageJSONNoJs(result)))
});

function packageMainRedirect(path) {
  var base = path.replace(/\.js$/, "");
  if (base in System.packages) {
    var main = System.packages[base].main;
    if (main) return base.replace(/\/$/, "") + "/" + main.replace(/^\.?\//, "");
  }
  return path;
}

function packageJSONNoJs(path) {
  return path.match(/package\.json\.js$/) ? path.replace(/\.js$/, "") : path;
}

// System.baseURL
// System.normalize("lively.lang", "http://localhost:9001/lively.modules/index.js").then(show.curry("%s"))
System.normalize("http://localhost:9001/lively.modules/node_modules/lively.ast/package.json").then(show.curry("%s"))

System.config({
  transpiler: "babel",
  map: {
    "lively.lang": "node_modules/lively.lang",
    "mocha-es6": "lively.modules/node_modules/mocha-es6",
    "lively.vm": "node_modules/lively.vm",
    "lively.ast": "http://localhost:9001/node_modules/lively.vm/node_modules/lively.ast",
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
    },
    "lively.modules": {main: "index.js"},
    "lively.modules/node_modules/lively.ast/dist/escodegen.browser.js": {
      "format": "global",
      "configured": true
    },
  },
  packages: {
    "node_modules/lively.lang": {main: "index.js"},
    "lively.modules/node_modules/lively.lang": {main: "index.js"},
    "lively.modules/node_modules/lively.ast": {main: "index.js"}
  },
  packageConfigPaths: [
    "lively.modules/node_modules/lively.lang/package.json",
    "lively.modules/node_modules/lively.vm/node_modules/lively.ast/package.json",
    "lively.modules/node_modules/lively.vm/package.json",
    "lively.modules/node_modules/lively.lang/package.json",
    "lively.modules/package.json",
    "lively.modules/node_modules/mocha-es6/package.json"]
})

System.import("lively.lang")
  .then(() => System.import("mocha-es6"))
  .then(() => System.import("lively.vm"))
  .then(() => System.import("lively.vm/node_modules/lively.ast"))
  // .then(() => System.import("lively.modules/index.js"))
  // .then(() => System.import("lively.modules/src/eval.js"))
  .then(() => System.import("lively.modules"))
  .then(show.curry("%s"))
  .catch(show.curry("%s"))

// lively.vm.es6.forgetModule("https://cdnjs.cloudflare.com/ajax/libs/fetch/0.11.0/fetch.js")

// System.trace = true
// System.loads["https://cdnjs.cloudflare.com/ajax/libs/fetch/0.11.0/fetch.js"]
// System._loader.
// systemConfPrint()

// function systemConfPrint() {
//   var S = System;
//   var json = {
//     baseURL: S.baseURL,
//     transpiler: S.transpiler,
//     map: S.map,
//     meta: S.meta,
//     packages: S.packages,
//     paths: S.paths,
//     packageConfigPaths: S.packageConfigPaths,
//   }
//   return JSON.stringify(json, null, 2);
// }

// var origNormalize = System.normalize;

System.normalize.getOriginal().wrap(function(proceed, name, parentName, parentAddress) {
  var System = this;
  return proceed(name, parentName, parentAddress)
    .then(result => {
      var packages = Object.keys(System.packages);
      if (packages.include(result)) {
        var main = System.packages[result].main;
        if (main) return lively.lang.string.joinPath(result, main);
      }
      result;
    })
})
