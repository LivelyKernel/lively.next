import { t } from '../ast.js';
import { generateUniqueName } from '../helpers.js';

const exportName = node => node.name ?? node.value;
const runtime = () => t.logicalExpression('||', t.memberExpression(t.identifier('lively'), t.identifier('FreezerRuntime')), t.memberExpression(t.identifier('lively'), t.identifier('frozenModules')));
const runtimeCall = (method, source) => t.callExpression(t.memberExpression(runtime(), t.identifier(method)), [t.stringLiteral(source)]);
const fallback = (name, source, namespace) => t.variableDeclaration('const', [t.variableDeclarator(t.identifier(name), t.logicalExpression('||', runtimeCall('exportsOf', source), t.identifier(namespace)))]);

function insertDeclarations (path, declarations) {
  const body = path.node.body;
  const index = body.findIndex(node => !t.isImportDeclaration(node) && !t.isExportAllDeclaration(node));
  body.splice(index < 0 ? body.length : index, 0, ...declarations);
  path.scope.crawl();
}

export function replaceImportedNamespaces (path, moduleName, bundler, options = {}) {
  const declarations = [];
  const used = new Set(Object.keys(path.scope.bindings));
  options.exclude ||= [];
  for (const node of path.node.body) {
    if (!t.isImportDeclaration(node) || node.importKind === 'type') continue;
    const namespace = node.specifiers.find(specifier => t.isImportNamespaceSpecifier(specifier));
    if (!namespace) continue;
    const name = namespace.local.name;
    const alias = generateUniqueName(used, name + '_namespace');
    used.add(alias);
    const resolved = bundler.normalizedId(bundler.resolveId(node.source.value, moduleName));
    namespace.local = t.identifier(alias);
    options.exclude.push(alias);
    declarations.push(fallback(name, resolved || node.source.value, alias));
  }
  insertDeclarations(path, declarations);
}

export function replaceExportedNamespaces (path, moduleName, bundler, options = {}) {
  const declarations = [];
  const used = new Set(Object.keys(path.scope.bindings));
  options.exclude ||= [];
  let counter = 0;
  path.node.body = path.node.body.map(node => {
    const namespace = t.isExportNamedDeclaration(node) && node.source && node.specifiers.length === 1 && t.isExportNamespaceSpecifier(node.specifiers[0]) ? node.specifiers[0].exported : t.isExportAllDeclaration(node) ? node.exported : null;
    if (!namespace && !t.isExportAllDeclaration(node)) return node;
    if (node.exportKind === 'type') return node;
    const resolved = bundler.normalizedId(bundler.resolveId(node.source.value, moduleName)) || node.source.value;
    if (namespace) {
      const exported = exportName(namespace);
      const name = generateUniqueName(used, t.isValidIdentifier(exported) ? exported : 'namespace');
      used.add(name);
      const alias = generateUniqueName(used, name + '_namespace');
      used.add(alias);
      options.exclude.push(alias);
      declarations.push(fallback(name, resolved, alias), t.exportNamedDeclaration(null, [t.exportSpecifier(t.identifier(name), t.cloneNode(namespace))]));
      const imported = t.importDeclaration([t.importNamespaceSpecifier(t.identifier(alias))], t.cloneNode(node.source));
      imported.attributes = node.attributes;
      return imported;
    }
    const alias = generateUniqueName(used, 'tmp_' + (++counter));
    used.add(alias);
    options.exclude.push(alias);
    const imported = t.importDeclaration([t.importNamespaceSpecifier(t.identifier(alias))], t.cloneNode(node.source));
    imported.attributes = node.attributes;
    declarations.push(imported, t.expressionStatement(t.callExpression(t.memberExpression(t.identifier('Object'), t.identifier('assign')), [runtimeCall('recorderFor', resolved), t.identifier(alias)])));
    return node;
  });
  insertDeclarations(path, declarations);
}

export function transformNamespaces (path, options = {}) {
  const bundler = {
    resolveId: source => options.resolvedImports?.[source] || source,
    normalizedId: source => source
  };
  replaceImportedNamespaces(path, options.moduleId || '', bundler, options);
  replaceExportedNamespaces(path, options.moduleId || '', bundler, options);
}
