/*global require, process*/

var fs = require("fs"),
    path = require("path"),
    rollup = require('rollup'),
    babel = require('rollup-plugin-babel'),
    targetFile = "dist/lively.storage.js",
    pouchdbSource = fs.readFileSync(require.resolve('pouchdb/dist/pouchdb.js')).toString(),
    pouchdbFindSource = fs.readFileSync(require.resolve('pouchdb-find/dist/pouchdb.find.min.js')).toString(),
    regeneratorRuntimeSource = fs.readFileSync(require.resolve('regenerator-runtime/runtime.js')).toString(),
    pouchdbAdapterMemSource = "",
    pouchdbAdapterFsSource;


module.exports = Promise.resolve()
  // .then(() => require("./build-pouchdb-adapter-fs.js").then(src => pouchdbAdapterFsSource = src))
  .then(() => require("./build-pouchdb-adapter-mem.js").then(src => pouchdbAdapterMemSource = src))
  .then(() => rollup.rollup({
    entry: "index.js",
    plugins: [
      babel({
        exclude: 'node_modules/**', sourceMap: false,
        "presets": [["es2015", {modules: false}]],
        "plugins": ['transform-async-to-generator', "syntax-object-rest-spread", "transform-object-rest-spread", "external-helpers"],
        babelrc: false
      })
    ]
  }))

  .then(bundle =>
    bundle.generate({
      format: 'iife',
      moduleName: 'lively.storage',
      globals: {
        "lively.lang": "lively.lang",
        "pouchdb": "PouchDB",
        "pouchdb-find": "pouchdbFind",
        "pouchdb-adapter-mem": "pouchdbAdapterMem"
      }
    }))

  .then(bundled => fs.writeFileSync(targetFile, fixSource(bundled.code)))
  .then(() => console.log(`lively.storage bundled into ${process.cwd()}/${targetFile}`))
  .catch(err => { console.error(err.stack || err); throw err; });


function fixSource(source) {
  return `
(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
${regeneratorRuntimeSource}
if (typeof btoa === "undefined")
  GLOBAL.btoa = function(str) { return new Buffer(str).toString('base64'); };
if (typeof atob === "undefined")
  GLOBAL.atob = function(str) { return new Buffer(str, 'base64').toString() };
var PouchDB = (function() {
  var exports = {}, module = {exports: exports};
${pouchdbSource}
  return module.exports;
})();
var pouchdbFind = (function() {
  var exports = {}, module = {exports: exports};
${pouchdbFindSource}
  return module.exports;
})();

var pouchdbAdapterMem = (function() {
  var exports = {}, module = {exports: exports};
${pouchdbAdapterMemSource}
  return module.exports;
})();
PouchDB.plugin(pouchdbAdapterMem);

  if (typeof GLOBAL.lively === "undefined") GLOBAL.lively = {};
  (function() {
    ${source}
  }).call(GLOBAL);
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.storage;
})();
`;
}
