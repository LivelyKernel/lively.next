import Visitor from '../generated/estree-visitor.js';
import { queryNodes } from './query.js';

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// simple ast traversing
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

class AllNodesVisitor extends Visitor {
  accept (node, state, path) {
    this.doFunc(node, state, path);
    return super.accept(node, state, path);
  }

  static run (parsed, doFunc, state) {
    const v = new this();
    v.doFunc = doFunc;
    v.accept(parsed, state, []);
    return state;
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// scoping
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

class FindToplevelFuncDeclVisitor extends Visitor {
  accept (node, funcDecls, path) {
    switch (node.type) {
      case 'ArrowFunctionExpression': return node;
      case 'FunctionExpression': return node;
      case 'FunctionDeclaration': funcDecls.unshift({ node, path }); return node;
      default: return super.accept(node, funcDecls, path);
    }
  }

  static run (parsed) {
    const state = [];
    new this().accept(parsed, state, []);
    return state;
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// replacement
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

const canBeInlinedSym = Symbol('canBeInlined');

function blockInliner (node) {
  // FIXME what about () => x kind of functions?
  if (Array.isArray(node.body)) {
    for (let i = node.body.length - 1; i >= 0; i--) {
      const stmt = node.body[i];
      if (stmt.type === 'BlockStatement' && stmt[canBeInlinedSym]) {
        node.body.splice.apply(node.body, [i, 1].concat(stmt.body));
      }
    }
  }
  return node;
}

function block (nodes) {
  return { type: 'BlockStatement', body: nodes };
}

class ReplaceManyVisitor extends Visitor {
  accept (node, state, path) {
    // return this.replacer(super.accept(node, state, path));
    const replaced = this.replacer(super.accept(node, state, path));
    return !Array.isArray(replaced)
      ? replaced
      : replaced.length === 1
        ? replaced[0]
        : Object.assign(block(replaced), { [canBeInlinedSym]: true });
  }

  visitBlockStatement (node, state, path) {
    return blockInliner(super.visitBlockStatement(node, state, path));
  }

  visitProgram (node, state, path) {
    return blockInliner(super.visitProgram(node, state, path));
  }

  static run (parsed, replacer) {
    const v = new this();
    v.replacer = replacer;
    return v.accept(parsed, null, []);
  }
}

class ReplaceVisitor extends Visitor {
  accept (node, state, path) {
    return this.replacer(super.accept(node, state, path), path);
  }

  static run (parsed, replacer) {
    const v = new this();
    v.replacer = replacer;
    return v.accept(parsed, null, []);
  }
}

export class QueryReplaceManyVisitor extends ReplaceManyVisitor {
  static run (parsed, query, replacer) {
    const matchingNodes = queryNodes(parsed, query);
    const filteredReplacer = (node) => {
      if (matchingNodes.includes(node)) return replacer(node);
      else return node;
    };
    return super.run(parsed, filteredReplacer);
  }
}

/*

  parsed = lively.ast.parse('a.b = f(__lvVarRecorder.component())')

  How do we utilize this for query based visitors?

Easy: We just clear all properties from the current node and assign completely new ones:
n = QueryReplaceManyVisitor.run(parsed, `
 // ExpressionStatement [
      /:expression AssignmentExpression [
          /:left MemberExpression [
            /:property Identifier [ @name ]
          ]
       && /:right CallExpression [
             /:arguments "*" [
               CallExpression [
                /:callee MemberExpression [
                   /:property Identifier [ @name == 'component' ]
                && /:object Identifier [ @name == '__lvVarRecorder' ]
                  ]
               ]
             ]
           ]
        ]
      ]
`, (node) => {
  return []
})

*/

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export {
  AllNodesVisitor,
  FindToplevelFuncDeclVisitor,
  ReplaceVisitor, ReplaceManyVisitor
};
