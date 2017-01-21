/*global require, process*/

var fs = require("fs");
var path = require("path");
var rollup = require('rollup');
var babel = require('rollup-plugin-babel');

var targetFile1 = "dist/lively.morphic_no-deps.js";
var targetFile2 = "dist/lively.morphic.js";

var placeholderSrc = "throw new Error('Not yet read')";

var parts = {
  "lively.lang":             {source: placeholderSrc, path: require.resolve("lively.lang/dist/lively.lang.dev.js")},
  "lively.graphics":         {source: placeholderSrc, path: require.resolve('lively.graphics/dist/lively.graphics.js')},
  "lively.serializer2":      {source: placeholderSrc, path: require.resolve('lively.serializer2/dist/lively.serializer2.js')},
  "lively.bindings":         {source: placeholderSrc, path: require.resolve('lively.bindings/dist/lively.bindings.js')},
  "virtual-dom":             {source: placeholderSrc, path: require.resolve('virtual-dom/dist/virtual-dom.js')},
  "gsap":                    {source: placeholderSrc, path: require.resolve('gsap/src/minified/TweenMax.min.js')},
  "bowser":                  {source: placeholderSrc, path: require.resolve('bowser')},
  "kld-intersections":       {source: placeholderSrc, path: "dist/kld-intersections.js"},
  // "jsdom":                   {source: placeholderSrc, path: require.resolve("dist/jsdom.js")}
}
// output format - 'amd', 'cjs', 'es6', 'iife', 'umd'

module.exports = Promise.resolve()
// 1. make sure deps are build
//.then(() => require("./build-kld-intersections.js"))
  // .then(() => require("./build-jsdom.js"))
  .then(() => {
    Object.keys(parts).forEach(name =>
      parts[name].source = fs.readFileSync(parts[name].path));
 })
  .then(() => {
    console.log('rolling up...')
    return rollup.rollup({
      entry: "index.js",
      plugins: [
        babel({
          exclude: 'node_modules/**',
          sourceMap: false,
          babelrc: false,
          plugins: ['transform-async-to-generator', "syntax-object-rest-spread", "transform-object-rest-spread", "external-helpers"],
          presets: [["es2015", {"modules": false}]]
        })
      ]
    });
})
  .then(bundle => {
    return bundle.generate({
      format: 'iife',
      moduleName: 'lively.morphic',
      globals: {
        "bowser": "bowser",
        "gsap": "TweenMax",
        "virtual-dom": "virtualDom",
        "lively.lang": "lively.lang",
        "lively.bindings": "lively.bindings",
        "lively.graphics": "lively.graphics",
        "lively.serializer2": "lively.serializer2",
        "lively.morphic": "lively.morphic"
      }
    })
  })

  // 3. massage code a little
  .then(bundled => {
    console.log("massging code...")
    var source = bundled.code;
    var noDeps = `
// INLINED ${parts["gsap"].path}
${parts["gsap"].source}
// INLINED END ${parts["gsap"].path}
${parts["kld-intersections"].source}
(function() {
  ${parts["bowser"].source}
  ${parts["virtual-dom"].source}
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  ${source}
  if (typeof module !== "undefined" && typeof require === "function") module.exports = GLOBAL.lively.modules;
})();`;

    var complete = [
      "lively.lang",
      "lively.graphics",
      "lively.serializer2",
      "lively.bindings"
].map(key => {
  return `
// INLINED ${parts[key].path}
${parts[key].source}
// INLINED END ${parts[key].path}`; }).join("\n") + "\n" + noDeps;

    return {noDeps: noDeps, complete: complete};
  })

  // 4. create files
  .then(sources => {
    console.log("writing files...")
    fs.writeFileSync(targetFile1, sources.noDeps);
    fs.writeFileSync(targetFile2, sources.complete);
  })
