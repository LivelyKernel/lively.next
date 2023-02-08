import { Path } from 'lively.lang';
import Visitor from '../generated/estree-visitor.js';

class PrinterVisitor extends Visitor {
  accept (node, state, path) {
    const pathString = path.map(ea =>
      typeof ea === 'string' ? `.${ea}` : `[${ea}]`).join('');
    const myChildren = [];
    const result = super.accept(node, { index: state.index, tree: myChildren }, path);
    state.tree.push({
      node: node,
      path: pathString,
      index: state.index++,
      children: myChildren
    });
    return result;
  }
}

class ComparisonVisitor extends Visitor {
  recordNotEqual (node1, node2, state, msg) {
    state.comparisons.errors.push({
      node1: node1,
      node2: node2,
      path: state.completePath,
      msg: msg
    });
  }

  compareType (node1, node2, state) {
    return this.compareField('type', node1, node2, state);
  }

  compareField (field, node1, node2, state) {
    node2 = Path(state.completePath.join('.')).get(node2);
    if (node1 && node2 && node1[field] === node2[field]) return true;
    if ((node1 && node1[field] === '*') || (node2 && node2[field] === '*')) return true;
    const fullPath = state.completePath.join('.') + '.' + field; let msg;
    if (!node1) msg = 'node1 on ' + fullPath + ' not defined';
    else if (!node2) msg = 'node2 not defined but node1 (' + fullPath + ') is: ' + node1[field];
    else msg = fullPath + ' is not equal: ' + node1[field] + ' vs. ' + node2[field];
    this.recordNotEqual(node1, node2, state, msg);
    return false;
  }

  accept (node1, node2, state, path) {
    const patternNode = Path(path.join('.')).get(node2);
    if (node1 === '*' || patternNode === '*') return;
    const nextState = {
      completePath: path,
      comparisons: state.comparisons
    };
    if (this.compareType(node1, node2, nextState)) { this['visit' + node1.type](node1, node2, nextState, path); }
  }

  visitFunction (node1, node2, state, path) {
    // node1.generator has a specific type that is boolean
    if (node1.generator) { this.compareField('generator', node1, node2, state); }

    // node1.expression has a specific type that is boolean
    if (node1.expression) { this.compareField('expression', node1, node2, state); }

    return super.visitFunction(node1, node2, state, path);
  }

  visitSwitchStatement (node1, node2, state, path) {
    // node1.lexical has a specific type that is boolean
    if (node1.lexical) { this.compareField('lexical', node1, node2, state); }

    return super.visitSwitchStatement(node1, node2, state, path);
  }

  visitForInStatement (node1, node2, state, path) {
    // node1.each has a specific type that is boolean
    if (node1.each) { this.compareField('each', node1, node2, state); }

    return super.visitForInStatement(node1, node2, state, path);
  }

  visitFunctionDeclaration (node1, node2, state, path) {
    // node1.generator has a specific type that is boolean
    if (node1.generator) { this.compareField('generator', node1, node2, state); }

    // node1.expression has a specific type that is boolean
    if (node1.expression) { this.compareField('expression', node1, node2, state); }

    return super.visitFunctionDeclaration(node1, node2, state, path);
  }

  visitVariableDeclaration (node1, node2, state, path) {
    // node1.kind is "var" or "let" or "const"
    this.compareField('kind', node1, node2, state);
    return super.visitVariableDeclaration(node1, node2, state, path);
  }

  visitUnaryExpression (node1, node2, state, path) {
    // node1.operator is an UnaryOperator enum:
    // "-" | "+" | "!" | "~" | "typeof" | "void" | "delete"
    this.compareField('operator', node1, node2, state);

    // node1.prefix has a specific type that is boolean
    if (node1.prefix) { this.compareField('prefix', node1, node2, state); }

    return super.visitUnaryExpression(node1, node2, state, path);
  }

  visitBinaryExpression (node1, node2, state, path) {
    // node1.operator is an BinaryOperator enum:
    // "==" | "!=" | "===" | "!==" | | "<" | "<=" | ">" | ">=" | | "<<" | ">>" | ">>>" | | "+" | "-" | "*" | "/" | "%" | | "|" | "^" | "&" | "in" | | "instanceof" | ".."
    this.compareField('operator', node1, node2, state);
    return super.visitBinaryExpression(node1, node2, state, path);
  }

  visitAssignmentExpression (node1, node2, state, path) {
    // node1.operator is an AssignmentOperator enum:
    // "=" | "+=" | "-=" | "*=" | "/=" | "%=" | | "<<=" | ">>=" | ">>>=" | | "|=" | "^=" | "&="
    this.compareField('operator', node1, node2, state);
    return super.visitAssignmentExpression(node1, node2, state, path);
  }

