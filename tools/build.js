/*global require, process*/

var fs = require("fs");
var path = require("path");
var rollup = require('rollup');

var targetFile = "dist/lively.modules.js";

module.exports = Promise.resolve()
  .then(() => rollup.rollup({
    entry: "index.js",
    plugins: [
      // builtins(),
    ]
  }))
  .then(bundle =>
    bundle.generate({
      format: 'iife',
      moduleName: 'lively.modules',
      globals: {
        "lively.lang": "lively.lang",
        "lively.ast": "lively.ast",
        "lively.vm/lib/evaluator.js": "lively.vm",
        // "escodegen": "GLOBAL.escodegen",
        // "module": "typeof module !== 'undefined' ? module.constructor : {}",
        // "fs": "typeof module !== 'undefined' && typeof module.require === 'function' ? module.require('fs') : {readFile: () => { throw new Error('fs module not available'); }}"
      },
    }))

  // 3. massage code a little
  .then(bundled => {
    var source = bundled.code;
    // FIXME rollup inlines our optional assignment that we need for self-dev
    source = source.replace('defaultSystem || getSystem("default")', 'exports.System || getSystem("default")');
    return `(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  ${source}
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.modules;
})();`;
  })

  // 4. inject dependencies
  .then(source => fs.writeFileSync(targetFile, source))
  .catch(err => { console.error(err.stack || err); throw err; })
