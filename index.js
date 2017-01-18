export {
  BaseVisitor,
  withMozillaAstDo,
  printAst,
  compareAst,
  pathToNode,
  rematchAstWithSource
} from "./lib/mozilla-ast-visitor-interface.js";
export { ReplaceManyVisitor, ReplaceVisitor } from "./lib/visitors.js";

export { parse, parseFunction, fuzzyParse } from "./lib/parser.js";

import { acorn } from "./lib/acorn-extension.js";
import stringify, { escodegen } from "./lib/stringify.js";
export { escodegen, acorn }

import * as nodes from "./lib/nodes.js";
import * as query from "./lib/query.js";
import * as transform from "./lib/transform.js";
import * as comments from "./lib/comments.js";
import * as categorizer from "./lib/code-categorizer.js";
export {
  query,
  transform,
  comments,
  categorizer,
  stringify,
  nodes
}
