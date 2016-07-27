/*global require, process*/

var fs = require("fs");
var path = require("path");
var rollup = require('rollup');
var babel = require('rollup-plugin-babel');

var targetFile1 = "dist/lively.notifications_no-deps.js";
var targetFile2 = "dist/lively.notifications.js";

var langSource = fs.readFileSync(require.resolve("lively.lang/dist/lively.lang.dev.js"));

module.exports = Promise.resolve()
  .then(() => rollup.rollup({
    entry: "index.js",
    plugins: [babel({
      exclude: 'node_modules/**',
      sourceMap: true,
      babelrc: false,
      plugins: ["syntax-object-rest-spread", "transform-object-rest-spread"],
      presets: ["es2015-rollup"]
    })]
  }))
  .then(bundle =>
    bundle.generate({
      format: 'iife',
      moduleName: 'lively.notifications',
      globals: {
        "lively.lang": "lively.lang"
      }
    }))

  // 3. massage code a little
  .then(bundled => {
    const noDeps = `(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  ${bundled.code}
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.notifications;
})();`;
    return {noDeps: noDeps, complete: `${langSource}\n${noDeps}`};
  })

  // 4. create files
  .then(sources => {
    fs.writeFileSync(targetFile1, sources.noDeps);
    fs.writeFileSync(targetFile2, sources.complete);
  })

  .catch(err => console.error(err));

