// var other = module.require("./some-cjs-module")
var other = require("./module1")

var someVal = other.state + 1;

// module.exports = {
//   val: someVal
// }

exports.val = someVal;
