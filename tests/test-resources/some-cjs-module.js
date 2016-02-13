var fs = require("fs");

function someFunction() {
  return 3 + 4;
}

// console.log("running " + __filename);

var internalState = 23;
var externalState = 42;

global.someModuleGlobal = 99;

exports.foo = someFunction;
exports.state = externalState;
