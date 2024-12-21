import { getAncestryPath } from './helpers.js';
import { arr } from 'lively.lang';

export function scopes (path) {
  function newScope (path, parentScope) {
    const scope = {
      node: path.node,
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
      refPaths: [],
      thisRefs: [],
      params: [],
      catches: [],
      subScopes: [],
      resolvedRefMap: new Map()
    };
    if (parentScope) parentScope.subScopes.push(scope);
    return scope;
  }

  function visitFunctionParameters (params) {
    params.forEach((param, i) => {
      if (param.type === 'ObjectPattern') {
        visitFunctionParameters(param.get('properties'));
      }
      if (param.type === 'Property' && param.value.type === 'AssignmentPattern') {
        param.get('value.right').visit();
      }
      // AssignmentPattern = default params
      // only visit the right side of a default param, we track the declarations
      // in scope.params specificially
      if (param.type === 'AssignmentPattern') {
        param.get('right').visit();
      }
    });
  }

  function withScopeDo(nextScope, cb) {
    currScope = nextScope;
    scopeStack.push(currScope);
    cb();
    scopeStack.pop();
    currScope = arr.last(scopeStack);
  }

  function visitFunction (path, scope) {
    scope = newScope(path, scope);
    withScopeDo(scope, () => visitFunctionParameters(path.get('params')));
    scope.params = Array.prototype.slice.call(path.node.params);
    return scope;
  }

  let currScope = newScope(path);
  const scopeStack = [currScope];

  const visitor = {
    VariableDeclaration (path) {
      currScope.varDecls.push(path.node);
      currScope.varDeclPaths.push(getAncestryPath(path));
    },

    VariableDeclarator (path) {
      path.skip();
      path.get('init').visit();
    },

    FunctionDeclaration (path) {
      path.skip();
      const newScope = visitFunction(path, currScope);
      currScope.funcDecls.push(path.node);
      currScope.funcDeclPaths.push(getAncestryPath(path));
      withScopeDo(newScope, () => path.get('body').visit());
    },

    FunctionExpression (path) {
      path.skip();
      withScopeDo(visitFunction(path, currScope), () => path.get('body').visit())
    },

    ArrowFunctionExpression (path) {
      path.skip();
      withScopeDo(visitFunction(path, currScope), () => path.get('body').visit())
    },

    Identifier (path) {
      currScope.refs.push(path.node);
      currScope.refPaths.push(getAncestryPath(path));
    },

    'MemberExpression|OptionalMemberExpression' (path) {
      path.skip();
      path.get('object').visit();
      if (path.node.computed) {
        path.get('property').visit();
      }
    },

    ObjectProperty (path) {
      path.skip();
      if (path.node.computed) {
        path.get('key').visit();
      }
      // value is of types Expression
      path.get('value').visit();
    },

    ThisExpression (path) {
      currScope.thisRefs.push(path.node);
    },

    TryStatement (path) {
      path.skip();
      const { node } = path;
      // block is of types BlockStatement
      path.get('block').visit();
      // handler is of types CatchClause
      if (node.handler) {
        path.get('handler').visit();
        currScope.catches.push(node.handler.param);
      }
      // finalizer is of types BlockStatement
      if (node.finalizer) {
        path.get('finalizer').visit();
      }
    },

    IfStatement (path) {
      path.skip();
      path.get('test').visit();

      withScopeDo(newScope(path, currScope), () => path.get('consequent').visit())

      if (path.node.alternate) {
        withScopeDo(newScope(path, currScope), () => path.get('alternate').visit())
      }
    },

    For (path) {
      path.skip();
      const loopScope = newScope(path, currScope);
      withScopeDo(path.get('left').node?.kind === 'var' ? currScope : loopScope, () => path.get('left').visit());
      withScopeDo(path.get('right').node?.kind === 'var' ? currScope : loopScope, () => path.get('right').visit());
      withScopeDo(path.get('init').node?.kind === 'var' ? currScope : loopScope, () => path.get('init').visit());
      withScopeDo(loopScope, () => {
        path.get('update').visit();
        path.get('test').visit();
        path.get('body').visit();
      });
    },

    LabeledStatement (path) {
      path.skip();
      path.get('body').visit();
    },

    ClassDeclaration (path) {
      path.skip();
      currScope.classDecls.push(path.node);
      currScope.classDeclPaths.push(getAncestryPath(path));

      if (path.node.superClass) path.get('superClass').visit();

      path.get('body').visit();
    },

    ClassExpression (path) {
      path.skip();

      if (path.node.id) {
        currScope.classExprs.push(path.node);
        currScope.classExprPaths.push(getAncestryPath(path));
      }

      if (path.node.superClass) path.get('superClass').visit();

      path.get('body').visit();
    },

    'ClassMethod|ObjectMethod' (path) {
      const { node } = path;
      if (node.computed) {
        let curr = node.key;
        while (curr.type === 'MemberExpression') curr = curr.object;
        if (curr.type === 'Identifier') {
          currScope.refs.push(curr);
        }
      }
      path.skip();
      withScopeDo(visitFunction(path, currScope), () => path.get('body').visit())
    },

    MetaProperty (path) { path.skip(); },

    BreakStatement (path) { path.skip(); },

    ContinueStatement (path) { path.skip(); },

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // es6 modules
    ImportSpecifier (path) {
      path.skip();
      currScope.importSpecifiers.push(path.node.local);
      currScope.importSpecifierPaths.push(getAncestryPath(path));
    },

    ImportDefaultSpecifier (path) {
      path.skip();
      currScope.importSpecifiers.push(path.node.local);
      currScope.importSpecifierPaths.push(getAncestryPath(path));
    },

    ImportNamespaceSpecifier (path) {
      path.skip();
      currScope.importSpecifiers.push(path.node.local);
      currScope.importSpecifierPaths.push(getAncestryPath(path));
    },

    ExportSpecifier (path) {
      path.skip();
      path.get('local').visit();
    },

    ExportNamedDeclaration (path) {
      currScope.exportDecls.push(path.node);
      currScope.exportDeclPaths.push(getAncestryPath(path));
      if (path.node.source) path.skip();
    },

    ExportDefaultDeclaration (path) {
      currScope.exportDecls.push(path.node);
      currScope.exportDeclPaths.push(getAncestryPath(path));
    },

    ExportAllDeclaration (path) {
      currScope.exportDecls.push(path.node);
      currScope.exportDeclPaths.push(getAncestryPath(path));
    }
  };

  path.traverse(visitor);

  return currScope;
}
