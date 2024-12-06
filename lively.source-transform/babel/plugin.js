import t from '@babel/types';
import babel from '@babel/core';
import systemjsTransform from '@babel/plugin-transform-modules-systemjs';
import { arr, Path } from 'lively.lang';
import { topLevelFuncDecls } from 'lively.ast/lib/visitors.js';
import { query } from 'lively.ast';
import { getGlobal } from 'lively.vm/lib/util.js';
import { declarationWrapperCall, annotationSym, assignExpr, varDeclOrAssignment, transformPattern, generateUniqueName, varDeclAndImportCall, importCallStmt, shouldDeclBeCaptured, importCall, exportCallStmt, exportFromImport, additionalIgnoredDecls, additionalIgnoredRefs } from './helpers.js';
import { classToFunctionTransformBabel } from 'lively.classes/class-to-function-transform.js';
import { scopes } from './scopes.js';

/*
import { module } from 'lively.modules'
let mod = module('lively.morphic/morph.js');
s = await mod.source()
fun.timeToRunN(() => {
  let res = babel.transform(s, {
    sourceMaps: 'inline',
    //compact: true,
    comments: false,
    plugins: [
      [livelyPreTranspile, { module: mod, }],
      systemjsTransform,
      [livelyPostTranspile, { module: mod }]
    ]
  });
}, 10)
*/

export const defaultDeclarationWrapperName = 'lively.capturing-declaration-wrapper';
export const defaultClassToFunctionConverter = t.Identifier('initializeES6ClassForLively');

function varDecl (name, init = null, kind = 'var') {
  if (typeof name === 'string') name = t.Identifier(name);
  return t.VariableDeclaration(kind, [t.VariableDeclarator(name, init)]);
}

function getVarDecls (scope) {
  return new Set(Object.values(scope.bindings).filter(decl => decl.kind !== 'module' && decl.kind !== 'hoisted').map(m => m.path.parentPath).filter(node => node.type === 'VariableDeclaration'));
}

const babelNodes = {
  member: t.MemberExpression,
  property: t.ObjectProperty,
  property: (kind, key, val) => t.ObjectProperty(key, val),
  varDecl,
  parse: src => babel.parse(src).program,
  assign: t.AssignmentExpression,
  assignPattern: t.AssignmentPattern,
  id: t.Identifier,
  block: t.BlockStatement,
  literal: (v) => typeof v === 'string' ? t.StringLiteral(v) : t.NumberLiteral(v),
  forInStmt: t.ForInStatement,
  continueStmt: t.ContinueStatement,
  objectLiteral: t.ObjectExpression,
  objectProperty: t.ObjectProperty,
  declareVariable: t.DeclareVariable,
  logicalExpr: t.LogicalExpression,
  exportNamedDeclaration: t.ExportNamedDeclaration,
  exportSpecifier: t.ExportSpecifier,
  ifStmt: t.IfStatement,
  funcExpr: t.FunctionExpression,
  arrowFuncExpr: t.ArrowFunctionExpression,
  sqncExpr: t.SequenceExpression,
  exprStmt: t.ExpressionStatement,
  unaryExpr: t.UnaryExpression,
  conditional: t.ConditionalExpression,
  binaryExpr: t.BinaryExpression,
  funcCall: t.CallExpression,
  arrayExpr: t.ArrayExpression,
  returnStmt: t.ReturnStatement,
  exportDefaultDecl: t.ExportDefaultDeclaration
};

function processInlineCodeTransformOptions (path, options) {
  if (!path.node.comments) return options;
  let livelyComment = path.node.comments.map(ea => ea.value).find(v => v?.startsWith('lively.vm '));
  if (!livelyComment) return options;
  try {
    let inlineOptions = eval('({' + livelyComment.slice('lively.vm '.length) + '});');
    return Object.assign(options, inlineOptions);
  } catch (err) { return options; }
}

function ensureModuleName (options) {
  let moduleName = false;
  if (options.declarationWrapperName?.includes(System.baseURL)) {
    moduleName = options.declarationWrapperName.split(System.baseURL)[1];
  }

  let separator;
  if (separator = options.declarationWrapperName?.match(/local\:\/\/(.*\/)/)?.[1]) {
    moduleName = options.declarationWrapperName.split(separator)[1];
    moduleName = `local://${separator}${moduleName}`;
  }

  if (separator = options.declarationWrapperName?.match(/lively\:\/\/(.*\/)/)?.[1]) {
    moduleName = options.declarationWrapperName.split(separator)[1];
    moduleName = `lively://${separator}${moduleName}`;
  }

  if (options.declarationWrapperName?.includes('lively.next-workspace/')) {
    moduleName = options.declarationWrapperName.split('lively.next-workspace/')[1];
    moduleName = `lively://lively.next-workspace/${moduleName}`;
  }

  if (moduleName && moduleName.includes('local_projects/')) moduleName = moduleName.replace('local_projects/', '');
  return moduleName;
}

function sanitizeOptions (options) {
  options = {
    ignoreUndeclaredExcept: null,
    includeRefs: null,
    excludeRefs: (options && options.exclude) || [],
    includeDecls: null,
    excludeDecls: (options && options.exclude) || [],
    es6ExportFuncId: null,
    es6ImportFuncId: null,
    captureObj: t.Identifier('__rec'),
    captureImports: true,
    moduleExportFunc: t.Identifier(options && options.es6ExportFuncId || '_moduleExport'),
    moduleImportFunc: t.Identifier(options && options.es6ImportFuncId || '_moduleImport'),
    declarationWrapper: undefined,
    classTransform: (parsed) => parsed,
    ...options
  };

  return options;
}

function wrapInStartEndCall (path, options, parsed) {
  // Wraps a piece of code into two function calls: One before the first
  // statement and one after the last. Also wraps the entire thing into a try /
  // catch block. The end call gets the result of the last statement (if it is
  // something that returns a value, i.e. an expression) passed as the second
  // argument. If an error occurs the end function is called with an error as
  // first parameter
  // Why? This allows to easily track execution of code, especially for
  // asynchronus / await code!
  // Example:
  // stringify(wrapInStartEndCall("var y = x + 23; y"))
  // // generates code
  // try {
  //     __start_execution();
  //     __lvVarRecorder.y = x + 23;
  //     return __end_execution(null, __lvVarRecorder.y);
  // } catch (err) {
  //     return __end_execution(err, undefined);
  // }

  const outerBody = [];
  const isProgram = parsed.type === 'Program';
  const funcDecls = topLevelFuncDecls(parsed);
  let startFuncNode = options.startFuncNode || t.Identifier('__start_execution');
  let endFuncNode = options.endFuncNode || t.Identifier('__end_execution');
  if (typeof startFuncNode == 'string') startFuncNode = babel.parse(startFuncNode).program.body[0].expression;
  if (typeof endFuncNode == 'string') endFuncNode = babel.parse(endFuncNode).program.body[0].expression;

  // 1. Hoist func decls outside the actual eval start - end code. The async /
  // generator transforms require this!
  funcDecls.forEach(({ node, path }) => {
    Path(path).set(parsed, t.ExpressionStatement(node.id));
    outerBody.push(node);
  });

  // 2. add start-eval call
  path.pushContainer('body', t.ExpressionStatement(t.CallExpression(startFuncNode, [])));

  // 3. if last statement is an expression, transform it so we can pass it to
  // the end-eval call, replacing the original expression. If it's a
  // non-expression we record undefined as the eval result
  const last = arr.last(path.get('body'));
  if (last.node.type === 'ExpressionStatement') {
    last.remove();
    path.pushContainer('body', t.ExpressionStatement(t.CallExpression(endFuncNode, [t.Identifier('null'), last.expression])));
  } else if (last.node.type === 'VariableDeclaration' && arr.last(last.node.declarations).id.type === 'Identifier') {
    path.pushContainer('body', t.ExpressionStatement(t.CallExpression(endFuncNode, [t.Identifier('null'), arr.last(last.declarations).id])));
  } else {
    path.pushContainer('body', t.ExpressionStatement(t.CallExpression(endFuncNode, [t.Identifier('null'), t.Identifier('undefined')])));
  }

  // 4. Wrap that stuff in a try stmt
  outerBody.push(
    t.TryStatement(
      t.BlockStatement(path.node.body),
      t.CatchClause(t.Identifier('err'), null,
        t.BlockStatement([t.ExpressionStatement(t.CallExpression(endFuncNode, [t.Identifierd('err'), t.Identifier('undefined')]))])
      )));

  path.replaceWith(isProgram ? t.Program(outerBody) : t.BlockStatement(outerBody));
}

