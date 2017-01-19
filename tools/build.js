/*global require, process*/

var fs = require("fs"),
    path = require("path"),
    rollup = require('rollup'),
    babel = require('rollup-plugin-babel'),
    uglify = require("uglify-js");

var targetFile = "dist/lively.lang.js",
    targetFileMin = "dist/lively.lang.min.js";

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
      moduleName: 'lively.lang'
    }))

  .then(bundled => fs.writeFileSync(targetFile, fixSource(bundled.code)))
  .then(() => fs.writeFileSync(targetFileMin, uglify.minify(targetFile).code))
  .then(() => console.log(`lively.lang bundled into ${process.cwd()}/${targetFile}`))
  .catch(err => { console.error(err.stack || err); throw err; });


function fixSource(source) {
  return `
(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  if (typeof GLOBAL.lively === "undefined") GLOBAL.lively = {};
  (function() {
    ${source}
  }).call(GLOBAL);
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.lang;
})();
`;
}
