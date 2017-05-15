/*global require, process*/

var fs = require("fs");
var path = require("path");
var rollup = require('rollup');
var babel = require('rollup-plugin-babel');
var uglify = require("uglify-es");

var targetFile1 = "dist/lively.modules_no-deps.js";
var targetFile2 = "dist/lively.modules.js";
var targetFile3 = "dist/lively.modules.min.js";

var placeholderSrc = "throw new Error('Not yet read')";

var parts = {
  "semver":                  {source: placeholderSrc, path: require.resolve("semver")},
  "lively.notifications":    {source: placeholderSrc, path: require.resolve("lively.notifications/dist/lively.notifications.js")},
  "lively.ast":              {source: placeholderSrc, path: require.resolve("lively.ast/dist/lively.ast.js")},
  "lively.classes":          {source: placeholderSrc, path: require.resolve("lively.classes/dist/lively.classes.js")},
  "lively.lang":             {source: placeholderSrc, path: require.resolve("lively.lang/dist/lively.lang.js")},
  "lively.vm":               {source: placeholderSrc, path: require.resolve("lively.vm/dist/lively.vm.js")},
  "lively.source-transform": {source: placeholderSrc, path: require.resolve("lively.source-transform/dist/lively.source-transform.js")},
  "lively.resources":        {source: placeholderSrc, path: require.resolve("lively.resources/dist/lively.resources_no-deps.js")},
  "lively.storage":          {source: placeholderSrc, path: require.resolve("lively.storage/dist/lively.storage_with-pouch.js")},
  "systemjs-init":           {source: placeholderSrc, path: path.join(__dirname, "../systemjs-init.js")},
  "babel-regenerator":       {source: placeholderSrc, path: require.resolve("babel-regenerator-runtime/runtime.js")}
}

Object.keys(parts).forEach(name =>
  parts[name].source = fs.readFileSync(parts[name].path));

module.exports = Promise.resolve()
  .then(() => rollup.rollup({
    entry: "index.js",
    external: ["semver"],
    plugins: [
      babel({
        exclude: 'node_modules/**',
        sourceMap: true,
        babelrc: false,
        plugins: ['transform-async-to-generator', "syntax-object-rest-spread", "transform-object-rest-spread", "external-helpers"],
        presets: [["es2015", {"modules": false}]]
      })
    ]
  }))
  .then(bundle =>
    bundle.generate({
      format: 'iife',
      moduleName: 'lively.modules',
      globals: {
        "semver": "semver",
        "lively.lang": "lively.lang",
        "lively.classes": "lively.classes",
        "lively.ast": "lively.ast",
        "lively.vm": "lively.vm",
        "lively.notifications": "lively.notifications",
        "lively.resources": "lively.resources",
        "lively.storage": "lively.storage"
      }
    }))

  // 3. massage code a little
  .then(bundled => {
    var source = bundled.code;
    // FIXME rollup inlines our optional assignment that we need for self-dev

    source = source.replace('defaultSystem || prepareSystem(GLOBAL.System)', 'exports.System || prepareSystem(GLOBAL.System)');

var semverSourcePatched = `
var semver;
(function(exports, module) {
// INLINED ${parts.semver.path}
${parts.semver.source}
// INLINED END ${parts.semver.path}
semver = exports;
})({}, {});
`;

var noDeps = `
// INLINED ${parts["systemjs-init"].path}
${parts["systemjs-init"].source}
// INLINED END ${parts["systemjs-init"].path}
(function() {
${semverSourcePatched}
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  ${source}
  if (typeof module !== "undefined" && typeof require === "function") module.exports = GLOBAL.lively.modules;
})();`;

var complete = [
 "babel-regenerator",
 "lively.lang",
 "lively.notifications",
 "lively.ast",
 "lively.classes",
 "lively.source-transform",
 "lively.vm",
 "lively.resources",
 "lively.storage"
].map(key => {
  return `
// INLINED ${parts[key].path}
${parts[key].source}
// INLINED END ${parts[key].path}`; }).join("\n") + "\n" + noDeps;

    return {noDeps: noDeps, complete: complete};
  })

  // 4. create files
  .then(sources => {
    fs.writeFileSync(targetFile1, sources.noDeps);
    fs.writeFileSync(targetFile2, sources.complete);
    let minified = uglify.minify(sources.complete, {});
    if (minified.error) throw minified.error;
    fs.writeFileSync(targetFile3, minified.code);
  })
  .catch(err => { console.error(err.stack || err); throw err; });