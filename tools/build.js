var fs = require("fs");
var path = require("path");
var rollup = require('rollup');
var babel = require('rollup-plugin-babel');


var mochaSrc = fs.readFileSync(require.resolve("mocha/mocha.js"));

var chaiSrc = (function() {
  var chaiCode = fs.readFileSync(require.resolve("chai/chai.js")),
      chaiSubsetCode = fs.readFileSync(require.resolve("chai-subset"));
  return `
;(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
    typeof global!=="undefined" ? global :
      typeof self!=="undefined" ? self : this;
  (function() {
    var module = undefined, exports = undefined; // no cjs require should be used!
    ${chaiCode}
  }).call(GLOBAL);

  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.chai;
  (function() {
    var module = {exports: {}};
    ${chaiSubsetCode}

    if (module.exports) {
      var ex = module.exports,
          chaiSubset = ex.chaiSubset || (typeof ex === "function" && ex);
    }

    if (chaiSubset)
      GLOBAL.chai.use(chaiSubset); // install then forget
  }).call(GLOBAL);
})();`

})();

var targetFile = "mocha-es6.js",
    targetFileMocha = "dist/mocha.js",
    targetFileChai = "dist/chai.js";

module.exports = Promise.resolve()

  .then(() => rollup.rollup({
    entry: "index.js",
    plugins: [babel({
      exclude: 'node_modules/**', sourceMap: false,
      presets: [["es2015", {"modules": false}]],
      plugins: [
        "external-helpers",
        "transform-async-to-generator",
        "syntax-object-rest-spread",
        "transform-object-rest-spread"
      ],
      babelrc: false
    })]
  }))

  .then(bundle =>
    bundle.generate({
      format: 'iife',
      moduleName: 'mochaEs6',
      globals: {
        "mocha": "mocha",
        "chai": "chai",
        "lively.modules": "lively.modules",
        "lively.ast": "lively.ast"
      }
    }))

  .then(bundled => {
    var source = `(function() {
var GLOBAL = typeof window !== "undefined" ? window :
    typeof global!=="undefined" ? global :
      typeof self!=="undefined" ? self : this;
${bundled.code}
  if (typeof module !== "undefined" && module.exports)
    module.exports = GLOBAL.mochaEs6;
})();`;

    return `${mochaSrc}\n${chaiSrc}\n${source}`;
  })

  .then(source => {
    fs.writeFileSync(targetFile, source);
    fs.writeFileSync(targetFileMocha, mochaSrc);
    fs.writeFileSync(targetFileChai, chaiSrc);
  })
  .then(() => console.log("Build " + targetFile))
  .catch(err => console.error(err.stack))
