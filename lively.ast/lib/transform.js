/* global process, global, exports */

import { arr, obj, string, Path } from 'lively.lang';
import { helpers, scopes } from './query.js';
import { topLevelFuncDecls } from './visitors.js';
import { parse, fuzzyParse } from './parser.js';
import objectSpreadTransform from './object-spread-transform.js';
import {
  varDecl,
  memberChain,
  id,
  exprStmt,
  funcCall,
  returnStmt,
  tryStmt,
  program,
  block,
  funcExpr
} from './nodes.js';
import stringify from './stringify.js';

function _node2string (node) {
  return node.source || stringify(node);
}

function _findIndentAt (s, pos) {
  const bol = string.peekLeft(s, pos, /\s+$/);
  let indent = typeof bol === 'number' ? s.slice(bol, pos) : '';
  if (indent[0] === '\n') indent = indent.slice(1);
  return indent;
}

function _applyChanges (changes, source) {
  for (let i = 0; i < changes.length; i++) {
    const change = changes[i];
    if (change.type === 'del') {
      source = source.slice(0, change.pos) + source.slice(change.pos + change.length);
    } else if (change.type === 'add') {
      source = source.slice(0, change.pos) + change.string + source.slice(change.pos);
    } else {
      throw new Error('Unexpected change ' + obj.inspect(change));
    }
  }
  return source;
}

function _compareNodesForReplacement (nodeA, nodeB) {
  // equals
  if (nodeA.start === nodeB.start && nodeA.end === nodeB.end) return 0;
  // a "left" of b
  if (nodeA.end <= nodeB.start) return -1;
  // a "right" of b
  if (nodeA.start >= nodeB.end) return 1;
  // a contains b
  if (nodeA.start <= nodeB.start && nodeA.end >= nodeB.end) return 1;
  // b contains a
  if (nodeB.start <= nodeA.start && nodeB.end >= nodeA.end) return -1;
  throw new Error('Comparing nodes');
}

function replaceNode (target, replacementFunc, sourceOrChanges) {
  // parameters:
  //   - target: ast node
  //   - replacementFunc that gets this node and its source snippet
  //     handed and should produce a new ast node or source code.
  //   - sourceOrChanges: If its a string -- the source code to rewrite
  //                      If its and object -- {changes: ARRAY, source: STRING}

  const sourceChanges = typeof sourceOrChanges === 'object'
    ? sourceOrChanges
    : { changes: [], source: sourceOrChanges };
  let insideChangedBefore = false;
  const pos = sourceChanges.changes.reduce(function (pos, change) {
    // fixup the start and end indices of target using the del/add
    // changes already applied
    if (pos.end < change.pos) return pos;

    const isInFront = change.pos < pos.start;
    insideChangedBefore = insideChangedBefore ||
                 change.pos >= pos.start && change.pos <= pos.end;

    if (change.type === 'add') {
      return {
        start: isInFront ? pos.start + change.string.length : pos.start,
        end: pos.end + change.string.length
      };
    }

    if (change.type === 'del') {
      return {
        start: isInFront ? pos.start - change.length : pos.start,
        end: pos.end - change.length
      };
    }

    throw new Error('Cannot deal with change ' + obj.inspect(change));
  }, { start: target.start, end: target.end });

  const source = sourceChanges.source;
  const replacement = replacementFunc(target, source.slice(pos.start, pos.end), insideChangedBefore);
  var replacementSource = typeof replacement === 'string'
    ? replacement
    : Array.isArray(replacement)
      ? replacement.map(_node2string).join('\n' + _findIndentAt(source, pos.start))
      : replacementSource = _node2string(replacement);

  const changes = [{ type: 'del', pos: pos.start, length: pos.end - pos.start },
    { type: 'add', pos: pos.start, string: replacementSource }];

  return {
    changes: sourceChanges.changes.concat(changes),
    source: _applyChanges(changes, source)
  };
}

function replaceNodes (targetAndReplacementFuncs, sourceOrChanges) {
  // replace multiple AST nodes, order rewriting from inside out and
  // top to bottom so that nodes to rewrite can overlap or be contained
  // in each other
  const sorted = targetAndReplacementFuncs.sort((a, b) =>
    _compareNodesForReplacement(a.target, b.target));
  let sourceChanges = typeof sourceOrChanges === 'object'
    ? sourceOrChanges
    : { changes: [], source: sourceOrChanges };
  for (let i = 0; i < sorted.length; i++) {
    const { target, replacementFunc } = sorted[i];
    sourceChanges = replaceNode(target, replacementFunc, sourceChanges);
  }
  return sourceChanges;
}

