import { nodes } from 'lively.ast';
const { varDecl } = nodes;

export function splitExportDeclarations (parsed) {
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
