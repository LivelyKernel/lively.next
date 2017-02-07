/*global require, process*/

var systemjs = require('../../lively.modules/node_modules/systemjs');
var lang = require('lively.lang');
var ast = require('../../lively.ast');
var classes = require('lively.classes');
var fs = require("fs");
var path = require("path");
var rollup = require('rollup');
var babel = require('rollup-plugin-babel');

var targetFile1 = "dist/lively.morphic_no-deps.js";
var targetFile2 = "dist/lively.morphic.js";

var placeholderSrc = "throw new Error('Not yet read')";

var parts = {
  "lively.lang":             {source: placeholderSrc, path: require.resolve("lively.lang/dist/lively.lang.js")},
  "lively.graphics":         {source: placeholderSrc, path: require.resolve('lively.graphics/dist/lively.graphics.js')},
  "lively.serializer2":      {source: placeholderSrc, path: require.resolve('lively.serializer2/dist/lively.serializer2.js')},
  "lively.bindings":         {source: placeholderSrc, path: require.resolve('lively.bindings/dist/lively.bindings.js')},
  "virtual-dom":             {source: placeholderSrc, path: require.resolve('virtual-dom/dist/virtual-dom.js')},
  "gsap":                    {source: placeholderSrc, path: require.resolve('gsap/src/minified/TweenMax.min.js')},
  "bowser":                  {source: placeholderSrc, path: require.resolve('bowser')},
  "svg-intersections":       {source: placeholderSrc, path: "dist/svg-intersections.js"},
  // "jsdom":                   {source: placeholderSrc, path: require.resolve("dist/jsdom.js")}
}
// output format - 'amd', 'cjs', 'es6', 'iife', 'umd'

function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
  }

function insertForwardDeclarations(source) {
   const vars = {
      LoadingIndicator: "Morph$$1",
      ListItemMorph: "Label$$1",
      "DropDownList$$1": "Button$$1"},
         exportedNames = {
            LoadingIndicator: 'LoadingIndicator',
            ListItemMorph: 'ListItemMorph',
            "DropDownList$$1": 'DropDownList'
         };
   for (var v in vars) {
    console.log('replacing ' + v);
    source = source.replace(`var ${v}`, () => `exports.${exportedNames[v]} = ${v}`);
     var re = new RegExp(`${escapeRegExp(v)} = function \(.*\) \{\[\\s\\S\]*?\}\\(${escapeRegExp(vars[v])}\\);`),
         fn = source.match(re),
         fn = fn ? fn[0] : "",
         args = /\(\s*([^)]+?)\s*\)/.exec(fn);
      if (!fn) {
         console.log('could not replace ', v);
         continue;
     }
      if (args[1]) {
        var superClasses = args[1].split(/\s*,\s*/);
        if (superClasses.length > 0) console.log("Inserting check for ", superClasses[0]);
        var instfn = fn.replace('inherits', `
              inherits`);
        source = source.replace(fn, () => `(function ${v}_Builder() { 
              if (${v}) return ${v};
              if (!${vars[v]}) {
                 setTimeout(${v}_Builder, 0);
                 return;
              }
        ${instfn}})()`);
        source = source.replace(`exports.${exportedNames[v]} = ${v};`, "");
      }
   }
   return Object.keys(vars).length > 0 ? "var " + Object.keys(vars).join(',') + ";\n" + source : source;
}

const opts = {classHolder: {type: "Identifier", name: "_classRecorder"}, functionNode: {type: "Identifier", name: "lively.classes.runtime.initializeClass"}};

module.exports = Promise.resolve()
// 1. make sure deps are build
//.then(() => require("./build-kld-intersections.js"))
  // .then(() => require("./build-jsdom.js"))
  .then(() => {
    Object.keys(parts).forEach(name =>
      parts[name].source = fs.readFileSync(parts[name].path).toString());
 })
  .then(() => {
    console.log('rolling up...')
    return rollup.rollup({
      entry: "index.js",
      plugins: [
        {transform: (source, id) => {
            return ast.stringify(ast.transform.objectSpreadTransform(classes.classToFunctionTransform(source, opts)));
        }},
        babel({
          exclude: 'node_modules/**',
          sourceMap: false,
          babelrc: false,
          plugins: ['transform-exponentiation-operator', 'transform-async-to-generator', "syntax-object-rest-spread", "transform-object-rest-spread", "external-helpers"],
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
        "lively.morphic": "lively.morphic",
        "lively.resources": "lively.resources",
        "lively.notifications": "lively.notifications",
        "svg-intersections": "svgIntersections",
        "lively.morphic/list.js": "lively.morphic" 
      }
    })
  })

  // 3. massage code a little
  .then(bundled => {
    console.log("massging code...")
    var source = bundled.code;
    var noDeps = `
${parts["gsap"].source}\n
${parts["svg-intersections"].source}\n
(function() {
  ${parts["bowser"].source}
  ${parts["virtual-dom"].source}
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  System.global._classRecorder = {};
  ${insertForwardDeclarations(source)}
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
// INLINED END ${parts[key].path}`
}).join("\n") + "\n" + noDeps;

    return {noDeps: noDeps, complete: complete};
  })

  // 4. create files
  .then(sources => {
    console.log("writing files...")
    fs.writeFileSync(targetFile1, sources.noDeps);
    fs.writeFileSync(targetFile2, sources.complete);
  })
