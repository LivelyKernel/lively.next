// even though acorn comes as es6 package there are certain issues with the
// module structures such as importing directories, not properly exporting which
// doesn't work with most es6 module systems. To make things easier for us we
// create one acorn bundle here that will "export" the lib into global.acorn

var fs = require("fs"),
    path = require("path"),
    acornDir = path.dirname(require.resolve("acorn/", module));

module.exports = new Promise((resolve, reject) => {
  var acornSrc = fs.readFileSync(path.join(acornDir, "dist/acorn.js")),
      walkSrc = fs.readFileSync(path.join(acornDir, "dist/walk.js")),
      looseSrc = fs.readFileSync(path.join(acornDir, "dist/acorn_loose.js")),
      acornAsyncSrc = `(function(acorn) {
  var module = {exports: {}};
  ${patchAcornSource(fs.readFileSync(require.resolve("acorn-es7-plugin/acorn-v4.js")))}
  acorn.plugins.asyncawait = module.exports;
})(this.acorn);`,
      acornObjectSpreadSrc = `(function(acorn) {
  var module = {exports: {}};
  ${fs.readFileSync(require.resolve("acorn-object-spread/inject.js")).toString().replace(/let /g, "var ")}
  module.exports(acorn);
})(this.acorn);`,
      targetFile = "dist/acorn.js",
      source = `(function() {
  var module = undefined, require = undefined, define = undefined;
  ${acornSrc};
  ${walkSrc}
  ${looseSrc}
  ${acornAsyncSrc}
  ${acornObjectSpreadSrc}
  return this.acorn;
})();`;
  
  fs.writeFileSync(targetFile, source);
  console.log(`acorn bundled into ${process.cwd()}/${targetFile}`);
  return resolve();
});


function patchAcornSource(src) {
  src = String(src);
  // rk 2017-06-14: support object rest prop
  return src.replace(
    "this$1.checkLVal(expr.properties[i].value, isBinding, checkClashes)",
    `if (expr.properties[i].type !== "RestElement")\n      `
  + `  this$1.checkLVal(expr.properties[i].value, isBinding, checkClashes);`);
}