function getCatches (scope) {
  return [];
}

function analyzeParsed (path, options, footer, header) {
  const undeclaredNames = Object.keys(path.scope.globals);
  const varDecls = getVarDecls(path.scope);
  const catches = getCatches(path.scope);

  if (options.footer) footer.push(...babel.parse(options.footer).program.body);
  if (options.header) header.push(...babel.parse(options.header).program.body);

  // "ignoreUndeclaredExcept" is null if we want to capture all globals in the toplevel scope
  // if it is a list of names we will capture all refs with those names
  if (options.ignoreUndeclaredExcept) {
    options.excludeRefs = arr.withoutAll(undeclaredNames, options.ignoreUndeclaredExcept).concat(options.excludeRefs);
    options.excludeDecls = arr.withoutAll(undeclaredNames, options.ignoreUndeclaredExcept).concat(options.excludeDecls);
  }

  options.excludeRefs = options.excludeRefs.concat(options.captureObj.name);
  options.excludeDecls = options.excludeDecls.concat(options.captureObj.name);

  // 2. find those var declarations that should not be rewritten. we
  // currently ignore var declarations in for loops and the error parameter
  // declaration in catch clauses. Also es6 import / export declaration need
  // a special treatment
  // DO NOT rewrite exports like "export { foo as bar }" => "export { _rec.foo as bar }"
  // as this is not valid syntax. Instead we add a var declaration using the
  // recorder as init for those exports later
  options.excludeRefs = options.excludeRefs.concat(additionalIgnoredRefs({ varDecls, catches }, options));
  options.excludeDecls = options.excludeDecls.concat(additionalIgnoredDecls({ varDecls, catches }, options));

  if (options.es6ExportFuncId) {
    options.excludeRefs.push(options.es6ExportFuncId);
    options.excludeRefs.push(options.es6ImportFuncId);
  }

  return options;
}

function removeJspmGlobalRef (path, options) {
  // do not replace until the
  // var _global = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : global;
  // declaration has been detected
  let declarationFound = false;
  const globalInitStmt = '_global = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : global';
  path.traverse({
    LogicalExpression (path, state) {
      if (declarationFound && path.node.right.name === '_global') {
        path.replaceWith(path.node.left);
        path.skip();
      }
    },
    VariableDeclarator (path, state) {
      if (!declarationFound && path.node.id.name === '_global') {
        declarationFound = path.getSource() === globalInitStmt;
      }
    }
  });
}

function getRefs (scope, options) {
  const bindings = Object.values(scope.bindings);
  const globalRefs = [];
  scope.traverse(scope.block, {
    AssignmentExpression (path) {
      const name = path.node.left?.name;
      if (name && scope.globals[name]) {
        globalRefs.push(path.node.left);
      }
    },
    ReferencedIdentifier (path) {
      if (scope.globals[path.node.name]) {
        globalRefs.push(path.node);
      }
    }
  });
  const exportRe = /ExportDefaultDeclaration|ExportNamedDeclaration|ExportSpecifier/;
  return bindings.map(binding =>
    binding.referencePaths
      .filter(path => !path.parentPath.type.match(exportRe) && !path.type.match(exportRe))
      .concat(binding.constantViolations.filter(path => path.type === 'AssignmentExpression').map(path => path.get('left'))))
    .flat().map(m => m.node).concat(globalRefs).filter(ref => !options?.excludeRefs.includes(ref.name));
}

function es6ModuleTransforms (path, options) {
  let moduleId;
  path.traverse({
    ExportNamedDeclaration (path) {
      const stmt = path.node;
      let insertedRef;
      if (stmt.source) {
        moduleId = stmt.source;
        path.insertAfter(stmt.specifiers.map(specifier => t.ExpressionStatement(
          exportFromImport(
            t.StringLiteral(specifier.exported.name),
            t.StringLiteral(specifier.local.name),
            moduleId, options.moduleExportFunc, options.moduleImportFunc))));
        path.remove();
      } else if (stmt.declaration) {
        const decls = stmt.declaration.declarations;
        if (!decls) { // func decl or class
          path.insertAfter([stmt.declaration].concat(
            exportCallStmt(options.moduleExportFunc, stmt.declaration.id.name, stmt.declaration.id)));
          insertedRef = path.getSibling(path.key + 2).get('expression.arguments.1');
          path.remove();
        } else {
          path.insertAfter(decls.map(decl => {
            options.excludeDecls.push(decl.id);
            return varDecl(decl.id,
              t.AssignmentExpression('=', t.MemberExpression(options.captureObj, decl.id, false), options.declarationWrapper
                ? declarationWrapperCall(
                  options.declarationWrapper,
                  decl,
                  t.StringLiteral(decl.id.name),
                  t.StringLiteral(stmt.declaration.kind),
                  decl.init, options.captureObj,
                  options)
                : decl.init),
              stmt.declaration.kind);
          })
            .concat(decls.map(decl => exportCallStmt(options.moduleExportFunc, decl.id.name, decl.id))));
          insertedRef = path.getAllNextSiblings().slice(decls.length, decls.length * 2).map(ea => ea.get('expression.arguments.1'));
          path.remove();
        }
      } else {
        path.insertAfter(stmt.specifiers.map(specifier =>
          exportCallStmt(options.moduleExportFunc, specifier.exported.name,
            shouldDeclBeCaptured({ id: specifier.local }, options)
              ? t.MemberExpression(options.captureObj, specifier.local)
              : specifier.local)));
        path.remove();
      }
      return path.skip();
    },
    ExportDefaultDeclaration (path) {
      const stmt = path.node;
      if (stmt.declaration && stmt.declaration.id) {
        path.insertAfter([stmt.declaration, exportCallStmt(options.moduleExportFunc, 'default', stmt.declaration.id)]);
      } else {
        let exported = stmt.declaration;
        if (exported.type === 'FunctionDeclaration') {
          const { params, body, generator } = exported;
          exported = t.FunctionExpression(null, params, body, generator);
        }
        path.insertAfter(exportCallStmt(options.moduleExportFunc, 'default', exported));
      }
      path.remove();
      path.skip();
    },
    ExportAllDeclaration (path) {
      const stmt = path.node;
      const key = t.Identifier(options.es6ExportFuncId + '__iterator__');
      moduleId = stmt.source;
      path.replaceWith(t.ForInStatement(
        varDecl(key, null),
        importCall(null, moduleId, options.moduleImportFunc),
        t.ExpressionStatement(exportFromImport(key, key, moduleId, options.moduleExportFunc, options.moduleImportFunc))));
      options.excludeRefs.push(key.name);
      options.excludeDecls.push(key.name);
      path.skip();
    },
    ImportDeclaration (path) {
      const stmt = path.node;
      path.insertAfter(stmt.specifiers.length
        ? stmt.specifiers.map(specifier => {
          const local = specifier.local;
          const imported = (specifier.type === 'ImportSpecifier' && specifier.imported.name) ||
                      (specifier.type === 'ImportDefaultSpecifier' && 'default') ||
                      null;
          return varDeclAndImportCall(local, imported || null, stmt.source, options.moduleImportFunc);
        })
        : [importCallStmt(null, stmt.source, options.moduleImportFunc)]);
      path.remove();
      path.skip();
    }
  });
  path.scope.crawl();
  options.scope.refs = getRefs(path.scope, options);
}

