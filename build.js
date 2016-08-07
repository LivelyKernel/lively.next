/*global require, process*/

var fs = require("fs");
var path = require("path");
var rollup = require('rollup');
var babel = require('rollup-plugin-babel');

var targetFile = "dist/lively.resources.js";

var regeneratorSource = fs.readFileSync(require.resolve("babel-regenerator-runtime/runtime.js"));

module.exports = Promise.resolve()
  .then(() => rollup.rollup({
    entry: "index.js",
    plugins: [babel({
      exclude: 'node_modules/**',
      sourceMap: true,
      babelrc: false,
      plugins: ['transform-async-to-generator', "syntax-object-rest-spread", "transform-object-rest-spread"],
      presets: ["es2015-rollup"]
    })]
  }))
  .then(bundle =>
    bundle.generate({
      format: 'iife',
      moduleName: 'lively.resources'
    }))
  .then(bundled => {
    var source = bundled.code;
    source = source.replace('defaultSystem || prepareSystem(GLOBAL.System)', 'exports.System || prepareSystem(GLOBAL.System)');
    return `
${regeneratorSource}\n
(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  ${source}
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.modules;
})();`;
  })
  .then(compiled => {
    fs.writeFileSync(targetFile, compiled);
  });
