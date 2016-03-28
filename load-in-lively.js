var System = lively.vm.es6.currentSystem();

System.baseURL

System.config({
  transpiler: "babel",
  map: {
    "lively.lang": "node_modules/lively.lang",
    "mocha-es6": "lively.modules/node_modules/mocha-es6",
    "lively.vm": "node_modules/lively.vm",
  },
  meta: {
    "https://cdnjs.cloudflare.com/ajax/libs/fetch/0.11.0/fetch.js": {
      "format": "global",
      "exports": "fetch"
    }
  },
  packageConfigPaths: [
    "lively.modules/node_modules/lively.lang/package.json",
    "node_modules/lively.lang/package.json",
    "lively.modules/package.json",
    "lively.modules/node_modules/mocha-es6/package.json"]
})

System.import("lively.lang")
  .then(() => System.import("mocha-es6"))
  .then(() => System.import("lively.modules/index.js"))
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
