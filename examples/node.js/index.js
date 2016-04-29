require("systemjs")
require("../../node_modules/lively.ast/dist/lively.ast.js")
require("../../node_modules/lively.vm/dist/lively.vm.js")
var modules = require("../../dist/lively.modules.js")

var testSystem = modules.getSystem("node.js-test", {baseURL: __dirname});
modules.changeSystem(testSystem);
modules.registerPackage(testSystem.normalizeSync("test-package"))
  .then(() => testSystem.import("test-package"))
  .then(module => console.log("Successfully loaded test-package: " + JSON.stringify(module)))
  .catch(err => console.error(err));
