var System = require("systemjs")
var modules = require("../../dist/lively.modules.js")

// 1. Load the package at examples/browser/test-package/
// and import its main file
modules.importPackage(__dirname + "/test-package")
  .then(module => console.log("Successfully loaded test-package: " + JSON.stringify(module)))
  .then(() => {
    // 2. The package will be automatically instrumented, allowing to
    // inspect the runtime state of its modules and evaluating stuff inside
    // it:
    var expr = "x + 3";
    modules.runEval(expr, {targetModule: "test-package"})
      .then(result => console.log(`evaluating ${expr}, result: ${JSON.stringify(result, null, 2)}`))
  })
  .catch(err => {
    if (err.originalErr) console.log(err.originalErr.stack);
    console.log(err.stack || err);
  })
