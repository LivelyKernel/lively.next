/*global require, process*/

var fs = require("fs");
var path = require("path");
var rollup = require('rollup');
var babel = require('rollup-plugin-babel');
var uglify = require("uglify-js");

var targetFileNode = "dist/lively.2lively_client.node.js";
var targetFile = "dist/lively.2lively_client.js";
var targetFileMin = "dist/lively.2lively_client.min.js";
var targetFileNoDeps = "dist/lively.2lively_client_no-deps.js";

async function httpGET(url) {
  let http = require(url.match(/^https:/) ? "https" : "http");
  return new Promise((resolve, reject) => {
    let req = http.get(url, res => {
      let data = "";
      res.on("data", d => data += d);
      res.on("end", () => resolve(data));
      res.on("error", err => reject(err));
    });
  });
}

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


var node = `(function() {
  var module = {exports: {}}, exports = module.exports;
  ${fs.readFileSync("/Users/robert/Lively/lively-dev2/socket.io/examples/webpack-build/dist/socket.io-client.node.js")}
  global.io = module.exports;
})();
(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  ${bundled.code}
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.l2l.client;
})();`;

var browser = `(function() {
  ${fs.readFileSync(require.resolve("socket.io-client/dist/socket.io.slim.js")).toString()}
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  ${bundled.code}
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.l2l.client;
})();`;

return {noDeps, browser, node};

  })

  // 4. inject dependencies
  .then(sources => {
    fs.writeFileSync(targetFileNode, sources.node);
    fs.writeFileSync(targetFile, sources.browser);
    fs.writeFileSync(targetFileMin, uglify.minify(sources.browser, {fromString: true}).code);
    fs.writeFileSync(targetFileNoDeps, sources.noDeps);
  })
  .catch(err => { console.error(err.stack || err); throw err; })
