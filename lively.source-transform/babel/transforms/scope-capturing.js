import { babel, t } from '../ast.js';
import { arr } from 'lively.lang';
import { splitExportDeclarations } from './export-split.js';
import { insertCapturesForImportAndExportDeclarations } from './exported-import-capture.js';
import { varDecl, declarationWrapperCall, annotationSym, assignExpr, transformPattern, generateUniqueName, varDeclAndImportCall, importCallStmt, shouldDeclBeCaptured, importCall, exportCallStmt, exportFromImport, additionalIgnoredDecls, additionalIgnoredRefs } from '../helpers.js';

function getVarDecls (scope) {
  return new Set(Object.values(scope.bindings).filter(decl => decl.kind !== 'module' && decl.kind !== 'hoisted').map(m => m.path.parentPath).filter(node => node.type === 'VariableDeclaration'));
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

function analyzeParsed (path, options, footer, header) {
  const undeclaredNames = Object.keys(path.scope.globals);
  const varDecls = getVarDecls(path.scope);
  const catches = [];

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

function getRefs (scope, options) {
  const bindings = Object.values(scope.bindings);
  const globalRefs = [];
  scope.traverse(scope.block, {
    AssignmentExpression (path) {
      for (const target of extractRef(path.get('left'))) {
        if (scope.globals[target.node.name]) globalRefs.push(target.node);
      }
    },
    ReferencedIdentifier (path) {
      if (scope.globals[path.node.name]) {
        globalRefs.push(path.node);
      }
    }
  });
  const exportRe = /ExportDefaultDeclaration|ExportNamedDeclaration|ExportSpecifier/;
  function extractRef (ref) {
    if (!ref.node) return [];
    if (ref.type === 'ObjectPattern') return ref.get('properties').flatMap(property =>
      extractRef(property.get(property.type === 'RestElement' ? 'argument' : 'value')));
    if (ref.type === 'ArrayPattern') return ref.get('elements').flatMap(extractRef);
    if (ref.type === 'AssignmentPattern') return extractRef(ref.get('left'));
    if (ref.type === 'RestElement') return extractRef(ref.get('argument'));
    return ref.type === 'Identifier' ? [ref] : [];
  }

  return bindings.map(binding =>
    binding.referencePaths
      .filter(path => !path.parentPath.type.match(exportRe) && !path.type.match(exportRe))
      .concat(binding.constantViolations.filter(path => path.type === 'AssignmentExpression').map(path => path.get('left')).map(extractRef)).flat())
    .flat().map(m => m.node).concat(globalRefs).filter(ref => !options?.excludeRefs.includes(ref.name));
}

function es6ModuleTransforms (path, options) {
  let moduleId;
  path.traverse({
    ExportNamedDeclaration (path) {
      const stmt = path.node;
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
}

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

function ensureGlobalBinding (ref, options) {
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

// Mirror the ESTree and SWC assignment-target walk; retain native destructuring.
function captureAssignmentPattern (pattern, refsToReplace, options) {
  if (!pattern) return pattern;
  if (pattern.type === 'Identifier' && refsToReplace.has(pattern)) {
    const target = t.MemberExpression(options.captureObj, t.Identifier(pattern.name));
    if (!options.declarationWrapper) return target;
    let valueName = '__lively_assignment_value__';
    while (JSON.stringify(options.declarationWrapper).includes(valueName)) valueName += '_';
    const value = t.Identifier(valueName);
    const setter = t.ObjectMethod('set', t.Identifier('value'), [value], t.BlockStatement([
      t.ExpressionStatement(t.AssignmentExpression('=', target,
        declarationWrapperCall(options.declarationWrapper, null, t.StringLiteral(pattern.name),
          t.StringLiteral('assignment'), value, options.captureObj, options)))
    ]));
    return t.MemberExpression(t.ObjectExpression([setter]), t.Identifier('value'));
  }
  if (pattern.type === 'ArrayPattern') return {...pattern, elements: pattern.elements.map(element => captureAssignmentPattern(element, refsToReplace, options))};
  if (pattern.type === 'ObjectPattern') return {...pattern, properties: pattern.properties.map(property =>
    property.type === 'RestElement'
      ? captureAssignmentPattern(property, refsToReplace, options)
      : {...property, shorthand: false, key: property.computed ? property.key : {...property.key}, value: captureAssignmentPattern(property.value, refsToReplace, options)})};
  if (pattern.type === 'RestElement') return {...pattern, argument: captureAssignmentPattern(pattern.argument, refsToReplace, options)};
  if (pattern.type === 'AssignmentPattern') return {...pattern, left: captureAssignmentPattern(pattern.left, refsToReplace, options)};
  return pattern;
}

function replaceVarDeclsAndRefs (path, options) {
  const globalInitStmt = '_global = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : global';
  const refsToReplace = new Set(options.scope.refs.filter(ref => !options?.excludeRefs.includes(ref.name) && path.scope.bindings[ref.name]?.kind !== 'module'));
  const varDeclsToReplace = getVarDecls(path.scope);
  const declaredNames = Object.keys(path.scope.bindings);
  const currentModuleAccessor = options.classToFunction?.currentModuleAccessor;
  let globalDeclarationFound = false;

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
    },
    LogicalExpression (path) {
      if (globalDeclarationFound && path.node.right.name === '_global') {
        path.replaceWith(path.node.left);
        path.skip();
      }
    },
    Identifier (path) {
      const { node } = path;
      if (refsToReplace.has(node)) {
        const newNode = t.MemberExpression(options.captureObj, node);
        newNode.loc = node.loc;
        path.replaceWith(newNode);
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
        return;
      }
      if (/^(Object|Array)Pattern$/.test(node.left.type)) {
        path.get('left').replaceWith(captureAssignmentPattern(node.left, refsToReplace, options));
      }
    },
    VariableDeclarator (path) {
      if (!globalDeclarationFound && path.node.id.name === '_global') {
        globalDeclarationFound = path.getSource() === globalInitStmt;
      }
    },
    VariableDeclaration (path) {
      if (!varDeclsToReplace.has(path) ||
           path.node.declarations.every(decl => !shouldDeclBeCaptured(decl, options))) {
        return;
      }

      const replaced = []; const { node } = path;
      for (let i = 0; i < node.declarations.length; i++) {
        const decl = node.declarations[i];

        if (!shouldDeclBeCaptured(decl, options)) {
          replaced.push(t.VariableDeclaration(node.kind || 'var', [decl]));
          continue;
        }

        let init = ensureGlobalBinding(path.get('declarations.' + i + '.init'), options) || t.ConditionalExpression(
          t.CallExpression(t.MemberExpression(t.MemberExpression(t.MemberExpression(t.Identifier('Object'), t.Identifier('prototype')), t.Identifier('hasOwnProperty')), t.Identifier('call')), [options.captureObj, t.StringLiteral(decl.id.name)]),
          t.MemberExpression(options.captureObj, decl.id), t.Identifier('undefined'));

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
            decl[annotationSym] && decl[annotationSym].capture &&
            shouldDeclBeCaptured(decl.declarations[0], options)
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
        rewrittenDecl.loc = decl.loc;
        // This is rewriting normal vars
        replaced.push(rewrittenDecl);

        if (options.keepTopLevelVarDecls) {
          replaced.push(varDecl(decl.id, t.MemberExpression(options.captureObj, decl.id)));
        }
      }

      if (path.parent.type === 'IfStatement') {
        path.replaceWith(t.BlockStatement(replaced));
        return;
      }

      if (replaced.length > 1) path.replaceWithMultiple(replaced); // this seems to fuck up the source map?
      else path.replaceWith(replaced[0]);
    }
  });
}

function clearEmptyExports (path) {
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
        decl,
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
      parentPath.replaceWith(t.ExportNamedDeclaration(null, [t.ExportSpecifier(funcId, funcId)], null));
    } else if (parentPath.type === 'ExportDefaultDeclaration') {
      parentPath.replaceWith(t.ExportDefaultDeclaration(funcId));
    }

    // hoist the function to the front, also it's capture
    putInFront.unshift(assignExpr(options.captureObj, funcId, init, false));
    putInFront.unshift(declFront);
  }
  path.unshiftContainer('body', putInFront);
}

export function rewriteToCaptureTopLevelVariables (path, options) {
  let footer = [];
  let header = [];

  options = sanitizeOptions(options);

  options = analyzeParsed(path, options, footer, header);

  if (options.es6ExportFuncId) {
    es6ModuleTransforms(path, options);
    path.scope.crawl();
    options.scope.refs = getRefs(path.scope, options);
  }

  replaceVarDeclsAndRefs(path, options);

  clearEmptyExports(path, options);

  replaceClassDecls(path, options);

  splitExportDeclarations(path, options);

  path.scope.crawl();

  insertCapturesForImportAndExportDeclarations(path, options);

  putFunctionDeclsInFront(path, options);
  path.scope.crawl();

  path.unshiftContainer('body', header);
  path.pushContainer('body', footer);

  return options;
}

export function getScopeFromPath (path) {
  return {
    classDecls: getClassDecls(path.scope),
    funcDecls: getFuncDecls(path.scope),
    refs: getRefs(path.scope),
    varDecls: getVarDecls(path.scope)
  };
}