function replaceVarDeclsAndRefs (path, options) {
  let intermediateCounter = 0;
  const refsToReplace = new Set(options.scope.refs.filter(ref => !options?.excludeRefs.includes(ref.name)));
  // const varDeclsToReplace = options.scope.varDecls;
  const varDeclsToReplace = getVarDecls(path.scope);
  const declaredNames = Object.keys(path.scope.bindings);
  const globalRegex = /(?:"undefined"\s*!==\s*typeof\s+(globalThis|self|global|window)\s*\?\s*\1\s*:)+\s*(globalThis|self|global|window)/;

  function isGlobalRef (identifierPath) {
    const variableName = identifierPath.node.name;
    const binding = identifierPath.scope.getBinding(variableName);

    if (!binding) {
      return false;
    }

    const { path: declarationPath } = binding;

    if (declarationPath.isVariableDeclarator()) {
      if (declarationPath.node.init) {
        return globalRegex.test(declarationPath.get('init').toString());
      }
    }

    return false;
  }

  function ensureGlobalBinding (ref) {
    // handles cases where we capture functions that need to be bound to the global
    // object in order to be run successfully.
    if (ref.type === 'MemberExpression') {
      const propName = ref.node.property?.name;
      if (['setInterval', 'setTimeout', 'clearTimeout'].includes(propName) && isGlobalRef(ref.get('object'))) {
        const globalRef = t.MemberExpression(options.captureObj, t.cloneNode(ref.get('object').node));
        return t.CallExpression(t.MemberExpression(t.MemberExpression(globalRef, t.Identifier(propName)), t.Identifier('bind')), [globalRef]);
      }
    }
    return ref.node;
  }

  path.traverse({
    Identifier (path) {
      const { node } = path;
      if (refsToReplace.has(node)) {
        path.replaceWith(t.MemberExpression(options.captureObj, node));
        path.skip();
      }
    },
    Property (path) {
      if (refsToReplace.has(path.node) && path.node.shorthand) {
        path.replaceWith(t.Property(t.Identifier(path.node.key.name), path.node.value));
        path.skip();
      }
    },
    ClassMethod (path) {
      // for computed method names we need to insert the capture
      // object such that the correct values are retrieved
      if (path.node.computed) {
        const { key } = path.node;
        if (refsToReplace.has(key)) {
          if (key.type === 'MemberExpression') {
            let curr = path.get('key');
            while (curr.get('object').type === 'MemberExpression') {
              curr = curr.get('object');
            }
            curr.get('object').replaceWith(t.MemberExpression(options.captureObj, curr.node.object));
            path.skip();
          }
        }
      }
    },
    AssignmentExpression (path) {
      // declaration wrapper function for assignments
      // "a = 3" => "a = _define('a', 'assignment', 3, _rec)"
      const { node } = path;
      if (refsToReplace.has(node.left) && options.declarationWrapper) {
        path.get('right').replaceWith(declarationWrapperCall(
          options.declarationWrapper,
          path.get('left').node,
          t.StringLiteral(node.left.name),
          t.StringLiteral('assignment'),
          node.right,
          options.captureObj,
          options));
        path.skip();
        path.get('left').visit();
        return;
      }
      // declaration wrapper for destructuring assignments like
      // ({ a: blub, b, c } = d); => (_inter = d, _rec.a = _inter.a, _rec.b = _inter.b, _rec.c = _inter.c);
      if (node.left.type === 'ObjectPattern') {
        const intermediate = t.Identifier(`__inter${intermediateCounter++}__`);
        path.replaceWith(t.SequenceExpression(
          [t.AssignmentExpression('=', t.MemberExpression(options.captureObj, intermediate), node.right),
            ...node.left.properties.map(prop => {
              if (prop.type === 'RestElement') {
                return t.AssignmentExpression('=', prop.argument.name, t.MemberExpression(options.captureObj, intermediate));
              }
              const key = prop.value || prop.key;
              return t.AssignmentExpression('=', key, t.MemberExpression(t.MemberExpression(options.captureObj, intermediate), prop.key));
            }), t.MemberExpression(options.captureObj, intermediate)]));
        path.skip();
      }
    },
    VariableDeclaration (path) {
      if (!varDeclsToReplace.has(path) ||
           path.node.declarations.every(decl => !shouldDeclBeCaptured(decl, options)) ||
           path.node._visited) {
        return;
      }

      const replaced = []; const { node } = path;
      for (let i = 0; i < node.declarations.length; i++) {
        const decl = node.declarations[i];

        if (!shouldDeclBeCaptured(decl, options)) {
          replaced.push(t.VariableDeclaration(node.kind || 'var', [decl]));
          continue;
        }

        let init = ensureGlobalBinding(path.get('declarations.' + i + '.init')) || t.LogicalExpression('||', t.MemberExpression(options.captureObj, decl.id), t.Identifier('undefined'));

        const initWrapped = options.declarationWrapper && decl.id.name
          ? declarationWrapperCall(
            options.declarationWrapper,
            decl,
            t.StringLiteral(decl.id.name),
            t.StringLiteral(node.kind),
            init,
            options.captureObj,
            options)
          : init;

        // Here we create the object pattern / destructuring replacements
        if (decl.id.type.includes('Pattern')) {
          const declRootName = generateUniqueName(declaredNames, 'destructured_1');
          const declRoot = t.Identifier(declRootName);
          const state = { parent: declRoot, declaredNames };
          const extractions = transformPattern(decl.id, state).map(decl =>
            decl[annotationSym] && decl[annotationSym].capture
              ? assignExpr(
                options.captureObj,
                decl.declarations[0].id,
                options.declarationWrapper
                  ? declarationWrapperCall(
                    options.declarationWrapper,
                    null,
                    t.StringLiteral(decl.declarations[0].id.name),
                    t.StringLiteral(node.kind),
                    decl.declarations[0].init,
                    options.captureObj,
                    options)
                  : decl.declarations[0].init,
                false)
              : decl);
          declaredNames.push(declRootName);
          options.excludeRefs.push(declRootName);
          options.excludeDecls.push(declRootName);
          replaced.push(...[varDecl(declRoot, initWrapped, node.kind)].concat(extractions));
          continue;
        }

        const rewrittenDecl = assignExpr(options.captureObj, decl.id, initWrapped, false);

        // This is rewriting normal vars
        replaced.push(rewrittenDecl); // FIXME: also update the refs here

        if (options.keepTopLevelVarDecls) {
          replaced.push(varDecl(decl.id, t.MemberExpression(options.captureObj, decl.id)));
        }
      }

      if (path.parent.type === 'IfStatement') {
        path.replaceWith(t.BlockStatement(replaced));
        return;
      }

      replaced.forEach(n => n._visited = true);
      path.replaceWithMultiple(replaced);
    }
  });
}

