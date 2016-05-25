import * as completions from "./lib/completions.js";
export { completions }

import * as globalEval from "./lib/eval.js";
import * as esmEval from "./lib/esm-eval.js";
export { defaultTopLevelVarRecorderName } from "./lib/eval.js";
export { runEval, syncEval }

function runEval(code, options) {
  options = Object.assign({
    format: "global",
    System: null,
    targetModule: null
  }, options);

  var S = options.System || (typeof System !== "undefined" && System);
  if (!S && options.targetModule) {
    return Promise.reject(new Error("options to runEval have targetModule but cannot find system loader!"));
  }

  return options.targetModule ?
    esmEval.runEval(options.System || System, code, options) :
    globalEval.runEval(code, options);
}

function syncEval(code, options) {
  return globalEval.syncEval(code, options);
}

