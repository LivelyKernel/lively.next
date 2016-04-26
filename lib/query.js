import { arr, chain, num, tree } from "lively.lang";
import { ScopeVisitor } from "./mozilla-ast-visitors.js";
import { withMozillaAstDo } from "./mozilla-ast-visitor-interface.js";
import { parse } from "./parser.js";
import { acorn } from "./acorn-extension.js";
import stringify from "./stringify.js";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var helpers = {

  declIds: function(nodes) {
    return arr.flatmap(nodes, function(ea) {
      if (!ea) return [];
      if (ea.type === "Identifier") return [ea];
      if (ea.type === "RestElement") return [ea.argument];
      if (ea.type === "AssignmentPattern") return [ea.left];
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

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var knownGlobals = [
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
  "module", "lively", "pt", "rect", "rgb", "$super", "$morph", "$world", "show"]

function scopes(parsed) {
  var vis = new ScopeVisitor(),
      scope = vis.newScope(parsed, null);
  vis.accept(parsed, 0, scope, []);
  return scope;
}

function nodesAtIndex(parsed, index) {
  return withMozillaAstDo(parsed, [], function(next, node, found) {
    if (node.start <= index && index <= node.end) { found.push(node); next(); }
    return found;
  });
}

function scopesAtIndex(parsed, index) {
  return tree.filter(
    scopes(parsed),
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
}

function scopeAtIndex(parsed, index) {
  return arr.last(scopesAtIndex(parsed, index));
}

function scopesAtPos(pos, parsed) {
  // DEPRECATED
  // FIXME "scopes" should actually not referer to a node but to a scope
  // object, see exports.scopes!
  return nodesAt(pos, parsed).filter(function(node) {
    return node.type === 'Program'
      || node.type === 'FunctionDeclaration'
      || node.type === 'FunctionExpression'
  });
}

function nodesInScopeOf(node) {
  // DEPRECATED
  // FIXME "scopes" should actually not referer to a node but to a scope
  // object, see exports.scopes!
  return withMozillaAstDo(node, {root: node, result: []}, function(next, node, state) {
    state.result.push(node);
    if (node !== state.root
    && (node.type === 'Program'
     || node.type === 'FunctionDeclaration'
     || node.type === 'FunctionExpression')) return state;
    next();
    return state;
  }).result;
}

function _declaredVarNames(scope, useComments) {
  return (scope.node.id && scope.node.id.name ?
      [scope.node.id && scope.node.id.name] : [])
    .concat(chain(scope.funcDecls).pluck('id').pluck('name').compact().value())
    .concat(arr.pluck(helpers.declIds(scope.params), 'name'))
    .concat(arr.pluck(scope.catches, 'name'))
    .concat(arr.pluck(helpers.varDeclIds(scope), 'name'))
    .concat(chain(scope.classDecls).pluck('id').pluck('name').value())
    .concat(arr.pluck(scope.importDecls, 'name'))
    .concat(!useComments ? [] :
      _findJsLintGlobalDeclarations(
        scope.node.type === 'Program' ?
          scope.node : scope.node.body));
}


function _findJsLintGlobalDeclarations(node) {
  if (!node || !node.comments) return [];
  return arr.flatten(
    node.comments
      .filter(function(ea) { return ea.text.trim().match(/^global/) })
      .map(function(ea) {
        return arr.invoke(ea.text.replace(/^\s*global\s*/, '').split(','), 'trim');
      }));
}

function topLevelDeclsAndRefs(parsed, options) {
  options = options || {};
  options.withComments = true;

  if (typeof parsed === "string") parsed = parse(parsed, options);

  var scope       = scopes(parsed),
      useComments = !!options.jslintGlobalComment,
      declared    = _declaredVarNames(scope, useComments),
      refs        = scope.refs.concat(arr.flatten(scope.subScopes.map(findUndeclaredReferences))),
      undeclared  = chain(refs).pluck('name').withoutAll(declared).value();

  return {
    scope:           scope,
    varDecls:        scope.varDecls,
    funcDecls:       scope.funcDecls,
    classDecls:      scope.classDecls,
    declaredNames:   declared,
    undeclaredNames: undeclared,
    refs:            refs
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function findUndeclaredReferences(scope) {
    var names = _declaredVarNames(scope, useComments);
    return scope.subScopes
      .map(findUndeclaredReferences)
      .reduce(function(refs, ea) { return refs.concat(ea); }, scope.refs)
      .filter(function(ref) { return names.indexOf(ref.name) === -1; });
  }

}

function findGlobalVarRefs(parsed, options) {
  var topLevel = topLevelDeclsAndRefs(parsed, options),
      noGlobals = topLevel.declaredNames.concat(knownGlobals);
  return topLevel.refs.filter(function(ea) {
    return noGlobals.indexOf(ea.name) === -1; })
}

function findNodesIncludingLines(parsed, code, lines, options) {
  if (!code && !parsed) throw new Error("Need at least ast or code");
  code = code ? code : stringify(parsed);
  parsed = parsed && parsed.loc ? parsed : parse(code, {locations: true});
  return withMozillaAstDo(parsed, [], function(next, node, found) {
  if (lines.every(function(line) {
    return num.between(line, node.loc.start.line, node.loc.end.line); })) {
    arr.pushIfNotIncluded(found, node); next(); }
  return found;
  });
}

function findReferencesAndDeclsInScope(scope, name) {
  return arr.flatten( // all references
    tree.map(
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
}

function findDeclarationClosestToIndex(parsed, name, index) {
  // var scopes = lively.ast
  function varDeclIdsOf(scope) {
    return scope.params
      .concat(arr.pluck(scope.funcDecls, 'id'))
      .concat(helpers.varDeclIds(scope));
  }
  var found = null;
  arr.detect(
    scopesAtIndex(parsed, index).reverse(),
    function(scope) {
      var decls = varDeclIdsOf(scope),
          idx = arr.pluck(decls, 'name').indexOf(name);
      if (idx === -1) return false;
      found = decls[idx]; return true;
    });
  return found;
}

function nodesAt(pos, ast) {
  ast = typeof ast === 'string' ? parse(ast) : ast;
  return acorn.walk.findNodesIncluding(ast, pos);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export {
  helpers,
  knownGlobals,
  scopes,
  nodesAtIndex,
  scopesAtIndex,
  scopeAtIndex,
  scopesAtPos,
  nodesInScopeOf,
  _declaredVarNames,
  _findJsLintGlobalDeclarations,
  topLevelDeclsAndRefs,
  findGlobalVarRefs,
  findNodesIncludingLines,
  findReferencesAndDeclsInScope,
  findDeclarationClosestToIndex,
  nodesAt
}
