/*global process, global, exports*/

var ast = require("../index");
var lang = require("lively.lang");
var Visitor = require("../generated/estree-visitor");

exports.capturing = {
  rewriteToCaptureTopLevelVariables: rewriteToCaptureTopLevelVariables
}

function rewriteToCaptureTopLevelVariables(astOrSource, assignToObj, options) {
  /* replaces var and function declarations with assignment statements.
  * Example:
     exports.transform.replaceTopLevelVarDeclAndUsageForCapturing(
       "var x = 3, y = 2, z = 4",
       {name: "A", type: "Identifier"}, ['z']).source;
     // => "A.x = 3; A.y = 2; z = 4"
  */

  options = lang.obj.merge({
    ignoreUndeclaredExcept: null,
    include: null,
    exclude: [],
    recordDefRanges: false,
    es6ExportId: null,
    es6ModulesId: null,
    captureObj: assignToObj || {type: "Identifier", name: "__rec"}
  }, options);

  var parsed = typeof astOrSource === 'object' ?
        astOrSource : ast.parse(astOrSource),
      source = typeof astOrSource === 'string' ?
        astOrSource : (parsed.source || ast.stringify(parsed)),
      exportedObj = {name: options.es6ExportId || "_exported", type: "Identifier"},
      modulesObj = {name: options.es6ModulesId || "_loaded_modules", type: "Identifier"},
      rewritten = parsed;

  // "ignoreUndeclaredExcept" is null if we want to capture all globals in the toplevel scope
  // if it is a list of names we will capture all refs with those names
  if (options.ignoreUndeclaredExcept) {
    var topLevel = ast.query.topLevelDeclsAndRefs(parsed);
    options.exclude = lang.arr.withoutAll(topLevel.undeclaredNames, options.ignoreUndeclaredExcept)
      .concat(options.exclude);
  }

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
  options.exclude = options.exclude.concat(additionalIgnores(parsed));

  // 4. make all references declared in the toplevel scope into property
  // reads of captureObj
  // Example "var foo = 3; 99 + foo;" -> "var foo = 3; 99 + Global.foo;"
  rewritten = replaceRefs(parsed, options);

  // 5. turn var declarations into assignments to captureObj
  // Example: "var foo = 3; 99 + foo;" -> "Global.foo = 3; 99 + foo;"
  rewritten = replaceVarDecls(rewritten, options);

  // 6. es6 export declaration are left untouched but a capturing assignment
  // is added after the export so that we get the value:
  // "export var x = 23;" => "export var x = 23; Global.x = x;"
  rewritten = insertCapturesForExportNamedDeclarations(rewritten, options);

  // 7. assignments for function declarations in the top level scope are
  // put in front of everything else to mirror the func hoisting:
  // "return bar(); function bar() { return 23 }" ->
  //   "Global.bar = bar; return bar(); function bar() { return 23 }"
  rewritten = putFunctionDeclsInFront(rewritten, options);

  return {
    ast: rewritten,
    source: ast.stringify(rewritten),
    defRanges: defRanges
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function replace(parsed, replacer) {
  var v = new Visitor();
  v.visitVariableDeclaration
  v.accept = lang.fun.wrap(v.accept, (proceed, node, state, path) => replacer(proceed(node, state, path)));
  return v.accept(parsed, null, []);
}

function replaceRefs(parsed, options) {
  var topLevel = ast.query.topLevelDeclsAndRefs(parsed),
      refsToReplace = topLevel.refs.filter(ref => shouldRefBeCaptured(ref, options))
  return replace(parsed, node => refsToReplace.indexOf(node) > -1 ? member(node, options.captureObj) : node);
}

function replaceVarDecls(parsed, options) {
  var topLevel = ast.query.topLevelDeclsAndRefs(parsed);
  return replace(parsed, node => {
    if (topLevel.varDecls.indexOf(node) === -1) return node;
    var decls = node.declarations.filter(decl => shouldDeclBeCaptured(decl, options));
    if (!decls.length) return node;
    return node.declarations.map(ea => {
      var init = ea.init || {
        operator: "||",
        type: "LogicalExpression",
        left: {computed: true, object: options.captureObj, property: {type: "Literal", value: ea.id.name},type: "MemberExpression"},
        right: {name: "undefined", type: "Identifier"}
      };
      return shouldDeclBeCaptured(ea, options) ?
        assignExpr(options.captureObj, ea.id, init, false) : ea;
    });
  });
}

function additionalIgnores(parsed) {
  var topLevel = ast.query.topLevelDeclsAndRefs(parsed),
      ignoreDecls = topLevel.scope.varDecls.reduce((result, decl, i) => {
        var path = lang.Path(topLevel.scope.varDeclPaths[i]),
            parent = path.slice(0,-1).get(parsed);
        if (parent.type === "ForStatement"
         || parent.type === "ForInStatement"
         || parent.type === "ExportNamedDeclaration") { result.push(decl); }
        return result;
      }, []),
      ignoredImportAndExportNames = parsed.body.reduce((ignored, stmt) => {
        if (stmt.type === "ImportDeclaration")
          return stmt.specifiers.reduce((ignored, specifier) =>
            specifier.type === "ImportSpecifier" ?
              ignored.concat([specifier.imported.name]) : ignored, ignored);
        if ((stmt.type === "ExportNamedDeclaration" || stmt.type === "ExportDefaultDeclaration") && stmt.specifiers)
          return ignored.concat(stmt.specifiers.map(specifier => specifier.local.name));
        return ignored;
      }, []);
  return []
    .concat(lang.arr.pluck(topLevel.scope.catches, "name"))
    .concat(lang.chain(ignoreDecls).pluck("declarations").flatten().pluck("id").pluck("name").value())
    .concat(ignoredImportAndExportNames);
}

function insertCapturesForExportNamedDeclarations(parsed, options) {
  parsed.body = parsed.body.reduce((stmts, stmt) =>
    stmts.concat(stmt.type !== "ExportNamedDeclaration" || !stmt.declaration ? [stmt] :
      [stmt].concat(stmt.declaration.declarations.map(decl =>
        assignExpr(options.captureObj, decl.id, decl.id, false)))), []);
  return parsed;
}

function additionalCaptures(parsed) {
      ignoreImports = parsed.body.map(stmt => {
        if (stmt.type !== "ImportDeclaration") return [];
        return stmt.specifiers.reduce((captures, specifier) => {
          switch (specifier.type) {
            case "ImportSpecifier": return specifier.imported.name;
            case "ImportNamespaceSpecifier":
            case "ImportDefaultSpecifier":
              captures.push(assignToObjExpr(specifier.local, specifier.local));
              break;
          }
          return captures;
        }, []);
      })
}

function putFunctionDeclsInFront(parsed, options) {
  var topLevel = ast.query.topLevelDeclsAndRefs(parsed);
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
  var topLevel = ast.query.topLevelDeclsAndRefs(parsed);
  var defRanges = lang.chain(topLevel.scope.varDecls)
    .pluck("declarations").flatten().value()
    .concat(topLevel.scope.funcDecls)
    .reduce((defs, decl) => {
      if (!defs[decl.id.name]) defs[decl.id.name] = []
      defs[decl.id.name].push({type: decl.type, start: decl.start, end: decl.end});
      return defs;
    }, {});
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function shouldDeclBeCaptured(decl, options) {
  return shouldRefBeCaptured(decl.id, options);
}

function shouldRefBeCaptured(ref, options) {
  return options.exclude.indexOf(ref.name) === -1
    && (!options.include || options.include.indexOf(ref.name) > -1);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function member(prop, obj) {
  return {type: "MemberExpression", computed: false, object: obj, property: prop}
}

function varDecl(declarator) {
  return {
   declarations: [declarator],
   kind: "var", type: "VariableDeclaration"
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