function replace (astOrSource, targetNode, replacementFunc, options) {
  // replaces targetNode in astOrSource with what replacementFunc returns
  // (one or multiple ast nodes)
  // Example:
  // var ast = exports.parse('foo.bar("hello");')
  // exports.transform.replace(
  //     ast, ast.body[0].expression,
  //     function(node, source) {
  //         return {type: "CallExpression",
  //             callee: {name: node.arguments[0].value, type: "Identifier"},
  //             arguments: [{value: "world", type: "Literal"}]
  //         }
  //     });
  // => {
  //      source: "hello('world');",
  //      changes: [{pos: 0,length: 16,type: "del"},{pos: 0,string: "hello('world')",type: "add"}]
  //    }

  const parsed = typeof astOrSource === 'object' ? astOrSource : null;
  const source = typeof astOrSource === 'string'
    ? astOrSource
    : (parsed.source || _node2string(parsed));
  return replaceNode(targetNode, replacementFunc, source);
}

function __findVarDecls (scope, varDecls = []) {
  varDecls.push(...scope.varDecls);
  for (const subScope of scope.subScopes) { __findVarDecls(subScope, varDecls); }
  return varDecls;
}

function oneDeclaratorPerVarDecl (astOrSource) {
  // oneDeclaratorPerVarDecl("var x = 3, y = (function() { var y = 3, x = 2; })(); ").source 

  const parsed = typeof astOrSource === 'object'
    ? astOrSource
    : parse(astOrSource);
  const source = typeof astOrSource === 'string'
    ? astOrSource
    : (parsed.source || _node2string(parsed));
  const scope = scopes(parsed);
  const varDecls = __findVarDecls(scope);

  const targetsAndReplacements = [];
  for (const decl of varDecls) {
    targetsAndReplacements.push({
      target: decl,
      replacementFunc: function (declNode, s, wasChanged) {
        if (wasChanged) {
          // reparse node if necessary, e.g. if init was changed before like in
          // var x = (function() { var y = ... })();
          declNode = parse(s).body[0];
        }

        return declNode.declarations.map(function (ea) {
          return {
            type: 'VariableDeclaration',
            kind: 'var',
            declarations: [ea]
          };
        });
      }
    });
  }

  return replaceNodes(targetsAndReplacements, source);
}

function oneDeclaratorForVarsInDestructoring (astOrSource) {
  const parsed = typeof astOrSource === 'object'
    ? astOrSource
    : parse(astOrSource);
  const source = typeof astOrSource === 'string'
    ? astOrSource
    : (parsed.source || _node2string(parsed));
  const scope = scopes(parsed);
  const varDecls = __findVarDecls(scope);
  const targetsAndReplacements = [];

  for (const decl of varDecls) {
    targetsAndReplacements.push({
      target: decl,
      replacementFunc: function (declNode, s, wasChanged) {
        if (wasChanged) {
          // reparse node if necessary, e.g. if init was changed before like in
          // var x = (function() { var y = ... })();
          declNode = parse(s).body[0];
        }

        const nodes = [];
        for (const decl of declNode.declarations) {
          const extractedId = { type: 'Identifier', name: '__temp' };
          const extractedInit = {
            type: 'VariableDeclaration',
            kind: 'var',
            declarations: [{ type: 'VariableDeclarator', id: extractedId, init: decl.init }]
          };
          nodes.push(extractedInit);

          for (const { key: keyPath } of helpers.objPropertiesAsList(decl.id, [], false)) {
            nodes.push(varDecl(
              keyPath[keyPath.length - 2],
              memberChain(extractedId.name, ...keyPath), 'var'));
          }
        }
        return nodes;
      }
    });
  }

  return replaceNodes(targetsAndReplacements, source);
}

function returnLastStatement (source, opts) {
  opts = opts || {};

  const parsed = parse(source, opts);
  const last = arr.last(parsed.body);
  if (last.type !== 'ExpressionStatement') { return opts.asAST ? parsed : source; }

  parsed.body.splice(
    parsed.body.length - 1, 1,
    returnStmt(last.expression));
  return opts.asAST ? parsed : stringify(parsed);
}

