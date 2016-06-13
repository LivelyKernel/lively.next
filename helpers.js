
import * as ast from "lively.ast";

export function parseJsonLikeObj(source) {
  try {
    var obj = eval(`(${ast.transform.wrapInFunction(`var _; _ = (${source})`)})()`);
  } catch (e) { return JSON.parse(source); }
  return typeof obj !== "object" ? null : obj
}
