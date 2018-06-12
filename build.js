/*global require, process, module*/

var fs = require("fs");
var path = require("path");
var rollup = require('rollup');
var babel = require('rollup-plugin-babel');
var uglifyjs = require('uglify-es');

var targetFile = "dist/lively.serializer2.js";
var minified = "dist/lively.serializer2.min.js";

module.exports = Promise.resolve()
  .then(() => rollup.rollup({
    entry: "./index.js",
    plugins: [babel({
      exclude: 'node_modules/**', sourceMap: false,
      "presets": [["es2015", {modules: false}]],
      "plugins": [["inline-json-import", {}], 'transform-async-to-generator', "syntax-object-rest-spread", "transform-object-rest-spread", "external-helpers"],
      babelrc: false
    })]
  }))
  .then(bundle =>
    bundle.generate({
      format: 'iife',
      moduleName: 'lively.serializer2',
      globals: {
        "lively.graphics": "lively.graphics",
        "lively.lang": "lively.lang",
        "lively.morphic": "{HTMLMorph: null}",
        "lively.bindings": "lively.bindings",
        "https://cdn.rawgit.com/cytoscape/cytoscape.js/v2.7.15/dist/cytoscape.js": "{default: null}",
        "https://cdn.rawgit.com/cytoscape/cytoscape.js-cose-bilkent/1.0.5/cytoscape-cose-bilkent.js": "{default: null}"
      }
    }))

  // 3. massage code a little
  .then(bundled => {
    return `(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  ${bundled.code}
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.serializer2;
})();`;
  })

  // 4. create files
  .then(source => {
    fs.writeFileSync(targetFile, source);
    fs.writeFileSync(minified, uglifyjs.minify(source).code);
  })

  .catch(err => console.error(err));
