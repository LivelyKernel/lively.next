/*global require, process*/

var fs = require("fs");
var path = require("path");
var rollup = require('rollup');
var babel = require('rollup-plugin-babel');
var uglify = require("uglify-js");

var targetFile = "dist/lively.2lively_client.js";
var targetFileMin = "dist/lively.2lively_client.min.js";
var targetFileNoDeps = "dist/lively.2lively_client_no-deps.js";

module.exports = Promise.resolve()
  .then(() => rollup.rollup({
    entry: "client.js",
    plugins: [
      babel({
        exclude: 'node_modules/**', sourceMap: false,
        "presets": [["es2015", {modules: false}]],
         plugins: [
           "transform-async-to-generator",
           "syntax-object-rest-spread",
           "transform-object-rest-spread",
           "external-helpers"
         ],
        babelrc: false
      })]
  }))
  .then(bundle =>
    bundle.generate({
      format: 'iife',
      moduleName: 'lively.l2l.L2LClient',
      globals: {
        "lively.lang": "lively.lang",
        "socket.io-client/dist/socket.io.js": "io"
      },
    }))

  // 3. massage code a little
  .then(bundled => {

var noDeps = `(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  ${bundled.code}
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.l2l.client;
})();`;

var complete = `(function() {
  ${fs.readFileSync(require.resolve("socket.io-client/dist/socket.io.slim.js")).toString()}
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  ${bundled.code}
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.l2l.client;
})();`;

return {noDeps, complete};

  })

  // 4. inject dependencies
  .then(sources => {
    fs.writeFileSync(targetFile, sources.complete);
    fs.writeFileSync(targetFileMin, uglify.minify(sources.complete, {fromString: true}).code);
    fs.writeFileSync(targetFileNoDeps, sources.noDeps);
  })
  .catch(err => { console.error(err.stack || err); throw err; })
