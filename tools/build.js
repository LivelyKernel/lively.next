/*global require, process*/

var fs = require("fs"),
    path = require("path"),
    rollup = require('rollup'),
    babel = require('rollup-plugin-babel'),
    targetFile = "dist/lively.storage.js",
    pouchdbSource = fs.readFileSync(require.resolve('pouchdb/dist/pouchdb.min.js')).toString(),
    pouchdbFindSource = fs.readFileSync(require.resolve('pouchdb-find/dist/pouchdb.find.min.js')).toString();


module.exports = Promise.resolve()
  .then(() => rollup.rollup({
    entry: "index.js",
    plugins: [
      babel({
        exclude: 'node_modules/**',
        sourceMap: false,
        "presets": [["es2015", {modules: false}]],
        "plugins": ["syntax-object-rest-spread", "transform-object-rest-spread", "external-helpers"]
    })]
  }))

  .then(bundle =>
    bundle.generate({
      format: 'iife',
      moduleName: 'lively.storage',
      globals: {
        "lively.lang": "lively.lang",
        "pouchdb": "PouchDB",
        "pouchdb-find": "pouchdbFind"
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
  if (typeof GLOBAL.lively === "undefined") GLOBAL.lively = {};
  (function() {
    ${source}
  }).call(GLOBAL);
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.storage;
})();
`;
}
