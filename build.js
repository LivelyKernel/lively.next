/*global require*/
/*
fswatch -0 -r . | xargs -0 -I{} bash -c \
  "[[ \"{}\" =~ .js$ ]] && [[ ! \"{}\" =~ .bundle. ]] && node build.js;"
*/

var uglify     = require("uglify-js")
var browserify = require("browserify");
var babel      = require("babel-core");
var fs         = require("fs");
var fun        = require("lively.lang").fun;
var arr        = require("lively.lang").arr;
var target     = "dist/lively.vm.js";
var targetES5  = target.replace(/\.js$/,".es5.js");
var targetMin  = target.replace(/\.js$/,".min.js");

var exportCode = "var lively = window.lively || (window.lively = {}); lively.vm = require('./index');"
var exportsFile = "./exports.js";

fun.composeAsync(
  log("1. Creating exports file"),
  n => fs.writeFile(exportsFile, exportCode, n),
  n => fs.unlink(target, (err) => n()),
  n => fs.unlink(targetES5, (err) => n()),
  n => fs.unlink(targetMin, (err) => n()),
  n => fs.mkdir("dist", (err) => n()),
  log("2. browserify"),
  n => browserify()
        .add("./exports.js")
        .external("lively.ast")
        .external("lively.lang")
        .external("systemjs")
        .bundle(n),
  (code, n) => n(null, String(code)),
  (code, n) => n(null, code.replace(/require\(['"](lively.ast|lively.lang)['"]\)/g, '$1')),
  (code, n) => n(null, code.replace(/require\(['"]systemjs['"]\)/g, '(typeof window !== "undefined" ? window.System : global.System)')),
  log("3. write " + target),
  (code, n) => fs.writeFile(target, code, err => n(err, code)),
  log("4. write " + target.replace(/\.js$/,".es5.js")),
  (code, n) => fs.writeFile(target.replace(/\.js$/,".es5.js"), babel.transform(code).code, n),
  log("5. minification"),
  n => fs.writeFile(targetMin, uglify.minify(targetES5).code, n)
)(err => {
  fs.unlink(exportsFile);
  err ? console.error(err) : console.log("bundled to %s!", target)
});

function log(msg) {
  return function() {
    console.log(msg);
    var args = arr.from(arguments),
        n = args.pop();
    n.apply(this, [null].concat(args));
  }
}
