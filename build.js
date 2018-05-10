/*global require,System*/
var uglifyjs = require('uglify-es');
var livelyLang = require('lively.lang');
var fs = require('fs');
var path = require("path");

var res =  [
uglifyjs.minify(fs.readFileSync(require.resolve("babel-standalone")).toString(), {
  output: { ascii_only: true },
}).code,
uglifyjs.minify(fs.readFileSync(require.resolve("systemjs").replace("index.js", "dist/system.src.js")).toString()).code, 
"//LIVELY.MODULES",
fs.readFileSync(require.resolve("lively.modules/dist/lively.modules.min.js")),
"//LIVELY.GRAPHICS",
fs.readFileSync(require.resolve("lively.graphics/dist/lively.graphics.min.js")),
"//LIVELY.BINDINGS",
fs.readFileSync(require.resolve("lively.bindings/dist/lively.bindings.min.js")),
"//LIVELY.SERIALIZER",
fs.readFileSync(require.resolve("lively.serializer2/dist/lively.serializer2.min.js")),
"//LIVELY.MORPHIC",
fs.readFileSync(require.resolve("lively.morphic/dist/lively.morphic_no-deps.min.js"))].join('\n');

fs.writeFileSync('./runtime-deps.js', res);
