import { parse, query, nodes } from 'lively.ast';
const { id, literal, member, assign, exprStmt, funcCall } = nodes;

// Supplemental freezer captures after scope rewriting; mirrors
// ExportedImportCapturePass in Rust. Import/export bindings stay local.
export function insertCapturesForExportedImports (parsed, options) {
  const usedNames = new Set(query.topLevelDeclsAndRefs(parsed).declaredNames);
  const recorder = options.captureObj;
  let captureId = 0;

  function validIdentifier (name) {
    try {
      const body = parse(`var ${name};`).body;
      return body.length === 1 && body[0].declarations?.[0].id.name === name;
    } catch (_) { return false; }
  }
  function uniqueName (hint) {
    let name = hint;
    let suffix = 1;
    while (usedNames.has(name)) name = hint.replace(/_\d+$/, '') + '_' + (++suffix);
    usedNames.add(name);
    return name;
  }
  function capture (key, name) {
    const computed = !validIdentifier(key) && key !== 'default';
    return exprStmt(assign(member(recorder, computed ? literal(key) : id(key), computed), id(name)));
  }
  function namedFromSource (stmt, specifiers) {
    const imports = [], exports = [], captures = [];
    for (const { imported, exported } of specifiers) {
      const exportedName = exported.name ?? exported.value;
      const importedName = imported && (imported.name ?? imported.value);
      const hint = exportedName === 'default'
        ? (importedName && importedName !== 'default' ? importedName : '_default')
        : exportedName;
      const local = uniqueName(validIdentifier(hint) ? hint : '__reexport__');
      imports.push(imported
        ? { type: 'ImportSpecifier', local: id(local), imported }
        : { type: 'ImportNamespaceSpecifier', local: id(local) });
      exports.push({ type: 'ExportSpecifier', local: id(local), exported });
      captures.push(capture(exportedName, local));
      if (importedName === 'default' && importedName !== exportedName) captures.push(capture('default', local));
      else if (exportedName === 'default' && importedName !== exportedName) captures.push(capture(importedName, local));
    }
    return [
      { type: 'ImportDeclaration', specifiers: imports, source: stmt.source, attributes: stmt.attributes },
      { type: 'ExportNamedDeclaration', declaration: null, source: null, specifiers: exports },
      ...captures
    ];
  }

  parsed.body = parsed.body.flatMap(stmt => {
    if (stmt.type === 'ExportNamedDeclaration') {
      if (stmt.source) return namedFromSource(stmt, stmt.specifiers.map(spec => ({ imported: spec.local, exported: spec.exported })));
      const captures = [];
      if (stmt.declaration?.type === 'VariableDeclaration') {
        for (const binding of query.helpers.declIds(stmt.declaration.declarations.map(decl => decl.id))) {
          captures.push(capture(binding.name, binding.name));
        }
      } else if (!stmt.declaration) {
        for (const specifier of stmt.specifiers) {
          if ((specifier.exported.name ?? specifier.exported.value) === 'default') captures.push(capture('default', specifier.local.name));
          if (specifier.local.name !== 'default') captures.push(capture(specifier.local.name, specifier.local.name));
        }
      }
      return [stmt, ...captures];
    }
    if (stmt.type === 'ExportAllDeclaration') {
      if (stmt.exported) return namedFromSource(stmt, [{ imported: null, exported: stmt.exported }]);
      const name = uniqueName(`__captured${++captureId}__`);
      return [stmt,
        { type: 'ImportDeclaration', specifiers: [{ type: 'ImportNamespaceSpecifier', local: id(name) }], source: stmt.source, attributes: stmt.attributes },
        exprStmt(funcCall(member(id('Object'), id('assign')), recorder, id(name)))];
    }
    return [stmt];
  });
  return parsed;
}
