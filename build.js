/*global require,System*/
var uglifyjs = require('uglify-es');
var livelyLang = require('lively.lang');
var fs = require('fs');
var path = require("path");

var res = [
 fs.readFileSync(require.resolve("babel-standalone").replace('babel.js', 'babel.min.js')),
 fs.readFileSync(require.resolve("systemjs").replace("index.js", "/dist/system.src.js")),
 fs.readFileSync(require.resolve("../lively.modules/dist/lively.modules.min.js")),
 fs.readFileSync(require.resolve("../lively.graphics/dist/lively.graphics.js")),
 fs.readFileSync(require.resolve("../lively.bindings/dist/lively.bindings.js")),
 fs.readFileSync(require.resolve("../lively.serializer2/dist/lively.serializer2.js")),
 fs.readFileSync(require.resolve("../lively.storage/dist/lively.storage_with-pouch.js"))].join('\n');

fs.writeFileSync('./runtime-dependencies.js', res);
