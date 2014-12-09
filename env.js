var isCommonJS = typeof module !== "undefined" && module.require;
var Global = typeof window !== "undefined" ? window : global;
var lang = typeof lively !== "undefined" ? lively.lang : isCommonJS ? module.require("lively.lang") : {};
var ast = typeof lively !== "undefined" && lively.ast ? lively.ast : (isCommonJS ? module.require("lively.ast") : (function() { throw new Error("Cannot find lively.lang") })());
var lv = Global.lively || {};
lv.ast = ast;
lv.lang = lang;

var env = {
  isCommonJS: isCommonJS,
  Global: Global,
  lively: lv
}

lang.obj.extend(isCommonJS ? module.exports : Global, env);
