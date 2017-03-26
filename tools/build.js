/*global require, process*/

var fs = require("fs"),
    path = require("path"),
    rollup = require('rollup'),
    babel = require('rollup-plugin-babel'),
    targetFileNoDeps = "dist/lively.storage_no-deps.js",
    targetFileWithPouch = "dist/lively.storage_with-pouch.js",
    targetFileComplete = "dist/lively.storage.js";

var placeholderSrc = "throw new Error('Not yet read')";

var parts = {
  "pouchdb-adapter-mem":     {source: placeholderSrc, script: "./build-pouchdb-adapter-mem.js"},
  "pouchdb":                 {source: placeholderSrc, path: require.resolve('pouchdb/dist/pouchdb.js')},
  "lively.resources":        {source: placeholderSrc, path: require.resolve("lively.resources/dist/lively.resources_no-deps.js")},
  "babel-regenerator":       {source: placeholderSrc, path: require.resolve("babel-regenerator-runtime/runtime.js")}
}

var partsSourceRead = Promise.all(
  Object.keys(parts).map(function(name) {
    if (parts[name].path)
      return parts[name].source = fs.readFileSync(parts[name].path)
    if (parts[name].script)
      return require(parts[name].script).then(src => parts[name].source = src);
    throw new Error("Cannot find source for " + name);
  }))

module.exports = Promise.resolve()
  .then(() => partsSourceRead)
  .then(() => rollup.rollup({
    entry: "index.js",
    plugins: [
      babel({
        exclude: 'node_modules/**', sourceMap: false,
        "presets": [["es2015", {modules: false}]],
        "plugins": [
          'transform-async-to-generator',
          "syntax-object-rest-spread",
          "transform-object-rest-spread",
          "external-helpers"
        ],
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
        "lively.resources": "lively.resources",
        "pouchdb": "PouchDB",
        "pouchdb-adapter-mem": "pouchdbAdapterMem"
      }
    }))

  .then(bundled => {
    var source = bundled.code;

var noDeps = `
(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  if (typeof GLOBAL.lively === "undefined") GLOBAL.lively = {};
  if (typeof btoa === "undefined")
    GLOBAL.btoa = function(str) { return new Buffer(str).toString('base64'); };
  if (typeof atob === "undefined")
    GLOBAL.atob = function(str) { return new Buffer(str, 'base64').toString() };
  (function() {
    ${source}
  }).call(GLOBAL);
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.storage;
})();
`;

var withPouch = `
(function() {

var PouchDB = (function() {
  var exports = {}, module = {exports: exports};
// INLINED ${parts["pouchdb"].path}
${parts["pouchdb"].source}
// INLINED END ${parts["pouchdb"].path}
  return module.exports;
})();

var pouchdbAdapterMem = (function() {
  var exports = {}, module = {exports: exports};
// INLINED ${parts["pouchdb-adapter-mem"].path}
${parts["pouchdb-adapter-mem"].source}
// INLINED END ${parts["pouchdb-adapter-mem"].path}
  return module.exports;
})();

${noDeps}

})();
`;

var complete = `
// INLINED ${parts["babel-regenerator"].path}
${parts["babel-regenerator"].source}
// INLINED END ${parts["babel-regenerator"].path}

// INLINED ${parts["lively.resources"].path}
${parts["lively.resources"].source}
// INLINED END ${parts["lively.resources"].path}

${withPouch}
`
    return {noDeps: noDeps, complete: complete, withPouch: withPouch};
  })

  .then(sources => {
    fs.writeFileSync(targetFileNoDeps, sources.noDeps);
    fs.writeFileSync(targetFileWithPouch, sources.withPouch);
    fs.writeFileSync(targetFileComplete, sources.complete);
  })
  .then(() => console.log(`lively.storage bundled into ${process.cwd()} ${targetFileComplete}, ${targetFileNoDeps}, and ${targetFileWithPouch}`))
  .catch(err => { console.error(err.stack || err); throw err; });

