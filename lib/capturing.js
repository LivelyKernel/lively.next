import { obj, chain, arr, fun, Path } from "lively.lang";
import { parse } from "./parser.js";
import * as query from "./query.js";
import Visitor from "../generated/estree-visitor";
import stringify from "./stringify.js";

var merge = Object.assign;

export function rewriteToCaptureTopLevelVariables(astOrSource, assignToObj, options) {
  /* replaces var and function declarations with assignment statements.
  * Example:
     exports.transform.replaceTopLevelVarDeclAndUsageForCapturing(
       "var x = 3, y = 2, z = 4",
       {name: "A", type: "Identifier"}, ['z']).source;
     // => "A.x = 3; A.y = 2; z = 4"
  */

  options = obj.merge({
    ignoreUndeclaredExcept: null,
    includeRefs: null,
    excludeRefs: (options && options.exclude) || [],
    includeDecls: null,
    excludeDecls: (options && options.exclude) || [],
    recordDefRanges: false,
    es6ExportFuncId: null,
    es6ImportFuncId: null,
    captureObj: assignToObj || {type: "Identifier", name: "__rec"},
    moduleExportFunc: {name: options && options.es6ExportFuncId || "_moduleExport", type: "Identifier"},
    moduleImportFunc: {name: options && options.es6ImportFuncId || "_moduleImport", type: "Identifier"},
  }, options);

  var parsed = typeof astOrSource === 'object' ?
        astOrSource : parse(astOrSource),
      source = typeof astOrSource === 'string' ?
        astOrSource : (parsed.source || stringify(parsed)),
      rewritten = parsed;

  // "ignoreUndeclaredExcept" is null if we want to capture all globals in the toplevel scope
  // if it is a list of names we will capture all refs with those names
  if (options.ignoreUndeclaredExcept) {
    var topLevel = query.topLevelDeclsAndRefs(parsed);
    options.excludeRefs = arr.withoutAll(topLevel.undeclaredNames, options.ignoreUndeclaredExcept).concat(options.excludeRefs);
    options.excludeDecls = arr.withoutAll(topLevel.undeclaredNames, options.ignoreUndeclaredExcept).concat(options.excludeDecls);
  }

  options.excludeRefs = options.excludeRefs.concat(options.captureObj.name);
  options.excludeDecls = options.excludeDecls.concat(options.captureObj.name);

  // 1. def ranges so that we know at which source code positions the
  // definitions are
  var defRanges = options.recordDefRanges ? computeDefRanges(rewritten, options) : null;

  // 2. find those var declarations that should not be rewritten. we
  // currently ignore var declarations in for loops and the error parameter
  // declaration in catch clauses. Also es6 import / export declaration need
  // a special treatment
  // DO NOT rewrite exports like "export { foo as bar }" => "export { _rec.foo as bar }"
  // as this is not valid syntax. Instead we add a var declaration using the
  // recorder as init for those exports later
  options.excludeRefs = options.excludeRefs.concat(additionalIgnoredRefs(parsed, options));
  options.excludeDecls = options.excludeDecls.concat(additionalIgnoredDecls(parsed, options));

  // 3. if the es6ExportFuncId options is defined we rewrite the es6 form into an
  // obj assignment, converting es6 code to es5 using the extra
  // options.moduleExportFunc and options.moduleImportFunc as capture / sources
  if (options.es6ExportFuncId) {
    options.excludeRefs.push(options.es6ExportFuncId);
    options.excludeRefs.push(options.es6ImportFuncId);
    rewritten = es6ModuleTransforms(rewritten, options);
  }

  // 4. make all references declared in the toplevel scope into property
  // reads of captureObj
  // Example "var foo = 3; 99 + foo;" -> "var foo = 3; 99 + Global.foo;"
  rewritten = replaceRefs(rewritten, options);

  // 5.a turn var declarations into assignments to captureObj
  // Example: "var foo = 3; 99 + foo;" -> "Global.foo = 3; 99 + foo;"
  rewritten = replaceVarDecls(rewritten, options);

  // 5.b record class declarations
  // Example: "class Foo {}" -> "class Foo {}; Global.Foo = Foo;"
  rewritten = replaceClassDecls(rewritten, options);

  // 6. es6 export declaration are left untouched but a capturing assignment
  // is added after the export so that we get the value:
  // "export var x = 23;" => "export var x = 23; Global.x = x;"
  rewritten = insertCapturesForExportDeclarations(rewritten, options);

  // 7. es6 import declaration are left untouched but a capturing assignment
  // is added after the import so that we get the value:
  // "import x from './some-es6-module.js';" => "import x from './some-es6-module.js';\n_rec.x = x;"
  rewritten = insertCapturesForImportDeclarations(rewritten, options);

  // 8. Since variable declarations like "var x = 23" were transformed to sth
  // like "_rex.x = 23" exports can't simply reference vars anymore and
  // "export { _rec.x }" is invalid syntax. So in front of those exports we add
  // var decls manually
  rewritten = insertDeclarationsForExports(rewritten, options);

  // 9. assignments for function declarations in the top level scope are
  // put in front of everything else to mirror the func hoisting:
  // "return bar(); function bar() { return 23 }" ->
  //   "Global.bar = bar; return bar(); function bar() { return 23 }"
  rewritten = putFunctionDeclsInFront(rewritten, options);

// console.log(stringify(rewritten));
  // console.log(require("util").inspect(rewritten.body, {depth: 10}));

  return {
    ast: rewritten,
    source: stringify(rewritten),
    defRanges: defRanges
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// replacing helpers
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var replaceVisitor = (() => {
  var v = new Visitor();
  v.accept = fun.wrap(v.accept, (proceed, node, state, path) =>
    v.replacer(proceed(node, state, path), path));
  return v;
})();

function replace(parsed, replacer) {
  replaceVisitor.replacer = replacer;
  return replaceVisitor.accept(parsed, null, []);
}

var replaceManyVisitor = (() => {
  var v = new Visitor(),
      canBeInlinedSym = Symbol("canBeInlined");
  v.accept = fun.wrap(v.accept, (proceed, node, state, path) => {
    var replaced = v.replacer(proceed(node, state, path), path);
    return !Array.isArray(replaced) ?
      replaced : replaced.length === 1 ?
        replaced[0] : Object.assign(block(replaced), {[canBeInlinedSym]: true});
  });
  v.visitBlockStatement = fun.wrap(v.visitBlockStatement, blockInliner);
  v.visitProgram = fun.wrap(v.visitProgram, blockInliner);
  return v;

  function blockInliner(proceed, node, state, path) {
    var result = proceed(node, state, path);
    // FIXME what about () => x kind of functions?
    if (Array.isArray(result.body)) {
      result.body = result.body.reduce((body, node) => {
        if (node.type !== "BlockStatement" || !node[canBeInlinedSym]) {
          body.push(node);
          return body
        } else {
          return body.concat(node.body)
        }
      }, []);
    }
    return result;
  }
})();

function replaceWithMany(parsed, replacer) {
  replaceManyVisitor.replacer = replacer;
  return replaceManyVisitor.accept(parsed, null, []);
}

function replaceRefs(parsed, options) {
  var topLevel = query.topLevelDeclsAndRefs(parsed),
      refsToReplace = topLevel.refs.filter(ref => shouldRefBeCaptured(ref, topLevel, options));

  return replace(parsed, (node, path) =>
    refsToReplace.indexOf(node) > -1 ? member(node, options.captureObj) : node);
}

function replaceVarDecls(parsed, options) {
  // rewrites var declarations so that they can be captured by
  // `options.captureObj`.
  // For normal vars we will do a transform like
  //   "var x = 23;" => "_rec.x = 23";
  // For patterns (destructuring assignments) we will create assignments for
  // all properties that are being destructured, creating helper vars as needed
  //   "var {x: [y]} = foo" => "var _1 = foo; var _1$x = _1.x; __rec.y = _1$x[0];"

  var topLevel = query.topLevelDeclsAndRefs(parsed);
  return replaceWithMany(parsed, node => {
    if (topLevel.varDecls.indexOf(node) === -1
     || node.declarations.every(decl => !shouldDeclBeCaptured(decl, options)))
       return node;

    return arr.flatmap(node.declarations, decl => {
      if (!shouldDeclBeCaptured(decl, options))
        return [{type: "VariableDeclaration", kind: node.kind || "var", declarations: [decl]}];

      // Here we create the object pattern / destructuring replacements
      if (decl.id.type.match(/Pattern/)) {
        var declRootName = generateUniqueName(topLevel.declaredNames, "destructured_1"),
            declRoot = {type: "Identifier", name: declRootName},
            state = {parent: declRoot, declaredNames: topLevel.declaredNames},
            extractions = transformPattern(decl.id, state).map(decl =>
              decl[annotationSym] && decl[annotationSym].capture ?
                assignExpr(options.captureObj, decl.declarations[0].id, decl.declarations[0].init, false) :
                decl);
        topLevel.declaredNames.push(declRootName);
        return [varDecl(declRoot, decl.init, node.kind)].concat(extractions);
      }

      // This is rewriting normal vars
      var init = decl.init || {
        operator: "||",
        type: "LogicalExpression",
        left: {computed: true, object: options.captureObj, property: {type: "Literal", value: decl.id.name},type: "MemberExpression"},
        right: {name: "undefined", type: "Identifier"}
      };
      return [assignExpr(options.captureObj, decl.id, init, false)];
    });

  });
}

function replaceClassDecls(parsed, options) {
  var topLevel = query.topLevelDeclsAndRefs(parsed);
  if (!topLevel.classDecls.length) return parsed;
  parsed.body = parsed.body.reduce((stmts, stmt) =>
    stmts.concat(topLevel.classDecls.indexOf(stmt) === -1 ?
      [stmt] : [stmt, assignExpr(options.captureObj, stmt.id, stmt.id, false)]), []);
  return parsed;
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// naming
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function generateUniqueName(declaredNames, hint) {
  var unique = hint, n = 1;
  while (declaredNames.indexOf(unique) > -1) {
    if (n > 1000) throw new Error("Endless loop searching for unique variable " + unique);
    unique = unique.replace(/_[0-9]+$|$/, "_" + (++n));
  }
  return unique;
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// exclude / include helpers
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function additionalIgnoredDecls(parsed, options) {
  var topLevel = query.topLevelDeclsAndRefs(parsed),
      ignoreDecls = topLevel.scope.varDecls.reduce((result, decl, i) => {
        var path = Path(topLevel.scope.varDeclPaths[i]),
            parent = path.slice(0,-1).get(parsed);
        if (parent.type === "ForStatement"
         || parent.type === "ForInStatement"
         || (parent.type === "ExportNamedDeclaration")) { result.push(decl); }
        return result;
      }, []);
  return []
    .concat(arr.pluck(topLevel.scope.catches, "name"))
    .concat(chain(ignoreDecls).pluck("declarations").flatten().pluck("id").pluck("name").value());
}

function additionalIgnoredRefs(parsed, options) {
  // FIXME rk 2016-05-11: in shouldRefBeCaptured we now also test for import
  // decls, this should somehow be consolidated with this function and with the
  // fact that naming based ignores aren't good enough...
  var topLevel = query.topLevelDeclsAndRefs(parsed),
      ignoreDecls = topLevel.scope.varDecls.reduce((result, decl, i) => {
        var path = Path(topLevel.scope.varDeclPaths[i]),
            parent = path.slice(0,-1).get(parsed);
        if (parent.type === "ForStatement"
         || parent.type === "ForInStatement"
         || (parent.type === "ExportNamedDeclaration")) { result.push(decl); }
        return result;
      }, []),
      ignoredImportAndExportNames = parsed.body.reduce((ignored, stmt) => {
        if (!options.es6ImportFuncId && stmt.type === "ImportDeclaration")
          return stmt.specifiers.reduce((ignored, specifier) =>
            specifier.type === "ImportSpecifier" ?
              ignored.concat([specifier.imported.name]) : ignored, ignored);
        if (!options.es6ExportFuncId && (stmt.type === "ExportNamedDeclaration"
          || stmt.type === "ExportDefaultDeclaration") && stmt.specifiers)
          return ignored.concat(stmt.specifiers.map(specifier => specifier.local.name));
        return ignored;
      }, []);
  return []
    .concat(arr.pluck(topLevel.scope.catches, "name"))
    .concat(ignoredImportAndExportNames)
    .concat(chain(ignoreDecls).pluck("declarations").flatten().pluck("id").pluck("name").value());
}

function shouldDeclBeCaptured(decl, options) {
  return options.excludeDecls.indexOf(decl.id.name) === -1
    && (!options.includeDecls || options.includeDecls.indexOf(decl.id.name) > -1);
}

function shouldRefBeCaptured(ref, toplevel, options) {
  return !arr.include(toplevel.scope.importDecls, ref)
    && options.excludeRefs.indexOf(ref.name) === -1
    && (!options.includeRefs || options.includeRefs.indexOf(ref.name) > -1);
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// capturing specific code
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function insertCapturesForExportDeclarations(parsed, options) {
  parsed.body = parsed.body.reduce((stmts, stmt) => {
    if (stmt.type !== "ExportNamedDeclaration" || !stmt.declaration) return stmts.concat([stmt]);
    var decls = stmt.declaration.declarations || [stmt.declaration];
    return stmts.concat([stmt]).concat(decls.map(decl => assignExpr(options.captureObj, decl.id, decl.id, false)))
  }, []);
  return parsed;
}

function insertCapturesForImportDeclarations(parsed, options) {
  parsed.body = parsed.body.reduce((stmts, stmt) =>
    stmts.concat(stmt.type !== "ImportDeclaration" || !stmt.specifiers.length ? [stmt] :
      [stmt].concat(stmt.specifiers.map(specifier =>
        assignExpr(options.captureObj, specifier.local, specifier.local, false)))), []);
  return parsed;
}

function insertDeclarationsForExports(parsed, options) {
  var topLevel = query.topLevelDeclsAndRefs(parsed);
  parsed.body = parsed.body.reduce((stmts, stmt) =>
    stmts.concat(stmt.type !== "ExportNamedDeclaration" || !stmt.specifiers.length ?
      [stmt] :
      stmt.specifiers.map(specifier =>
       topLevel.declaredNames.indexOf(specifier.local.name) > -1 ?
       null :
        varDeclOrAssignment(parsed, {
          type: "VariableDeclarator",
          id: specifier.local,
          init: member(specifier.local, options.captureObj)
        })).filter(Boolean).concat(stmt)), []);
  return parsed;
}

function es6ModuleTransforms(parsed, options) {
  parsed.body = parsed.body.reduce((stmts, stmt) => {
    var nodes;
    if (stmt.type === "ExportNamedDeclaration") {
      if (stmt.source) {
        var key = moduleId = stmt.source;
        nodes = stmt.specifiers.map(specifier => ({
          type: "ExpressionStatement",
          expression: exportFromImport(
            {type: "Literal", value: specifier.exported.name},
            {type: "Literal", value: specifier.local.name},
             moduleId, options.moduleExportFunc, options.moduleImportFunc)}));
      } else if (stmt.declaration) {
        var decls = stmt.declaration.declarations || [stmt.declaration];
        nodes = [stmt.declaration].concat(decls.map(decl => exportCallStmt(options.moduleExportFunc, decl.id.name, decl.id)));
      } else {
        nodes = stmt.specifiers.map(specifier =>
        exportCallStmt(options.moduleExportFunc, specifier.exported.name,
          shouldDeclBeCaptured({id: specifier.local}, options) ?
            member(specifier.local, options.captureObj) :
            specifier.local))
      }
    } else if (stmt.type === "ExportDefaultDeclaration") {
      // nodes = [assignExpr(options.moduleExportFunc, {type: "Literal", value: "default"}, stmt.declaration, true)];
      nodes = [exportCallStmt(options.moduleExportFunc, "default", stmt.declaration)];
    } else if (stmt.type === "ExportAllDeclaration") {
      var key = {name: options.es6ExportFuncId + "__iterator__", type: "Identifier"}, moduleId = stmt.source;
      nodes = [
        {
          type: "ForInStatement",
          body: {type: "ExpressionStatement", expression: exportFromImport(key, key, moduleId, options.moduleExportFunc, options.moduleImportFunc)},
          left: {type: "VariableDeclaration", kind: "var", declarations: [{type: "VariableDeclarator", id: key, init: null}]},
          right: importCall(null, moduleId, options.moduleImportFunc),
        }
      ];
      options.excludeRefs.push(key.name);
      options.excludeDecls.push(key.name);
    } else if (stmt.type ===  "ImportDeclaration") {
      nodes = stmt.specifiers.length ?
        stmt.specifiers.map(specifier => {
          var local = specifier.local,
              imported = (specifier.type === "ImportSpecifier" && specifier.imported.name)
                      || (specifier.type === "ImportDefaultSpecifier" && "default")
                      || null;
          return varDeclAndImportCall(parsed, local, imported || null, stmt.source, options.moduleImportFunc);
        }) : importCallStmt(null, stmt.source, options.moduleImportFunc);
    } else nodes = [stmt];
    return stmts.concat(nodes);
  }, []);

  return parsed;
}

function putFunctionDeclsInFront(parsed, options) {
  var topLevel = query.topLevelDeclsAndRefs(parsed);
  if (!topLevel.funcDecls.length) return parsed;
  var globalFuncs = topLevel.funcDecls
    .filter(ea => shouldDeclBeCaptured(ea, options))
    .map((decl) => {
      var funcId = {type: "Identifier", name: decl.id.name};
      return assignExpr(options.captureObj, funcId, funcId, false);
    });
  parsed.body = globalFuncs.concat(parsed.body);
  return parsed;
}

function computeDefRanges(parsed, options) {
  var topLevel = query.topLevelDeclsAndRefs(parsed);
  return chain(topLevel.scope.varDecls)
    .pluck("declarations").flatten().value()
    .concat(topLevel.scope.funcDecls)
    .reduce((defs, decl) => {
      if (!defs[decl.id.name]) defs[decl.id.name] = []
      defs[decl.id.name].push({type: decl.type, start: decl.start, end: decl.end});
      return defs;
    }, {});
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// capturing oobject patters / destructuring
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var annotationSym = Symbol("lively.ast-destructuring-transform");

function transformPattern(pattern, transformState) {
  // For transforming destructuring expressions into plain vars and member access.
  // Takes a var or argument pattern node (of type ArrayPattern or
  // ObjectPattern) and transforms it into a set of var declarations that will
  // "pull out" the nested properties
  // Example:
  // var parsed = ast.parse("var [{b: {c: [a]}}] = foo;");
  // var state = {parent: {type: "Identifier", name: "arg"}, declaredNames: ["foo"]}
  // transformPattern(parsed.body[0].declarations[0].id, state).map(ast.stringify).join("\n");
  // // => "var arg$0 = arg[0];\n"
  // //  + "var arg$0$b = arg$0.b;\n"
  // //  + "var arg$0$b$c = arg$0$b.c;\n"
  // //  + "var a = arg$0$b$c[0];"
  if (pattern.type === "ArrayPattern") {
    return transformArrayPattern(pattern, transformState)
  } else if (pattern.type === "ObjectPattern") {
    return transformObjectPattern(pattern, transformState);
  } else { return []; }

}

function transformArrayPattern(pattern, transformState) {
  var declaredNames = transformState.declaredNames,
      p = annotationSym;
  return arr.flatmap(pattern.elements, (el, i) => {

    // like [a]
    if (el.type === "Identifier") {
      return [merge(varDecl(el, member(id(i), transformState.parent, true)), {[p]: {capture: true}})]

    // like [...foo]
    } else if (el.type === "RestElement") {
      return [
        merge(
          varDecl(el.argument, {
            type: "CallExpression",
            arguments: [{type: "Literal", value: i}],
            callee: member(id("slice"), transformState.parent, false)}),
          {[p]: {capture: true}})]

    // like [{x}]
    } else {
      var helperVarId = id(generateUniqueName(declaredNames, transformState.parent.name + "$" + i)),
          helperVar = merge(varDecl(helperVarId, member(id(i), transformState.parent, true)), {[p]: {capture: true}});
      declaredNames.push(helperVarId.name);
      return [helperVar].concat(transformPattern(el, {parent: helperVarId, declaredNames: declaredNames}));
    }
  })
}

function transformObjectPattern(pattern, transformState) {
  var declaredNames = transformState.declaredNames,
      p = annotationSym;
  return arr.flatmap(pattern.properties, prop => {

    // like {x: y}
    if (prop.value.type == "Identifier") {
      return [merge(varDecl(prop.value, member(prop.key, transformState.parent, false)), {[p]: {capture: true}})];

    // like {x: {z}} or {x: [a]}
    } else {
      var helperVarId = id(generateUniqueName(declaredNames, transformState.parent.name + "$" + prop.key.name)),
          helperVar = merge(varDecl(helperVarId, member(prop.key, transformState.parent, false)), {[p]: {capture: false}});
      declaredNames.push(helperVarId.name);
      return [helperVar].concat(transformPattern(prop.value, {parent: helperVarId, declaredNames: declaredNames}));
    }
  })
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// code generation helpers
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function id(name) {
  return {type: "Identifier", name: String(name)}
}

function block(nodes) {
  return {type: "BlockStatement", body: nodes}
}

function member(prop, obj, computed) {
  return {type: "MemberExpression", computed: computed || false, object: obj, property: prop}
}

function varDecl(id, init, kind) {
  return {
   declarations: [{type: "VariableDeclarator", id: id, init: init}],
   kind: kind || "var", type: "VariableDeclaration"
  }
}

function varDeclOrAssignment(parsed, declarator, kind) {
  var topLevel = query.topLevelDeclsAndRefs(parsed),
      name = declarator.id.name
  return topLevel.declaredNames.indexOf(name) > -1 ?
    // only create a new declaration if necessary
    {
     type: "ExpressionStatement", expression: {
      type: "AssignmentExpression", operator: "=",
      right: declarator.init,
      left: declarator.id
     }
    } : {
     declarations: [declarator],
     kind: kind || "var", type: "VariableDeclaration"
    }
}

function assignExpr(assignee, propId, value, computed) {
  return {
   type: "ExpressionStatement", expression: {
    type: "AssignmentExpression", operator: "=",
    right: value || {type: "Identifier", name: 'undefined'},
    left: {
      type: "MemberExpression", computed: computed || false,
      object: assignee, property: propId
    }
   }
  }
}

function exportFromImport(keyLeft, keyRight, moduleId, moduleExportFunc, moduleImportFunc) {
  return exportCall(moduleExportFunc, keyLeft, importCall(keyRight, moduleId, moduleImportFunc));
}

function varDeclAndImportCall(parsed, localId, imported, moduleSource, moduleImportFunc) {
  return varDeclOrAssignment(parsed, {
    type: "VariableDeclarator",
    id: localId,
    init: importCall(imported, moduleSource, moduleImportFunc)
  });
}

function importCall(imported, moduleSource, moduleImportFunc) {
  if (typeof imported === "string") imported = {type: "Literal", value: imported};
  return {
    arguments: [moduleSource].concat(imported || []),
    callee: moduleImportFunc, type: "CallExpression"
  };
}

function importCallStmt(imported, moduleSource, moduleImportFunc) {
  return {
    type: "ExpressionStatement",
    expression: importCall(imported, moduleSource, moduleImportFunc)
  };
}

function exportCall(exportFunc, local, exportedObj) {
  if (typeof local === "string") local = {type: "Literal", value: local};
  exportedObj = obj.deepCopy(exportedObj);
  return {arguments: [local, exportedObj], callee: exportFunc, type: "CallExpression"};
}

function exportCallStmt(exportFunc, local, exportedObj) {
  return {type: "ExpressionStatement", expression: exportCall(exportFunc, local, exportedObj)};
}
