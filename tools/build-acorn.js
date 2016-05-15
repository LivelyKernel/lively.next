// even though acorn comes as es6 package there are certain issues with the
// module structures such as importing directories, not properly exporting which
// doesn't work with most es6 module systems. To make things easier for us we
// create one acorn bundle here that will "export" the lib into global.acorn

var fs = require("fs"),
    path = require("path"),
    acornDir = "node_modules/acorn";

module.exports = new Promise((resolve, reject) => {
  var acornSrc = fs.readFileSync(path.join(acornDir, "dist/acorn.js")),
      walkSrc = fs.readFileSync(path.join(acornDir, "dist/walk.js")),
      looseSrc = fs.readFileSync(path.join(acornDir, "dist/acorn_loose.js")),
      acornAsyncSrc = `(function(acorn) {
  var module = {exports: {}};
  ${fs.readFileSync(require.resolve("acorn-es7-plugin"))}
  module.exports(acorn);
})(this.acorn);`,
      targetFile = "dist/acorn.js",
      source = `(function() {
  var module = undefined, require = undefined;
  ${acornSrc};
  ${walkSrc}
  ${looseSrc}
  ${acornAsyncSrc}
  return this.acorn;
})();`;
  
  fs.writeFileSync(targetFile, source);
  console.log(`acorn bundled into ${process.cwd()}/${targetFile}`);
  return resolve();
});
