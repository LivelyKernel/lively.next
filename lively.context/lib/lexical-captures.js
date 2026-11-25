import { query, parseFunction, escodegen } from 'lively.ast';

const captures = new WeakMap();

/** `[name, kind]` of every let/const binding declared by the VariableDeclarations among `nodes`. */
export function lexicalDeclarations(nodes) {
  return nodes.filter(node => node.type === 'VariableDeclaration' && node.kind !== 'var')
    .flatMap(node => query.helpers.declIds(node.declarations.map(decl => decl.id)).map(id => [id.name, node.kind]));
}

/** Find the lexical receiver/arguments used by an arrow, including nested arrows. */
export function lexicalCaptures(node) {
  if (node.type !== 'ArrowFunctionExpression') return {this: false, arguments: false};
  if (captures.has(node)) return captures.get(node);
  const result = {this: false, arguments: false};
  const visit = (scope, argumentsBound = false) => {
    if (['FunctionDeclaration', 'FunctionExpression'].includes(scope.node.type)) return;
    argumentsBound ||= query.declarationsOfScope(scope, true).some(id => id.name === 'arguments');
    result.this ||= !!scope.thisRefs.length;
    result.arguments ||= !argumentsBound && scope.refs.some(ref => ref.name === 'arguments');
    scope.subScopes.forEach(child => visit(child, argumentsBound));
  };
  visit(query.scopes(parseFunction(escodegen.generate(node), {sourceType: 'script'})));
  captures.set(node, result);
  return result;
}
