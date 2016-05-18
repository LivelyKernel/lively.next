require("babel-regenerator-runtime");
var System = require("systemjs")
var modules = require("../../dist/lively.modules.js")

var log = console.log.bind(console);

// 1. Load the package at examples/browser/test-package/
// and import its main file
modules.importPackage(__dirname + "/test-package")
  .then(module => log("Successfully loaded test-package: " + JSON.stringify(module)))
  .then(() =>
    // 2. The package will be automatically instrumented, allowing to
    // inspect the runtime state of its modules and evaluating stuff inside
    // it:
    Promise.all([
      Promise.resolve().then(() => {
        log("Testing runEval...")
        var code = "x + 3";
        lively.modules.runEval(code, {targetModule: "test-package"})
          .then(result => {
            if (result.isError) throw result.value;
            log(`evaluating ${code}, result: ${JSON.stringify(result, null, 2)}`)
          })
      }),

      Promise.resolve().then(() => {
        log("Testing async eval...")
        var code = "async function foo() { return new Promise((resolve, reject) => setTimeout(resolve, 300, 23)); }; await foo();";
        lively.modules.runEval(code, {targetModule: "test-package"})
          .then(result => {
            if (result.isError) throw result.value;
            log(`evaluating ${code}, result: ${JSON.stringify(result, null, 2)}`);
          });
      })
    ]))