  visitUpdateExpression (node1, node2, state, path) {
    // node1.operator is an UpdateOperator enum:
    // "++" | "--"
    this.compareField('operator', node1, node2, state);
    // node1.prefix has a specific type that is boolean
    if (node1.prefix) { this.compareField('prefix', node1, node2, state); }
    return super.visitUpdateExpression(node1, node2, state, path);
  }

  visitLogicalExpression (node1, node2, state, path) {
    // node1.operator is an LogicalOperator enum:
    // "||" | "&&"
    this.compareField('operator', node1, node2, state);
    return super.visitLogicalExpression(node1, node2, state, path);
  }

  visitMemberExpression (node1, node2, state, path) {
    // node1.computed has a specific type that is boolean
    if (node1.computed) { this.compareField('computed', node1, node2, state); }
    return super.visitMemberExpression(node1, node2, state, path);
  }

  visitComprehensionBlock (node1, node2, state, path) {
    // node1.each has a specific type that is boolean
    if (node1.each) { this.compareField('each', node1, node2, state); }
    return super.visitComprehensionBlock(node1, node2, state, path);
  }

  visitIdentifier (node1, node2, state, path) {
    // node1.name has a specific type that is string
    this.compareField('name', node1, node2, state);
    return super.visitIdentifier(node1, node2, state, path);
  }

  visitLiteral (node1, node2, state, path) {
    this.compareField('value', node1, node2, state);
    return super.visitLiteral(node1, node2, state, path);
  }

  visitClassDeclaration (node1, node2, state, path) {
    this.compareField('id', node1, node2, state);
    if (node1.superClass) {
      this.compareField('superClass', node1, node2, state);
    }
    this.compareField('body', node1, node2, state);
    return super.visitClassDeclaration(node1, node2, state, path);
  }

  visitClassBody (node1, node2, state, path) {
    this.compareField('body', node1, node2, state);
    return super.visitClassBody(node1, node2, state, path);
  }

  visitMethodDefinition (node1, node2, state, path) {
    this.compareField('static', node1, node2, state);
    this.compareField('computed', node1, node2, state);
    this.compareField('kind', node1, node2, state);
    this.compareField('key', node1, node2, state);
    this.compareField('value', node1, node2, state);
    return super.visitMethodDefinition(node1, node2, state, path);
  }
}

class ScopeVisitor extends Visitor {
  newScope (scopeNode, parentScope) {
    const scope = {
      node: scopeNode,
      varDecls: [],
      varDeclPaths: [],
      funcDecls: [],
      funcDeclPaths: [],
      classDecls: [],
      classDeclPaths: [],
      classExprs: [],
      classExprPaths: [],
      methodDecls: [],
      methodDeclPaths: [],
      importSpecifiers: [],
      importSpecifierPaths: [],
      exportDecls: [],
      exportDeclPaths: [],
      refs: [],
      thisRefs: [],
      params: [],
      catches: [],
      subScopes: [],
      resolvedRefMap: new Map()
    };
    if (parentScope) parentScope.subScopes.push(scope);
    return scope;
  }

  visitVariableDeclaration (node, scope, path) {
    scope.varDecls.push(node);
    scope.varDeclPaths.push(path);
    return super.visitVariableDeclaration(node, scope, path);
  }

  visitVariableDeclarator (node, scope, path) {
    const visitor = this;
    // ignore id
    // // id is of types Pattern
    // node["id"] = visitor.accept(node["id"], scope, path.concat(["id"]));
    // init is of types Expression
    if (node.init) {
      node.init = visitor.accept(node.init, scope, path.concat(['init']));
    }
    return node;
  }

  visitFunctionParameters (params, scope, path) {
    params.forEach((param, i) => {
      if (param.type === 'ObjectPattern') {
        this.visitFunctionParameters(param.properties, scope, path.concat(i, 'properties'));
      }
      if (param.type === 'Property' && param.value.type === 'AssignmentPattern') {
        this.accept(param.value.right, scope, path.concat(i, 'value', 'right'));
      }
      // AssignmentPattern = default params
      // only visit the right side of a default param, we track the declarations
      // in scope.params specificially
      if (param.type === 'AssignmentPattern') {
        this.accept(param.right, scope, path.concat(i, 'right'));
      }
    });
  }

