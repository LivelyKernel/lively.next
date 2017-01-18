import * as capturing from "./capturing.js";
export { capturing };

import { parseFunction, stringify, ReplaceVisitor } from "lively.ast";

export function stringifyFunctionWithoutToplevelRecorder(
  funcOrSourceOrAst,
  varRecorderName = "__lvVarRecorder"
) {
  // stringifyFunctionWithoutToplevelRecorder((x) => hello + x)
  // => x => hello + x
  // instead of String((x) => hello + x) // => x => __lvVarRecorder.hello + x
  // when run in toplevel scope
  if (typeof funcOrSourceOrAst === "function")
    funcOrSourceOrAst = String(funcOrSourceOrAst);
  var parsed = typeof funcOrSourceOrAst === "string" ?
        parseFunction(funcOrSourceOrAst) : funcOrSourceOrAst,
      replaced = ReplaceVisitor.run(parsed, (node) => {
        var isVarRecorderMember = node.type === "MemberExpression"
                               && node.object.type === "Identifier"
                               && node.object.name === varRecorderName;
        return isVarRecorderMember ? node.property : node;
      });
  return stringify(replaced);
}