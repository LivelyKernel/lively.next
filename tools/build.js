/*global require, process*/

var fs = require("fs"),
    path = require("path"),
    rollup = require('rollup'),
    babel = require('rollup-plugin-babel');

var targetFile = "dist/lively.user-client.js";

module.exports = Promise.resolve()
  .then(() => rollup.rollup({
    entry: "index.js",
    plugins: [
      babel({
        exclude: 'node_modules/**',
        babelrc: false,
        sourceMap: false,
        plugins: ['transform-async-to-generator', "syntax-object-rest-spread", "transform-object-rest-spread", "external-helpers"],
        presets: [["es2015", {"modules": false}]]
    })]
  }))

  .then(bundle =>
    bundle.generate({
      format: 'iife',
      moduleName: 'lively.user'
    }))

  .then(bundled => fs.writeFileSync(targetFile, fixSource(bundled.code)))
  .then(() => console.log(`lively.user bundled into ${process.cwd()}/${targetFile}`))
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
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.user;
})();
`;
}