function replaceRefs (path, options) {
  const refsToReplace = new Set(getRefs(path.scope, options));
  // const refsToReplace = options.scope.refs;
  let intermediateCounter = 0;

  path.traverse({
    Identifier (path) {
      const { node } = path;
      if (refsToReplace.has(node)) {
        path.replaceWith(t.MemberExpression(options.captureObj, node));
        path.skip();
      }
    },
    Property (path) {
      if (refsToReplace.has(path.node) && path.node.shorthand) {
        path.replaceWith(t.Property(t.Identifier(path.node.key.name), path.node.value));
        path.skip();
      }
    },
    ClassMethod (path) {
      // for computed method names we need to insert the capture
      // object such that the correct values are retrieved
      if (path.node.computed) {
        const { key } = path.node;
        if (refsToReplace.has(key)) {
          if (key.type === 'MemberExpression') {
            let curr = path.get('key');
            while (curr.get('object').type === 'MemberExpression') {
              curr = curr.get('object');
            }
            curr.get('object').replaceWith(t.MemberExpression(options.captureObj, curr.node.object));
            path.skip();
          }
        }
      }
    },
    AssignmentExpression (path) {
      // declaration wrapper function for assignments
      // "a = 3" => "a = _define('a', 'assignment', 3, _rec)"
      const { node } = path;
      if (refsToReplace.has(node.left) && options.declarationWrapper) {
        path.get('right').replaceWith(declarationWrapperCall(
          options.declarationWrapper,
          path.get('left').node,
          t.StringLiteral(node.left.name),
          t.StringLiteral('assignment'),
          node.right,
          options.captureObj,
          options));
        path.skip();
        path.get('left').visit();
        return;
      }
      // declaration wrapper for destructuring assignments like
      // ({ a: blub, b, c } = d); => (_inter = d, _rec.a = _inter.a, _rec.b = _inter.b, _rec.c = _inter.c);
      if (node.left.type === 'ObjectPattern') {
        const intermediate = t.Identifier(`__inter${intermediateCounter++}__`);
        path.replaceWith(t.SequenceExpression(
          [t.AssignmentExpression('=', t.MemberExpression(options.captureObj, intermediate), node.right),
            ...node.left.properties.map(prop => {
              if (prop.type === 'RestElement') {
                return t.AssignmentExpression('=', prop.argument.name, t.MemberExpression(options.captureObj, intermediate));
              }
              const key = prop.value || prop.key;
              return t.AssignmentExpression('=', key, t.MemberExpression(t.MemberExpression(options.captureObj, intermediate), prop.key));
            }), t.MemberExpression(options.captureObj, intermediate)]));
        path.skip();
      }
    }
  });
}

function replaceVarDecls (path, options) {
  const varDecls = getVarDecls(path.scope);
  const declaredNames = Object.keys(path.scope.bindings);
  const globalRegex = /(?:"undefined"\s*!==\s*typeof\s+(globalThis|self|global|window)\s*\?\s*\1\s*:)+\s*(globalThis|self|global|window)/;

  function isGlobalRef (identifierPath) {
    const variableName = identifierPath.node.name;
    const binding = identifierPath.scope.getBinding(variableName);

    if (!binding) {
      return false;
    }

    const { path: declarationPath } = binding;

    if (declarationPath.isVariableDeclarator()) {
      if (declarationPath.node.init) {
        return globalRegex.test(declarationPath.get('init').toString());
      }
    }

    return false;
  }

  function ensureGlobalBinding (ref) {
    // handles cases where we capture functions that need to be bound to the global
    // object in order to be run successfully.
    if (ref.type === 'MemberExpression') {
      const propName = ref.node.property?.name;
      if (['setInterval', 'setTimeout', 'clearTimeout'].includes(propName) && isGlobalRef(ref.get('object'))) {
        const globalRef = t.MemberExpression(options.captureObj, t.cloneNode(ref.get('object').node));
        return t.CallExpression(t.MemberExpression(t.MemberExpression(globalRef, t.Identifier(propName)), t.Identifier('bind')), [globalRef]);
      }
    }
    return ref.node;
  }

  path.traverse({
    VariableDeclaration (path) {
      if (!varDecls.has(path) ||
           path.node.declarations.every(decl => !shouldDeclBeCaptured(decl, options)) ||
           path.node._visited) {
        return;
      }

      const replaced = []; const { node } = path;
      for (let i = 0; i < node.declarations.length; i++) {
        const decl = node.declarations[i];

        if (!shouldDeclBeCaptured(decl, options)) {
          replaced.push(t.VariableDeclaration(node.kind || 'var', [decl]));
          continue;
        }

        let init = ensureGlobalBinding(path.get('declarations.' + i + '.init')) || t.LogicalExpression('||', t.MemberExpression(options.captureObj, decl.id), t.Identifier('undefined'));

        const initWrapped = options.declarationWrapper && decl.id.name
          ? declarationWrapperCall(
            options.declarationWrapper,
            decl,
            t.StringLiteral(decl.id.name),
            t.StringLiteral(node.kind),
            init,
            options.captureObj,
            options)
          : init;

        // Here we create the object pattern / destructuring replacements
        if (decl.id.type.includes('Pattern')) {
          const declRootName = generateUniqueName(declaredNames, 'destructured_1');
          const declRoot = t.Identifier(declRootName);
          const state = { parent: declRoot, declaredNames };
          const extractions = transformPattern(decl.id, state).map(decl =>
            decl[annotationSym] && decl[annotationSym].capture
              ? assignExpr(
                options.captureObj,
                decl.declarations[0].id,
                options.declarationWrapper
                  ? declarationWrapperCall(
                    options.declarationWrapper,
                    null,
                    t.StringLiteral(decl.declarations[0].id.name),
                    t.StringLiteral(node.kind),
                    decl.declarations[0].init,
                    options.captureObj,
                    options)
                  : decl.declarations[0].init,
                false)
              : decl);
          declaredNames.push(declRootName);
          options.excludeRefs.push(declRootName);
          options.excludeDecls.push(declRootName);
          replaced.push(...[varDecl(declRoot, initWrapped, node.kind)].concat(extractions));
          continue;
        }

        const rewrittenDecl = assignExpr(options.captureObj, decl.id, initWrapped, false);

        // This is rewriting normal vars
        replaced.push(rewrittenDecl); // FIXME: also update the refs here

        if (options.keepTopLevelVarDecls) {
          replaced.push(varDecl(decl.id, t.MemberExpression(options.captureObj, decl.id)));
        }
      }

      if (path.parent.type === 'IfStatement') {
        path.replaceWith(t.BlockStatement(replaced));
        return;
      }

      replaced.forEach(n => n._visited = true);
      path.replaceWithMultiple(replaced);
    }
  });
}

function clearEmptyExports (path, options) {
  for (const exp of path.get('body')) {
    if (exp.type !== 'ExportNamedDeclaration') continue;
    if (!exp.node.declaration && exp.node.specifiers && !exp.node.specifiers.length) {
      exp.remove();
    }
  }
}

function getClassDecls (scope) {
  return Object.values(scope.bindings).filter(m => m.path.type === 'ClassDeclaration').map(m => m.path);
}

function replaceClassDecls (path, options) {
  if (options.classToFunction && options.classToFunction.transform) {
    return options.classToFunction.transform(path, {
      ...options.classToFunction,
      captureObj: options.captureObj
    });
  }

  const classDecls = getClassDecls(path.scope);
  if (!classDecls.length) return;

  for (let i = classDecls.length - 1; i >= 0; i--) {
    const stmt = classDecls[i];
    if (stmt.parentPath.type.match(/ExportNamedDeclaration|ExportDefaultDeclaration/)) continue;
    stmt.insertAfter(assignExpr(options.captureObj, stmt.node.id, stmt.node.id, false));
  }
}

