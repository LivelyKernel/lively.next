import { babel, t } from '../ast.js';

function varDecl (name, init = null, kind = 'var') {
  if (typeof name === 'string') name = t.Identifier(name);
  return t.VariableDeclaration(kind, [t.VariableDeclarator(name, init)]);
}

export function splitExportDeclarations (path) {
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

export function replaceExportedVarDeclarations (path, moduleId = '', options = {}) {
  for (const statement of path.get('body')) {
    if (!statement.isExportNamedDeclaration() || !t.isVariableDeclaration(statement.node.declaration)) continue;
    const declaration = statement.node.declaration;
    const names = Object.keys(t.getBindingIdentifiers(declaration));
    statement.replaceWithMultiple([
      ...declaration.declarations.map(node => t.variableDeclaration(declaration.kind, [node])),
      t.exportNamedDeclaration(null, names.map(name => t.exportSpecifier(t.identifier(name), t.identifier(name))))
    ]);
  }

  if (moduleId.includes('lively.morphic/config.js')) {
    for (let i = 0; i < path.node.body.length; i++) {
      const stmt = path.get('body')[i];
      if (stmt.type === 'VariableDeclaration' && stmt.node.declarations?.[0].init?.type === 'ObjectExpression') {
        const { id, init } = stmt.node.declarations[0];
        stmt.get('declarations.0.init').replaceWith(t.LogicalExpression('||', babel.parse(`${options.recorderName}.${id.name}`).program.body[0].expression, init));
      }
    }
  }
}
