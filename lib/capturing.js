import { obj, chain, arr, fun, Path } from "lively.lang";
import { parse } from "./parser.js";
import { topLevelDeclsAndRefs } from "./query.js";
import { transformSingleExpression, wrapInStartEndCall } from "./transform.js";
import Visitor from "../generated/estree-visitor";
import stringify from "./stringify.js";

var merge = Object.assign;

export function rewriteToCaptureTopLevelVariables(parsed, assignToObj, options) {
  /* replaces var and function declarations with assignment statements.
   * Example:
     stringify(
       rewriteToCaptureTopLevelVariables2(
         parse("var x = 3, y = 2, z = 4"),
         {name: "A", type: "Identifier"}, ['z']));
     // => "A.x = 3; A.y = 2; z = 4"
   */

  options = merge({
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
    declarationWrapper: undefined
  }, options);

  var rewritten = parsed;

  // "ignoreUndeclaredExcept" is null if we want to capture all globals in the toplevel scope
  // if it is a list of names we will capture all refs with those names
  if (options.ignoreUndeclaredExcept) {
    var topLevel = topLevelDeclsAndRefs(parsed);
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
  } else {
    rewritten = fixDefaultAsyncFunctionExportForRegeneratorBug(rewritten, options);
  }

  // 4. make all references declared in the toplevel scope into property
  // reads of captureObj
  // Example "var foo = 3; 99 + foo;" -> "var foo = 3; 99 + Global.foo;"
  rewritten = replaceRefs(rewritten, options);

  // 5.a turn var declarations into assignments to captureObj
  // Example: "var foo = 3; 99 + foo;" -> "Global.foo = 3; 99 + foo;"
  // if declarationWrapper is requested:
  //   "var foo = 3;" -> "Global.foo = _define(3, 'foo', _rec, 'var');"
  rewritten = replaceVarDecls(rewritten, options);

  // 5.b record class declarations
  // Example: "class Foo {}" -> "class Foo {}; Global.Foo = Foo;"
  // if declarationWrapper is requested:
  //   "class Foo {}" -> "Global.Foo = _define(class Foo {});"
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
  // if declarationWrapper is requested:
  //   "Global.bar = _define(bar, 'bar', _rec, 'function'); function bar() {}"
  rewritten = putFunctionDeclsInFront(rewritten, options);

  return rewritten
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// replacing helpers
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// TODO move this stuff over into transform? Or separate replace.js?

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

function replace(parsed, replacer) { return ReplaceVisitor.run(parsed, replacer); }

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

function replaceWithMany(parsed, replacer) { return ReplaceManyVisitor.run(parsed, replacer); }

function replaceRefs(parsed, options) {
  var topLevel = topLevelDeclsAndRefs(parsed),
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

  var topLevel = topLevelDeclsAndRefs(parsed);
  return replaceWithMany(parsed, node => {
    if (topLevel.varDecls.indexOf(node) === -1
     || node.declarations.every(decl => !shouldDeclBeCaptured(decl, options)))
       return node;

    return arr.flatmap(node.declarations, decl => {
      if (!shouldDeclBeCaptured(decl, options))
        return [{type: "VariableDeclaration", kind: node.kind || "var", declarations: [decl]}];

      var init = decl.init || {
        operator: "||",
        type: "LogicalExpression",
        left: {computed: false, object: options.captureObj, property: decl.id, type: "MemberExpression"},
        right: {name: "undefined", type: "Identifier"}
      };

      var initWrapped = options.declarationWrapper ? {
        arguments: [{type: "Literal", value: decl.id.name}, {type: "Literal", value: node.kind}, init, options.captureObj],
        callee: options.declarationWrapper, type: "CallExpression"
      } : init;

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
        return [varDecl(declRoot, initWrapped, node.kind)].concat(extractions);
      }

      // This is rewriting normal vars
      return [assignExpr(options.captureObj, decl.id, initWrapped, false)];
    });

  });
}