function splitExportDeclarations (path, options) {
  const stmts = path.get('body');
  for (let stmt of stmts) {
    const { declaration, type } = stmt.node;
    if (type !== 'ExportNamedDeclaration' ||
       !declaration || declaration.type !== 'VariableDeclaration' ||
        declaration.declarations.length <= 1) { continue; }

    const decls = declaration.declarations;
    const newNodes = [];
    for (let j = 0; j < decls.length; j++) {
      newNodes.push(t.ExportNamedDeclaration(varDecl(decls[j].id, decls[j].init, declaration.kind), []));
    }
    stmt.replaceWithMultiple(newNodes);
  }
}

function insertCapturesForExportDeclarations (path, options) {
  const declaredNames = Object.keys(path.scope.bindings);
  function handleDeclarations (path) {
    const stmt = path.node;
    path.insertAfter(stmt.declaration.declarations.map(decl => {
      let assignVal = decl.id;
      if (options.declarationWrapper) {
        const alreadyWrapped = decl.init.callee &&
                            decl.init.callee.name === options.declarationWrapper.name;
        if (!alreadyWrapped) {
          assignVal = declarationWrapperCall(
            options.declarationWrapper,
            decl,
            t.StringLiteral(decl.id.name),
            t.StringLiteral('assignment'),
            decl.id,
            options.captureObj,
            options);
        }
      }
      return assignExpr(options.captureObj, decl.id, assignVal, false);
    }));
  }
  return path.traverse({
    ExportNamedDeclaration (path) {
      const stmt = path.node;
      if (!stmt.declaration) return;
      if (stmt.declaration.declarations) {
        handleDeclarations(path);
      } else if (stmt.declaration.type === 'ClassDeclaration') {
        path.insertAfter(assignExpr(options.captureObj, stmt.declaration.id, stmt.declaration.id, false));
      }
    },
    ExportDefaultDeclaration (path) {
      const stmt = path.node;
      if (!stmt.declaration) return;
      if (stmt.declaration.type.match(/StringLiteral|NumericLiteral/)) {
        // default export of an unnamed primitive value, i.e.
        // "export default "foo"", "export default 27;"
        const decl = stmt.declaration;
        const refId = generateUniqueName(declaredNames, '$' + decl.extra.raw.split('"').join(''));
        path.insertBefore(assignExpr(options.captureObj, t.Identifier(refId), stmt.declaration, false));
        stmt.declaration = t.Identifier(refId);
      } else if (stmt.declaration.declarations) {
        return handleDeclarations(path);
      } else if (stmt.declaration.type === 'ClassDeclaration') {
        path.insertAfter(assignExpr(options.captureObj, stmt.declaration.id, stmt.declaration.id, false));
      }
    }
  });
}

function insertCapturesForImportDeclarations (path, options) {
  path.traverse({
    ImportDeclaration (path) {
      const stmt = path.node;
      if (!stmt.specifiers.length) return;
      path.insertAfter(stmt.specifiers.map(specifier =>
        assignExpr(options.captureObj, specifier.local, specifier.local, false)));
    }
  });
}

function insertCapturesForImportAndExportDeclarations (path, options) {
  path.scope.crawl();
  const declaredNames = new Set(Object.keys(path.scope.bindings));
  function handleDeclarations (path) {
    const stmt = path.node;
    path.insertAfter(stmt.declaration.declarations.map(decl => {
      let assignVal = decl.id;
      if (options.declarationWrapper) {
        const alreadyWrapped = decl.init.callee &&
                            decl.init.callee.name === options.declarationWrapper.name;
        if (!alreadyWrapped) {
          assignVal = declarationWrapperCall(
            options.declarationWrapper,
            decl,
            t.StringLiteral(decl.id.name),
            t.StringLiteral('assignment'),
            decl.id,
            options.captureObj,
            options);
        }
      }
      return assignExpr(options.captureObj, decl.id, assignVal, false);
    }));
  }
  return path.traverse({
    ExportNamedDeclaration (path) {
      const stmt = path.node;

      if (stmt.declaration?.declarations) {
        handleDeclarations(path);
      } else if (stmt.declaration?.type === 'ClassDeclaration') {
        path.insertAfter(assignExpr(options.captureObj, stmt.declaration.id, stmt.declaration.id, false));
      }

      if (stmt.specifiers.length && !stmt.source) {
        path.insertBefore(arr.compact(stmt.specifiers.map(specifier =>
          declaredNames.has(specifier.local.name)
            ? null
            : varDeclOrAssignment(declaredNames, specifier.local, t.MemberExpression(options.captureObj, specifier.local)))));
      }
    },
    ExportDefaultDeclaration (path) {
      const stmt = path.node;
      if (!stmt.declaration) return;
      if (stmt.declaration.type.match(/StringLiteral|NumericLiteral/)) {
        // default export of an unnamed primitive value, i.e.
        // "export default "foo"", "export default 27;"
        const decl = stmt.declaration;
        const refId = generateUniqueName(declaredNames, '$' + decl.extra.raw.split('"').join(''));
        path.insertBefore(assignExpr(options.captureObj, t.Identifier(refId), stmt.declaration, false));
        path.get('declaration').replaceWith(t.Identifier(refId));
      } else if (stmt.declaration.declarations) {
        handleDeclarations(path);
      } else if (stmt.declaration.type === 'ClassDeclaration') {
        path.insertAfter(assignExpr(options.captureObj, stmt.declaration.id, stmt.declaration.id, false));
      }
      if (!stmt.declaration.type.includes('Declaration') &&
            (stmt.declaration.type === 'Identifier' || stmt.declaration.id) &&
            !declaredNames.has(stmt.declaration.name)) {
        path.insertBefore(
          varDeclOrAssignment(declaredNames, stmt.declaration, t.MemberExpression(options.captureObj, stmt.declaration)));
      }
    },
    ImportDeclaration (path) {
      if (!options.captureImports) return;
      const stmt = path.node;
      if (!stmt.specifiers.length) return;
      path.insertAfter(stmt.specifiers.map(specifier =>
        assignExpr(options.captureObj, specifier.local, specifier.local, false)));
    }
  });
}

function insertDeclarationsForExports (path, options) {
  path.scope.crawl();
  const declaredNames = new Set(Object.keys(path.scope.bindings));
  path.traverse({
    ExportDefaultDeclaration (path) {
      const stmt = path.node;
      if (stmt.declaration &&
            !stmt.declaration.type.includes('Declaration') &&
            (stmt.declaration.type === 'Identifier' || stmt.declaration.id) &&
            !declaredNames.has(stmt.declaration.name)) {
        path.insertBefore(
          varDeclOrAssignment(declaredNames, stmt.declaration, t.MemberExpression(options.captureObj, stmt.declaration)));
      }
    },
    ExportNamedDeclaration (path) {
      const stmt = path.node;
      if (!stmt.specifiers.length || stmt.source) return;
      path.insertBefore(arr.compact(stmt.specifiers.map(specifier =>
        declaredNames.has(specifier.local.name)
          ? null
          : varDeclOrAssignment(declaredNames, specifier.local, t.MemberExpression(options.captureObj, specifier.local)))));
    }
  });
}

function getFuncDecls (scope) {
  return Object.values(scope.bindings).filter(m => m.kind === 'hoisted').map(m => m.path);
}

