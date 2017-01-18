/*global process, global, exports*/

import { arr, obj, string, chain, Path } from "lively.lang";
import { helpers, scopes, topLevelDeclsAndRefs, topLevelFuncDecls } from "./query.js";
import { parse, fuzzyParse } from "./parser.js";
import objectSpreadTransform from "./object-spread-transform.js";
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
} from "./nodes.js";
import stringify from "./stringify.js";


function _node2string(node) {
  return node.source || stringify(node)
}

function _findIndentAt(s, pos) {
  var bol = string.peekLeft(s, pos, /\s+$/),
      indent = typeof bol === 'number' ? s.slice(bol, pos) : '';
  if (indent[0] === '\n') indent = indent.slice(1);
  return indent;
}

function _applyChanges(changes, source) {
  for (var i = 0; i < changes.length; i++) {
    let change = changes[i];
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

function _compareNodesForReplacement(nodeA, nodeB) {
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


function replaceNode(target, replacementFunc, sourceOrChanges) {
  // parameters:
  //   - target: ast node
  //   - replacementFunc that gets this node and its source snippet
  //     handed and should produce a new ast node.
  //   - sourceOrChanges: If its a string -- the source code to rewrite
  //                      If its and object -- {changes: ARRAY, source: STRING}

  var sourceChanges = typeof sourceOrChanges === 'object' ?
    sourceOrChanges : {changes: [], source: sourceOrChanges},
    insideChangedBefore = false,
    pos = sourceChanges.changes.reduce(function(pos, change) {
      // fixup the start and end indices of target using the del/add
      // changes already applied
      if (pos.end < change.pos) return pos;

      var isInFront = change.pos < pos.start;
      insideChangedBefore = insideChangedBefore
               || change.pos >= pos.start && change.pos <= pos.end;

      if (change.type === 'add') return {
        start: isInFront ? pos.start + change.string.length : pos.start,
        end: pos.end + change.string.length
      };

      if (change.type === 'del') return {
        start: isInFront ? pos.start - change.length : pos.start,
        end: pos.end - change.length
      };

      throw new Error('Cannot deal with change ' + obj.inspect(change));
    }, {start: target.start, end: target.end});

  var source = sourceChanges.source,
      replacement = replacementFunc(target, source.slice(pos.start, pos.end), insideChangedBefore),
      replacementSource = Array.isArray(replacement) ?
        replacement.map(_node2string).join('\n' + _findIndentAt(source, pos.start)):
        replacementSource = _node2string(replacement);

  var changes = [{type: 'del', pos: pos.start, length: pos.end - pos.start},
         {type: 'add', pos: pos.start, string: replacementSource}];

  return {
    changes: sourceChanges.changes.concat(changes),
    source: _applyChanges(changes, source)
  };
}

function replaceNodes(targetAndReplacementFuncs, sourceOrChanges) {
  // replace multiple AST nodes, order rewriting from inside out and
  // top to bottom so that nodes to rewrite can overlap or be contained
  // in each other
  var sorted = targetAndReplacementFuncs.sort((a, b) =>
        _compareNodesForReplacement(a.target, b.target)),
      sourceChanges = typeof sourceOrChanges === 'object' ?
        sourceOrChanges : {changes: [], source: sourceOrChanges};
  for (var i = 0; i < sorted.length; i++) {
    let {target, replacementFunc} = sorted[i];
    sourceChanges = replaceNode(target, replacementFunc, sourceChanges);
  }
  return sourceChanges;
}

function replace(astOrSource, targetNode, replacementFunc, options) {
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

  var parsed = typeof astOrSource === 'object' ? astOrSource : null,
      source = typeof astOrSource === 'string' ?
        astOrSource : (parsed.source || _node2string(parsed));
  return replaceNode(targetNode, replacementFunc, source);
}

function oneDeclaratorPerVarDecl(astOrSource) {
  // exports.transform.oneDeclaratorPerVarDecl(
  //    "var x = 3, y = (function() { var y = 3, x = 2; })(); ").source

  var parsed = typeof astOrSource === 'object' ?
      astOrSource : parse(astOrSource),
    source = typeof astOrSource === 'string' ?
      astOrSource : (parsed.source || _node2string(parsed)),
    scope = scopes(parsed),
    varDecls = (function findVarDecls(scope) {
      return arr.flatten(scope.varDecls.concat(scope.subScopes.map(findVarDecls)));
    })(scope);

  var targetsAndReplacements = varDecls.map(function(decl) {
    return {
      target: decl,
      replacementFunc: function(declNode, s, wasChanged) {
        if (wasChanged) {
          // reparse node if necessary, e.g. if init was changed before like in
          // var x = (function() { var y = ... })();
          declNode = parse(s).body[0];
        }

        return declNode.declarations.map(function(ea) {
          return {
            type: "VariableDeclaration",
            kind: "var", declarations: [ea]
          }
        });
      }
    }
  });

  return replaceNodes(targetsAndReplacements, source);
}

function oneDeclaratorForVarsInDestructoring(astOrSource) {
  var parsed = typeof astOrSource === 'object' ?
      astOrSource : parse(astOrSource),
    source = typeof astOrSource === 'string' ?
      astOrSource : (parsed.source || _node2string(parsed)),
    scope = scopes(parsed),
    varDecls = (function findVarDecls(scope) {
      return arr.flatten(scope.varDecls
        .concat(scope.subScopes.map(findVarDecls)));
    })(scope);

  var targetsAndReplacements = varDecls.map(function(decl) {
    return {
      target: decl,
      replacementFunc: function(declNode, s, wasChanged) {
        if (wasChanged) {
          // reparse node if necessary, e.g. if init was changed before like in
          // var x = (function() { var y = ... })();
          declNode = parse(s).body[0];
        }

        return arr.flatmap(declNode.declarations, function(declNode) {
          var extractedId = {type: "Identifier", name: "__temp"},
              extractedInit = {
                type: "VariableDeclaration", kind: "var",
                declarations: [{type: "VariableDeclarator", id: extractedId, init: declNode.init}]
              }


          var propDecls = helpers.objPropertiesAsList(declNode.id, [], false).map(ea => ea.key)
            .map(keyPath =>  varDecl(arr.last(keyPath), memberChain(extractedId.name, ...keyPath), "var"));

          return [extractedInit].concat(propDecls);
        });
      }
    }
  });

  return replaceNodes(targetsAndReplacements, source);
}

function returnLastStatement(source, opts) {
  opts = opts || {};

  var parsed = parse(source, opts),
      last = arr.last(parsed.body);
  if (last.type === "ExpressionStatement") {
    parsed.body.splice(
      parsed.body.length-1, 1,
      returnStmt(last.expression))
    return opts.asAST ? parsed : stringify(parsed);
  } else {
    return opts.asAST ? parsed : source;
  }

}

function wrapInFunction(code, opts) {
  opts = opts || {};
  var transformed = returnLastStatement(code, opts);
  return opts.asAST ?
    program(funcExpr({id: opts.id || undefined}, [], ...transformed.body)) :
    `function${opts.id ? " " + opts.id : ""}() {\n${transformed}\n}`;
}

function wrapInStartEndCall(parsed, options) {
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

  if (typeof parsed === "string") parsed = parse(parsed);
  options = options || {};

  var isProgram = parsed.type === "Program",
      startFuncNode = options.startFuncNode || id("__start_execution"),
      endFuncNode = options.endFuncNode || id("__end_execution"),
      funcDecls = topLevelFuncDecls(parsed),
      innerBody = parsed.body,
      outerBody = [];

  // 1. Hoist func decls outside the actual eval start - end code. The async /
  // generator transforms require this!
  funcDecls.forEach(({node, path}) => {
    Path(path).set(parsed, exprStmt(node.id));
    outerBody.push(node);
  });

  // 2. add start-eval call
  innerBody.unshift(exprStmt(funcCall(startFuncNode)));

  // 3. if last statement is an expression, transform it so we can pass it to
  // the end-eval call, replacing the original expression. If it's a
  // non-expression we record undefined as the eval result
  var last = arr.last(innerBody);
  if (last.type === "ExpressionStatement") {
    innerBody.pop();
    innerBody.push(exprStmt(funcCall(endFuncNode, id("null"), last.expression)));
  } else if (last.type === "VariableDeclaration" && arr.last(last.declarations).id.type === "Identifier") {
    innerBody.push(exprStmt(funcCall(endFuncNode, id("null"), arr.last(last.declarations).id)));
  } else {
    innerBody.push(exprStmt(funcCall(endFuncNode, id("null"), id("undefined"))));
  }

  // 4. Wrap that stuff in a try stmt
  outerBody.push(
    tryStmt("err",
      [exprStmt(funcCall(endFuncNode, id("err"), id("undefined")))],
      ...innerBody));

  return isProgram ? program(...outerBody) : block(...outerBody);
}

const isProbablySingleExpressionRe = /^\s*(\{|function\s*\()/;

function transformSingleExpression(code) {
  // evaling certain expressions such as single functions or object
  // literals will fail or not work as intended. When the code being
  // evaluated consists just out of a single expression we will wrap it in
  // parens to allow for those cases
  // Example:
  // transformSingleExpression("{foo: 23}") // => "({foo: 23})"

  if (!isProbablySingleExpressionRe.test(code) || code.split("\n").length > 30) return code;

  try {
    var parsed = fuzzyParse(code);
    if (parsed.body.length === 1 &&
      (parsed.body[0].type === 'FunctionDeclaration'
    || (parsed.body[0].type === 'BlockStatement'
    && parsed.body[0].body[0].type === 'LabeledStatement'))) {
      code = '(' + code.replace(/;\s*$/, '') + ')';
    }
  } catch(e) {
    if (typeof $world !== "undefined") $world.logError(e);
    else console.error("Eval preprocess error: %s", e.stack || e);
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
