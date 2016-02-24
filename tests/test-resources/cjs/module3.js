var other = require("./module2");

// console.log("running " + __filename);

var myVal = other.val + 1;

module.exports = {
  myVal: myVal
}