function putFunctionDeclsInFront (path, options) {
  let funcDecls = getFuncDecls(path.scope, options);
  if (!funcDecls.length) return;
  const putInFront = [];

  for (let i = funcDecls.length; i--;) {
    const declPath = funcDecls[i];
    const parentPath = declPath.parentPath;
    const decl = declPath.node;
    const funcId = decl.id;

    if (!funcId || !shouldDeclBeCaptured(decl, options)) continue;
    // ge the parent so we can replace the original function:
    const init = options.declarationWrapper
      ? declarationWrapperCall(
        options.declarationWrapper,
        decl, // FIXME: this is not babel compatible
        t.StringLiteral(funcId.name),
        t.StringLiteral('function'),
        funcId, options.captureObj,
        options)
      : funcId;

    const declFront = t.cloneNode(decl);

    if (parentPath.type === 'Program') {
      if (declPath.getAllNextSiblings().length > 0) declPath.remove();
      else declPath.replaceWith(funcId);
    } else if (parentPath.type === 'ExportNamedDeclaration') {
      // If the function is exported we change the export declaration into a reference
      // const parentIndexInBody = scope.node.body.indexOf(parent);
      parentPath.replaceWith(t.ExportNamedDeclaration(null, [t.ExportSpecifier(funcId, funcId)], null));
    } else if (parentPath.type === 'ExportDefaultDeclaration') {
      parentPath.replaceWith(t.ExportDefaultDeclaration(funcId));
    }

    // hoist the function to the front, also it's capture
    putInFront.unshift(assignExpr(options.captureObj, funcId, init, false));
    putInFront.unshift(declFront);
  }
  path.unshiftContainer('body', putInFront);
  path.scope.crawl();
}

function transformImportMeta (path, options) {
  const currentModuleAccessor = options.classToFunction?.currentModuleAccessor;
  path.traverse({
    MetaProperty (path) {
      if (path.node.meta.name === 'import') {
        path.replaceWith(currentModuleAccessor
          ? t.ObjectExpression(
            [
              t.ObjectProperty(
                t.Identifier('url'),
                t.MemberExpression(currentModuleAccessor, t.Identifier('id')))
            ])
          : t.ObjectExpression([
            t.objectProperty(
              t.Identifier('url'),
              t.MemberExpression(t.CallExpression(t.Identifier('eval'), [t.StringLiteral("typeof _context !== \'undefined\' ? _context : {}")]), t.Identifier('id')))]));
        path.skip();
      }
    }
  });
}

export function rewriteToCaptureTopLevelVariables (path, options) {
  let footer = [];
  let header = [];

  options = sanitizeOptions(options);

  options = analyzeParsed(path, options, footer, header);

  removeJspmGlobalRef(path, options);

  if (options.es6ExportFuncId) {
    es6ModuleTransforms(path, options);
  }

  replaceVarDeclsAndRefs(path, options);

  clearEmptyExports(path, options);

  replaceClassDecls(path, options);

  splitExportDeclarations(path, options);

  insertCapturesForImportAndExportDeclarations(path, options);

  putFunctionDeclsInFront(path, options);

  transformImportMeta(path, options);

  path.unshiftContainer('body', header);
  path.pushContainer('body', footer);
}

function ensureComponentDescriptors (path, moduleId, options) {
  // check first for top level decls
  const varDecls = getVarDecls(path.scope);
  let earlyReturn = false;

  path.traverse({
    ExpressionStatement (sub, state) {
      if (sub.node.expression?.callee?.name === 'component') {
        sub.stop();
        path.replaceWith(t.CallExpression(t.MemberExpression(t.Identifier('component'), t.Identifier('for')), [
          t.ArrowFunctionExpression([], t.CallExpression(t.Identifier('component'), sub.node.expression.arguments)),
          t.ObjectExpression([t.ObjectProperty(t.Identifier('module'), t.StringLiteral(moduleId))])
        ]));
        earlyReturn = true;
      }
    }
  });

  if (earlyReturn) return;

  path.traverse({
    VariableDeclarator (path, state) {
      const node = path.node;
      const isCaptured = varDecls.has(path);
      const componentRef = node.id.name;
      if (node.init?.callee?.name !== 'component') return path.skip();
      const spec = node.init.arguments;
      path.replaceWith(
        t.VariableDeclarator(t.Identifier(componentRef), t.CallExpression(t.MemberExpression(t.Identifier('component'), t.Identifier('for')), [
          t.ArrowFunctionExpression([], t.CallExpression(t.Identifier('component'), spec)),
          t.ObjectExpression([
            t.ObjectProperty(t.Identifier('module'), t.StringLiteral(moduleId)),
            t.ObjectProperty(t.Identifier('export'), t.StringLiteral(componentRef)),
            t.ObjectProperty(t.Identifier('range'), t.ObjectExpression([
              t.ObjectProperty(t.Identifier('start'), t.NumberLiteral(node.start)),
              t.ObjectProperty(t.Identifier('end'), t.NumberLiteral(node.end))
            ]))
          ]),
          t.Identifier('System'),
          ...isCaptured ? [t.Identifier(options.varRecorderName), t.StringLiteral(componentRef)] : []
        ]))
      );
    }
  });
}

function getExportDecls (scope) {
  return [...new Set(Object.values(scope.bindings).map(m => m.referencePaths.filter(m => m.parentPath.parentPath?.type.match(/ExportNamedDeclaration|ExportDefaultDeclaration/))).flat().map(m => m.parent))];
}