function replaceClassDecls(parsed, options) {
  var topLevel = topLevelDeclsAndRefs(parsed);
  if (!topLevel.classDecls.length) return parsed;
  for (var i = parsed.body.length - 1; i >= 0; i--) {
    var stmt = parsed.body[i];
    if (topLevel.classDecls.indexOf(stmt) !== -1) {
      if (options.declarationWrapper) {
        parsed.body.splice(i, 1,
          assignExpr(options.captureObj, stmt.id, {
            arguments: [{type: "Literal", value: stmt.id.name}, {type: "Literal", value: "class"}, stmt, options.captureObj],
            callee: options.declarationWrapper, type: "CallExpression"
          }, false));
      } else {
        parsed.body.splice(i+1, 0, assignExpr(options.captureObj, stmt.id, stmt.id, false));
      }
    }
  }
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
  var topLevel = topLevelDeclsAndRefs(parsed), ignoreDecls = [];
  for (var i = 0; i < topLevel.scope.varDecls.length; i++) {
    var decl = topLevel.scope.varDecls[i],
        path = Path(topLevel.scope.varDeclPaths[i]),
        parent = path.slice(0,-1).get(parsed);
    if (parent.type === "ForStatement"
     || parent.type === "ForInStatement"
     || parent.type === "ForOfStatement"
     || parent.type === "ExportNamedDeclaration") { ignoreDecls.push(...decl.declarations); }
  }
  return topLevel.scope.catches.map(ea => ea.name)
          .concat(ignoreDecls.map(ea => ea.id.name));
}

function additionalIgnoredRefs(parsed, options) {
  // FIXME rk 2016-05-11: in shouldRefBeCaptured we now also test for import
  // decls, this should somehow be consolidated with this function and with the
  // fact that naming based ignores aren't good enough...
  var topLevel = topLevelDeclsAndRefs(parsed);

  var ignoreDecls = [];
  for (var i = 0; i < topLevel.scope.varDecls.length; i++) {
    var decl = topLevel.scope.varDecls[i],
        path = Path(topLevel.scope.varDeclPaths[i]),
        parent = path.slice(0,-1).get(parsed);
    if (parent.type === "ForStatement"
     || parent.type === "ForInStatement"
     || parent.type === "ForOfStatement"
     || parent.type === "ExportNamedDeclaration") { ignoreDecls.push(...decl.declarations); }
  }

  // ignore stuff like var bar = class Foo {}
  ignoreDecls.push(...topLevel.scope.classExprs);

  var ignoredImportAndExportNames = [];
  for (var i = 0; i < parsed.body.length; i++) {
    var stmt = parsed.body[i];
    if (!options.es6ImportFuncId && stmt.type === "ImportDeclaration") {
      ignoredImportAndExportNames.push(
        ...stmt.specifiers
          .filter(ea => ea.type === "ImportSpecifier")
          .map(ea => ea.imported.name));
    } else if (!options.es6ExportFuncId && (stmt.type === "ExportNamedDeclaration"
            || stmt.type === "ExportDefaultDeclaration") && stmt.specifiers) {
      ignoredImportAndExportNames.push(...stmt.specifiers.map(specifier => specifier.local.name))
    }
  }

  return []
    .concat(topLevel.scope.catches.map(ea => ea.name))
    .concat(ignoredImportAndExportNames)
    .concat(ignoreDecls.map(ea => ea.id.name));
}

function shouldDeclBeCaptured(decl, options) {
  return options.excludeDecls.indexOf(decl.id.name) === -1
    && (!options.includeDecls || options.includeDecls.indexOf(decl.id.name) > -1);
}

