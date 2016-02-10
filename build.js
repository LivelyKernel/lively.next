/*global require*/


/*
fswatch -0 -r . | xargs -0 -I{} bash -c \
  "[[ \"{}\" =~ .js$ ]] && [[ ! \"{}\" =~ .bundle. ]] && node build.js;"
*/

var ast = require("./index");

var uglify          = require("uglify-js"),
    browserify      = require("browserify"),
    babel           = require("babel-core"),
    fs              = require("fs"),
    path            = require("path"),
    fun             = require("lively.lang").fun,
    arr             = require("lively.lang").arr,
    target          = "dist/lively.ast.js",
    targetES5       = target.replace(/\.js$/,".es5.js"),
    targetMin       = target.replace(/\.js$/,".min.js"),
    targetBundleDev = target.replace(/.js$/, ".bundle.js"),
    targetBundleES5 = target.replace(/.js$/, ".bundle.es5.js"),
    targetBundleMin = target.replace(/.js$/, ".bundle.min.js"),
    langFileDev     = path.join(require.resolve("lively.lang"), "../dist/lively.lang.dev.js"),
    langFileES5     = langFileDev.replace(".dev.", ".es5."),
    langFileMin     = langFileDev.replace(".dev.", ".min."),
    exportsFile     = "./exports.js",
    exportCode = `var lively = window.lively || (window.lively = {});
window.acorn = require('acorn');
window.escodegen = require('escodegen');
lively.ast = require('./index');`;

function buildchain(target, exportCode, externals, thenDo) {
  fun.composeAsync(
      log("1. Creating exports file"),
      n => fs.writeFile(exportsFile, exportCode, n),
      n => fs.unlink(target, (err) => n()),
      n => fs.unlink(targetES5, (err) => n()),
      n => fs.unlink(targetMin, (err) => n()),
      n => fs.mkdir("dist", (err) => n()),
      log("2. browserify"),
      n => {
        var b = browserify().add("./exports.js");
        externals.forEach(ea => b.external(ea));
        b.bundle(n);
      },
      (code, n) => n(null, String(code)),
      (code, n) => n(null, code.replace(/require\(['"](lively.lang)['"]\)/g, '$1')),
      log("3. write " + target),
      (code, n) => fs.writeFile(target, code, err => n(err, code)),
      log("4. write " + target.replace(/\.js$/,".es5.js")),
      (code, n) => fs.writeFile(target.replace(/\.js$/,".es5.js"), babel.transform(code).code, n),
      log("5. minification"),
      n => fs.writeFile(targetMin, uglify.minify(targetES5).code, n)
    )(err => {
      fs.unlink(exportsFile);
      (typeof thenDo === "function") && thenDo(err);
    });
}

module.exports = function build() {
  fun.composeAsync(
    n => buildchain(target, exportCode, ["lively.lang"], n),
    log("6. creating " + targetBundleDev),
    n => fs.writeFile(targetBundleDev, fs.readFileSync(langFileDev) + "\n\n" + fs.readFileSync(target), n),
    log("7. creating " + targetBundleES5),
    n => fs.writeFile(targetBundleES5, fs.readFileSync(langFileES5) + "\n\n" + fs.readFileSync(targetES5), n),
    log("8. creating " + targetBundleMin),
    n => fs.writeFile(targetBundleMin, fs.readFileSync(langFileMin) + "\n\n" + fs.readFileSync(targetMin), n)
  )(err => {
    err ? console.error(err) : console.log("bundled to %s!", target);
  });
}

function log(msg) {
  return function() {
    console.log(msg);
    var args = arr.from(arguments),
        n = args.pop();
    n.apply(this, [null].concat(args));
  }
}
