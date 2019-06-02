import Visitor from "../generated/estree-visitor.js";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// simple ast traversing
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

class AllNodesVisitor extends Visitor {
  accept(node, state, path) {
    this.doFunc(node, state, path);
    return super.accept(node, state, path);
  }

  static run(parsed, doFunc, state) {
    var v = new this();
    v.doFunc = doFunc;
    v.accept(parsed, state, []);
    return state;
  }
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// scoping
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

class FindToplevelFuncDeclVisitor extends Visitor {
  accept(node, funcDecls, path) {
    switch (node.type) {
      case "ArrowFunctionExpression": return node;
      case "FunctionExpression": return node;
      case "FunctionDeclaration": funcDecls.unshift({node, path}); return node;
      default: return super.accept(node, funcDecls, path);
    }
  }

  static run(parsed) {
    var state = [];
    new this().accept(parsed, state, []);
    return state;
  }
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// replacement
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

const canBeInlinedSym = Symbol("canBeInlined");

function blockInliner(node) {
  // FIXME what about () => x kind of functions?
  if (Array.isArray(node.body)) {
    for (var i = node.body.length - 1; i >= 0; i--) {
      var stmt = node.body[i];
      if (stmt.type === "BlockStatement" && stmt[canBeInlinedSym]) {
        node.body.splice.apply(node.body, [i, 1].concat(stmt.body));
      }
    }
  }
  return node;
}

function block(nodes) {
  return {type: "BlockStatement", body: nodes}
}

class ReplaceManyVisitor extends Visitor {
  accept(node, state, path) {
    return this.replacer(super.accept(node, state, path));
    var replaced = this.replacer(super.accept(node, state, path), path);
    return !Array.isArray(replaced) ?
      replaced : replaced.length === 1 ?
        replaced[0] : Object.assign(block(replaced), {[canBeInlinedSym]: true});

  }

  visitBlockStatement(node, state, path) {
    return blockInliner(super.visitBlockStatement(node, state, path));
  }

  visitProgram(node, state, path) {
    return blockInliner(super.visitProgram(node, state, path));
  }

  static run(parsed, replacer) {
    var v = new this();
    v.replacer = replacer;
    return v.accept(parsed, null, []);
  }
}


class ReplaceVisitor extends Visitor {
  accept(node, state, path) {
    return this.replacer(super.accept(node, state, path), path);
  }

  static run(parsed, replacer) {
    var v = new this();
    v.replacer = replacer;
    return v.accept(parsed, null, []);
  }
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


export {
  AllNodesVisitor,
  FindToplevelFuncDeclVisitor,
  ReplaceVisitor, ReplaceManyVisitor
}

