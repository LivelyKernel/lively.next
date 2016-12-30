import * as completions from "./lib/completions.js";
export { completions }

import * as globalEval from "./lib/eval.js";
import * as esmEval from "./lib/esm-eval.js";
export { defaultTopLevelVarRecorderName } from "./lib/eval.js";
export {
  defaultClassToFunctionConverterName,
  evalCodeTransform,
  evalCodeTransformOfSystemRegisterSetters
} from "./lib/eval-support.js";

export { runEval, syncEval }

function runEval(code, options) {
  var {format, System: S, targetModule} = options = {
    format: "esm",
    System: null,
    targetModule: null,
    ...options
  }

  if (!S && typeof System !== "undefined") S = System;
  if (!S && targetModule) {
    return Promise.reject(new Error("options to runEval have targetModule but cannot find system loader!"));
  }

  return targetModule && (["esm", "es6", "register"].includes(format))?
    esmEval.runEval(S, code, options) :
    globalEval.runEval(code, options);
}

function syncEval(code, options) {
  return globalEval.syncEval(code, options);
}

import * as evalStrategies from "./lib/eval-strategies.js";
export { evalStrategies }
