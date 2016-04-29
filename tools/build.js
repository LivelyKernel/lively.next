/*global require, process*/

var fs = require("fs");
var path = require("path");
var rollup = require('rollup');
var builtins = require('rollup-plugin-node-builtins');

// import commonjs from 'rollup-plugin-commonjs';
// import nodeResolve from 'rollup-plugin-node-resolve';
// import globals from 'rollup-plugin-node-globals';
// import builtins from 'rollup-plugin-node-builtins';
// import json from 'rollup-plugin-json';
// rollup({
//   entry: 'main.js',
//   plugins: [
//     builtins(),
//     nodeResolve({ jsnext: true, main: true, browser: true }),
//     commonjs({
//       ignoreGlobal: true
//     }),
//     globals(),
//     json()
//   ]
// })
var targetFile = "dist/lively.vm.js";

// output format - 'amd', 'cjs', 'es6', 'iife', 'umd'
module.exports = Promise.resolve()
  .then(() => rollup.rollup({
    entry: "index.js",
    plugins: [
      builtins(),
    ]
  }))
  .then(bundle =>
    bundle.generate({
      format: 'iife',
      moduleName: 'lively.vm',
      globals: {
        "lively.lang": "lively.lang",
        "lively.ast": "lively.ast",
        "escodegen": "GLOBAL.escodegen",
        "module": "typeof module !== 'undefined' ? module.constructor : {}",
        "fs": "typeof module !== 'undefined' && typeof module.require === 'function' ? module.require('fs') : {readFile: () => { throw new Error('fs module not available'); }}"
      },
    }))

  // 3. massage code a little
  .then(bundled => `(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  ${bundled.code}
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.ast;
})();`)

  // 4. inject dependencies
  .then(source => fs.writeFileSync(targetFile, source))
  .catch(err => { console.error(err.stack || err); throw err; })
