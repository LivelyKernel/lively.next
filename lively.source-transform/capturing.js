import { obj, chain, arr, Path } from 'lively.lang';
import {
  parse,
  stringify,
  query,
  transform,
  nodes,
  ReplaceManyVisitor,
  ReplaceVisitor
} from 'lively.ast';

const {
  member,
  prop,
  varDecl,
  assign,
  id,
  literal,
  exprStmt,
  conditional,
  binaryExpr,
  funcCall,
  block
} = nodes;
const { topLevelDeclsAndRefs, helpers: queryHelpers } = query;
const { transformSingleExpression, wrapInStartEndCall } = transform;

export function rewriteToCaptureTopLevelVariables (parsed, assignToObj, options) {
  /* replaces var and function declarations with assignment statements.
   * Example:
     stringify(
       rewriteToCaptureTopLevelVariables(
         parse("var x = 3, y = 2, z = 4"),
         {name: "A", type: "Identifier"},
         {exclude: ['z']}));
     // => "A.x = 3; A.y = 2; z = 4"
   */

  if (!assignToObj) assignToObj = { type: 'Identifier', name: '__rec' };

  options = {
    ignoreUndeclaredExcept: null,
    includeRefs: null,
    excludeRefs: (options && options.exclude) || [],
    includeDecls: null,
    excludeDecls: (options && options.exclude) || [],
    recordDefRanges: false,
    es6ExportFuncId: null,
    es6ImportFuncId: null,
    captureObj: assignToObj,
    moduleExportFunc: { name: options && options.es6ExportFuncId || '_moduleExport', type: 'Identifier' },
    moduleImportFunc: { name: options && options.es6ImportFuncId || '_moduleImport', type: 'Identifier' },
    declarationWrapper: undefined,
    classTransform: (parsed) => parsed, // no transform
    // classToFunction: options && options.hasOwnProperty("classToFunction") ?
    //   options.classToFunction : {
    //     classHolder: assignToObj,
    //     functionNode: {type: "Identifier", name: "_createOrExtendClass"},
    //     declarationWrapper: options && options.declarationWrapper,
    //     evalId: options && options.evalId,
    //     sourceAccessorName: options && options.sourceAccessorName
    //   },
    ...options
  };

  let rewritten = parsed;

  rewritten = removeJspmGlobalRef(rewritten, options);

  // "ignoreUndeclaredExcept" is null if we want to capture all globals in the toplevel scope
  // if it is a list of names we will capture all refs with those names
  if (options.ignoreUndeclaredExcept) {
    const topLevel = topLevelDeclsAndRefs(parsed);
    options.excludeRefs = arr.withoutAll(topLevel.undeclaredNames, options.ignoreUndeclaredExcept).concat(options.excludeRefs);
    options.excludeDecls = arr.withoutAll(topLevel.undeclaredNames, options.ignoreUndeclaredExcept).concat(options.excludeDecls);
  }

  options.excludeRefs = options.excludeRefs.concat(options.captureObj.name);
  options.excludeDecls = options.excludeDecls.concat(options.captureObj.name);

  // 1. def ranges so that we know at which source code positions the
  // definitions are
  const defRanges = options.recordDefRanges ? computeDefRanges(rewritten, options) : null;

  // 2. find those var declarations that should not be rewritten. we
  // currently ignore var declarations in for loops and the error parameter
  // declaration in catch clauses. Also es6 import / export declaration need
  // a special treatment
  // DO NOT rewrite exports like "export { foo as bar }" => "export { _rec.foo as bar }"
  // as this is not valid syntax. Instead we add a var declaration using the
  // recorder as init for those exports later
  options.excludeRefs = options.excludeRefs.concat(additionalIgnoredRefs(parsed, options));
  options.excludeDecls = options.excludeDecls.concat(additionalIgnoredDecls(parsed, options));

  rewritten = fixDefaultAsyncFunctionExportForRegeneratorBug(rewritten, options);

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
  // if declarationWrapper is requested:
  //   "var foo = 3;" -> "Global.foo = _define(3, 'foo', _rec, 'var');"
  rewritten = replaceVarDecls(rewritten, options);

  // clear empty exports
  // rms 26.05.20: removes statements of the sort "export {}"
  //               This is technically illegal ESM syntax, however
  //               this sometimes is served by jspm due to auto generated esm modules
  //               It's therefore worth tolerating this kind of syntax for convenience sake.
  rewritten = clearEmptyExports(rewritten, options);

  // 5.b record class declarations
  // Example: "class Foo {}" -> "class Foo {}; Global.Foo = Foo;"
  // if declarationWrapper is requested:
  //   "class Foo {}" -> "Global.Foo = _define(class Foo {});"
  rewritten = replaceClassDecls(rewritten, options);

  rewritten = splitExportDeclarations(rewritten, options);

  // 6. es6 export declaration are left untouched but a capturing assignment
  // is added after the export so that we get the value:
  // "export var x = 23;" => "export var x = 23; Global.x = x;"
  rewritten = insertCapturesForExportDeclarations(rewritten, options);

  // 7. es6 import declaration are left untouched but a capturing assignment
  // is added after the import so that we get the value:
  // "import x from './some-es6-module.js';" =>
  //   "import x from './some-es6-module.js';\n_rec.x = x;"
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

  rewritten = transformImportMeta(rewritten, options);

  return rewritten;
}

