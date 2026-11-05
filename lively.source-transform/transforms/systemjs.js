import { arr } from 'lively.lang';
import { parse, stringify, nodes } from 'lively.ast';
import { declarationWrapperCall } from './helpers.js';
const { assign, member, literal, exprStmt, funcCall, id } = nodes;

export function normalizeImportedNamespace (expression) {
  const normalizer = parse(`(__modNS => {
    if (!__modNS || !__modNS.__useDefault || !__modNS.default ||
        (typeof __modNS.default !== "object" && typeof __modNS.default !== "function")) return __modNS;
    var __modDefault = __modNS.default;
    var __normalizedNS = Object.create(__modNS);
    for (var __modKey of Object.getOwnPropertyNames(__modDefault)) {
      if (__modKey === "default" || __modKey === "__useDefault" || __modKey === "__esModule") continue;
      if (__modKey in __normalizedNS) continue;
      __normalizedNS[__modKey] = __modDefault[__modKey];
    }
    return __normalizedNS;
  })`).body[0].expression;
  return funcCall(normalizer, expression);
}

export function rewriteToRegisterModuleToCaptureSetters (parsed, assignToObj, options) {
  // for rewriting the setters part in code like
  // ```js
  //   System.register(["a.js"], function (_export, _context) {
  //     var a, _rec;
  //     return {
  //       setters: [function(foo_a_js) { a = foo_a_js.x }],
  //       execute: function () { _rec.x = 23 + _rec.a; }
  //     };
  //   });
  // ```
  // This allows us to capture (and potentially re-export) imports and their
  // changes without actively running the module again.

  options = {
    captureObj: assignToObj || { type: 'Identifier', name: '__rec' },
    exclude: [],
    declarationWrapper: undefined,
    ...options
  };

  const registerCall = parsed.body.map(stmt => stmt.expression).find(expr =>
    ['System', 'SystemJS'].includes(expr?.callee?.object?.name) && expr.callee.property?.name === 'register');
  if (!registerCall) { throw new Error(`rewriteToRegisterModuleToCaptureSetters: input doesn't seem to be a System.register call: ${stringify(parsed).slice(0, 300)}...`); }
  const factory = arr.last(registerCall.arguments);
  const registerBody = factory.body.body;
  parsed.body = parsed.body.filter(stmt => stmt.directive !== 'format esm');
  registerBody.splice(0, registerBody.length, ...registerBody.filter(stmt => stmt.directive !== 'use strict'));
  const registerReturn = arr.last(registerBody);
  if (registerReturn.type !== 'ReturnStatement') { throw new Error(`rewriteToRegisterModuleToCaptureSetters: input doesn't seem to be a System.register call, at return statement: ${stringify(parsed).slice(0, 300)}...`); }
  const setters = registerReturn.argument.properties.find(prop => prop.key.name === 'setters');
  if (!setters) { throw new Error(`rewriteToRegisterModuleToCaptureSetters: input doesn't seem to be a System.register call, at finding setters: ${stringify(parsed).slice(0, 300)}...`); }
  const execute = registerReturn.argument.properties.find(prop => prop.key.name === 'execute');
  if (!execute) { throw new Error(`rewriteToRegisterModuleToCaptureSetters: input doesn't seem to be a System.register call, at finding execute: ${stringify(parsed).slice(0, 300)}...`); }

  // Static re-exports compile to a setter assignment and an _export call in
  // execute.  Capture that mapping so a later dependency update can schedule
  // the already-evaluated re-export without running execute again.
  const exportFunctionName = factory.params[0]?.name;
  const exportedNamesByLocal = new Map();
  execute.value.body.body.forEach(stmt => {
    const call = stmt.expression;
    if (options.captureImports !== false && stmt.type === 'ExpressionStatement' && call?.type === 'CallExpression' &&
        call.callee.type === 'Identifier' && call.callee.name === exportFunctionName &&
        call.arguments[0]?.type === 'Literal' && typeof call.arguments[0].value === 'string' &&
        call.arguments[1]?.type === 'Identifier') {
      const names = exportedNamesByLocal.get(call.arguments[1].name) || [];
      names.push(call.arguments[0].value);
      exportedNamesByLocal.set(call.arguments[1].name, names);
    }
  });

  // In each setter function intercept assignments to local vars and inject the
  // capture object.  When the local is re-exported, schedule that export too.
  setters.value.elements.forEach(funcExpr => {
    if (funcExpr.params[0] && funcExpr.params[0].type !== 'AssignmentPattern') {
      funcExpr.params[0] = assign(funcExpr.params[0], nodes.objectLiteral({}));
    }
    funcExpr.body.body = funcExpr.body.body.flatMap(stmt => {
      if (options.captureImports === false || stmt.type !== 'ExpressionStatement' ||
       stmt.expression.type !== 'AssignmentExpression' ||
       stmt.expression.left.type !== 'Identifier' ||
       options.exclude.includes(stmt.expression.left.name)) return [stmt];

      const local = stmt.expression.left;
      stmt.expression.right = normalizeImportedNamespace(stmt.expression.right);
      const rhs = options.declarationWrapper
        ? declarationWrapperCall(
          options.declarationWrapper,
          null,
          literal(local.name),
          literal('var'),
          stmt.expression,
          options.captureObj,
          options)
        : stmt.expression;
      const captured = exprStmt(assign(member(options.captureObj, local), rhs));
      const exportedNames = exportedNamesByLocal.get(local.name) || [];
      return [captured, ...exportedNames.map(exportedName =>
        exprStmt(funcCall(id('__livelyScheduleExport'), literal(exportedName), local)))];
    });
  });

  if (exportedNamesByLocal.size) {
    const moduleId = JSON.stringify(options.moduleId);
    const helper = parse(`function __livelyScheduleExport(name, value) {
      if (SystemJS.get(${moduleId})) {
        var pendingExports = SystemJS.get('@lively-env').pendingExportChanges[${moduleId}] || (SystemJS.get('@lively-env').pendingExportChanges[${moduleId}] = {});
        pendingExports[name] = value;
      }
    }`).body[0];
    registerBody.splice(1, 0, helper);
  }

  let captureInitialize = execute.value.body.body.find(stmt =>
    stmt.type === 'ExpressionStatement' &&
                         stmt.expression.type === 'AssignmentExpression' &&
                         stmt.expression.left.name === options.captureObj.name);
  if (!captureInitialize) {
    captureInitialize = execute.value.body.body.find(stmt =>
      stmt.type === 'VariableDeclaration' &&
                         stmt.declarations[0].id &&
                         stmt.declarations[0].id.name === options.captureObj.name);
  }
  if (captureInitialize) {
    arr.remove(execute.value.body.body, captureInitialize);
    arr.pushAt(registerBody, captureInitialize, registerBody.length - 1);
  }

  if (options.sourceAccessorName) {
    let origSourceInitialize = execute.value.body.body.find(stmt =>
      stmt.type === 'ExpressionStatement' &&
                           stmt.expression.type === 'AssignmentExpression' &&
                           stmt.expression.left.name === options.sourceAccessorName);
    if (!origSourceInitialize) {
      origSourceInitialize = execute.value.body.body.find(stmt =>
        stmt.type === 'VariableDeclaration' &&
                           stmt.declarations[0].id &&
                           stmt.declarations[0].id.name === options.sourceAccessorName);
    }
    if (origSourceInitialize) {
      arr.remove(execute.value.body.body, origSourceInitialize);
      arr.pushAt(registerBody, origSourceInitialize, registerBody.length - 1);
    }
  }

  return parsed;
}