function shouldRefBeCaptured(ref, toplevel, options) {
  return toplevel.scope.importDecls.indexOf(ref) === -1
      && arr.flatmap(toplevel.scope.exportDecls, ea => ea.declarations ? ea.declarations : ea.declaration ? [ea.declaration] : []).indexOf(ref) === -1
      && options.excludeRefs.indexOf(ref.name) === -1
      && (!options.includeRefs || options.includeRefs.indexOf(ref.name) !== -1);
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// capturing specific code
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function insertCapturesForExportDeclarations(parsed, options) {
  var body = [];
  for (var i = 0; i < parsed.body.length; i++) {
    var stmt = parsed.body[i];
    body.push(stmt);
    // ExportNamedDeclaration can have specifieres = refs, those should already
    // be captured. Only focus on export declarations and only those
    // declarations that are no refs, i.e.
    // ignore: "export default x;"
    // capture: "export default function foo () {};", "export var x = 23, y = 3;"
    if ((stmt.type !== "ExportNamedDeclaration" && stmt.type !== "ExportDefaultDeclaration")
     || !stmt.declaration) {
       /*...*/
     } else if (stmt.declaration.declarations) {
      body.push(...stmt.declaration.declarations.map(decl =>
                      assignExpr(options.captureObj, decl.id, decl.id, false)));
    } else if (stmt.declaration.type === "FunctionDeclaration") {
      /*handled by function rewriter as last step*/
    } else if (stmt.declaration.type === "ClassDeclaration") {
      body.push(assignExpr(options.captureObj, stmt.declaration.id, stmt.declaration.id, false));
    }
  }
  parsed.body = body;
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
  var topLevel = topLevelDeclsAndRefs(parsed), body = [];
  for (var i = 0; i < parsed.body.length; i++) {
    var stmt = parsed.body[i];
    if (stmt.type === "ExportDefaultDeclaration" && stmt.declaration && stmt.declaration.type.indexOf("Declaration") === -1) {
      body = body.concat([
        varDeclOrAssignment(parsed, {
          type: "VariableDeclarator",
          id: stmt.declaration,
          init: member(stmt.declaration, options.captureObj)
        }),
        stmt
      ]);
    } else if (stmt.type !== "ExportNamedDeclaration" || !stmt.specifiers.length) {
      body.push(stmt)
    } else {
      body = body.concat(stmt.specifiers.map(specifier =>
       topLevel.declaredNames.indexOf(specifier.local.name) > -1 ?
       null :
        varDeclOrAssignment(parsed, {
          type: "VariableDeclarator",
          id: specifier.local,
          init: member(specifier.local, options.captureObj)
        })).filter(Boolean)).concat(stmt);
    }
  }

  parsed.body = body;
  return parsed;
}

function fixDefaultAsyncFunctionExportForRegeneratorBug(parsed, options) {
  // rk 2016-06-02: see https://github.com/LivelyKernel/lively.modules/issues/9
  // FIXME this needs to be removed as soon as the cause for the issue is fixed
  var body = [];
  for (var i = 0; i < parsed.body.length; i++) {
    var stmt = parsed.body[i];
    if (stmt.type === "ExportDefaultDeclaration"
     && stmt.declaration.type === "FunctionDeclaration"
     && stmt.declaration.id
     && stmt.declaration.async) {
      body.push(stmt.declaration);
      stmt.declaration = stmt.declaration.id;
    }
    body.push(stmt);
  }
  parsed.body = body;
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
      if (stmt.declaration && stmt.declaration.id) {
        nodes = [stmt.declaration].concat(exportCallStmt(options.moduleExportFunc, "default", stmt.declaration.id));
      } else {
        nodes = [exportCallStmt(options.moduleExportFunc, "default", stmt.declaration)];
      }
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
  var topLevel = topLevelDeclsAndRefs(parsed);
  if (!topLevel.funcDecls.length) return parsed;
  var globalFuncs = topLevel.funcDecls
    .filter(ea => shouldDeclBeCaptured(ea, options))
    .map((decl) => {
      var funcId = {type: "Identifier", name: decl.id.name},
          init = options.declarationWrapper ? {
            arguments: [{type: "Literal", value: funcId.name}, {type: "Literal", value: "function"}, funcId, options.captureObj],
            callee: options.declarationWrapper, type: "CallExpression"
          } : funcId;

      return assignExpr(options.captureObj, funcId, init, false);
    });
  parsed.body = globalFuncs.concat(parsed.body);
  return parsed;
}

function computeDefRanges(parsed, options) {
  var topLevel = topLevelDeclsAndRefs(parsed);
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
  var topLevel = topLevelDeclsAndRefs(parsed),
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
