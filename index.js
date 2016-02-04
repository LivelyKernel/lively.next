/*global module,exports,require*/

var lang = typeof window !== "undefined" ? lively.lang : require("lively.lang");

module.exports = lang.obj.merge(
  require("./lib/evaluator"),
  require("./lib/completions"),
  {cjs: require("./lib/modules/cjs")
});