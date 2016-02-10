/*global process, global, exports*/

var lang = require("lively.lang");
var arr = lang.arr, chain = lang.chain;
var ast = require("../index");
var acorn = ast.acorn;


var helpers = {

  declIds: function(nodes) {
    return arr.flatmap(nodes, function(ea) {
      if (!ea) return [];
      if (ea.type === "Identifier") return [ea];
      if (ea.type === "RestElement") return [ea.argument];
      if (ea.type === "ObjectPattern")
        return helpers.declIds(arr.pluck(ea.properties, "value"));
      if (ea.type === "ArrayPattern")
        return helpers.declIds(ea.elements);
      return [];
    });
  },

  varDeclIds: function(scope) {
    return helpers.declIds(
      chain(scope.varDecls)
        .pluck('declarations')
        .flatten()
        .pluck('id')
        .value());
  },

  objPropertiesAsList: function objPropertiesAsList(objExpr, path, onlyLeafs) {
    // takes an obj expr like {x: 23, y: [{z: 4}]} an returns the key and value
    // nodes as a list
    return arr.flatmap(objExpr.properties, function(prop) {
      var key = prop.key.name
      // var result = [{key: path.concat([key]), value: prop.value}];
      var result = [];
      var thisNode = {key: path.concat([key]), value: prop.value};
      switch (prop.value.type) {
        case "ArrayExpression": case "ArrayPattern":
          if (!onlyLeafs) result.push(thisNode);
          result = result.concat(arr.flatmap(prop.value.elements, function(el, i) {
            return objPropertiesAsList(el, path.concat([key, i]), onlyLeafs); }));
          break;
        case "ObjectExpression": case "ObjectPattern":
          if (!onlyLeafs) result.push(thisNode);
          result = result.concat(objPropertiesAsList(prop.value, path.concat([key]), onlyLeafs));
          break;
        default: result.push(thisNode);
      }
      return result;
    });
  }
}

exports.query = {

  helpers: helpers,

  knownGlobals: [
     "true", "false", "null", "undefined", "arguments",
     "Object", "Function", "String", "Array", "Date", "Boolean", "Number", "RegExp",
     "Error", "EvalError", "RangeError", "ReferenceError", "SyntaxError", "TypeError", "URIError",
     "Math", "NaN", "Infinity", "Intl", "JSON", "Promise",
     "parseFloat", "parseInt", "isNaN", "isFinite", "eval", "alert",
     "decodeURI", "decodeURIComponent", "encodeURI", "encodeURIComponent",
     "navigator", "window", "document", "console",
     "setTimeout", "clearTimeout", "setInterval", "clearInterval", "requestAnimationFrame", "cancelAnimationFrame",
     "Node", "HTMLCanvasElement", "Image", "Class",
     "Global", "Functions", "Objects", "Strings",
     "module", "lively", "pt", "rect", "rgb", "$super", "$morph", "$world", "show"],

  scopes: function(parsed) {
    var vis = new ast.MozillaAST.ScopeVisitor();
    var scope = vis.newScope(parsed, null);
    vis.accept(parsed, 0, scope, []);
    return scope;
  },

  nodesAtIndex: function(parsed, index) {
    return acorn.withMozillaAstDo(parsed, [], function(next, node, found) {
      if (node.start <= index && index <= node.end) { found.push(node); next(); }
      return found;
    });
  },

  scopesAtIndex: function(parsed, index) {
    return lang.tree.filter(
      ast.query.scopes(parsed),
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

  scopeAtIndex: function(parsed, index) {
    return arr.last(ast.query.scopesAtIndex(parsed, index));
  },

  scopesAtPos: function(pos, parsed) {
    // DEPRECATED
    // FIXME "scopes" should actually not referer to a node but to a scope
    // object, see exports.query.scopes!
    return acorn.nodesAt(pos, parsed).filter(function(node) {
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

  _declaredVarNames: function(scope, useComments) {
    return (scope.node.id && scope.node.id.name ?
        [scope.node.id && scope.node.id.name] : [])
      .concat(chain(scope.funcDecls).pluck('id').pluck('name').compact().value())
      .concat(arr.pluck(helpers.declIds(scope.params), 'name'))
      .concat(arr.pluck(scope.catches, 'name'))
      .concat(arr.pluck(helpers.varDeclIds(scope), 'name'))
      .concat(chain(scope.classDecls).pluck('id').pluck('name').value())
      .concat(arr.pluck(scope.importDecls, 'name'))
      .concat(!useComments ? [] :
        ast.query._findJsLintGlobalDeclarations(
          scope.node.type === 'Program' ?
            scope.node : scope.node.body));
  },


  _findJsLintGlobalDeclarations: function(node) {
    if (!node || !node.comments) return [];
    return arr.flatten(
      node.comments
        .filter(function(ea) { return ea.text.trim().match(/^global/) })
        .map(function(ea) {
          return arr.invoke(ea.text.replace(/^\s*global\s*/, '').split(','), 'trim');
        }));
  },

  topLevelDeclsAndRefs: function(parsed, options) {
    options = options || {};
    options.withComments = true;

    if (typeof parsed === "string") parsed = ast.parse(parsed, options);

    var q           = ast.query,
        scope       = ast.query.scopes(parsed),
        useComments = !!options.jslintGlobalComment,
        declared    = q._declaredVarNames(scope, useComments),
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

    function findUndeclaredReferences(scope) {
      var names = q._declaredVarNames(scope, useComments);
      return scope.subScopes
        .map(findUndeclaredReferences)
        .reduce(function(refs, ea) { return refs.concat(ea); }, scope.refs)
        .filter(function(ref) { return names.indexOf(ref.name) === -1; });
    }

  },

  findGlobalVarRefs: function(parsed, options) {
    var q = ast.query,
        topLevel = q.topLevelDeclsAndRefs(parsed, options),
        noGlobals = topLevel.declaredNames.concat(q.knownGlobals);
    return topLevel.refs.filter(function(ea) {
      return noGlobals.indexOf(ea.name) === -1; })
  },

  findNodesIncludingLines: function(parsed, code, lines, options) {
    if (!code && !parsed) throw new Error("Need at least ast or code");
    code = code ? code : ast.acorn.stringify(parsed);
    parsed = parsed && parsed.loc ? parsed : ast.parse(code, {locations: true});
    return acorn.withMozillaAstDo(parsed, [], function(next, node, found) {
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
      return scope.params
        .concat(arr.pluck(scope.funcDecls, 'id'))
        .concat(helpers.varDeclIds(scope));
    }
  },

  findDeclarationClosestToIndex: function(parsed, name, index) {
    // var scopes = lively.ast
    function varDeclIdsOf(scope) {
      return scope.params
        .concat(arr.pluck(scope.funcDecls, 'id'))
        .concat(helpers.varDeclIds(scope));
    }
    var found = null;
    arr.detect(
      ast.query.scopesAtIndex(parsed, index).reverse(),
      function(scope) {
        var decls = varDeclIdsOf(scope),
            idx = arr.pluck(decls, 'name').indexOf(name);
        if (idx === -1) return false;
        found = decls[idx]; return true;
      });
    return found;
  }

};
