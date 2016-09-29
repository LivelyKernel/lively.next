/*global require, process*/

var fs = require("fs");
var path = require("path");
var rollup = require('rollup');
var babel = require('rollup-plugin-babel');

var targetFile1 = "dist/lively.resources_no-deps.js";
var targetFile2 = "dist/lively.resources.js";

var regeneratorSource = fs.readFileSync(require.resolve("babel-regenerator-runtime/runtime.js"));

module.exports = Promise.resolve()
  .then(() => rollup.rollup({
    entry: "index.js",
    plugins: [babel({
      exclude: 'node_modules/**',
      sourceMap: true,
      babelrc: false,
      plugins: ['transform-async-to-generator', "syntax-object-rest-spread", "transform-object-rest-spread", "external-helpers"],
      presets: [["es2015", {"modules": false}]]
    })]
  }))
  .then(bundle =>
    bundle.generate({
      format: 'iife',
      moduleName: 'lively.resources',
      globals: {
        "fs": "typeof module !== 'undefined' && typeof module.require === 'function' ? module.require('fs') : {readFile: function() { throw new Error('fs module not available'); }}"
      }
    }))
  .then(bundled => {
    const noDeps = `(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  ${bundled.code}
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.resources;
})();`;
    return {noDeps: noDeps, complete: `${regeneratorSource}\n${noDeps}`};
  })
  .then(compiled => {
    fs.writeFileSync(targetFile1, compiled.noDeps);
    fs.writeFileSync(targetFile2, compiled.complete);
  })
  .catch(err => console.error(err));

