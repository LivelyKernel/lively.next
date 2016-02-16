
// var fs = require("fs");

function someFunction() {
  return 3 + 4;
}

// console.log("running some-module");

var internalState = 23;
var externalState = 42;

// global.es6ModuleGlobal = 99;

// module.exports = {
//   foo: someFunction,
//   state: externalState
// }

var internalState = 23;

export var x = internalState * 2 + 1;