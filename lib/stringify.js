import * as escodegen from "escodegen";

var es = escodegen.escodegen || escodegen;

export { es as escodegen }

export default function stringify(node, opts) {
  return es.generate(fixParamDefaults(node), opts);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// rk 2016-04-10: escodegen cannot deal with how default parameters are
// represented by the AST format acorn uses (and which adheres to the offical
// Mozilla ES AST spec)
// for that purpose we implement a transformer here that will convert an AST like this
//   {
//     body: {body: [],type: "BlockStatement"},
//     expression: false,
//     generator: false,
//     id: { name: "foo", type: "Identifier" },
//     params: [{
//         left: { name: "a", type: "Identifier" },
//         right: { type: "Literal", value: 3 },
//         type: "AssignmentPattern"
//       }],
//     type: "FunctionDeclaration"
//   }
//   (lively.ast.parse("function foo(a = 3) {}"))
// into an ast like this
//   {
//     "type": "FunctionDeclaration",
//     "id": { "type": "Identifier", "name": "foo" },
//     "params": [{ "type": "Identifier", "name": "a" }],
//     "defaults": [{ "type": "Literal", "value": 3, "raw": "3" }],
//     "body": { "type": "BlockStatement", "body": [] },
//     "generator": false,
//     "expression": false
//   }

import Visitor from "../generated/estree-visitor";
import { obj } from "lively.lang";

class FixParamsForEscodegenVisitor extends Visitor {
  
  fixFunctionNode(node) {
    node.defaults = node.params.map((p, i) => {
      if (p.type === "AssignmentPattern") {
        node.params[i] = p.left;
        return p.right;
      }
      return undefined;
    });
  }

  visitFunction(node, state, path) {
    this.fixFunctionNode(node);
    return super.visitFunction(node, state, path);
  }

  visitArrowFunctionExpression(node, state, path) {
    this.fixFunctionNode(node);
    return super.visitArrowFunctionExpression(node, state, path);
  }

  visitFunctionExpression(node, state, path) {
    this.fixFunctionNode(node);
    return super.visitFunctionExpression(node, state, path);
  }

  visitFunctionDeclaration(node, state, path) {
    this.fixFunctionNode(node);
    return super.visitFunctionDeclaration(node, state, path);
  }
}

function fixParamDefaults(parsed) {
  parsed = obj.deepCopy(parsed);
  new FixParamsForEscodegenVisitor().accept(parsed, null, []);
  return parsed
}