function removeJspmGlobalRef (parsed) {
  // do not replace until the
  // var _global = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : global;
  // declaration has been detected
  let declarationFound = false;
  return ReplaceVisitor.run(parsed, (node) => {
    if (!declarationFound && node.type == 'VariableDeclarator' && node.id.name == '_global') {
      declarationFound = stringify(node) == '_global = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : global';
    }
    if (declarationFound && node.type == 'LogicalExpression' &&
        node.right.name == '_global') {
      return node.left;
    }
    return node;
  });
}

function transformImportMeta (parsed, options) {
  return ReplaceVisitor.run(parsed, (node) => {
    if (node.type == 'MetaProperty' && node.meta.name == 'import') {
      return options.classToFunction.currentModuleAccessor
        ? nodes.objectLiteral(['url', nodes.member(options.classToFunction.currentModuleAccessor, 'id')])
        : parse('({url: eval("_context").id})').body[0].expression;
    }
    return node;
  });
}

export function rewriteToRegisterModuleToCaptureSetters (parsed, assignToObj, options) {
  // for rewriting the setters part in code like
  // ```js
  //   System.register(["a.js"], function (_export, _context) {
  //     var a, _rec;
  //     return {
  //       setters: [function(foo_a_js) { a = foo_a_js.x }],
  //       execute: function () { _rec.x = 23 + _rec.a; }
  //     };
  //   });
  // ```
  // This allows us to capture (and potentially re-export) imports and their
  // changes without actively running the module again.

  options = {
    captureObj: assignToObj || { type: 'Identifier', name: '__rec' },
    exclude: [],
    declarationWrapper: undefined,
    ...options
  };

  const registerCall = Path('body.0.expression').get(parsed);
  if (registerCall.callee.object.name !== 'System') { throw new Error(`rewriteToRegisterModuleToCaptureSetters: input doesn't seem to be a System.register call: ${stringify(parsed).slice(0, 300)}...`); }
  if (registerCall.callee.property.name !== 'register') { throw new Error(`rewriteToRegisterModuleToCaptureSetters: input doesn't seem to be a System.register call: ${stringify(parsed).slice(0, 300)}...`); }
  const registerBody = Path('arguments.1.body.body').get(registerCall);
  const registerReturn = arr.last(registerBody);
  if (registerReturn.type !== 'ReturnStatement') { throw new Error(`rewriteToRegisterModuleToCaptureSetters: input doesn't seem to be a System.register call, at return statement: ${stringify(parsed).slice(0, 300)}...`); }
  const setters = registerReturn.argument.properties.find(prop => prop.key.name === 'setters');
  if (!setters) { throw new Error(`rewriteToRegisterModuleToCaptureSetters: input doesn't seem to be a System.register call, at finding setters: ${stringify(parsed).slice(0, 300)}...`); }
  const execute = registerReturn.argument.properties.find(prop => prop.key.name === 'execute');
  if (!execute) { throw new Error(`rewriteToRegisterModuleToCaptureSetters: input doesn't seem to be a System.register call, at finding execute: ${stringify(parsed).slice(0, 300)}...`); }

  // in each setter function: intercept the assignments to local vars and inject capture object
  setters.value.elements.forEach(funcExpr => {
    funcExpr.params[0] = assign(funcExpr.params[0], nodes.objectLiteral({}));
    funcExpr.body.body = funcExpr.body.body.map(stmt => {
      if (stmt.type !== 'ExpressionStatement' ||
       stmt.expression.type !== 'AssignmentExpression' ||
       stmt.expression.left.type !== 'Identifier' ||
       options.exclude.includes(stmt.expression.left.name)) return stmt;

      const id = stmt.expression.left;
      const rhs = options.declarationWrapper
        ? declarationWrapperCall(
          options.declarationWrapper,
          null,
          literal(id.name),
          literal('var'),
          stmt.expression,
          options.captureObj,
          options)
        : stmt.expression;
      return exprStmt(assign(member(options.captureObj, id), rhs));
    });
  });

  let captureInitialize = execute.value.body.body.find(stmt =>
    stmt.type === 'ExpressionStatement' &&
                         stmt.expression.type == 'AssignmentExpression' &&
                         stmt.expression.left.name === options.captureObj.name);
  if (!captureInitialize) {
    captureInitialize = execute.value.body.body.find(stmt =>
      stmt.type === 'VariableDeclaration' &&
                         stmt.declarations[0].id &&
                         stmt.declarations[0].id.name === options.captureObj.name);
  }
  if (captureInitialize) {
    arr.remove(execute.value.body.body, captureInitialize);
    arr.pushAt(registerBody, captureInitialize, registerBody.length - 1);
  }

  if (options.sourceAccessorName) {
    let origSourceInitialize = execute.value.body.body.find(stmt =>
      stmt.type === 'ExpressionStatement' &&
                           stmt.expression.type == 'AssignmentExpression' &&
                           stmt.expression.left.name === options.sourceAccessorName);
    if (!origSourceInitialize) {
      origSourceInitialize = execute.value.body.body.find(stmt =>
        stmt.type === 'VariableDeclaration' &&
                           stmt.declarations[0].id &&
                           stmt.declarations[0].id.name === options.sourceAccessorName);
    }
    if (origSourceInitialize) {
      arr.remove(execute.value.body.body, origSourceInitialize);
      arr.pushAt(registerBody, origSourceInitialize, registerBody.length - 1);
    }
  }

  return parsed;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// replacement helpers

function clearEmptyExports (parsed, options) {
  const topLevel = topLevelDeclsAndRefs(parsed);
  for (const exp of topLevel.scope.exportDecls) {
    if (!exp.declaration && exp.specifiers && !exp.specifiers.length) { arr.remove(parsed.body, exp); }
  }
  return parsed;
}

function replaceRefs (parsed, options) {
  const topLevel = topLevelDeclsAndRefs(parsed);
  const refsToReplace = topLevel.refs.filter(ref => shouldRefBeCaptured(ref, topLevel, options));
  const locallyIgnored = [];
  let intermediateCounter = 0;

  const replaced = ReplaceVisitor.run(parsed, (node, path) => {
    // cs 2016/06/27, 1a4661
    // ensure keys of shorthand properties are not renamed while capturing
    if (node.type === 'Property' &&
     refsToReplace.includes(node.key) &&
     node.shorthand) { return prop(id(node.key.name), node.value); }

    if (node.type === 'MethodDefinition' && node.computed) {
      const { key } = node;
      if (refsToReplace.includes(key)) {
        if (key.type === 'MemberExpression') {
          const newNode = { ...node, key: { ...key } };
          let curr = newNode.key;
          while(curr.object?.type === 'MemberExpression') {
            curr.object = { ...curr.object };
            curr = curr.object;
          }
          curr.object = member(options.captureObj, curr.object);
          return newNode;
        }
      }
    }

    // don't replace var refs in expressions such as "export { x }" or "export var x;"
    // We make sure that those var references are defined in insertDeclarationsForExports()
    if (node.type === 'ExportNamedDeclaration') {
      const { declaration, specifiers } = node;
      if (declaration) {
        if (declaration.id) locallyIgnored.push(declaration.id);
        else if (declaration.declarations) { locallyIgnored.push(...declaration.declarations.map(({ id }) => id)); }
      }
      specifiers && specifiers.forEach(({ local }) => locallyIgnored.push(local));
      return node;
    }

    // declaration wrapper function for assignments
    // "a = 3" => "a = _define('a', 'assignment', 3, _rec)"
    if (node.type === 'AssignmentExpression' &&
     refsToReplace.includes(node.left) &&
     options.declarationWrapper) {
      return {
        ...node,
        right: declarationWrapperCall(
          options.declarationWrapper,
          null,
          literal(node.left.name),
          literal('assignment'),
          node.right,
          options.captureObj,
          options)
      };
    }

    // declaration wrapper for destructuring assignments like ({ a: blub, b, c } = d); => (_inter = d, _rec.a = _inter.a, _rec.b = _inter.b, _rec.c = _inter.c);
    if (node.type === 'AssignmentExpression' && node.left.type === 'ObjectPattern') {
      const intermediate = id(`__inter${intermediateCounter++}__`);
      return nodes.sqncExpr(
        assign(member(options.captureObj, intermediate), node.right),
        ...node.left.properties.map(prop => {
          const key = prop.value || prop.key;
          return assign(key, member(member(options.captureObj, intermediate), prop.key));
        }));
    }

    return node;
  });

  return ReplaceVisitor.run(replaced, (node, path, parent) =>
    refsToReplace.includes(node) && !locallyIgnored.includes(node)
      ? member(options.captureObj, node)
      : node);
}

function replaceVarDecls (parsed, options) {
  // rewrites var declarations so that they can be captured by
  // `options.captureObj`.
  // For normal vars we will do a transform like
  //   "var x = 23;" => "_rec.x = 23";
  // For patterns (destructuring assignments) we will create assignments for
  // all properties that are being destructured, creating helper vars as needed
  //   "var {x: [y]} = foo" => "var _1 = foo; var _1$x = _1.x; __rec.y = _1$x[0];"

  const topLevel = topLevelDeclsAndRefs(parsed);
  return ReplaceManyVisitor.run(parsed, node => {
    if (!topLevel.varDecls.includes(node) ||
     node.declarations.every(decl => !shouldDeclBeCaptured(decl, options))
    ) return node;

    const replaced = [];
    for (let i = 0; i < node.declarations.length; i++) {
      const decl = node.declarations[i];

      if (!shouldDeclBeCaptured(decl, options)) {
        replaced.push({ type: 'VariableDeclaration', kind: node.kind || 'var', declarations: [decl] });
        continue;
      }

      const init = decl.init || {
        operator: '||',
        type: 'LogicalExpression',
        left: { computed: false, object: options.captureObj, property: decl.id, type: 'MemberExpression' },
        right: { name: 'undefined', type: 'Identifier' }
      };

      const initWrapped = options.declarationWrapper && decl.id.name
        ? declarationWrapperCall(
          options.declarationWrapper,
          decl,
          literal(decl.id.name),
          literal(node.kind),
          init, options.captureObj,
          options)
        : init;

      // Here we create the object pattern / destructuring replacements
      if (decl.id.type.includes('Pattern')) {
        const declRootName = generateUniqueName(topLevel.declaredNames, 'destructured_1');
        const declRoot = { type: 'Identifier', name: declRootName };
        const state = { parent: declRoot, declaredNames: topLevel.declaredNames };
        const extractions = transformPattern(decl.id, state).map(decl =>
          decl[annotationSym] && decl[annotationSym].capture
            ? assignExpr(
              options.captureObj,
              decl.declarations[0].id,
              options.declarationWrapper
                ? declarationWrapperCall(
                  options.declarationWrapper,
                  null,
                  literal(decl.declarations[0].id.name),
                  literal(node.kind),
                  decl.declarations[0].init,
                  options.captureObj,
                  options)
                : decl.declarations[0].init,
              false)
            : decl);
        topLevel.declaredNames.push(declRootName);
        replaced.push(...[varDecl(declRoot, initWrapped, node.kind)].concat(extractions));
        continue;
      }

      // This is rewriting normal vars
      replaced.push(assignExpr(options.captureObj, decl.id, initWrapped, false));
      if (options.keepTopLevelVarDecls) { replaced.push(varDecl(decl.id, member(options.captureObj, decl.id))); }
    }

    return replaced;
  });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// naming
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function generateUniqueName (declaredNames, hint) {
  let unique = hint; let n = 1;
  while (declaredNames.indexOf(unique) > -1) {
    if (n > 1000) throw new Error('Endless loop searching for unique variable ' + unique);
    unique = unique.replace(/_[0-9]+$|$/, '_' + (++n));
  }
  return unique;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// exclude / include helpers
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function additionalIgnoredDecls (parsed, options) {
  const topLevel = topLevelDeclsAndRefs(parsed); const ignoreDecls = [];
  for (let i = 0; i < topLevel.scope.varDecls.length; i++) {
    const decl = topLevel.scope.varDecls[i];
    const path = Path(topLevel.scope.varDeclPaths[i]);
    const parent = path.slice(0, -1).get(parsed);
    if (parent.type === 'ForStatement' ||
     parent.type === 'ForInStatement' ||
     parent.type === 'ForOfStatement' ||
     parent.type === 'ExportNamedDeclaration'
    ) ignoreDecls.push(...decl.declarations);
  }

  return topLevel.scope.catches.map(ea => ea.name)
    .concat(ignoreDecls.map(ea => ea.id.name));
}

function additionalIgnoredRefs (parsed, options) {
  // FIXME rk 2016-05-11: in shouldRefBeCaptured we now also test for import
  // decls, this should somehow be consolidated with this function and with the
  // fact that naming based ignores aren't good enough...
  const topLevel = topLevelDeclsAndRefs(parsed);

  const ignoreDecls = [];
  for (let i = 0; i < topLevel.scope.varDecls.length; i++) {
    const decl = topLevel.scope.varDecls[i];
    const path = Path(topLevel.scope.varDeclPaths[i]);
    const parent = path.slice(0, -1).get(parsed);
    if (parent.type === 'ForStatement' ||
     parent.type === 'ForInStatement' ||
     parent.type === 'ForOfStatement'
    ) ignoreDecls.push(...decl.declarations);
  }

  return topLevel.scope.catches.map(ea => ea.name)
    .concat(queryHelpers.declIds(ignoreDecls.map(ea => ea.id)).map(ea => ea.name));
}

function shouldDeclBeCaptured (decl, options) {
  return options.excludeDecls.indexOf(decl.id.name) === -1 &&
    (!options.includeDecls || options.includeDecls.indexOf(decl.id.name) > -1);
}

function shouldRefBeCaptured (ref, toplevel, options) {
  if (toplevel.scope.importSpecifiers.includes(ref)) return false;
  for (let i = 0; i < toplevel.scope.exportDecls.length; i++) {
    const ea = toplevel.scope.exportDecls[i];
    if (ea.declarations && ea.declarations.includes(ref)) return false;
    if (ea.declaration === ref) return false;
  }
  if (options.excludeRefs.includes(ref.name)) return false;
  if (options.includeRefs && !options.includeRefs.includes(ref.name)) return false;
  return true;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// capturing specific code
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function replaceClassDecls (parsed, options) {
  if (options.classToFunction && options.classToFunction.transform) { return options.classToFunction.transform(parsed, options.classToFunction); }

  const topLevel = topLevelDeclsAndRefs(parsed);
  if (!topLevel.classDecls.length) return parsed;

  for (let i = parsed.body.length - 1; i >= 0; i--) {
    const stmt = parsed.body[i];
    if (stmt.id && topLevel.classDecls.includes(stmt)) { parsed.body.splice(i + 1, 0, assignExpr(options.captureObj, stmt.id, stmt.id, false)); }
  }
  return parsed;
}

function splitExportDeclarations (parsed, options) {
  const stmts = parsed.body; const newNodes = parsed.body = [];
  for (let i = 0; i < stmts.length; i++) {
    const stmt = stmts[i];
    if (stmt.type !== 'ExportNamedDeclaration' ||
     !stmt.declaration || stmt.declaration.type !== 'VariableDeclaration' ||
     stmt.declaration.declarations.length <= 1
    ) { newNodes.push(stmt); continue; }

    const decls = stmt.declaration.declarations;
    for (let j = 0; j < decls.length; j++) {
      newNodes.push({
        type: 'ExportNamedDeclaration',
        specifiers: [],
        declaration: varDecl(decls[j].id, decls[j].init, stmt.declaration.kind)
      });
    }
  }
  return parsed;
}

export function insertCapturesForExportedImports (parsed, options) {
  // function only needed for additional capturing of exports when using rollup.js
  // since rollup discards the module boundaries, information about immediate exports from modules is lost,
  // which is needed for deserialization to work properly.
  // this function detects all occurances of export { a, b } from 'moduleZ' or export { * } from 'moduleY'
  // and replaces them with code that captures the immediatly exported variables within the context of this module
  // => export { a, b } from 'moduleZ'; __rec.a = a; __rec.b = b;
  // => export * from 'moduleY'; import * as __capturedY__ from 'moduleY'; Object.assign(__rec, __capturedY__);

  const recorder = stringify(options.captureObj);
  let captureId = 0;
  parsed.body = parsed.body.reduce((stmts, stmt) => {
    let nodes = [stmt];
    let sourceImport = '';
    let sourceExport = false;
    if (stmt.type === 'ExportNamedDeclaration') {
      let decls;
      if (stmt.source) {
        decls = stmt.specifiers.map(specifier => [specifier.local.name, specifier.exported.name]);
        sourceImport = `import { ${decls.map(([local, imp]) => local === imp ? imp : `${local} as ${imp}`).join(',')} } from ${stmt.source.raw};\n`;
        sourceExport = `export { ${decls.map(([local, imp]) => imp).join(',')} };\n`;
      } else if (stmt.declaration) {
        decls = stmt.declaration.declarations || [];
        decls = decls.map(decl => {
          return [decl.id.name, decl.id.name];
        });
      } else {
        decls = stmt.specifiers.map(specifier => [specifier.exported.name, specifier.local.name]);
      }
      if (sourceExport) {
        nodes = [];
        sourceImport += sourceExport;
      }
      nodes = nodes.concat(parse(
        sourceImport +
        decls.map(([exp, imp]) => {
          return `${recorder}.${exp} = ${imp};\n` + (imp !== exp ? `${recorder}.${imp} = ${imp};\n` : '');
        }).join('\n')));
    }
    if (stmt.type === 'ExportAllDeclaration') {
      captureId++;
      nodes = nodes.concat(parse(`
       import * as __captured${captureId}__ from ${stmt.source.raw};
       Object.assign(${recorder}, __captured${captureId}__);
      `));
    }
    return stmts.concat(nodes);
  }, []);
  return parsed;
}

function insertCapturesForExportDeclarations (parsed, options) {
  const body = [];
  for (let i = 0; i < parsed.body.length; i++) {
    const stmt = parsed.body[i];
    body.push(stmt);
    // ExportNamedDeclaration can have specifieres = refs, those should already
    // be captured. Only focus on export declarations and only those
    // declarations that are no refs, i.e.
    // ignore: "export default x;"
    // capture: "export default function foo () {};", "export var x = 23, y = 3;"
    if ((stmt.type !== 'ExportNamedDeclaration' && stmt.type !== 'ExportDefaultDeclaration') ||
     !stmt.declaration) {
      /* ... */
    } else if (stmt.type === 'ExportDefaultDeclaration' && stmt.declaration.type === 'Literal') {
      // default export of an unnamed primitive value, i.e.
      // "export default "foo"", "export default 27;"
      const decl = stmt.declaration;
      const assignVal = decl.raw;
      const refId = generateUniqueName(topLevelDeclsAndRefs(parsed).declaredNames, '$' + decl.raw.split('"').join(''));
      stmt.declaration = id(refId);
      arr.pushAt(body, assignExpr(options.captureObj, refId, decl.raw, false), body.indexOf(stmt));
    } else if (stmt.declaration.declarations) {
      body.push(...stmt.declaration.declarations.map(decl => {
        let assignVal = decl.id;
        if (options.declarationWrapper) {
          const alreadyWrapped = decl.init.callee &&
                            decl.init.callee.name === options.declarationWrapper.name;
          if (!alreadyWrapped) {
            assignVal = declarationWrapperCall(
              options.declarationWrapper,
              decl,
              literal(decl.id.name),
              literal('assignment'),
              decl.id,
              options.captureObj,
              options);
          }
        }
        return assignExpr(options.captureObj, decl.id, assignVal, false);
      }));
    } else if (stmt.declaration.type === 'FunctionDeclaration') {
      /* handled by function rewriter as last step */

    } else if (stmt.declaration.type === 'ClassDeclaration') {
      body.push(assignExpr(options.captureObj, stmt.declaration.id, stmt.declaration.id, false));
    }
  }
  parsed.body = body;
  return parsed;
}

function insertCapturesForImportDeclarations (parsed, options) {
  parsed.body = parsed.body.reduce((stmts, stmt) =>
    stmts.concat(stmt.type !== 'ImportDeclaration' || !stmt.specifiers.length
      ? [stmt]
      : [stmt].concat(stmt.specifiers.map(specifier =>
          assignExpr(options.captureObj, specifier.local, specifier.local, false)))), []);
  return parsed;
}

function insertDeclarationsForExports (parsed, options) {
  const topLevel = topLevelDeclsAndRefs(parsed); let body = [];
  for (let i = 0; i < parsed.body.length; i++) {
    const stmt = parsed.body[i];
    if (stmt.type === 'ExportDefaultDeclaration' &&
        stmt.declaration && !stmt.declaration.type.includes('Declaration') &&
        (stmt.declaration.type === 'Identifier' || stmt.declaration.id) &&
        !topLevel.declaredNames.includes(stmt.declaration.name)) {
      body = body.concat([
        varDeclOrAssignment(parsed, {
          type: 'VariableDeclarator',
          id: stmt.declaration,
          init: member(options.captureObj, stmt.declaration)
        }),
        stmt
      ]);
    } else if (stmt.type !== 'ExportNamedDeclaration' || !stmt.specifiers.length || stmt.source) {
      body.push(stmt);
    } else {
      body = body.concat(stmt.specifiers.map(specifier =>
        topLevel.declaredNames.includes(specifier.local.name)
          ? null
          : varDeclOrAssignment(parsed, {
            type: 'VariableDeclarator',
            id: specifier.local,
            init: member(options.captureObj, specifier.local)
          })).filter(Boolean)).concat(stmt);
    }
  }

  parsed.body = body;
  return parsed;
}

function fixDefaultAsyncFunctionExportForRegeneratorBug (parsed, options) {
  // rk 2016-06-02: see https://github.com/LivelyKernel/lively.modules/issues/9
  // FIXME this needs to be removed as soon as the cause for the issue is fixed
  const body = [];
  for (let i = 0; i < parsed.body.length; i++) {
    const stmt = parsed.body[i];
    if (stmt.type === 'ExportDefaultDeclaration' &&
     stmt.declaration.type === 'FunctionDeclaration' &&
     stmt.declaration.id &&
     stmt.declaration.async) {
      body.push(stmt.declaration);
      stmt.declaration = { type: 'Identifier', name: stmt.declaration.id.name };
    }
    body.push(stmt);
  }
  parsed.body = body;
  return parsed;
}

function es6ModuleTransforms (parsed, options) {
  parsed.body = parsed.body.reduce((stmts, stmt) => {
    let nodes;
    if (stmt.type === 'ExportNamedDeclaration') {
      if (stmt.source) {
        var key = moduleId = stmt.source;
        nodes = stmt.specifiers.map(specifier => ({
          type: 'ExpressionStatement',
          expression: exportFromImport(
            { type: 'Literal', value: specifier.exported.name },
            { type: 'Literal', value: specifier.local.name },
            moduleId, options.moduleExportFunc, options.moduleImportFunc)
        }));
      } else if (stmt.declaration) {
        const decls = stmt.declaration.declarations;
        if (!decls) { // func decl or class
          nodes = [stmt.declaration].concat(
            exportCallStmt(options.moduleExportFunc, stmt.declaration.id.name, stmt.declaration.id));
        } else {
          nodes = decls.map(decl => {
            options.excludeDecls.push(decl.id);
            return varDecl(decl.id,
              assignExpr(
                options.captureObj, decl.id,
                options.declarationWrapper
                  ? declarationWrapperCall(
                    options.declarationWrapper,
                    null,
                    literal(decl.id.name),
                    literal(stmt.declaration.kind),
                    decl, options.captureObj,
                    options)
                  : decl.init,
                false),
              stmt.declaration.kind);
          })
            .concat(decls.map(decl => exportCallStmt(options.moduleExportFunc, decl.id.name, decl.id)));
        }
      } else {
        nodes = stmt.specifiers.map(specifier =>
          exportCallStmt(options.moduleExportFunc, specifier.exported.name,
            shouldDeclBeCaptured({ id: specifier.local }, options)
              ? member(options.captureObj, specifier.local)
              : specifier.local));
      }
    } else if (stmt.type === 'ExportDefaultDeclaration') {
      if (stmt.declaration && stmt.declaration.id) {
        nodes = [stmt.declaration].concat(exportCallStmt(options.moduleExportFunc, 'default', stmt.declaration.id));
      } else {
        nodes = [exportCallStmt(options.moduleExportFunc, 'default', stmt.declaration)];
      }
    } else if (stmt.type === 'ExportAllDeclaration') {
      var key = { name: options.es6ExportFuncId + '__iterator__', type: 'Identifier' }; var moduleId = stmt.source;
      nodes = [
        {
          type: 'ForInStatement',
          body: { type: 'ExpressionStatement', expression: exportFromImport(key, key, moduleId, options.moduleExportFunc, options.moduleImportFunc) },
          left: { type: 'VariableDeclaration', kind: 'var', declarations: [{ type: 'VariableDeclarator', id: key, init: null }] },
          right: importCall(null, moduleId, options.moduleImportFunc)
        }
      ];
      options.excludeRefs.push(key.name);
      options.excludeDecls.push(key.name);
    } else if (stmt.type === 'ImportDeclaration') {
      nodes = stmt.specifiers.length
        ? stmt.specifiers.map(specifier => {
          const local = specifier.local;
          const imported = (specifier.type === 'ImportSpecifier' && specifier.imported.name) ||
                      (specifier.type === 'ImportDefaultSpecifier' && 'default') ||
                      null;
          return varDeclAndImportCall(parsed, local, imported || null, stmt.source, options.moduleImportFunc);
        })
        : importCallStmt(null, stmt.source, options.moduleImportFunc);
    } else nodes = [stmt];
    return stmts.concat(nodes);
  }, []);

  return parsed;
}

function putFunctionDeclsInFront (parsed, options) {
  const scope = topLevelDeclsAndRefs(parsed).scope;
  const funcDecls = scope.funcDecls;
  if (!funcDecls.length) return parsed;

  const putInFront = [];

  for (let i = funcDecls.length; i--;) {
    const decl = funcDecls[i];
    if (!decl.id || !shouldDeclBeCaptured(decl, options)) continue;

    const parentPath = scope.funcDeclPaths[i].slice(0, -1);
    // ge the parent so we can replace the original function:
    const parent = Path(parentPath).get(scope.node);
    const funcId = { type: 'Identifier', name: decl.id.name };
    // what we capture:
    const init = options.declarationWrapper
      ? declarationWrapperCall(
        options.declarationWrapper,
        decl,
        literal(funcId.name),
        literal('function'),
        funcId, options.captureObj,
        options)
      : funcId;
    const declFront = { ...decl };

    if (Array.isArray(parent)) {
      // If the parent is a body array we remove the original func decl from it
      // and replace it with a reference to the function
      parent.splice(parent.indexOf(decl), 1, exprStmt(decl.id));
    } else if (parent.type === 'ExportNamedDeclaration') {
      // If the function is exported we change the export declaration into a reference
      const parentIndexInBody = scope.node.body.indexOf(parent);
      if (parentIndexInBody > -1) {
        scope.node.body.splice(parentIndexInBody, 1, { type: 'ExportNamedDeclaration', specifiers: [{ type: 'ExportSpecifier', exported: decl.id, local: decl.id }] });
      }
    } else if (parent.type === 'ExportDefaultDeclaration') {
      parent.declaration = decl.id;
    } else {
      // ??? just leave it alone...
      // decl.type = "EmptyStatement";
    }

    // hoist the function to the front, also it's capture
    putInFront.unshift(assignExpr(options.captureObj, funcId, init, false));
    putInFront.unshift(declFront);
  }
  parsed.body = putInFront.concat(parsed.body);
  return parsed;
}

function computeDefRanges (parsed, options) {
  const topLevel = topLevelDeclsAndRefs(parsed);
  return chain(topLevel.scope.varDecls)
    .pluck('declarations').flat().value()
    .concat(topLevel.scope.funcDecls.filter(ea => ea.id))
    .reduce((defs, decl) => {
      if (!defs[decl.id.name]) defs[decl.id.name] = [];
      defs[decl.id.name].push({ type: decl.type, start: decl.start, end: decl.end });
      return defs;
    }, {});
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// capturing oobject patters / destructuring
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var annotationSym = Symbol('lively.ast-destructuring-transform');

function transformPattern (pattern, transformState) {
  // For transforming destructuring expressions into plain vars and member access.
  // Takes a var or argument pattern node (of type ArrayPattern or
  // ObjectPattern) and transforms it into a set of var declarations that will
  // "pull out" the nested properties
  // Example:
  // var parsed = parse("var [{b: {c: [a]}}] = foo;");
  // var state = {parent: {type: "Identifier", name: "arg"}, declaredNames: ["foo"]}
  // transformPattern(parsed.body[0].declarations[0].id, state).map(stringify).join("\n");
  // // => "var arg$0 = arg[0];\n"
  // //  + "var arg$0$b = arg$0.b;\n"
  // //  + "var arg$0$b$c = arg$0$b.c;\n"
  // //  + "var a = arg$0$b$c[0];"
  return pattern.type === 'ArrayPattern'
    ? transformArrayPattern(pattern, transformState)
    : pattern.type === 'ObjectPattern'
      ? transformObjectPattern(pattern, transformState)
      : [];
}

function transformArrayPattern (pattern, transformState) {
  const declaredNames = transformState.declaredNames;
  const p = annotationSym;
  const transformed = [];

  for (let i = 0; i < pattern.elements.length; i++) {
    const el = pattern.elements[i];

    // like [a]
    if (el.type === 'Identifier') {
      var decl = varDecl(el, member(transformState.parent, id(i), true));
      decl[p] = { capture: true };
      transformed.push(decl);

    // like [...foo]
    } else if (el.type === 'RestElement') {
      var decl = varDecl(el.argument, {
        type: 'CallExpression',
        arguments: [{ type: 'Literal', value: i }],
        callee: member(transformState.parent, id('slice'), false)
      });
      decl[p] = { capture: true };
      transformed.push(decl);
    } else if (el.type == 'AssignmentPattern') {
      // like [x = 23]
      var decl = varDecl(
        el.left/* id */,
        conditional(
          binaryExpr(member(transformState.parent, id(i), true), '===', id('undefined')),
          el.right,
          member(transformState.parent, id(i), true)));
      decl[p] = { capture: true };
      transformed.push(decl);

    // like [{x}]
    } else {
      const helperVarId = id(generateUniqueName(declaredNames, transformState.parent.name + '$' + i));
      const helperVar = varDecl(helperVarId, member(transformState.parent, i));
      // helperVar[p] = {capture: true};
      declaredNames.push(helperVarId.name);
      transformed.push(helperVar);
      transformed.push(...transformPattern(el, { parent: helperVarId, declaredNames }));
    }
  }
  return transformed;
}

function transformObjectPattern (pattern, transformState) {
  const declaredNames = transformState.declaredNames;
  const p = annotationSym;
  const transformed = [];

  for (let i = 0; i < pattern.properties.length; i++) {
    const prop = pattern.properties[i];

    if (prop.type == 'RestElement') {
      const knownKeys = pattern.properties.map(ea => ea.key && ea.key.name).filter(Boolean);
      var decl = nodes.varDecl(prop.argument.name, nodes.objectLiteral([]));
      const captureDecl = nodes.varDecl(prop.argument.name, id(prop.argument.name));
      const defCall = nodes.exprStmt(nodes.funcCall(nodes.funcExpr({}, [],
        nodes.forIn('__key', transformState.parent,
          nodes.block(
            ...(knownKeys.length
              ? knownKeys.map(knownKey =>
                nodes.ifStmt(
                  nodes.binaryExpr(nodes.id('__key'), '===', nodes.literal(knownKey)),
                  { type: 'ContinueStatement', label: null }, null))
              : []),
            nodes.exprStmt(
              nodes.assign(
                nodes.member(prop.argument.name, nodes.id('__key'), true),
                nodes.member(transformState.parent, nodes.id('__key'), true)))
          )))));

      captureDecl[p] = { capture: true };
      transformed.push(decl, captureDecl, defCall);
    } else if (prop.value.type == 'Identifier') {
      // like {x: y}
      var decl = varDecl(prop.value, member(transformState.parent, prop.key));
      decl[p] = { capture: true };
      transformed.push(decl);
    } else if (prop.value.type == 'AssignmentPattern') {
      // like {x = 23}
      var decl = varDecl(
        prop.value.left/* id */,
        conditional(
          binaryExpr(member(transformState.parent, prop.key), '===', id('undefined')),
          prop.value.right,
          member(transformState.parent, prop.key)));
      decl[p] = { capture: true };
      transformed.push(decl);
    } else {
      // like {x: {z}} or {x: [a]}
      const helperVarId = id(generateUniqueName(
        declaredNames,
        transformState.parent.name + '$' + prop.key.name));
      const helperVar = varDecl(helperVarId, member(transformState.parent, prop.key));
      helperVar[p] = { capture: false };
      declaredNames.push(helperVarId.name);
      transformed.push(
        ...[helperVar].concat(
          transformPattern(prop.value, { parent: helperVarId, declaredNames: declaredNames })));
    }
  }

  return transformed;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// code generation helpers
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function varDeclOrAssignment (parsed, declarator, kind) {
  const topLevel = topLevelDeclsAndRefs(parsed);
  const name = declarator.id.name;
  return topLevel.declaredNames.indexOf(name) > -1
    // only create a new declaration if necessary
    ? exprStmt(assign(declarator.id, declarator.init))
    : {
        declarations: [declarator],
        kind: kind || 'var',
        type: 'VariableDeclaration'
      };
}

function assignExpr (assignee, propId, value, computed) {
  return exprStmt(
    assign(
      member(assignee, propId, computed),
      value || id('undefined')));
}

function exportFromImport (keyLeft, keyRight, moduleId, moduleExportFunc, moduleImportFunc) {
  return exportCall(moduleExportFunc, keyLeft, importCall(keyRight, moduleId, moduleImportFunc));
}

function varDeclAndImportCall (parsed, localId, imported, moduleSource, moduleImportFunc) {
  // return varDeclOrAssignment(parsed, {
  //   type: "VariableDeclarator",
  //   id: localId,
  //   init: importCall(imported, moduleSource, moduleImportFunc)
  // });
  return varDecl(localId, importCall(imported, moduleSource, moduleImportFunc));
}

function importCall (imported, moduleSource, moduleImportFunc) {
  if (typeof imported === 'string') imported = literal(imported);
  return {
    arguments: [moduleSource].concat(imported || []),
    callee: moduleImportFunc,
    type: 'CallExpression'
  };
}

function importCallStmt (imported, moduleSource, moduleImportFunc) {
  return exprStmt(importCall(imported, moduleSource, moduleImportFunc));
}

function exportCall (exportFunc, local, exportedObj) {
  if (typeof local === 'string') local = literal(local);
  exportedObj = obj.deepCopy(exportedObj);
  return funcCall(exportFunc, local, exportedObj);
}

function exportCallStmt (exportFunc, local, exportedObj) {
  return exprStmt(exportCall(exportFunc, local, exportedObj));
}

function declarationWrapperCall (
  declarationWrapperNode,
  declNode,
  varNameLiteral,
  varKindLiteral,
  valueNode,
  recorder,
  options
) {
  if (declNode) {
    // here we pass compile-time meta data into the runtime
    const keyVals = [];
    let addMeta = false;
    if (declNode['x-lively-object-meta']) {
      var { start, end, evalId, sourceAccessorName } = declNode['x-lively-object-meta'];
      addMeta = true;
      keyVals.push('start', nodes.literal(start), 'end', nodes.literal(end));
    }
    if (evalId === undefined && options.hasOwnProperty('evalId')) {
      evalId = options.evalId;
      addMeta = true;
    }
    if (sourceAccessorName === undefined && options.hasOwnProperty('sourceAccessorName')) {
      sourceAccessorName = options.sourceAccessorName;
      addMeta = true;
    }
    if (evalId !== undefined) keyVals.push('evalId', nodes.literal(evalId));
    if (sourceAccessorName) keyVals.push('moduleSource', nodes.id(sourceAccessorName));
    if (addMeta) {
    	 return funcCall(
        declarationWrapperNode, varNameLiteral, varKindLiteral, valueNode, recorder,
        nodes.objectLiteral(keyVals)/* meta node */);
    }
  }

  return funcCall(declarationWrapperNode, varNameLiteral, varKindLiteral, valueNode, recorder);
}
