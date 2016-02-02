var fs = require("fs");

function someFunction() {
  return 3 + 4;
}

console.log("running some-module");

var internalState = 23;
var externalState = 42;

global.someModuleGlobal = 99;

module.exports = {
  foo: someFunction,
  state: externalState
}
