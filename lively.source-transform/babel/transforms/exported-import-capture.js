import { t } from '../ast.js';
import { arr } from 'lively.lang';
import { assignExpr, declarationWrapperCall, varDeclOrAssignment, generateUniqueName } from '../helpers.js';

export function insertCapturesForImportAndExportDeclarations (path, options) {
  let i = 0;
  const declaredNames = new Set(Object.keys(path.scope.bindings));
  function handleDeclarations (path) {
    const stmt = path.node;
    path.insertAfter(stmt.declaration.declarations.map(decl => {
      let assignVal = decl.id;
      if (options.declarationWrapper) {
        const alreadyWrapped = decl.init?.callee &&
                            decl.init?.callee.name === options.declarationWrapper.name;
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

      if (stmt.specifiers.length && stmt.source) {
        const specifiers = stmt.specifiers;
        let paths = path.replaceWithMultiple([
          t.ImportDeclaration(specifiers.map(spec => {
            if (spec.local.name === 'default' && spec.exported.name === 'default') {
              return t.ImportSpecifier(t.Identifier(`__default${++i}__`), t.Identifier('default'));
            } else if (spec.local.name !== spec.exported.name && spec.exported.name === 'default') {
              spec.shadow = `__default${++i}__`;
              return t.ImportSpecifier(t.Identifier(spec.shadow), t.Identifier(spec.local.name));
            } else if (spec.local.name !== spec.exported.name && spec.local.name === 'default') {
              spec.shadow = generateUniqueName(declaredNames, spec.exported.name);
              return t.ImportSpecifier(t.Identifier(spec.shadow), t.Identifier(spec.local.name));
            } else if (spec.local.name !== spec.exported.name) {
              spec.shadow = generateUniqueName(declaredNames, spec.exported.name);
              return t.ImportSpecifier(t.Identifier(spec.shadow), t.Identifier(spec.local.name));
            } else {
              spec.shadow = generateUniqueName(declaredNames, `__${spec.local.name}__`);
              return t.ImportSpecifier(t.Identifier(spec.shadow), t.Identifier(spec.local.name));
            }
          }).filter(Boolean), t.StringLiteral(stmt.source.value)),
          t.ExportNamedDeclaration(null, specifiers.map(spec => {
            if (spec.local.name === 'default' && spec.exported.name === 'default') {
              return t.ExportSpecifier(t.Identifier(`__default${i}__`), t.Identifier('default'));
            }
            declaredNames.add(spec.shadow);
            return t.ExportSpecifier(t.Identifier(spec.shadow), t.Identifier(spec.exported.name));
          }).filter(Boolean))
        ]);

        for (let spec of specifiers) {
          if (spec.local.name === 'default' && spec.exported.name === 'default') { paths[0].insertAfter(assignExpr(options.captureObj, t.Identifier('default'), t.Identifier(`__default${i}__`), false)); } else { paths[0].insertAfter(assignExpr(options.captureObj, t.Identifier(spec.exported.name), t.Identifier(spec.shadow), false)); }
        }

        paths.forEach(path => path.skip());
      }
    },
    ExportDefaultDeclaration (path) {
      const stmt = path.node;
      if (!stmt.declaration) return;
      if (stmt.declaration.type.match(/StringLiteral|NumericLiteral|DecimalLiteral/)) {
        // default export of an unnamed primitive value, i.e.
        // "export default "foo"", "export default 27;"
        const refId = generateUniqueName(declaredNames, '$exportedLiteral');
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
