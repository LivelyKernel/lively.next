import { arr, chain, num, tree, fun, obj } from "lively.lang";
import { BaseVisitor, ScopeVisitor } from "./mozilla-ast-visitors.js";
import { FindToplevelFuncDeclVisitor } from "./visitors.js";
import { withMozillaAstDo } from "./mozilla-ast-visitor-interface.js";
import { parse } from "./parser.js";
import { acorn } from "./acorn-extension.js";
import stringify from "./stringify.js";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var helpers = {

  declIds(nodes) {
    let result = [];
    for (let i = 0; i < nodes.length; i++) {
      let node = nodes[i];
      if (!node) continue;
      else if (node.type === "Identifier") result.push(node);
      else if (node.type === "RestElement") result.push(node.argument);
      // AssignmentPattern: default arg like function(local = defaultVal) {}
      else if (node.type === "AssignmentPattern") result.push(...helpers.declIds([node.left]));
      else if (node.type === "ObjectPattern") {
        for (let j = 0; j < node.properties.length; j++) {
          let prop = node.properties[j];
          result.push(...helpers.declIds([prop.value || prop]))
        }
      }
      else if (node.type === "ArrayPattern")
        result.push(...helpers.declIds(node.elements));
    }
    return result;
  },

  varDecls(scope) {
    return arr.flatmap(scope.varDecls, varDecl =>
      arr.flatmap(varDecl.declarations, decl =>
        helpers.declIds([decl.id]).map(id => [decl, id])));
  },

  varDeclIds(scope) {
    return helpers.declIds(
      scope.varDecls.reduce((all, ea) => {
        all.push.apply(all, ea.declarations); return all; }, [])
          .map(ea => ea.id));
  },

  objPropertiesAsList(objExpr, path, onlyLeafs) {
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
            return helpers.objPropertiesAsList(el, path.concat([key, i]), onlyLeafs); }));
          break;
        case "ObjectExpression": case "ObjectPattern":
          if (!onlyLeafs) result.push(thisNode);
          result = result.concat(helpers.objPropertiesAsList(prop.value, path.concat([key]), onlyLeafs));
          break;
        case "AssignmentPattern":
          if (!onlyLeafs) result.push(thisNode);
          result = result.concat(helpers.objPropertiesAsList(prop.left, path.concat([key]), onlyLeafs));
          break;
        default: result.push(thisNode);
      }
      return result;
    });
  },

  isDeclaration(node) {
    return node.type === "FunctionDeclaration" ||
           node.type === "VariableDeclaration" ||
           node.type === "ClassDeclaration";
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var knownGlobals = [
  "true",
  "false",
  "null",
  "undefined",
  "arguments",
  "Object",
  "Function",
  "Array",
  "Number",
  "parseFloat",
  "parseInt",
  "Infinity",
  "NaN",
  "Boolean",
  "String",
  "Symbol",
  "Date",
  "Promise",
  "RegExp",
  "Error",
  "EvalError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TypeError",
  "URIError",
  "JSON",
  "Math",
  "console",
  "ArrayBuffer",
  "Uint8Array",
  "Int8Array",
  "Uint16Array",
  "Int16Array",
  "Uint32Array",
  "Int32Array",
  "Float32Array",
  "Float64Array",
  "Uint8ClampedArray",
  "DataView",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "Proxy",
  "Reflect",
  "decodeURI",
  "decodeURIComponent",
  "encodeURI",
  "encodeURIComponent",
  "escape",
  "unescape",
  "eval",
  "isFinite",
  "isNaN",
  "Intl",
  "navigator",
  "window",
  "document",
  "Blob",
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "btoa",
  "atob",
  "sessionStorage",
  "localStorage",
  "$world",
  "lively"
];

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
    .concat(scope.importSpecifiers)
}