function wrapInFunction (code, opts) {
  opts = opts || {};
  const transformed = returnLastStatement(code, opts);
  return opts.asAST
    ? program(funcExpr({ id: opts.id || undefined }, [], ...transformed.body))
    : `function${opts.id ? ' ' + opts.id : ''}() {\n${transformed}\n}`;
}

function wrapInStartEndCall (parsed, options) {
  // Wraps a piece of code into two function calls: One before the first
  // statement and one after the last. Also wraps the entire thing into a try /
  // catch block. The end call gets the result of the last statement (if it is
  // something that returns a value, i.e. an expression) passed as the second
  // argument. If an error occurs the end function is called with an error as
  // first parameter
  // Why? This allows to easily track execution of code, especially for
  // asynchronus / await code!
  // Example:
  // stringify(wrapInStartEndCall("var y = x + 23; y"))
  // // generates code
  // try {
  //     __start_execution();
  //     __lvVarRecorder.y = x + 23;
  //     return __end_execution(null, __lvVarRecorder.y);
  // } catch (err) {
  //     return __end_execution(err, undefined);
  // }

  if (typeof parsed === 'string') parsed = parse(parsed);
  options = options || {};

  const isProgram = parsed.type === 'Program';
  const startFuncNode = options.startFuncNode || id('__start_execution');
  const endFuncNode = options.endFuncNode || id('__end_execution');
  const funcDecls = topLevelFuncDecls(parsed);
  const innerBody = parsed.body;
  const outerBody = [];

  // 1. Hoist func decls outside the actual eval start - end code. The async /
  // generator transforms require this!
  funcDecls.forEach(({ node, path }) => {
    Path(path).set(parsed, exprStmt(node.id));
    outerBody.push(node);
  });

  // 2. add start-eval call
  innerBody.unshift(exprStmt(funcCall(startFuncNode)));

  // 3. if last statement is an expression, transform it so we can pass it to
  // the end-eval call, replacing the original expression. If it's a
  // non-expression we record undefined as the eval result
  const last = arr.last(innerBody);
  if (last.type === 'ExpressionStatement') {
    innerBody.pop();
    innerBody.push(exprStmt(funcCall(endFuncNode, id('null'), last.expression)));
  } else if (last.type === 'VariableDeclaration' && arr.last(last.declarations).id.type === 'Identifier') {
    innerBody.push(exprStmt(funcCall(endFuncNode, id('null'), arr.last(last.declarations).id)));
  } else {
    innerBody.push(exprStmt(funcCall(endFuncNode, id('null'), id('undefined'))));
  }

  // 4. Wrap that stuff in a try stmt
  outerBody.push(
    tryStmt('err',
      [exprStmt(funcCall(endFuncNode, id('err'), id('undefined')))],
      ...innerBody));

  return isProgram ? program(...outerBody) : block(...outerBody);
}

const isProbablySingleExpressionRe = /^\s*(\{|function\s*\()/;

function transformSingleExpression (code) {
  // evaling certain expressions such as single functions or object
  // literals will fail or not work as intended. When the code being
  // evaluated consists just out of a single expression we will wrap it in
  // parens to allow for those cases
  // Example:
  // transformSingleExpression("{foo: 23}") // => "({foo: 23})"

  if (!isProbablySingleExpressionRe.test(code) || code.split('\n').length > 30) return code;

  try {
    const parsed = fuzzyParse(code);
    if (parsed.body.length === 1 &&
      (parsed.body[0].type === 'FunctionDeclaration' ||
    (parsed.body[0].type === 'BlockStatement' &&
    parsed.body[0].body[0].type === 'LabeledStatement'))) {
      code = '(' + code.replace(/;\s*$/, '') + ')';
    }
  } catch (e) {
    if (typeof $world !== 'undefined') $world.logError(e);
    else console.error('Eval preprocess error: %s', e.stack || e);
  }
  return code;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export {
  replaceNode,
  replaceNodes,
  replace,
  _compareNodesForReplacement,
  oneDeclaratorPerVarDecl,
  oneDeclaratorForVarsInDestructoring,
  returnLastStatement,
  wrapInFunction,
  wrapInStartEndCall,
  transformSingleExpression,
  objectSpreadTransform
};
