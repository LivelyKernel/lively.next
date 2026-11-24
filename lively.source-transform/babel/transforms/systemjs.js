import { t } from '../ast.js';
import { declarationWrapperCall } from '../helpers.js';

export function normalizeImportedNamespace (expr) {
  const m = t.Identifier('__modNS');
  const d = t.Identifier('__modDefault');
  const ns = t.Identifier('__normalizedNS');
  const k = t.Identifier('__modKey');
  return t.CallExpression(
    t.ArrowFunctionExpression(
      [m],
      t.BlockStatement([
        t.IfStatement(
          t.LogicalExpression(
            '||',
            t.LogicalExpression(
              '||',
              t.LogicalExpression(
                '||',
                t.UnaryExpression('!', t.cloneNode(m)),
                t.UnaryExpression('!', t.MemberExpression(t.cloneNode(m), t.Identifier('__useDefault')))
              ),
              t.UnaryExpression('!', t.MemberExpression(t.cloneNode(m), t.Identifier('default')))
            ),
            t.LogicalExpression(
              '&&',
              t.BinaryExpression(
                '!==',
                t.UnaryExpression('typeof', t.MemberExpression(t.cloneNode(m), t.Identifier('default'))),
                t.StringLiteral('object')
              ),
              t.BinaryExpression(
                '!==',
                t.UnaryExpression('typeof', t.MemberExpression(t.cloneNode(m), t.Identifier('default'))),
                t.StringLiteral('function')
              )
            )
          ),
          t.ReturnStatement(t.cloneNode(m))
        ),
        t.VariableDeclaration('var', [t.VariableDeclarator(t.cloneNode(d), t.MemberExpression(t.cloneNode(m), t.Identifier('default')))]),
        t.VariableDeclaration('var', [t.VariableDeclarator(t.cloneNode(ns), t.CallExpression(t.MemberExpression(t.Identifier('Object'), t.Identifier('create')), [t.cloneNode(m)]))]),
        t.ForOfStatement(
          t.VariableDeclaration('var', [t.VariableDeclarator(t.cloneNode(k))]),
          t.CallExpression(t.MemberExpression(t.Identifier('Object'), t.Identifier('getOwnPropertyNames')), [t.cloneNode(d)]),
          t.BlockStatement([
            t.IfStatement(
              t.LogicalExpression(
                '||',
                t.LogicalExpression(
                  '||',
                  t.BinaryExpression('===', t.cloneNode(k), t.StringLiteral('default')),
                  t.BinaryExpression('===', t.cloneNode(k), t.StringLiteral('__useDefault'))
                ),
                t.BinaryExpression('===', t.cloneNode(k), t.StringLiteral('__esModule'))
              ),
              t.ContinueStatement()
            ),
            t.IfStatement(
              t.BinaryExpression('in', t.cloneNode(k), t.cloneNode(ns)),
              t.ContinueStatement()
            ),
            t.ExpressionStatement(
              t.AssignmentExpression(
                '=',
                t.MemberExpression(t.cloneNode(ns), t.cloneNode(k), true),
                t.MemberExpression(t.cloneNode(d), t.cloneNode(k), true)
              )
            )
          ])
        ),
        t.ReturnStatement(t.cloneNode(ns))
      ])
    ),
    [expr]
  );
}

const propertyName = property => property.key.name ?? property.key.value;
const functionBody = property => property.type === 'ObjectMethod' ? property.body : property.value?.body;

