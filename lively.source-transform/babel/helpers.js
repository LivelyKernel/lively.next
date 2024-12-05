import t from '@babel/types';
import { helpers } from 'lively.ast/lib/query.js';
import { Path } from 'lively.lang';

export function getAncestryPath (path) {
  return path.getAncestry().map(m => m.inList ? [m.key, m.listKey] : m.key).flat().slice(0, -1).reverse();
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// code generation helpers
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function varDecl (name, init = null, kind = 'var') {
  if (typeof name === 'string') name = t.Identifier(name);
  return t.VariableDeclaration(kind, [t.VariableDeclarator(name, init)]);
}

export function varDeclOrAssignment (declaredNames, id, init, kind) {
  const name = id.name;
  return declaredNames.has(name)
    // only create a new declaration if necessary
    ? t.ExpressionStatement(t.AssignmentExpression('=', id, init))
    : varDecl(id, init, kind || 'var');
}

export function assignExpr (assignee, propId, value, computed) {
  return t.ExpressionStatement(
    t.AssignmentExpression('=',
      t.MemberExpression(assignee, propId, computed),
      value || t.Identifier('undefined')));
}

export function importCall (imported, moduleSource, moduleImportFunc) {
  if (typeof imported === 'string') imported = t.StringLiteral(imported);
  return {
    arguments: [moduleSource].concat(imported || []),
    callee: moduleImportFunc,
    type: 'CallExpression'
  };
}

export function varDeclAndImportCall (localId, imported, moduleSource, moduleImportFunc) {
  return varDecl(localId, importCall(imported, moduleSource, moduleImportFunc));
}

export function importCallStmt (imported, moduleSource, moduleImportFunc) {
  return t.ExpressionStatement(importCall(imported, moduleSource, moduleImportFunc));
}

function exportCall (exportFunc, local, exportedObj) {
  if (typeof local === 'string') local = t.StringLiteral(local);
  exportedObj = { ...exportedObj }; // this wont work with recast nodes
  return t.CallExpression(exportFunc, [local, exportedObj]);
}

export function exportFromImport (keyLeft, keyRight, moduleId, moduleExportFunc, moduleImportFunc) {
  return exportCall(moduleExportFunc, keyLeft, importCall(keyRight, moduleId, moduleImportFunc));
}

export function exportCallStmt (exportFunc, local, exportedObj) {
  return t.ExpressionStatement(exportCall(exportFunc, local, exportedObj));
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// naming
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export function generateUniqueName (declaredNames, hint) {
  let unique = hint; let n = 1;
  if (!declaredNames.has) declaredNames = new Set(declaredNames);
  while (declaredNames.has(unique)) {
    if (n > 1000) throw new Error('Endless loop searching for unique variable ' + unique);
    unique = unique.replace(/_[0-9]+$|$/, '_' + (++n));
  }
  return unique;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// capturing oobject patters / destructuring
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export const annotationSym = Symbol.for('lively.ast-destructuring-transform');

function transformArrayPattern (pattern, transformState) {
  const declaredNames = transformState.declaredNames;
  const p = annotationSym;
  const transformed = [];

  for (let i = 0; i < pattern.elements.length; i++) {
    const el = pattern.elements[i];

    // like [a]
    if (el.type === 'Identifier') {
      let decl = varDecl(el, t.MemberExpression(transformState.parent, t.Identifier(String(i)), true));
      decl[p] = { capture: true };
      transformed.push(decl);

    // like [...foo]
    } else if (el.type === 'RestElement') {
      let decl = varDecl(el.argument, {
        type: 'CallExpression',
        arguments: [t.NumberLiteral(i)],
        callee: t.MemberExpression(transformState.parent, t.Identifier('slice'), false)
      });
      decl[p] = { capture: true };
      transformed.push(decl);
    } else if (el.type === 'AssignmentPattern') {
      // like [x = 23]
      let decl = varDecl(
        el.left/* id */,
        t.ConditionalExpression(
          t.BinaryExpression('===', t.MemberExpression(transformState.parent, t.Identifier(String(i)), true), t.Identifier('undefined')),
          el.right,
          t.MemberExpression(transformState.parent, t.NumberLiteral(i), true)));
      decl[p] = { capture: true };
      transformed.push(decl);

    // like [{x}]
    } else {
      const helperVarId = t.Identifier(generateUniqueName(declaredNames, transformState.parent.name + '$' + i));
      const helperVar = varDecl(helperVarId, t.MemberExpression(transformState.parent, t.NumberLiteral(i), true));
      // helperVar[p] = {capture: true};
      declaredNames.push(helperVarId.name);
      transformed.push(helperVar);
      transformed.push(...transformPattern(el, { parent: helperVarId, declaredNames })); // eslint-disable-line no-use-before-define
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

    if (prop.type === 'RestElement') {
      const knownKeys = pattern.properties.map(ea => ea.key && ea.key.name).filter(Boolean);
      let decl = varDecl(prop.argument.name, t.ObjectExpression([]));
      const captureDecl = varDecl(prop.argument.name, t.Identifier(prop.argument.name));
      const defCall = t.ExpressionStatement(t.CallExpression(t.FunctionExpression(null, [],
        t.BlockStatement([
          t.ForInStatement(varDecl('__key'), transformState.parent,
            t.BlockStatement(
              [...(knownKeys.length
                ? knownKeys.map(knownKey =>
                  t.IfStatement(
                    t.BinaryExpression('===', t.Identifier('__key'), t.StringLiteral(knownKey)),
                    t.ContinueStatement(null), null))
                : []),
              t.ExpressionStatement(
                t.AssignmentExpression('=',
                  t.MemberExpression(t.Identifier(prop.argument.name), t.Identifier('__key'), true),
                  t.MemberExpression(transformState.parent, t.Identifier('__key'), true)))]
            ))])), []));

      captureDecl[p] = { capture: true };
      transformed.push(decl, captureDecl, defCall);
    } else if (prop.value.type === 'Identifier') {
      // like {x: y}
      let decl = varDecl(prop.value, t.MemberExpression(transformState.parent, prop.key));
      decl[p] = { capture: true };
      transformed.push(decl);
    } else if (prop.value.type === 'AssignmentPattern') {
      // like {x = 23}
      let decl = varDecl(
        prop.value.left/* id */,
        t.ConditionalExpression(
          t.BinaryExpression('===', t.MemberExpression(transformState.parent, prop.key), t.Identifier('undefined')),
          prop.value.right,
          t.MemberExpression(transformState.parent, prop.key)));
      decl[p] = { capture: true };
      transformed.push(decl);
    } else {
      // like {x: {z}} or {x: [a]}
      const helperVarId = t.Identifier(generateUniqueName(
        declaredNames,
        transformState.parent.name + '$' + prop.key.name));
      const helperVar = varDecl(helperVarId, t.MemberExpression(transformState.parent, prop.key));
      helperVar[p] = { capture: false };
      declaredNames.push(helperVarId.name);
      transformed.push(
        ...[helperVar].concat(
          transformPattern(prop.value, { parent: helperVarId, declaredNames: declaredNames }))); // eslint-disable-line no-use-before-define
    }
  }

  return transformed;
}

export function transformPattern (pattern, transformState) {
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

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// replacement helpers
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export function shouldDeclBeCaptured (decl, options) {
  return options.excludeDecls.indexOf(decl.id.name) === -1 &&
    options.excludeDecls.indexOf(decl.id) === -1 &&
    (!options.includeDecls || options.includeDecls.indexOf(decl.id.name) > -1);
}

export function shouldRefBeCaptured (ref, options) {
  const { topLevel } = options;
  if (topLevel.scope.importSpecifiers.includes(ref)) return false;
  for (let i = 0; i < topLevel.scope.exportDecls.length; i++) {
    const ea = topLevel.scope.exportDecls[i];
    if (ea.declarations && ea.declarations.includes(ref)) return false;
    if (ea.declaration === ref) return false;
  }
  if (options.excludeRefs.includes(ref.object?.name)) return false;
  if (options.excludeRefs.includes(ref.name)) return false;
  if (options.includeRefs && !options.includeRefs.includes(ref.name)) return false;
  return true;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// exclude / include helpers
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export function additionalIgnoredDecls ({ varDecls, catches }) {
  // const { topLevel } = options;
  const ignoreDecls = [];
  varDecls.forEach(pathToNode => {
    const decl = pathToNode.node;
    const parent = pathToNode.parentPath;
    if (parent.type === 'ForStatement' ||
     parent.type === 'ForInStatement' ||
     parent.type === 'ForOfStatement' ||
     parent.type === 'ExportNamedDeclaration'
    ) ignoreDecls.push(...decl.declarations);
  });

  return catches.map(ea => ea.name)
    .concat(ignoreDecls.map(ea => {
      if (ea.id.type === 'ArrayPattern') return ea.id;
      else if (ea.id.type === 'ObjectPattern') return ea.id;
      return ea.id.name;
    }).flat());
}

export function additionalIgnoredRefs ({ varDecls, catches, importSpecifiers }, options) {
  const ignoreDecls = [];
  varDecls.forEach(pathToNode => {
    const decl = pathToNode.node;
    const parent = pathToNode.parentPath;
    if (parent.type === 'ForStatement' ||
     parent.type === 'ForInStatement' ||
     parent.type === 'ForOfStatement'
    ) ignoreDecls.push(...decl.declarations);
  });

  return catches.map(ea => ea.name)
    .concat(helpers.declIds(ignoreDecls.map(ea => ea.id || ea.name))
      .concat(options.captureImports ? [] : importSpecifiers)
      .map(ea => ea.name));
}

export function declarationWrapperCall (
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
    let start; let end; let evalId; let sourceAccessorName; let exportConflict;
    if (declNode['x-lively-object-meta']) {
      ({ start, end, evalId, sourceAccessorName, exportConflict } = declNode['x-lively-object-meta']);
    }
    if (start !== undefined) keyVals.push(t.ObjectProperty(t.Identifier('start'), t.NumberLiteral(start)));
    if (end !== undefined) keyVals.push(t.ObjectProperty(t.Identifier('end'), t.NumberLiteral(end)));
    if (exportConflict !== undefined) keyVals.push(t.ObjectProperty(t.Identifier('exportConflict'), t.StringLiteral(exportConflict)));
    if (evalId === undefined && options.hasOwnProperty('evalId')) {
      evalId = options.evalId;
    }
    if (sourceAccessorName === undefined && options.hasOwnProperty('sourceAccessorName')) {
      sourceAccessorName = options.sourceAccessorName;
    }

    if (evalId !== undefined) keyVals.push(t.ObjectProperty(t.Identifier('evalId'), t.NumberLiteral(evalId)));
    if (sourceAccessorName) keyVals.push(t.ObjectProperty(t.Identifier('moduleSource'), t.Identifier(sourceAccessorName)));
    if (keyVals.length > 0) {
      return t.CallExpression(
        declarationWrapperNode, [varNameLiteral, varKindLiteral, valueNode, recorder,
          t.ObjectExpression(keyVals)/* meta node */]);
    }
  }

  return t.CallExpression(declarationWrapperNode, [varNameLiteral, varKindLiteral, valueNode, recorder]);
}
