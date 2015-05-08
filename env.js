var isCommonJS = typeof module !== "undefined" && module.require;
var Global = typeof window !== "undefined" ? window : global;
var lang = typeof lively !== "undefined" ? lively.lang : isCommonJS && module.require("lively.lang");
var escodegen = isCommonJS ? require("escodegen") : escodegen;
var acorn = !isCommonJS && Global.acorn;
if (!acorn && isCommonJS) {
    acorn = require("acorn-jsx");
    acorn.walk = require("acorn-jsx/node_modules/acorn/dist/walk");
    acorn.parse_dammit = require("acorn-jsx/node_modules/acorn/dist/acorn_loose").parse_dammit;
}

var env = {
  isCommonJS: isCommonJS,
  Global: Global,
  lively: isCommonJS ? (Global.lively || {}) : (Global.lively || (Global.lively = {})),
  "lively.lang": lang,
  "lively.ast": (Global.lively && Global.lively.ast) || {},
  escodegen: escodegen,
  acorn: acorn
}

env.lively.ast = env['lively.ast'];

if (isCommonJS) lang.obj.extend(module.exports, env);
else env.lively['lively.lang_env'] = env;