function evalCodeTransform (path, state, options) {
  // A: Rewrite the component definitions to create component descriptors.
  let { moduleName } = options;
  const renamedExports = {};
  if (state.opts.module) state.opts.module._renamedExports = renamedExports;

  getExportDecls(path.scope)
    .filter(stmt => stmt.local !== stmt.exported)
    .forEach(stmt => renamedExports[stmt.exported.name] = stmt.local?.name || stmt.imported?.name);

  let annotation = {};
  // FIXME: the entire name extraction stuff is extremely confusing. Why do we need to do
  //        this dance in the first place? Don't we always have a module in place that we
  //        can use to retrive the module name?
  // moduleName = ensureModuleName(options)

  processInlineCodeTransformOptions(path, options);

  if ((moduleName && moduleName.endsWith('cp.js') || options.wrapInStartEndCall) && state.file.code) {
    ensureComponentDescriptors(path, moduleName, options);
  }

  // 2. Annotate definitions with code location. This is being used by the
  // function-wrapper-source transform.
  options.scope = {
    classDecls: getClassDecls(path.scope),
    funcDecls: getFuncDecls(path.scope),
    refs: getRefs(path.scope),
    varDecls: getVarDecls(path.scope)
  };

  if (options.hasOwnProperty('evalId')) annotation.evalId = options.evalId;
  if (options.sourceAccessorName) annotation.sourceAccessorName = options.sourceAccessorName;
  if (options.addSourceMeta !== false) {
    [...options.scope.classDecls, ...options.scope.funcDecls].forEach(({ node }) => {
      node['x-lively-object-meta'] = { ...annotation, start: node.start, end: node.end };
      if (renamedExports.hasOwnProperty(node.id.name)) { node['x-lively-object-meta'] = { exportConflict: renamedExports[node.id.name] }; }
    });
    options.scope.refs.forEach(ref => {
      if (renamedExports.hasOwnProperty(ref.name)) { ref['x-lively-object-meta'] = { exportConflict: renamedExports[ref.name] }; }
    });
    options.scope.varDecls.forEach(({ node }) =>
      node.declarations.forEach(decl => {
        decl['x-lively-object-meta'] = { ...annotation, start: decl.start, end: decl.end };
        if (renamedExports.hasOwnProperty(decl.id.name)) {
          decl['x-lively-object-meta'].exportConflict = renamedExports[decl.id.name];
        }
      }));
  }

  // transforming experimental ES features into accepted es6 form...
  // This can be done by babel...
  // objectSpreadTransform(path);

  // 3. capture top level vars into topLevelVarRecorder "environment"

  if (!options.topLevelVarRecorder && options.topLevelVarRecorderName) {
    let G = getGlobal();
    if (options.topLevelVarRecorderName === 'GLOBAL') { // "magic"
      options.topLevelVarRecorder = getGlobal();
    } else {
      options.topLevelVarRecorder = Path(options.topLevelVarRecorderName).get(G);
    }
  }

  if (options.topLevelVarRecorder) {
    // capture and wrap logic
    let blacklist = (options.dontTransform || []).concat(['arguments']);
    let undeclaredToTransform = options.recordGlobals
      ? null/* all */ : arr.withoutAll(Object.keys(options.topLevelVarRecorder), blacklist);
    let varRecorder = t.Identifier(options.varRecorderName || '__lvVarRecorder');
    let es6ClassToFunctionOptions = null;

    if (options.declarationWrapperName || typeof options.declarationCallback === 'function') {
      // 2.1 declare a function that wraps all definitions, i.e. all var
      // decls, functions, classes etc that get captured will be wrapped in this
      // function. This allows to define some behavior that is run whenever
      // variables get initialized or changed as well as transform values.
      // The parameters passed are:
      //   name, kind, value, recorder
      // Note that the return value of declarationCallback is used as the
      // actual value in the code being executed. This allows to transform the
      // value as necessary but also means that declarationCallback needs to
      // return sth meaningful!
      let declarationWrapperName = options.declarationWrapperName || defaultDeclarationWrapperName;

      options.declarationWrapper = t.MemberExpression(
        t.Identifier(options.varRecorderName || '__lvVarRecorder'),
        t.StringLiteral(declarationWrapperName), true);

      if (options.declarationCallback) { options.topLevelVarRecorder[declarationWrapperName] = options.declarationCallback; }
    }

    let transformES6Classes = options.hasOwnProperty('transformES6Classes')
      ? options.transformES6Classes
      : true;
    if (transformES6Classes) {
      // Class declarations and expressions are converted into a function call
      // to `createOrExtendClass`, a helper that will produce (or extend an
      // existing) constructor function in a way that allows us to redefine
      // methods and properties of the class while keeping the class object
      // identical
      const scope = {
        decls: [],
        resolvedRefMap: new Map()
      };
      Object.values(path.scope.bindings).map(binding => {
        let decl = binding.path.node;
        if (decl.type === 'ImportSpecifier' || decl.type === 'ImportDefaultSpecifier') decl = binding.path.parent;
        scope.decls.push([decl, binding.identifier]); // this data format is just weird af?
        binding.referencePaths.forEach(ref => {
          scope.resolvedRefMap.set(ref.node, { decl, declId: binding.identifier, ref });
        });
      });
      es6ClassToFunctionOptions = {
        currentModuleAccessor: options.currentModuleAccessor,
        classHolder: varRecorder,
        functionNode: t.MemberExpression(varRecorder, defaultClassToFunctionConverter),
        declarationWrapper: options.declarationWrapper,
        evalId: options.evalId,
        sourceAccessorName: options.sourceAccessorName,
        scope,
        nodes: babelNodes,
        ...options.classToFunction,
        transform: (parsed, options) => {
          classToFunctionTransformBabel(path, state, options);
        }
      };
    }

    // 3.2 Here we call out to the actual code transformation that installs the captured top level vars
    rewriteToCaptureTopLevelVariables(
      path,
      // FIXME: this weird remapping should be removed, completely unnessecary
      {
        footer: options.footer,
        header: options.header,
        topLevel: options.topLevel,
        scope: options.scope,
        es6ImportFuncId: options.es6ImportFuncId,
        es6ExportFuncId: options.es6ExportFuncId,
        ignoreUndeclaredExcept: undeclaredToTransform,
        exclude: blacklist,
        captureObj: varRecorder,
        declarationWrapper: options.declarationWrapper || undefined,
        classToFunction: es6ClassToFunctionOptions,
        evalId: options.evalId,
        sourceAccessorName: options.sourceAccessorName,
        keepTopLevelVarDecls: options.keepTopLevelVarDecls
      });
  }

  if (options.wrapInStartEndCall) {
    wrapInStartEndCall(path, {
      startFuncNode: options.startFuncNode,
      endFuncNode: options.endFuncNode
    }, state.parsed);
  }

  if (options.sourceURL) {
    t.addComment(path.node, 'trailing', '# sourceURL=' + options.sourceURL.replace(/\s/g, '_'));
  }
}

function isMochaTest (scope) {
  return !!Object.values(scope.bindings).filter(binding => binding.path.type === 'ImportSpecifier').map(binding => binding.path.parentPath).find(binding => binding.get('source.extra.rawValue').node?.match(/(mocha-es6|mocha-es6\/index\.js)$/));
}

export function livelyPreTranspile (api, options) {
  let isGlobal = true;

  if (options.module) {
    const { module } = options;
    let {
      sourceAccessorName,
      recorder,
      recorderName,
      // dontTransform,
      varDefinitionCallbackName,
      embedOriginalCode = true
    } = module;

    isGlobal = recorderName === 'System.global';

    sourceAccessorName = embedOriginalCode ? sourceAccessorName : undefined;

    options = {
      ...options,
      moduleName: module.shortName(),
      topLevelVarRecorder: recorder,
      varRecorderName: recorderName,
      sourceAccessorName,
      dontTransform: [
        'global', 'self',
        '_moduleExport', '_moduleImport',
        'localStorage', // for Firefox, see fetch
        // doesn't like to be called as a method, i.e. __lvVarRecorder.fetch
        module.recorderName, module.sourceAccessorName,
        'prompt', 'alert', 'fetch', 'getComputedStyle'
      ].concat(query.knownGlobals),
      recordGlobals: true,
      declarationWrapperName: varDefinitionCallbackName,
      evalId: module.nextEvalId(),
      currentModuleAccessor: t.CallExpression(
        t.MemberExpression(
          t.CallExpression(
            t.MemberExpression(t.MemberExpression(t.Identifier(recorderName), t.Identifier('System')), t.Identifier('get')),
            [t.StringLiteral('@lively-env')]),
          t.Identifier('moduleEnv')),
        [t.StringLiteral(module.id)])
    };

    options.header = (options.header || '') + (options.debug ? `console.log("[lively.modules] executing module ${module.id}");\n` : '');
    options.footer = options.footer || '';
    if (isGlobal) {
    // FIXME how to update exports in that case?
      delete options.declarationWrapperName;
    }
  }

  return {
    visitor: {
      Program (path, state) {
        if (!isGlobal) {
          const { module, sourceAccessorName, varRecorderName } = options;
          options.header += `SystemJS.get("@lively-env").evaluationStart("${module.id}");\n` +
            `var ${varRecorderName} = SystemJS.get("@lively-env").moduleEnv("${module.id}").recorder;\n` +
            (sourceAccessorName ? `\nvar ${sourceAccessorName} = ${JSON.stringify(state.file.code)};\n` : '');
          options.footer += `\nSystemJS.get("@lively-env").evaluationEnd("${module.id}");`;
          // also check for the mocha test!
          if (!isMochaTest(path.scope)) options.dontTransform?.push(...Object.keys(path.scope.globals));
        }

        evalCodeTransform(path, state, options);
      }
    }
  };
}

