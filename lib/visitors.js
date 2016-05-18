import Visitor from "../generated/estree-visitor.js";

class FindToplevelFuncDeclVisitor extends Visitor {
  accept(node, funcDecls, path) {
    switch (node.type) {
      case "ArrowFunctionExpression": return node;
      case "FunctionExpression": return node;
      case "FunctionDeclaration": funcDecls.unshift({node: node, path: path}); return node;
      default: return super.accept(node, funcDecls, path);
    }
  }
  
  static run(parsed) {
    var state = [];
    new this().accept(parsed, state, []);
    return state;
  }
}

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

export {
  FindToplevelFuncDeclVisitor,
  AllNodesVisitor
}