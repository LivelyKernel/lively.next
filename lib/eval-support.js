import { arr } from "lively.lang";
import { parse } from "./parser.js";
import stringify from "./stringify.js";
import { rewriteToCaptureTopLevelVariables } from "./capturing.js";
import { transformSingleExpression, wrapInStartEndCall } from "./transform.js";

export function evalCodeTransform(code, options) {
  // variable declaration and references in the the source code get
  // transformed so that they are bound to `varRecorderName` aren't local
  // state. THis makes it possible to capture eval results, e.g. for
  // inspection, watching and recording changes, workspace vars, and
  // incrementally evaluating var declarations and having values bound later.

  // 1. Allow evaluation of function expressions and object literals
  code = transformSingleExpression(code);

  var parsed = parse(code);

  // 2. capture top level vars into topLevelVarRecorder "environment"
  if (options.topLevelVarRecorder) {

    var blacklist = (options.dontTransform || []).concat(["arguments"]),
        undeclaredToTransform = !!options.recordGlobals ?
          null/*all*/ : arr.withoutAll(Object.keys(options.topLevelVarRecorder), blacklist);

    parsed = rewriteToCaptureTopLevelVariables(
      parsed,
      {name: options.varRecorderName || '__lvVarRecorder', type: "Identifier"},
      {
        es6ImportFuncId: options.es6ImportFuncId,
        es6ExportFuncId: options.es6ExportFuncId,
        ignoreUndeclaredExcept: undeclaredToTransform,
        exclude: blacklist
     });
  }

  if (options.wrapInStartEndCall) {
    parsed = wrapInStartEndCall(parsed, {
      startFuncNode: options.startFuncNode,
      endFuncNode: options.endFuncNode
    });
  }

  var result = stringify(parsed);

  if (options.sourceURL) result += "\n//# sourceURL=" + options.sourceURL.replace(/\s/g, "_");

  return result;
}