  visitFunction (node, scope, path) {
    const visitor = this;
    const newScope = this.newScope(node, scope);

    visitor.visitFunctionParameters(node.params, newScope, path.concat('params'));

    newScope.params = Array.prototype.slice.call(node.params);
    return newScope;
  }

  visitFunctionDeclaration (node, scope, path) {
    const newScope = this.visitFunction(node, scope, path);
    scope.funcDecls.push(node);
    scope.funcDeclPaths.push(path);

    // don't visit id and params
    const visitor = this;

    if (node.defaults) {
      node.defaults = node.defaults.reduce(function (results, ea, i) {
        const result = visitor.accept(ea, newScope, path.concat(['defaults', i]));
        if (Array.isArray(result)) results.push.apply(results, result);
        else results.push(result);
        return results;
      }, []);
    }

    if (node.rest) {
      node.rest = visitor.accept(node.rest, newScope, path.concat(['rest']));
    }

    node.body = visitor.accept(node.body, newScope, path.concat(['body']));

    // loc is of types SourceLocation
    if (node.loc) {
      node.loc = visitor.accept(node.loc, newScope, path.concat(['loc']));
    }
    return node;
  }

  visitFunctionExpression (node, scope, path) {
    const newScope = this.visitFunction(node, scope, path);

    // don't visit id and params
    const visitor = this;

    if (node.defaults) {
      node.defaults = node.defaults.reduce(function (results, ea, i) {
        const result = visitor.accept(ea, newScope, path.concat(['defaults', i]));
        if (Array.isArray(result)) results.push.apply(results, result);
        else results.push(result);
        return results;
      }, []);
    }

    if (node.rest) {
      node.rest = visitor.accept(node.rest, newScope, path.concat(['rest']));
    }

    node.body = visitor.accept(node.body, newScope, path.concat(['body']));

    // loc is of types SourceLocation
    if (node.loc) {
      node.loc = visitor.accept(node.loc, newScope, path.concat(['loc']));
    }
    return node;
  }

  visitArrowFunctionExpression (node, scope, path) {
    const newScope = this.visitFunction(node, scope, path);
    const visitor = this;

    if (node.defaults) {
      node.defaults = node.defaults.reduce(function (results, ea, i) {
        const result = visitor.accept(ea, newScope, path.concat(['defaults', i]));
        if (Array.isArray(result)) results.push.apply(results, result);
        else results.push(result);
        return results;
      }, []);
    }

    if (node.rest) {
      node.rest = visitor.accept(node.rest, newScope, path.concat(['rest']));
    }

    // body is of types BlockStatement, Expression
    node.body = visitor.accept(node.body, newScope, path.concat(['body']));

    // loc is of types SourceLocation
    if (node.loc) {
      node.loc = visitor.accept(node.loc, newScope, path.concat(['loc']));
    }
    // node.generator has a specific type that is boolean
    if (node.generator) { /* do stuff */ }

    // node.expression has a specific type that is boolean
    if (node.expression) { /* do stuff */ }
    return node;
  }

  visitIdentifier (node, scope, path) {
    scope.refs.push(node);
    return super.visitIdentifier(node, scope, path);
  }

  visitMemberExpression (node, scope, path) {
    // only visit property part when prop is computed so we don't gather
    // prop ids

    const visitor = this;
    // object is of types Expression, Super
    node.object = visitor.accept(node.object, scope, path.concat(['object']));
    // property is of types Expression
    if (node.computed) {
      node.property = visitor.accept(node.property, scope, path.concat(['property']));
    }
    return node;
  }

  visitProperty (node, scope, path) {
    const visitor = this;
    // key is of types Expression
    if (node.computed) { node.key = visitor.accept(node.key, scope, path.concat(['key'])); }
    // value is of types Expression
    node.value = visitor.accept(node.value, scope, path.concat(['value']));
    return node;
  }

  visitThisExpression (node, scope, path) {
    scope.thisRefs.push(node);
    return super.visitThisExpression(node, scope, path);
  }

  visitTryStatement (node, scope, path) {
    const visitor = this;
    // block is of types BlockStatement
    node.block = visitor.accept(node.block, scope, path.concat(['block']));
    // handler is of types CatchClause
    if (node.handler) {
      node.handler = visitor.accept(node.handler, scope, path.concat(['handler']));
      scope.catches.push(node.handler.param);
    }

    // finalizer is of types BlockStatement
    if (node.finalizer) {
      node.finalizer = visitor.accept(node.finalizer, scope, path.concat(['finalizer']));
    }
    return node;
  }

