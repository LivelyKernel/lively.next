/*global require, process*/

var fs = require("fs");
var path = require("path");
var rollup = require('rollup');
var babel = require('rollup-plugin-babel');
var uglifyjs = require('uglify-es');
var ast = require('lively.ast/dist/lively.ast.js');
var classes = require('lively.classes');

var targetFile = "dist/lively.bindings.js";

if (!fs.existsSync('./dist')) {
  fs.mkdirSync('./dist');
}

const opts = {
  classHolder: {type: "Identifier", name: "_classRecorder"}, 
  functionNode: {type: "Identifier", name: "lively.classes.runtime.initializeClass"},
  currentModuleAccessor: ast.parse(`({
      pathInPackage: () => {
         return '/index.js'
      },
      subscribeToToplevelDefinitionChanges: () => () => {},
      package: () => { 
        return {
          name: "${JSON.parse(fs.readFileSync('./package.json')).name}",
          version: "${JSON.parse(fs.readFileSync('./package.json')).version}"
        } 
      } 
    })`).body[0].expression,
};

// output format - 'amd', 'cjs', 'es6', 'iife', 'umd'
module.exports = Promise.resolve()

  .then(() => rollup.rollup({
    entry: "index.js",
    plugins: [
      {
        transform: (source, id) => {
            return ast.stringify(ast.transform.objectSpreadTransform(classes.classToFunctionTransform(source, opts)));
        }
      },
      babel({
        exclude: 'node_modules/**', sourceMap: false,
        "presets": [["es2015", {modules: false}]],
        "plugins": ['transform-async-to-generator', "syntax-object-rest-spread", "transform-object-rest-spread", "external-helpers"],
        babelrc: false
      })]
  }))

  .then(bundle =>
    bundle.generate({
      format: 'iife',
      moduleName: 'lively.bindings',
      globals: {
        "lively.lang": "lively.lang",
        "lively.source-transform": 'lively.sourceTransform',
        "module": "typeof module !== 'undefined' ? module.constructor : {}"
      },
    }))

  // 3. massage code a little
  .then(bundled => {
    return `(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  System.global._classRecorder = System.global._classRecorder || {};
  ${bundled.code}
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.bindings;
})();`;
  })

  // 4. inject dependencies
  .then(source => {
    fs.writeFileSync(targetFile, source);
    fs.writeFileSync(targetFile.replace('.js', '.min.js'), uglifyjs.minify(source, {keep_fnames: true}).code);
  })
  .catch(err => { console.error(err.stack || err); throw err; })
