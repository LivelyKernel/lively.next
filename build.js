/*global require,System*/
var uglifyjs = require('uglify-es');
var livelyLang = require('lively.lang');
var fs = require('fs');
var path = require("path");

var semverSourcePatched = `
var semver;
(function(exports, module) {
${fs.readFileSync(require.resolve("semver")).toString()}
semver = exports;
})({}, {});
`;


var runtimeSource = `(${uglifyjs.minify(fs.readFileSync(require.resolve('lively.freezer/runtime.js')).toString()).code.slice(0,-1).replace('export ', '')})()`;

var res =  [
uglifyjs.minify(semverSourcePatched).code,
runtimeSource,  
uglifyjs.minify(fs.readFileSync(require.resolve('babel-regenerator-runtime')).toString()).code,
"//LIVELY.LANG",
fs.readFileSync(require.resolve('lively.lang/dist/lively.lang.min.js')), 
"//LIVELY.NOTIFICATIONS",
uglifyjs.minify(fs.readFileSync(require.resolve('lively.notifications')).toString()).code,
"//LIVELY.AST",
"lively.ast = {query: {}, acorn: {}, nodes: {}, BaseVisitor: function() {}};",
//uglifyjs.minify(fs.readFileSync(require.resolve('lively.ast')).toString()).code,
"//LIVELY.CLASSES",
uglifyjs.minify(fs.readFileSync(require.resolve('lively.classes')).toString()).code,
"//LIVELY.SOURCE-TRANSFORM",
uglifyjs.minify(fs.readFileSync(require.resolve('lively.source-transform')).toString()).code,
"//LIVELY.VM",
//uglifyjs.minify(fs.readFileSync(require.resolve('lively.vm')).toString()).code,
"//LIVELY.RESOURCES",
uglifyjs.minify(fs.readFileSync(require.resolve('lively.resources/dist/lively.resources_no-deps.js')).toString()).code,
"//LIVELY.STORAGE",
fs.readFileSync(require.resolve('lively.storage/dist/lively.storage_with-pouch.min.js')), 
"//LIVELY.GRAPHICS",
fs.readFileSync(require.resolve("lively.graphics/dist/lively.graphics_no-deps.min.js")),
"//LIVELY.BINDINGS",
fs.readFileSync(require.resolve("lively.bindings/dist/lively.bindings.min.js")),
"//LIVELY.SERIALIZER",
fs.readFileSync(require.resolve("lively.serializer2/dist/lively.serializer2.min.js")),
"//LIVELY.MORPHIC",
fs.readFileSync(require.resolve("lively.morphic/dist/lively.morphic_no-deps.min.js")),
"//pep.js",
fs.readFileSync(require.resolve('lively.freezer/deps/pep.min.js')),
"//fetch.js",
uglifyjs.minify(fs.readFileSync(require.resolve('lively.freezer/deps/fetch.umd.js')).toString()).code
].join('\n');

fs.writeFileSync('./runtime-deps.js', res);
fs.writeFileSync('./static-runtime.js', runtimeSource);
