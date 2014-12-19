/*global window, process, global*/

;(function(run) {
  var env = typeof module !== "undefined" && module.require ? module.require("../env") : lively['lively.lang_env'];
  run(env.acorn, env.lively, env['lively.lang'], env['lively.ast']);
})(function(acorn, lively, lang, exports) {

var arr = lang.arr, chain = lang.chain;

exports.query = {

  knownGlobals: [
     "true", "false", "null", "undefined", "arguments",
     "Object", "Function", "String", "Array", "Date", "Boolean", "Number", "RegExp",
     "Error", "EvalError", "RangeError", "ReferenceError", "SyntaxError", "TypeError", "URIError",
     "Math", "NaN", "Infinity", "Intl", "JSON",
     "parseFloat", "parseInt", "isNaN", "isFinite", "eval", "alert",
     "decodeURI", "decodeURIComponent", "encodeURI", "encodeURIComponent",
     "window", "document", "console",
     "Node", "HTMLCanvasElement", "Image", "Class",
     "Global", "Functions", "Objects", "Strings",
     "module", "lively", "pt", "rect", "rgb", "$super", "$morph", "$world", "show"],

  scopes: function(ast) {
    var vis = new exports.MozillaAST.ScopeVisitor();
    var scope = vis.newScope(ast, null);
    vis.accept(ast, 0, scope, []);
    return scope;
  },

  nodesAtIndex: function(ast, index) {
    return acorn.withMozillaAstDo(ast, [], function(next, node, found) {
      if (node.start <= index && index <= node.end) { found.push(node); next(); }
      return found;
    });
  },

  scopesAtIndex: function(ast, index) {
    return lang.tree.filter(
      exports.query.scopes(ast),
      function(scope) {
        var n = scope.node;
        var start = n.start, end = n.end;
        if (n.type === 'FunctionDeclaration') {
          start = n.params.length ? n.params[0].start : n.body.start;
          end = n.body.end;
        }
        return start <= index && index <= end;
      },
      function(s) { return s.subScopes; });
  },

  scopeAtIndex: function(ast, index) {
    return arr.last(exports.query.scopesAtIndex(ast, index));
  },

  scopesAtPos: function(pos, ast) {
    // DEPRECATED
    // FIXME "scopes" should actually not referer to a node but to a scope
    // object, see exports.query.scopes!
    return acorn.nodesAt(pos, ast).filter(function(node) {
      return node.type === 'Program'
        || node.type === 'FunctionDeclaration'
        || node.type === 'FunctionExpression'
    });
  },

  nodesInScopeOf: function(node) {
    // DEPRECATED
    // FIXME "scopes" should actually not referer to a node but to a scope
    // object, see exports.query.scopes!
    return acorn.withMozillaAstDo(node, {root: node, result: []}, function(next, node, state) {
      state.result.push(node);
      if (node !== state.root
      && (node.type === 'Program'
       || node.type === 'FunctionDeclaration'
       || node.type === 'FunctionExpression')) return state;
      next();
      return state;
    }).result;
  },

  topLevelDeclsAndRefs: function(ast, options) {
    if (typeof ast === "string") ast = exports.parse(ast, {withComments: true});

    var scope     = exports.query.scopes(ast),
      useComments = options && !!options.jslintGlobalComment,
      declared    = declaredVarNames(scope),
      refs        = scope.refs.concat(arr.flatten(scope.subScopes.map(findUndeclaredReferences))),
      undeclared  = chain(refs).pluck('name').withoutAll(declared).value();

    return {
      scope:           scope,
      varDecls:        scope.varDecls,
      funcDecls:       scope.funcDecls,
      declaredNames:   declared,
      undeclaredNames: undeclared,
      refs:            refs
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    function declaredVarNames(scope) {
      return [scope.node.id && scope.node.id.name]
        .concat(chain(scope.funcDecls).pluck('id').pluck('name').compact().value())
        .concat(arr.pluck(scope.params, 'name'))
        .concat(arr.pluck(scope.catches, 'name'))
        .concat(chain(scope.varDecls).pluck('declarations').flatten().pluck('id').pluck('name').value())
        .concat(chain(scope.classDecls).pluck('id').pluck('name').value())
        .concat(!useComments ? [] :
          findJsLintGlobalDeclarations(
            scope.node.type === 'Program' ?
              scope.node : scope.node.body));
    }

    function findUndeclaredReferences(scope) {
      var names = declaredVarNames(scope);
      return scope.subScopes
        .map(findUndeclaredReferences)
        .reduce(function(refs, ea) { return refs.concat(ea); }, scope.refs)
        .filter(function(ref) { return names.indexOf(ref.name) === -1; });
    }

    function findJsLintGlobalDeclarations(node) {
      if (!node || !node.comments) return [];
      return arr.flatten(
        node.comments
          .filter(function(ea) { return ea.text.trim().match(/^global/) })
          .map(function(ea) {
            return arr.invoke(ea.text.replace(/^\s*global\s*/, '').split(','), 'trim');
          }));
    }

  },

  findGlobalVarRefs: function(ast, options) {
    var q = exports.query,
        topLevel = q.topLevelDeclsAndRefs(ast, options),
        noGlobals = topLevel.declaredNames.concat(q.knownGlobals);
    return topLevel.refs.filter(function(ea) {
      return noGlobals.indexOf(ea.name) === -1; })
  },

  findNodesIncludingLines: function(ast, code, lines, options) {
    if (!code && !ast) throw new Error("Need at least ast or code");
    code = code ? code : acorn.stringify(ast);
    ast = ast && ast.loc ? ast : exports.parse(code, {locations: true});
    return acorn.withMozillaAstDo(ast, [], function(next, node, found) {
    if (lines.every(function(line) {
      return lang.num.between(line, node.loc.start.line, node.loc.end.line); })) {
      arr.pushIfNotIncluded(found, node); next(); }
    return found;
    });
  },

  findReferencesAndDeclsInScope: function(scope, name) {
    return arr.flatten( // all references
      lang.tree.map(
        scope,
        function(scope) {
          return scope.refs.concat(varDeclIdsOf(scope))
            .filter(function(ref) { return ref.name === name; });
        },
        function(s) {
          return s.subScopes.filter(function(subScope) {
            return varDeclIdsOf(subScope).every(function(id) {
              return  id.name !== name; }); });
        }));

    function varDeclIdsOf(scope) {
      var funcDeclIds = scope.funcDecls,
          varDeclIds = chain(scope.varDecls).pluck("declarations").flatten().value();
      return scope.params.concat(arr.pluck(scope.funcDecls.concat(varDeclIds), 'id'));
    }
  },

  findDeclarationClosestToIndex: function(ast, name, index) {
    // var scopes = lively.ast
    function varDeclIdsOf(scope) {
      var funcDeclIds = scope.funcDecls,
          varDeclIds = chain(scope.varDecls).pluck("declarations").flatten().value();
      return scope.params.concat(arr.pluck(scope.funcDecls.concat(varDeclIds), 'id'));
    }
    var found = null;
    arr.detect(
      exports.query.scopesAtIndex(ast, index).reverse(),
      function(scope) {
        var decls = varDeclIdsOf(scope),
            idx = arr.pluck(decls, 'name').indexOf(name);
        if (idx === -1) return false;
        found = decls[idx]; return true;
      });
    return found;
  }

};

});