function declarationsWithIdsOfScope(scope) {
  // returns a list of pairs [(DeclarationNode,IdentifierNode)]
  const bareIds = helpers.declIds(scope.params).concat(scope.catches),
        declNodes = (scope.node.id && scope.node.id.name ? [scope.node] : [])
                      .concat(scope.funcDecls)
                      .concat(scope.classDecls);
  return bareIds.map(ea => [ea, ea])
          .concat(declNodes.map(ea => [ea, ea.id]))
          .concat(helpers.varDecls(scope))
          .concat(scope.importSpecifiers.map(im => {
            return [statementOf(scope.node, im), im]}));
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

function resolveReference(ref, scopePath) {
  if (scopePath.length == 0) return [null, null];
  const [scope, ...outer] = scopePath;
  const decls = scope.decls || declarationsWithIdsOfScope(scope);
  scope.decls = decls;
  const decl = decls.find(([_, id]) => id.name == ref);
  return decl || resolveReference(ref, outer);
}

function resolveReferences(scope) {
  function rec(scope, outerScopes) {
    const path = [scope].concat(outerScopes);
    scope.refs.forEach(ref => {
      const [decl, id] = resolveReference(ref.name, path);
      map.set(ref, {decl, declId: id, ref});
    });
    scope.subScopes.forEach(s => rec(s, path));
  }
  if (scope.referencesResolvedSafely) return scope;
  var map = scope.resolvedRefMap || (scope.resolvedRefMap = new Map());
  rec(scope, []);
  scope.referencesResolvedSafely = true;
  return scope;
}

function refWithDeclAt(pos, scope) {
  for (let ref of scope.resolvedRefMap.values()) {
    var {ref: {start, end}} = ref;
    if (start <= pos && pos <= end) return ref;
  }
}

function topLevelDeclsAndRefs(parsed, options) {
  options = options || {};
  options.withComments = true;

  if (typeof parsed === "string") parsed = parse(parsed, options);

  var scope       = scopes(parsed),
      useComments = !!options.jslintGlobalComment,
      declared    = _declaredVarNames(scope, useComments),
      refs        = scope.refs.concat(arr.flatten(
                      scope.subScopes.map(findUndeclaredReferences))),
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
  if (name === "this") {
    return scope.thisRefs;
  }

  return arr.flatten( // all references
    tree.map(scope,
      scope => scope.refs.concat(varDeclIdsOf(scope)).filter(ref => ref.name === name),
      s => s.subScopes.filter(subScope => varDeclIdsOf(subScope).every(id => id.name !== name))));

  function varDeclIdsOf(scope) {
    return scope.params
      .concat(arr.pluck(scope.funcDecls, 'id'))
      .concat(arr.pluck(scope.classDecls, 'id'))
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

const _stmtTypes = [
  "EmptyStatement",
  "BlockStatement",
  "ExpressionStatement",
  "IfStatement",
  "BreakStatement",
  "ContinueStatement",
  "WithStatement",
  "ReturnStatement",
  "ThrowStatement",
  "TryStatement",
  "WhileStatement",
  "DoWhileStatement",
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "DebuggerStatement",
  "FunctionDeclaration",
  "VariableDeclaration",
  "ClassDeclaration",
  "ImportDeclaration",
  "ImportDeclaration",
  "ExportNamedDeclaration",
  "ExportDefaultDeclaration",
  "ExportAllDeclaration"];

function statementOf(parsed, node, options) {
  // Find the statement that a target node is in. Example:
  // let source be "var x = 1; x + 1;" and we are looking for the
  // Identifier "x" in "x+1;". The second statement is what will be found.
  const nodes = nodesAt(node.start, parsed),
        found = nodes.reverse().find(node => arr.include(_stmtTypes, node.type));
  if (options && options.asPath) {
    let v = new BaseVisitor(), foundPath;
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
// imports and exports
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function imports(scope) {

  // like import "fooo";
  var imports = [],
      stmts = scope.node.body || [];

  for (var i = 0; i < stmts.length; i++) {
    var stmt = stmts[i];
    if (stmt.type !== "ImportDeclaration") continue;
    if (stmt.specifiers.length === 0) {
      imports.push({local: null, imported: null, fromModule: stmt.source.value, node: stmt});
      continue;
    }

    // like import { x as y } from "fooo"; import * as x from "fooo"; import x from "fooo";
    var from = stmt.source ? stmt.source.value : "unknown module";
    
    imports.push(...stmt.specifiers.map(importSpec => {
      var imported;
      if (importSpec.type === "ImportNamespaceSpecifier") imported = "*";
      else if (importSpec.type === "ImportDefaultSpecifier") imported = "default";
      else if (importSpec.type === "ImportSpecifier") imported = importSpec.imported.name;
      else imported = null;
      return {
        local:      importSpec.local ? importSpec.local.name : null,
        imported:   imported,
        fromModule: from,
        node:       stmt
      };
    }))
  }

  return imports;
}

function exports(scope, resolve = false) {
  if (resolve) resolveReferences(scope);

  const exports = scope.exportDecls.reduce((exports, node) => {

    var exportsStmt = statementOf(scope.node, node);
    if (!exportsStmt) return exports;

    var from = exportsStmt.source ? exportsStmt.source.value : null;

    if (exportsStmt.type === "ExportAllDeclaration") {
      return exports.concat([{
        local:           null,
        exported:        "*",
        imported:        "*",
        fromModule:      from,
        node:            node,
        type:            "all"
      }])
    }
    if (exportsStmt.type === "ExportDefaultDeclaration") {
      if (helpers.isDeclaration(exportsStmt.declaration)) {
        return exports.concat({
          local:           exportsStmt.declaration.id.name,
          exported:        "default",
          type:            exportsStmt.declaration.type === "FunctionDeclaration" ?
                            "function" : exportsStmt.declaration.type === "ClassDeclaration" ?
                              "class" : null,
          fromModule:      null,
          node:            node,
          decl:            exportsStmt.declaration,
          declId:          exportsStmt.declaration.id
        });

      } else if (exportsStmt.declaration.type === "Identifier") {
        var {decl, declId} = scope.resolvedRefMap.get(exportsStmt.declaration) || {}
        return exports.concat([{
          local:           exportsStmt.declaration.name,
          exported:        "default",
          fromModule:      null,
          node:            node,
          type:            "id",
          decl,
          declId
        }])

      } else { // exportsStmt.declaration is an expression
        return exports.concat([{
          local:           null,
          exported:        "default",
          fromModule:      null,
          node:            node,
          type:            "expr",
          decl:            exportsStmt.declaration,
          declId:          exportsStmt.declaration
        }])
      }
    }

    if (exportsStmt.specifiers && exportsStmt.specifiers.length) {
      return exports.concat(exportsStmt.specifiers.map(exportSpec => {
        var decl, declId;
        if (from) {
          // "export { x as y } from 'foo'" is the only case where export
          // creates a (non-local) declaration itself
          decl = node; declId = exportSpec.exported;
        } else if (exportSpec.local) {
          var resolved = scope.resolvedRefMap.get(exportSpec.local);
          decl = resolved ? resolved.decl : null;
          declId = resolved ? resolved.declId : null;
        }

        return {
          local:           !from && exportSpec.local ? exportSpec.local.name : null,
          exported:        exportSpec.exported ? exportSpec.exported.name : null,
          imported:        from && exportSpec.local ? exportSpec.local.name : null,
          fromModule:      from || null,
          type:           "id",
          node,
          decl,
          declId
        }
      }))
    }

    if (exportsStmt.declaration && exportsStmt.declaration.declarations) {
      return exports.concat(exportsStmt.declaration.declarations.map(decl => {
        return {
          local:           decl.id.name,
          exported:        decl.id.name,
          type:            exportsStmt.declaration.kind,
          fromModule:      null,
          node:            node,
          decl:            decl,
          declId:          decl.id
        }
      }))
    }

    if (exportsStmt.declaration) {
      return exports.concat({
        local:           exportsStmt.declaration.id.name,
        exported:        exportsStmt.declaration.id.name,
        type:            exportsStmt.declaration.type === "FunctionDeclaration" ?
                          "function" : exportsStmt.declaration.type === "ClassDeclaration" ?
                            "class" : null,
        fromModule:      null,
        node:            node,
        decl:            exportsStmt.declaration,
        declId:          exportsStmt.declaration.id
      })
    }
    return exports;
  }, []);

  return arr.uniqBy(exports, (a, b) =>
    a.local == b.local && a.exported == b.exported && a.fromModule == b.fromModule);
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
  statementOf,
  resolveReferences,
  refWithDeclAt,
  imports,
  exports
};