function rewriteToRegisterModuleToCaptureSetters (path, state, options) {
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
    captureObj: t.Identifier(options.varRecorderName || '__rec'),
    exclude: [],
    declarationWrapper: undefined,
    ...options
  };

  const { _renamedExports: renamedExports = {} } = state.opts.module || {};

  const registerCall = path.get('body.0.expression');

  const printAst = () => babel.transformFromAstSync(path.node).code.slice(0, 300);
  if (registerCall.node.callee.object.name !== 'System') {
    throw new Error(`rewriteToRegisterModuleToCaptureSetters: input doesn't seem to be a System.register call: ${printAst()}...`);
  }
  if (registerCall.node.callee.property.name !== 'register') {
    throw new Error(`rewriteToRegisterModuleToCaptureSetters: input doesn't seem to be a System.register call: ${printAst()}...`);
  }
  const registerBody = registerCall.get('arguments.1.body.body');
  const registerReturn = arr.last(registerBody);

  if (registerReturn.node.type !== 'ReturnStatement') {
    throw new Error(`rewriteToRegisterModuleToCaptureSetters: input doesn't seem to be a System.register call, at return statement: ${printAst()}...`);
  }
  const setters = registerReturn.get('argument.properties').find(({ node: prop }) => prop.key.name === 'setters');
  if (!setters) {
    throw new Error(`rewriteToRegisterModuleToCaptureSetters: input doesn't seem to be a System.register call, at finding setters: ${printAst()}...`);
  }
  const execute = registerReturn.get('argument.properties').find(({ node: prop }) => prop.key.name === 'execute');
  if (!execute) {
    throw new Error(`rewriteToRegisterModuleToCaptureSetters: input doesn't seem to be a System.register call, at finding execute: ${printAst()}...`);
  }

  path.get('directives').find(d => d.get('value.value').node === 'format esm')?.remove(); // remove esm directive if still present

  // in each setter function: intercept the assignments to local vars and inject capture object
  setters.get('value.elements').forEach(pathToFun => {
    const fun = pathToFun.node;
    pathToFun.replaceWith(t.FunctionExpression(fun.id, [t.AssignmentPattern(fun.params[0], t.ObjectExpression([]))], t.BlockStatement(fun.body.body.map(stmt => {
      if (stmt.type !== 'ExpressionStatement' ||
       stmt.expression.type !== 'AssignmentExpression' ||
       stmt.expression.left.type !== 'Identifier' ||
       options.exclude.includes(stmt.expression.left.name)) return stmt;

      const id = stmt.expression.left;
      if (renamedExports.hasOwnProperty(id.name)) {
        id['x-lively-object-meta'] = { exportConflict: renamedExports[id.name] };
      }
      // FIXME: at this point, we lost the info about the renamed export from preTranspile... how do we get that info to here?
      const rhs = options.declarationWrapper
        ? declarationWrapperCall(
          options.declarationWrapper,
          id,
          t.StringLiteral(id.name),
          t.StringLiteral('var'),
          stmt.expression,
          options.captureObj,
          options)
        : stmt.expression;
      return t.ExpressionStatement(t.AssignmentExpression('=', t.MemberExpression(options.captureObj, id), rhs));
    }))));
  });
  const execFunctionBody = execute.get('value.body.body');
  let captureInitialize = execFunctionBody.find(({ node: stmt }) =>
    stmt.type === 'ExpressionStatement' &&
                         stmt.expression.type === 'AssignmentExpression' &&
                         stmt.expression.left.name === options.captureObj.name) || execFunctionBody.find(({ node: stmt }) =>
    stmt.type === 'VariableDeclaration' &&
                         stmt.declarations[0].id &&
                         stmt.declarations[0].id.name === options.captureObj.name);

  if (captureInitialize) {
    registerBody[0].insertAfter(captureInitialize.node);
    captureInitialize.remove();
  }

  // FIXME: is this ever a thing?
  if (options.sourceAccessorName) {
    let origSourceInitialize = execFunctionBody.find(stmt =>
      stmt.type === 'ExpressionStatement' &&
                           stmt.expression.type === 'AssignmentExpression' &&
                           stmt.expression.left.name === options.sourceAccessorName) ||
      execFunctionBody.find(stmt =>
        stmt.type === 'VariableDeclaration' &&
                           stmt.declarations[0].id &&
                           stmt.declarations[0].id.name === options.sourceAccessorName);
    if (origSourceInitialize) {
      registerBody[0].insertAfter(origSourceInitialize.node);
      origSourceInitialize.remove();
    }
  }
}

export function livelyPostTranspile (api, options) {
  if (options.module) {
    const { module, debug } = options;
    const captureObj = t.Identifier(module.recorderName);
    options = {
      captureObj,
      topLevelVarRecorder: module.recorder,
      dontTransform: module.dontTransform,
      declarationWrapper: t.MemberExpression(
        captureObj,
        t.StringLiteral(module.varDefinitionCallbackName), true)
    };
  }

  return {
    visitor: {
      Program: {
        exit (path, state) {
          if (!options.topLevelVarRecorder) {
            path.stop();
            return;
          }

          let blacklist = (options.dontTransform || []).concat(['arguments']);
          rewriteToRegisterModuleToCaptureSetters(path, state, { exclude: blacklist, ...options });
        }
      }
    }
  };
}

export function livelyModuleLoadTranspile (api, options) {
  return {
    visitor: {
      CallExpression (path, state) {
        if (path.get('callee.property').node?.name === 'register') {
          options.depNames.push(...path.node.arguments[0].elements.map(ea => ea.value));
          const declareFuncNode = path.node.arguments[1];
          const body = path.parentPath;
          // maybe need to be all wrapped in expression statements?
          body.replaceWithMultiple([
            varDecl('SystemJS', t.Identifier('System')),
            varDecl('__moduleName', t.StringLiteral(options.module.fullName())),
            t.ExpressionStatement(declareFuncNode)
          ]);
          t.addComment(body.node, 'trailing', '# sourceURL=' + options.module.fullName());

          path.stop(); // do not proceed with anything
        }
      }
    }
  };
}

class BabelTranspiler {
  constructor (System, moduleId, env) {
    this.System = System;
    this.moduleId = moduleId;
    this.env = env;
  }

  transpileDoit (source, options) {
    // wrap in async function so we can use await top-level
    let System = this.System;
    var source = '(async function(__rec) {\n' + source.replace(/(\/\/# sourceURL=.+)$|$/, '\n}).call(this);\n$1'); // eslint-disable-line no-var
    let opts = System.babelOptions;
    let needsBabel = (opts.plugins && opts.plugins.length) || (opts.presets && opts.presets.length);
    return needsBabel
      ? System.global.babel.transform(source, opts).code
      : source;
  }

  transpileModule (source, options) {
    let System = this.System;
    let opts = Object.assign({}, System.babelOptions);
    opts.sourceFileName = options.module?.id;
    opts.plugins = opts.plugins ? opts.plugins.slice() : [
      [livelyPreTranspile, options],
      systemjsTransform,
      // choose either one
      options.esmLoad ? [livelyModuleLoadTranspile, options] : [livelyPostTranspile, options]
    ];
    return babel.transform(source, opts);
  }
}
// setupBabelTranspiler(System)
export function setupBabelTranspiler (System) {
  function translate (load, opts) {
    const { code, map } = new BabelTranspiler(this, load.name, {}).transpileModule(load.source, { ...opts, module: load.metadata.module });
    load.metadata.sourceMap = map;
    return code;
  }
  System.set('lively.transpiler.babel', System.newModule({ default: BabelTranspiler, translate }));
  System._loader.transpilerPromise = Promise.resolve({ translate });
  System.translate = async (load, opts) => await translate.bind(System)(load, opts);
  System.config({
    transpiler: 'lively.transpiler.babel',
    babelOptions: {
      sourceMaps: true,
      // inputSourceMap: true,
      compact: false,
      comments: true,
      presets: []
    }
  });
}
