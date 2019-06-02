/*global require, process*/

var fs = require("fs");
var rollup = require('rollup');
var babel = require('rollup-plugin-babel');
var uglify = require("uglify-js");

var targetFile = "dist/lively.keyboard.js";
var targetFile2 = "dist/lively.keyboard.min.js";

if (!fs.existsSync('./dist')) {
  fs.mkdirSync('./dist');
}

module.exports = Promise.resolve()
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
      })]
  }))
  .then(bundle =>
    bundle.generate({
      format: 'iife',
      moduleName: 'lively.keyboard',
      globals: {
        "lively.lang": "lively.lang",
        "bowser": "bowser"
      },
    }))

  // 3. massage code a little
  .then(bundled => {
  
var noDeps = `(function() {
  ${String(fs.readFileSync("./bowser.min.js"))}

  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  ${bundled.code}
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.vm;
})();`;

return {noDeps: noDeps};

  })

  // 4. inject dependencies
  .then(sources => {
    fs.writeFileSync(targetFile, sources.noDeps);
    fs.writeFileSync(targetFile2, uglify.minify(sources.noDeps, {fromString: true}).code);
  })
  .catch(err => { console.error(err.stack || err); throw err; })
