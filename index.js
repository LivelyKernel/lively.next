import { withMozillaAstDo, printAst, compareAst, pathToNode, rematchAstWithSource } from "./lib/mozilla-ast-visitor-interface.js";
export { withMozillaAstDo, printAst, compareAst, pathToNode, rematchAstWithSource };

import { parse, parseFunction, parseLikeOMeta, fuzzyParse } from "./lib/parser.js";
export { parse, parseFunction, parseLikeOMeta, fuzzyParse }

import { acorn } from "./lib/acorn-extension.js";
import stringify, { escodegen } from "./lib/stringify.js";
export { escodegen, acorn }

import * as nodes from "./lib/nodes.js";
import * as query from "./lib/query.js";
import * as transform from "./lib/transform.js";
import * as capturing from "./lib/capturing.js";
import * as comments from "./lib/comments.js";
import * as categorizer from "./lib/code-categorizer.js";
export { query, transform, capturing, comments, categorizer, stringify, nodes }