export function rewriteToRegisterModuleToCaptureSetters (path, state = {}, options = {}) {
  options = { captureObj: t.identifier(options.varRecorderName || '__rec'), exclude: [], ...options };
  const renamedExports = state.opts?.module?._renamedExports || {};
  const register = path.node.body.find(statement => {
    const callee = statement.expression?.callee;
    return t.isMemberExpression(callee) && !callee.computed &&
      ['System', 'SystemJS'].includes(callee.object.name) && callee.property.name === 'register';
  });
  if (!register) throw new Error('rewriteToRegisterModuleToCaptureSetters: input does not contain a System.register call');
  const call = register.expression;
  const factory = call.arguments[call.arguments.length - 1];
  const body = factory?.body;
  const returned = body?.body?.findLast(statement => t.isReturnStatement(statement));
  if (!t.isObjectExpression(returned?.argument)) throw new Error('System.register factory must return its setters and execute functions');
  const setters = returned.argument.properties.find(property => propertyName(property) === 'setters');
  const execute = returned.argument.properties.find(property => propertyName(property) === 'execute');
  const executeBody = execute && functionBody(execute);
  if (!t.isArrayExpression(setters?.value) || !t.isBlockStatement(executeBody)) throw new Error('System.register requires setters and execute');
  body.directives = (body.directives || []).filter(directive => directive.value.value !== 'use strict');
  path.node.directives = (path.node.directives || []).filter(directive => directive.value.value !== 'format esm');
  const exportedNamesByLocal = new Map();
  const exportFunctionName = factory.params[0]?.name;
  if (options.captureImports !== false) for (const statement of executeBody.body) {
    const expression = statement.expression;
    if (t.isCallExpression(expression) && t.isIdentifier(expression.callee, { name: exportFunctionName }) &&
        t.isStringLiteral(expression.arguments[0]) && t.isIdentifier(expression.arguments[1])) {
      const local = expression.arguments[1].name;
      exportedNamesByLocal.set(local, [...(exportedNamesByLocal.get(local) || []), expression.arguments[0].value]);
    }
  }
  for (const setter of setters.value.elements) {
    if ((!t.isFunctionExpression(setter) && !t.isArrowFunctionExpression(setter)) || !t.isBlockStatement(setter.body)) continue;
    if (setter.params[0] && !t.isAssignmentPattern(setter.params[0])) setter.params[0] = t.assignmentPattern(setter.params[0], t.objectExpression([]));
    if (options.captureImports === false) continue;
    setter.body.body = setter.body.body.flatMap(statement => {
      const assignment = statement.expression;
      if (!t.isExpressionStatement(statement) || !t.isAssignmentExpression(assignment) || !t.isIdentifier(assignment.left) || options.exclude.includes(assignment.left.name)) return [statement];
      const name = assignment.left.name;
      const id = t.cloneNode(assignment.left);
      if (Object.hasOwn(renamedExports, name)) id['x-lively-object-meta'] = { exportConflict: renamedExports[name] };
      const value = t.assignmentExpression(assignment.operator, t.cloneNode(id), normalizeImportedNamespace(assignment.right));
      const rhs = options.declarationWrapper ? declarationWrapperCall(options.declarationWrapper, id, t.stringLiteral(name), t.stringLiteral('var'), value, options.captureObj, options) : value;
      return [t.expressionStatement(t.assignmentExpression('=', t.memberExpression(t.cloneNode(options.captureObj), id), rhs)),
        ...(exportedNamesByLocal.get(name) || []).map(exported => t.expressionStatement(t.callExpression(t.identifier('__livelyScheduleExport'), [t.stringLiteral(exported), t.identifier(name)])))];
    });
  }
  const inserted = [];
  if (exportedNamesByLocal.size) {
    const moduleId = t.stringLiteral(options.moduleId || '');
    const environment = () => t.callExpression(t.memberExpression(t.identifier('SystemJS'), t.identifier('get')), [t.stringLiteral('@lively-env')]);
    const pending = () => t.memberExpression(t.memberExpression(environment(), t.identifier('pendingExportChanges')), t.cloneNode(moduleId), true);
    inserted.push(t.functionDeclaration(t.identifier('__livelyScheduleExport'), [t.identifier('name'), t.identifier('value')], t.blockStatement([
      t.ifStatement(t.callExpression(t.memberExpression(t.identifier('SystemJS'), t.identifier('get')), [t.cloneNode(moduleId)]), t.blockStatement([
        t.variableDeclaration('var', [t.variableDeclarator(t.identifier('pendingExports'), t.logicalExpression('||', pending(), t.assignmentExpression('=', pending(), t.objectExpression([]))))]),
        t.expressionStatement(t.assignmentExpression('=', t.memberExpression(t.identifier('pendingExports'), t.identifier('name'), true), t.identifier('value')))
      ]))
    ])));
  }
  for (const name of [options.captureObj.name, options.sourceAccessorName].filter(Boolean)) {
    let index = executeBody.body.findIndex(statement => t.isExpressionStatement(statement) && t.isAssignmentExpression(statement.expression) && t.isIdentifier(statement.expression.left, { name }));
    if (index < 0) index = executeBody.body.findIndex(statement => t.isVariableDeclaration(statement) && t.isIdentifier(statement.declarations[0]?.id, { name }));
    if (index >= 0) inserted.unshift(...executeBody.body.splice(index, 1));
  }
  const insertionIndex = Math.min(1, body.body.indexOf(returned));
  body.body.splice(Math.max(0, insertionIndex), 0, ...inserted);
  path.scope.crawl();
}
