/*global require, process*/

var fs = require("fs");
var path = require("path");
var rollup = require('rollup');
var babel = require('rollup-plugin-babel');
var uglify = require("uglify-js");

var targetFile = "dist/lively.vm.js";
var targetFile2 = "dist/lively.vm_standalone.js";
var targetFileMin = "dist/lively.vm_standalone.min.js";

var placeholderSrc = "throw new Error('Not yet read')";

var parts = {
  "lively.notifications":    {source: placeholderSrc, path: require.resolve("lively.notifications/dist/lively.notifications.js")},
  "lively.ast":              {source: placeholderSrc, path: require.resolve("lively.ast/dist/lively.ast.js")},
  "lively.classes":          {source: placeholderSrc, path: require.resolve("lively.classes/dist/lively.classes.js")},
  "lively.lang":             {source: placeholderSrc, path: require.resolve("lively.lang/dist/lively.lang.js")},
  "lively.source-transform": {source: placeholderSrc, path: require.resolve("lively.source-transform/dist/lively.source-transform.js")},
  "babel-regenerator":       {source: placeholderSrc, path: require.resolve("babel-regenerator-runtime/runtime.js")}
}

Object.keys(parts).forEach(name =>
  parts[name].source = fs.readFileSync(parts[name].path));

// output format - 'amd', 'cjs', 'es6', 'iife', 'umd'
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
      moduleName: 'lively.vm',
      globals: {
        "lively.lang": "lively.lang",
        "lively.ast": "lively.ast",
        "lively.notifications": "lively.notifications",
        "lively.classes": "lively.classes",
        "lively.source-transform": "lively.sourceTransform",
        "module": "typeof module !== 'undefined' ? module.constructor : {}",
        "fs": "typeof module !== 'undefined' && typeof module.require === 'function' ? module.require('fs') : {readFile: () => { throw new Error('fs module not available'); }}"
      },
    }))

  // 3. massage code a little
  .then(bundled => {
  
var noDeps = `(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  ${bundled.code}
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.vm;
})();`;

var complete = [
 "babel-regenerator",
 "lively.lang",
 "lively.notifications",
 "lively.ast",
 "lively.classes",
 "lively.source-transform",
].map(key => {
  return `
// INLINED ${parts[key].path}
${parts[key].source}
// INLINED END ${parts[key].path}`; }).join("\n") + "\n" + noDeps;

return {noDeps: noDeps, complete: complete};

  })

  // 4. inject dependencies
  .then(sources => {
    fs.writeFileSync(targetFile, sources.noDeps);
    fs.writeFileSync(targetFile2, sources.complete);
    // fs.writeFileSync(targetFileMin, uglify.minify(sources.complete, {fromString: true}).code);
  })
  .catch(err => { console.error(err.stack || err); throw err; })
