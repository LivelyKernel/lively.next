/*global require, process*/

var fs = require("fs");
var path = require("path");
var rollup = require('rollup');
var babel = require('rollup-plugin-babel');

var targetFile1 = "dist/lively.vm_no-deps.js";
var targetFile2 = "dist/lively.vm.js";

var astSource = fs.readFileSync(require.resolve("lively.ast/dist/lively.ast_no-deps.js"));
var langSource = fs.readFileSync(require.resolve("lively.lang/dist/lively.lang.dev.js"));

// output format - 'amd', 'cjs', 'es6', 'iife', 'umd'
module.exports = Promise.resolve()
  .then(() => rollup.rollup({
    entry: "index.js",
    plugins: [
      babel({
        exclude: 'node_modules/**', sourceMap: false,
        "presets": ["es2015-rollup"],
        babelrc: false,
        plugins: ['transform-async-to-generator']})
    ]
  }))
  .then(bundle =>
    bundle.generate({
      format: 'iife',
      moduleName: 'lively.vm',
      globals: {
        "lively.lang": "lively.lang",
        "lively.ast": "lively.ast",
        "module": "typeof module !== 'undefined' ? module.constructor : {}",
        "fs": "typeof module !== 'undefined' && typeof module.require === 'function' ? module.require('fs') : {readFile: () => { throw new Error('fs module not available'); }}"
      },
    }))

  // 3. massage code a little
  .then(bundled => {
    var noDeps = `(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  ${bundled.code}
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.vm;
})();`,
        complete = `${langSource}\n${astSource}\n${noDeps}`;
    return {noDeps: noDeps, complete: complete}
  })

  // 4. inject dependencies
  .then(sources => {
    fs.writeFileSync(targetFile1, sources.noDeps);
    fs.writeFileSync(targetFile2, sources.complete);
  })
  .catch(err => { console.error(err.stack || err); throw err; })
