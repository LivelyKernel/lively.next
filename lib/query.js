import { arr, chain, num, tree, fun } from "lively.lang";
import { BaseVisitor, ScopeVisitor } from "./mozilla-ast-visitors.js";
import { FindToplevelFuncDeclVisitor } from "./visitors.js";
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
      if (ea.type === "AssignmentPattern") return helpers.declIds([ea.left]);
      if (ea.type === "ObjectPattern")
        return helpers.declIds(arr.pluck(ea.properties, "value"));
      if (ea.type === "ArrayPattern")
        return helpers.declIds(ea.elements);
      return [];
    });
  },

  varDeclIds: function(scope) {
    return helpers.declIds(
      scope.varDecls.reduce((all, ea) => {
        all.push.apply(all, ea.declarations); return all; }, [])
          .map(ea => ea.id));
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
        case "AssignmentPattern":
          if (!onlyLeafs) result.push(thisNode);
          result = result.concat(objPropertiesAsList(prop.left, path.concat([key]), onlyLeafs));
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
  "Object", "Function", "String", "Array", "Date", "Boolean", "Number", "RegExp", "Symbol",
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
  vis.accept(parsed, scope, []);
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

function declarationsOfScope(scope, includeOuter) {
  // returns Identifier nodes
  return (includeOuter && scope.node.id && scope.node.id.name ? [scope.node.id] : [])
    .concat(helpers.declIds(scope.params))
    .concat(scope.funcDecls.map(ea => ea.id))
    .concat(helpers.varDeclIds(scope))
    .concat(scope.catches)
    .concat(scope.classDecls.map(ea => ea.id))
    .concat(scope.importDecls)
}

function _declaredVarNames(scope, useComments) {
  return arr.pluck(declarationsOfScope(scope, true), 'name')
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

function topLevelFuncDecls(parsed) {
  return FindToplevelFuncDeclVisitor.run(parsed);
}

function topLevelDeclsAndRefs(parsed, options) {
  options = options || {};
  options.withComments = true;

  if (typeof parsed === "string") parsed = parse(parsed, options);

  var scope       = scopes(parsed),
      useComments = !!options.jslintGlobalComment,
      declared    = _declaredVarNames(scope, useComments),
      refs        = scope.refs.concat(arr.flatten(scope.subScopes.map(findUndeclaredReferences))),
      undeclared  = arr.withoutAll(refs.map(ea => ea.name), declared);

  return {
    scope:           scope,
    varDecls:        scope.varDecls,
    funcDecls:       scope.funcDecls,
    classDecls:      scope.classDecls,
    declaredNames:   declared,
    undeclaredNames: undeclared,
    refs:            refs,
    thisRefs:        scope.thisRefs
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
  return withMozillaAstDo(parsed, [], (next, node, found) => {
    if (lines.every(line => num.between(line, node.loc.start.line, node.loc.end.line))) {
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
  var found = null;
  arr.detect(
    scopesAtIndex(parsed, index).reverse(),
    (scope) => {
      var decls = declarationsOfScope(scope, true),
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

function statementOf(parsed, node, options) {
  // Find the statement that a target node is in. Example:
  // let source be "var x = 1; x + 1;" and we are looking for the
  // Identifier "x" in "x+1;". The second statement is what will be found.
  var nodes = nodesAt(node.start, parsed);
  if (nodes.indexOf(node) === -1) return undefined;
  var found = nodes.reverse().find((node, i) => {
    if (!nodes[i+1]) return false;
    var t = nodes[i+1].type;
    return ["BlockStatement",
            "Program",
            "FunctionDeclaration",
            "FunctionExpress",
            "ArrowFunctionExpress",
            "SwitchCase", "SwitchStatement"].indexOf(t) > -1 ? true : false;
  });
  if (options && options.asPath) {
    var v = new BaseVisitor(), foundPath;
    v.accept = fun.wrap(v.accept, (proceed, node, state, path) => {
      if (node === found) { foundPath = path; throw new Error("stop search"); };
      return proceed(node, state, path);
    });
    try { v.accept(parsed, {}, []); } catch (e) {}
    return foundPath;
  }
  return found;
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
  declarationsOfScope,
  _declaredVarNames,
  _findJsLintGlobalDeclarations,
  topLevelDeclsAndRefs,
  topLevelFuncDecls,
  findGlobalVarRefs,
  findNodesIncludingLines,
  findReferencesAndDeclsInScope,
  findDeclarationClosestToIndex,
  nodesAt,
  statementOf
}
