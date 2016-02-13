var other = module.require("./some-cjs-module")

var someVal = other.state + 1;

module.exports = {
  val: someVal
}
