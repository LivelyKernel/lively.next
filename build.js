/*
fswatch -0 -r . | xargs -0 -I{} bash -c \
  "[[ \"{}\" =~ .js$ ]] && [[ ! \"{}\" =~ .bundle. ]] && node build.js;"
*/

var uglify = require("uglify-js")
var browserify = require("browserify");
var babel = require("babel-core");
var fs = require("fs");
var fun = require("lively.lang").fun;
var arr = require("lively.lang").arr;
var target = "dist/lively.vm.js";

fun.composeAsync(
  n => fs.mkdir("dist", (err) => n()),
  log("1. browserify"),
  n => browserify({standalone: "lively.vm"})
        .add("./index.js")
        .external("lively.ast")
        .external("lively.lang")
        .bundle(n),
  (code, n) => n(null, `(function(lively, r, m) {
// make sure module and require are undefined for lively
var require = lively ? undefined : r, module = lively ? m : undefined;
${code};
})(typeof lively !== "undefined" ? lively : undefined,
   typeof require !== "undefined" ? require : undefined,
   typeof module !== "undefined" ? module : undefined);`),
  (code, n) => n(null, code.replace(/require\(['"](lively.ast|lively.lang)['"]\)/g, '$1')),
  log("2. write " + target),
  (code, n) => fs.writeFile(target, code, err => n(err, code)),
  log("3. write " + target.replace(/\.js$/,".es5.js")),
  (code, n) => fs.writeFile(target.replace(/\.js$/,".es5.js"), babel.transform(code).code, n)
  // log("3. minification"),
  // n => fs.writeFile(
  //       target.replace(/\.js$/,".es5.js"),
  //       uglify.minify(target).code, n)
)(err => err ? console.error(err) : console.log("bundled to %s!", target));

function log(msg) {
  return function() {
    console.log(msg);
    var args = arr.from(arguments),
        n = args.pop();
    n.apply(this, [null].concat(args));
  }
}
