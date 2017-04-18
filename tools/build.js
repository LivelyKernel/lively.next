/*global require, process*/

var fs = require("fs"),
    path = require("path"),
    rollup = require('rollup'),
    babel = require('rollup-plugin-babel');

var targetFile = "dist/lively.ast.js";
var escodegenBundle = "dist/escodegen.js";
var acornBundle = "dist/acorn.js";
var escodegenSource, acornSource, astSource;

// output format - 'amd', 'cjs', 'es6', 'iife', 'umd'

module.exports = Promise.resolve()
  // 1. make sure deps are build
  .then(() => require("./build-acorn.js"))
  .then(() => require("./build-escodegen.js"))
  .then(() => {
    escodegenSource = fs.readFileSync(escodegenBundle);
    acornSource = fs.readFileSync(acornBundle);
  })

  // 2. bundle local esm modules
  .then(() => rollup.rollup({
    entry: "index.js",
    // external: [require.resolve('acorn-es7-plugin')],
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
      moduleName: 'lively.ast',
      globals: {
        "acorn": "acorn",
        "lively.lang": "lively.lang",
        "lively.classes": "lively.classes",
        "escodegen": "GLOBAL.escodegen"
      }
    }))

  // 3. inject dependencies
  .then(bundled => astSource = bundled.code)
  .then(() => fs.writeFileSync(targetFile, combineSources()))
  .then(() => console.log(`lively.ast bundled into ${process.cwd()}/${targetFile}`))
  .catch(err => { console.error(err.stack || err); throw err; })


function combineSources() {
  return `
;(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  if (GLOBAL.define) { var __define_suckz__ = GLOBAL; delete GLOBAL.define; }
  (function() {
    var module = undefined, require = undefined, define = undefined;
    ${acornSource};
    ${escodegenSource};
  })();
  (function() {
    ${astSource}
  }).call(GLOBAL);
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.ast;
  if (__define_suckz__) { GLOBAL.define = __define_suckz__; }
})();
`;
}
