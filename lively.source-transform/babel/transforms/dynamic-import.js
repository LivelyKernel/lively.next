import { t } from '../ast.js';

// This pass resolves literals and + expressions without executing module code.
export function staticImportValue (node) {
  if (t.isStringLiteral(node) || t.isNumericLiteral(node) || (node.type === 'Literal' && ['string', 'number'].includes(typeof node.value))) return node.value;
  if (t.isTemplateLiteral(node) && node.expressions.length === 0) return node.quasis.map(part => part.value.cooked).join('');
  if (t.isBinaryExpression(node, { operator: '+' })) {
    const left = staticImportValue(node.left), right = staticImportValue(node.right);
    if (left !== undefined && right !== undefined) return left + right;
  }
}

export function transformDynamicImports (path, { onImport } = {}) {
  path.traverse({
    CallExpression (call) {
      const { node } = call;
      if (!t.isMemberExpression(node.callee) || node.callee.computed || !t.isIdentifier(node.callee.object, { name: 'System' }) || !t.isIdentifier(node.callee.property, { name: 'import' }) || node.arguments.length !== 1 || t.isSpreadElement(node.arguments[0])) return;
      const specifier = staticImportValue(node.arguments[0]);
      if (typeof specifier === 'string' && specifier.length) {
        call.replaceWith(t.callExpression(t.import(), [t.stringLiteral(specifier)]));
        onImport?.(specifier);
        call.skip();
      }
    }
  });
}
