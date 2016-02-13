var other = require("./another-cjs-module");

// console.log("running " + __filename);

var myVal = other.val + 1;

module.exports = {
  myVal: myVal
}
