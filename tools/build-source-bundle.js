/*global require, process*/

var fs = require("fs");
var path = require("path");
var rollup = require('rollup');

var fetchFile = require.resolve("whatwg-fetch/fetch.js");
var targetFile1 = "dist/lively.modules_no-deps.js";
var targetFile2 = "dist/lively.modules.js";

var astSource = fs.readFileSync(require.resolve("lively.ast/dist/lively.ast_no-deps.js"));
var langSource = fs.readFileSync(require.resolve("lively.lang/dist/lively.lang.dev.js"));
var vmSource = fs.readFileSync(require.resolve("lively.vm/dist/lively.vm_no-deps.js"));

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

    source = source.replace('defaultSystem || prepareSystem(GLOBAL.System)', 'exports.System || prepareSystem(GLOBAL.System)');
    var noDeps = `(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  (function() {
    ${fs.readFileSync(fetchFile)}
  }).call(GLOBAL);
  ${source}
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.modules;
})();`;
    var complete = `${langSource}\n${astSource}\n${vmSource}\n${noDeps}`;
    return {noDeps: noDeps, complete: complete};
  })

  // 4. inject dependencies
  .then(sources => { fs.writeFileSync(targetFile1, sources.noDeps); fs.writeFileSync(targetFile2, sources.complete); })