  visitLabeledStatement (node, scope, path) {
    const visitor = this;
    // ignore label
    // // label is of types Identifier
    // node["label"] = visitor.accept(node["label"], scope, path.concat(["label"]));
    // body is of types Statement
    node.body = visitor.accept(node.body, scope, path.concat(['body']));
    return node;
  }

  visitClassDeclaration (node, scope, path) {
    scope.classDecls.push(node);
    scope.classDeclPaths.push(path);

    const visitor = this;
    // ignore id
    // // id is of types Identifier
    // node["id"] = visitor.accept(node["id"], scope, path.concat(["id"]));
    // superClass is of types Expression
    if (node.superClass) {
      node.superClass = visitor.accept(node.superClass, scope, path.concat(['superClass']));
    }
    // body is of types ClassBody
    node.body = visitor.accept(node.body, scope, path.concat(['body']));
    return node;
  }

  visitClassExpression (node, scope, path) {
    if (node.id) {
      scope.classExprs.push(node);
      scope.classExprPaths.push(path);
    }

    const visitor = this;
    // ignore id
    // // id is of types Identifier
    // node["id"] = visitor.accept(node["id"], scope, path.concat(["id"]));
    // superClass is of types Expression
    if (node.superClass) {
      node.superClass = visitor.accept(node.superClass, scope, path.concat(['superClass']));
    }
    // body is of types ClassBody
    node.body = visitor.accept(node.body, scope, path.concat(['body']));
    return node;
  }

  visitMethodDefinition (node, scope, path) {
    const visitor = this;
    // don't visit key Identifier for now
    // // key is of types Expression
    // node["key"] = visitor.accept(node["key"], scope, path.concat(["key"]));
    // value is of types FunctionExpression

    if (node.computed) {
      let curr = node.key;
      while (curr.type === 'MemberExpression') curr = curr.object;
      if (curr.type === 'Identifier') {
        scope.refs.push(node.key);
      }
    }

    node.value = visitor.accept(node.value, scope, path.concat(['value']));
    return node;
  }

  visitMetaProperty (node, scope, path) {
    // this is the new.target thing
    const visitor = this;
    // node['meta'] = visitor.accept(node['meta'], scope, path.concat(['meta']));
    // node['property'] = visitor.accept(node['property'],scope, path.concat(['property']));
    return node;
  }

  visitBreakStatement (node, scope, path) { return node; }
  visitContinueStatement (node, scope, path) { return node; }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // es6 modules
  visitImportSpecifier (node, scope, path) {
    scope.importSpecifiers.push(node.local);
    scope.importSpecifierPaths.push(path);

    const visitor = this;
    // imported is of types Identifier
    // node["imported"] = visitor.accept(node["imported"], scope, path.concat(["imported"]));
    // local is of types Identifier
    // node["local"] = visitor.accept(node["local"], scope, path.concat(["local"]));
    return node;
  }

  visitImportDefaultSpecifier (node, scope, path) {
    scope.importSpecifiers.push(node.local);
    scope.importSpecifierPaths.push(path);
    const visitor = this;
    // // local is of types Identifier
    // node["local"] = visitor.accept(node["local"], scope, path.concat(["local"]));
    return node;
  }

  visitImportNamespaceSpecifier (node, scope, path) {
    scope.importSpecifiers.push(node.local);
    scope.importSpecifierPaths.push(path);
    const visitor = this;
    // // local is of types Identifier
    // node["local"] = visitor.accept(node["local"], scope, path.concat(["local"]));
    return node;
  }

  visitExportSpecifier (node, scope, path) {
    const visitor = this;
    // // exported is of types Identifier
    // node["exported"] = visitor.accept(node["exported"], scope, path.concat(["exported"]));
    // local is of types Identifier
    node.local = visitor.accept(node.local, scope, path.concat(['local']));
    return node;
  }

  visitExportNamedDeclaration (node, scope, path) {
    scope.exportDecls.push(node);
    scope.exportDeclPaths.push(path);
    // only descend if it's not an export {...} from "..."
    if (!node.source) super.visitExportNamedDeclaration(node, scope, path);
    return node;
  }

  visitExportDefaultDeclaration (node, scope, path) {
    scope.exportDecls.push(node);
    scope.exportDeclPaths.push(path);
    return super.visitExportDefaultDeclaration(node, scope, path);
  }

  visitExportAllDeclaration (node, scope, path) {
    scope.exportDecls.push(node);
    scope.exportDeclPaths.push(path);
    return super.visitExportAllDeclaration(node, scope, path);
  }
}

export {
  Visitor as BaseVisitor,
  PrinterVisitor,
  ComparisonVisitor,
  ScopeVisitor
};
