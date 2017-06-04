/*global require, process*/

var fs = require("fs");
var path = require("path");
var rollup = require('rollup');
var babel = require('rollup-plugin-babel');
var uglify = require("uglify-es");

var targetFile1 = "dist/lively-system-interface-only-local.js";

module.exports = Promise.resolve()
  .then(() => rollup.rollup({
    entry: "index-local-only.js",
    plugins: [
      babel({
        exclude: 'node_modules/**',
        sourceMap: false,
        babelrc: false,
        plugins: ['transform-async-to-generator', "syntax-object-rest-spread", "transform-object-rest-spread", "external-helpers"],
        presets: [["es2015", {"modules": false}]]
      })
    ]
  }))
  .then(bundle =>
    bundle.generate({
      format: 'iife',
      moduleName: 'lively.systemInterface',
      globals: {
        "lively.lang": "lively.lang",
        "lively.modules": "lively.modules",
        "lively.ast": "lively.ast",
        "lively.vm": "lively.vm",
        "lively.resources": "lively.resources"
      }
    }))

  // 3. massage code a little
  .then(bundled => {
    var source = bundled.code;
    // FIXME rollup inlines our optional assignment that we need for self-dev

    source = source.replace('defaultSystem || prepareSystem(GLOBAL.System)', 'exports.System || prepareSystem(GLOBAL.System)');


var noDeps = `
(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  ${source}
  if (typeof module !== "undefined" && typeof require === "function") module.exports = GLOBAL.lively.systemInterface;
})();`;

    return {noDeps: noDeps};
  })

  // 4. create files
  .then(sources => {
    fs.writeFileSync(targetFile1, sources.noDeps);
  })
  .catch(err => { console.error(err.stack || err); throw err; });