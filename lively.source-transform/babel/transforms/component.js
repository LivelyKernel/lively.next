import { t } from '../ast.js';

function isComponentCall (node) {
  return t.isCallExpression(node) && t.isIdentifier(node.callee, { name: 'component' });
}

export function ensureComponentDescriptors (path, moduleId, options = {}) {
  const rootScope = path.scope;
  const recorderName = options.varRecorderName || options.recorderName || options.captureObj?.name || '__rec';
  const excluded = options.exclude || options.excludeDecls || [];
  path.traverse({
    ExpressionStatement (statement) {
      if (!isComponentCall(statement.node.expression)) return;
      statement.get('expression').replaceWith(t.callExpression(
        t.memberExpression(t.identifier('component'), t.identifier('for')),
        [t.arrowFunctionExpression([], statement.node.expression),
          t.objectExpression([t.objectProperty(t.identifier('module'), t.stringLiteral(moduleId))])]
      ));
      statement.skip();
    },
    VariableDeclarator (declarator) {
      const { node } = declarator;
      if (!t.isIdentifier(node.id) || !isComponentCall(node.init)) return;
      const name = node.id.name;
      const captured = declarator.scope.getBinding(name)?.scope === rootScope && !excluded.includes(name);
      const args = [
        t.arrowFunctionExpression([], node.init),
        t.objectExpression([
          t.objectProperty(t.identifier('module'), t.stringLiteral(moduleId)),
          t.objectProperty(t.identifier('export'), t.stringLiteral(name)),
          t.objectProperty(t.identifier('range'), t.objectExpression([
            t.objectProperty(t.identifier('start'), t.numericLiteral(node.start || 0)),
            t.objectProperty(t.identifier('end'), t.numericLiteral(node.end || 0))
          ]))
        ]),
        t.identifier('System')
      ];
      if (captured) args.push(t.identifier(recorderName), t.stringLiteral(name));
      declarator.get('init').replaceWith(t.callExpression(t.memberExpression(t.identifier('component'), t.identifier('for')), args));
      declarator.skip();
    }
  });
}
