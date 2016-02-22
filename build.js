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
    estreeVisitor   = "generated/estree-visitor.js",
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
var ast = require('./index');
if (!lively.ast) lively.ast = ast;
else {
  if (lively.ast.acorn) {
    for (var name in ast.acorn) {
      if (ast.acorn.hasOwnProperty(name))
        lively.ast.acorn[name] = ast.acorn[name];
    }
  } else { lively.ast.acorn = ast.acorn; }
  for (var name in ast) {
    if (ast.hasOwnProperty(name) && name !== "acorn")
      lively.ast[name] = ast[name];
  }
}
`;

function buildchain(target, exportCode, externals, thenDo) {
  fun.composeAsync(
      log("1. Creating estree visitor"),
      createEstreeVisitorModule,
      log("2. Creating exports file"),
      n => fs.writeFile(exportsFile, exportCode, n),
      n => fs.unlink(target, (err) => n()),
      n => fs.unlink(targetES5, (err) => n()),
      n => fs.unlink(targetMin, (err) => n()),
      n => fs.mkdir("dist", (err) => n()),
      log("3. browserify"),
      n => {
        var b = browserify().add("./exports.js");
        externals.forEach(ea => b.external(ea));
        b.bundle(n);
      },
      (code, n) => n(null, String(code)),
      (code, n) => n(null, code.replace(/require\(['"](lively.lang)['"]\)/g, '$1')),
      log("4. write " + target),
      (code, n) => fs.writeFile(target, code, err => n(err, code)),
      log("5. write " + target.replace(/\.js$/,".es5.js")),
      (code, n) => fs.writeFile(target.replace(/\.js$/,".es5.js"), babel.transform(code).code, n),
      log("6. minification"),
      n => fs.writeFile(targetMin, uglify.minify(targetES5).code, n)
    )(err => {
      fs.unlink(exportsFile);
      (typeof thenDo === "function") && thenDo(err);
    });
}

function createEstreeVisitorModule(thenDo) {
  var estree = require("estree-to-js"),
      estreeSpec = JSON.parse(fs.readFileSync(require.resolve("estree-to-js/generated/es6.json"))),
      source = estree.createVisitor(estreeSpec, []/*exceptions*/, "Visitor") + "\nmodule.exports = Visitor;"
  fs.writeFile(estreeVisitor, source, thenDo);
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
