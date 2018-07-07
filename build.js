/*global require,System*/
var uglifyjs = require('uglify-es');
var livelyLang = require('lively.lang');
var fs = require('fs');
var path = require("path");

var res =  [
fs.readFileSync(require.resolve("babel-standalone/babel.min.js")),
uglifyjs.minify(fs.readFileSync(require.resolve("systemjs").replace("index.js", "dist/system.src.js")).toString()).code, 
uglifyjs.minify(fs.readFileSync(require.resolve('babel-regenerator-runtime')).toString()).code,
"//LIVELY.LANG",
fs.readFileSync(require.resolve('lively.lang/dist/lively.lang.min.js')), 
"//LIVELY.NOTIFICATIONS",
uglifyjs.minify(fs.readFileSync(require.resolve('lively.notifications')).toString()).code,
"//LIVELY.AST",
uglifyjs.minify(fs.readFileSync(require.resolve('lively.ast')).toString()).code,
"//LIVELY.CLASSES",
uglifyjs.minify(fs.readFileSync(require.resolve('lively.classes')).toString()).code,
"//LIVELY.SOURCE-TRANSFORM",
uglifyjs.minify(fs.readFileSync(require.resolve('lively.source-transform')).toString()).code,
"//LIVELY.VM",
uglifyjs.minify(fs.readFileSync(require.resolve('lively.vm')).toString()).code,
"//LIVELY.RESOURCES",
uglifyjs.minify(fs.readFileSync(require.resolve('lively.resources/dist/lively.resources_no-deps.js')).toString()).code,
"//LIVELY.STORAGE",
fs.readFileSync(require.resolve('lively.storage/dist/lively.storage_with-pouch.min.js')), 
"//LIVELY.MODULES",
fs.readFileSync(require.resolve("lively.modules/dist/lively.modules_no-deps.min.js")),
"//LIVELY.GRAPHICS",
fs.readFileSync(require.resolve("lively.graphics/dist/lively.graphics.min.js")),
"//LIVELY.BINDINGS",
fs.readFileSync(require.resolve("lively.bindings/dist/lively.bindings.min.js")),
"//LIVELY.SERIALIZER",
fs.readFileSync(require.resolve("lively.serializer2/dist/lively.serializer2.min.js")),
"//LIVELY.MORPHIC",
fs.readFileSync(require.resolve("lively.morphic/dist/lively.morphic_no-deps.min.js"))].join('\n');

fs.writeFileSync('./runtime-deps.js', res);
