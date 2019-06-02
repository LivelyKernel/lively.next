/*global require, process*/

var ast = require('lively.ast');
var classes = require('lively.classes');
var fs = require("fs");
var rollup = require('rollup');
var babel = require('rollup-plugin-babel');
var uglifyjs = require('uglify-es');
var targetFile = "dist/lively.graphics.js";
var noDepsFile = "dist/lively.graphics_no-deps.js";

var livelyLangSource = fs.readFileSync(require.resolve("lively.lang/dist/lively.lang.js"))

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

module.exports = Promise.resolve()
  .then(() => rollup.rollup({
    entry: "index.js",
    //external: ['lively.lang'],
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
      moduleName: 'lively.graphics',
      globals: {
        "lively.lang": "lively.lang"
      }
    }))

  // 3. massage code a little
  .then(bundled => {
    return {
noDeps: `(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  System.global._classRecorder = System.global._classRecorder || {};
  ${bundled.code}
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.graphics;
})();`,
complete: `(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  System.global._classRecorder = System.global._classRecorder || {};
  ${livelyLangSource}
  ${bundled.code}
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.graphics;
})();`};
  })

  // 4. create files
  .then(({noDeps, complete}) => {
    fs.writeFileSync(targetFile, complete);
    fs.writeFileSync(targetFile.replace('.js', '.min.js'), uglifyjs.minify(complete).code);
    fs.writeFileSync(noDepsFile, noDeps);
    fs.writeFileSync(noDepsFile.replace('.js', '.min.js'), uglifyjs.minify(noDeps).code);
  })

  .catch(err => console.error(err));
