/*global global, require,System*/
var uglifyjs = require('uglify-es');
var livelyLang = require('lively.lang');
var fs = require('fs');
var path = require("path");
global.window = {}
global.navigator = {};
var babel = require("babel-standalone");

var semverSourcePatched = `
var semver;
(function(exports, module) {
${fs.readFileSync(require.resolve("semver")).toString()}
semver = exports;
})({}, {});
`;

var runtimeSource = `(${uglifyjs.minify(fs.readFileSync(require.resolve('lively.freezer/runtime.js')).toString()).code.slice(0,-1).replace('export ', '')})()`;

let options = {
  sourceMap: undefined, // 'inline' || true || false
  inputSourceMap: undefined,
  babelrc: false,
  presets: [["es2015", {"modules": false}]],
  plugins: ['transform-exponentiation-operator', 'transform-async-to-generator', 
            "syntax-object-rest-spread", "transform-object-rest-spread"],
  code: true,
  ast: false
};
runtimeSource = babel.transform(runtimeSource, options).code;

var res =  [
uglifyjs.minify(semverSourcePatched).code,
uglifyjs.minify(runtimeSource).code,  
uglifyjs.minify(fs.readFileSync(require.resolve('babel-regenerator-runtime')).toString()).code,
"//LIVELY.LANG - 100k",
fs.readFileSync(require.resolve('lively.lang/dist/lively.lang.min.js')), 
"//LIVELY.NOTIFICATIONS - 5k",
uglifyjs.minify(fs.readFileSync(require.resolve('lively.notifications')).toString()).code,
"//LIVELY.AST",
"lively.ast = {query: {}, acorn: {}, nodes: {}, BaseVisitor: function() {}};",
//uglifyjs.minify(fs.readFileSync(require.resolve('lively.ast')).toString()).code,
"//LIVELY.CLASSES - 45k",
uglifyjs.minify(fs.readFileSync(require.resolve('lively.classes')).toString()).code,
"//LIVELY.SOURCE-TRANSFORM - 45k",
uglifyjs.minify(fs.readFileSync(require.resolve('lively.source-transform')).toString()).code,
"//LIVELY.VM",
//uglifyjs.minify(fs.readFileSync(require.resolve('lively.vm')).toString()).code,
"//LIVELY.RESOURCES - 100k",
uglifyjs.minify(fs.readFileSync(require.resolve('lively.resources/dist/lively.resources_no-deps.js')).toString()).code,
"//LIVELY.STORAGE - 120k",
"const PouchDB = {plugin: function() {}};\nconst pouchdbAdapterMem = {};",
fs.readFileSync(require.resolve('lively.storage/dist/lively.storage_no-deps.min.js')), 
"//LIVELY.GRAPHICS - 60k",
fs.readFileSync(require.resolve("lively.graphics/dist/lively.graphics_no-deps.min.js")),
"//LIVELY.BINDINGS - 14k",
fs.readFileSync(require.resolve("lively.bindings/dist/lively.bindings.min.js")),
"//LIVELY.SERIALIZER - 45k",
fs.readFileSync(require.resolve("lively.serializer2/dist/lively.serializer2.min.js")),
"//LIVELY.MORPHIC - 1MB",
fs.readFileSync(require.resolve("lively.morphic/dist/lively.morphic_no-deps.min.js")),
"//pep.js",
fs.readFileSync(require.resolve('lively.freezer/deps/pep.min.js')),
"//fetch.js",
uglifyjs.minify(fs.readFileSync(require.resolve('lively.freezer/deps/fetch.umd.js')).toString()).code
].join('\n');

fs.writeFileSync('./runtime-deps.js', res);
fs.writeFileSync('./static-runtime.js', runtimeSource);
