/*global require, process*/

var fs = require("fs");
var path = require("path");
var rollup = require('rollup');
var babel = require('rollup-plugin-babel');
var targetFile = "dist/lively.graphics.js";

livelyLangSource = fs.readFileSync(require.resolve("lively.lang/dist/lively.lang.js"))

module.exports = Promise.resolve()
  .then(() => rollup.rollup({
    entry: "index.js",
    //external: ['lively.lang'],
    plugins: [babel({
      exclude: 'node_modules/**', sourceMap: false,
      "presets": [["es2015", {modules: false}]],
      "plugins": ['transform-async-to-generator', "syntax-object-rest-spread", "transform-object-rest-spread", "external-helpers"],
      babelrc: false
    })]
  }))
  .then(bundle =>
    bundle.generate({
      format: 'iife',
      moduleName: 'lively.graphics',
      globals: {
        "lively.lang": "lively.lang"
      }
    }))

  // 3. massage code a little
  .then(bundled => {
    return `(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  ${livelyLangSource}
  ${bundled.code}
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.graphics;
})();`;
  })

  // 4. create files
  .then(source => {
    fs.writeFileSync(targetFile, source);
  })

  .catch(err => console.error(err));
