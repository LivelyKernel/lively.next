/*global process, global, exports*/

import { arr, string, chain, Path } from "lively.lang";
import { helpers, scopes, topLevelDeclsAndRefs, topLevelFuncDecls } from "./query.js";
import { parse } from "./parser.js";
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


var helper = {
  // currently this is used by the replacement functions below but
  // I don't wan't to make it part of our AST API

  _node2string: function(node) {
    return node.source || stringify(node)
  },

  _findIndentAt: function(s, pos) {
    var bol = string.peekLeft(s, pos, /\s+$/),
        indent = typeof bol === 'number' ? s.slice(bol, pos) : '';
    if (indent[0] === '\n') indent = indent.slice(1);
    return indent;
  },

  _applyChanges: function(changes, source) {
    return changes.reduce(function(source, change) {
      if (change.type === 'del') {
        return source.slice(0, change.pos) + source.slice(change.pos + change.length);
      } else if (change.type === 'add') {
        return source.slice(0, change.pos) + change.string + source.slice(change.pos);
      }
      throw new Error('Uexpected change ' + Objects.inspect(change));
    }, source);
  },

  _compareNodesForReplacement: function(nodeA, nodeB) {
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
  },

  replaceNode: function(target, replacementFunc, sourceOrChanges) {
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

        throw new Error('Cannot deal with change ' + Objects.inspect(change));
      }, {start: target.start, end: target.end});

    var source = sourceChanges.source,
        replacement = replacementFunc(target, source.slice(pos.start, pos.end), insideChangedBefore),
        replacementSource = Array.isArray(replacement) ?
          replacement.map(helper._node2string).join('\n' + helper._findIndentAt(source, pos.start)):
          replacementSource = helper._node2string(replacement);

    var changes = [{type: 'del', pos: pos.start, length: pos.end - pos.start},
           {type: 'add', pos: pos.start, string: replacementSource}];

    return {
      changes: sourceChanges.changes.concat(changes),
      source: this._applyChanges(changes, source)
    };
  },

  replaceNodes: function(targetAndReplacementFuncs, sourceOrChanges) {
    // replace multiple AST nodes, order rewriting from inside out and
    // top to bottom so that nodes to rewrite can overlap or be contained
    // in each other
    return targetAndReplacementFuncs.sort(function(a, b) {
      return helper._compareNodesForReplacement(a.target, b.target);
    }).reduce(function(sourceChanges, ea) {
      return helper.replaceNode(ea.target, ea.replacementFunc, sourceChanges);
    }, typeof sourceOrChanges === 'object' ?
      sourceOrChanges : {changes: [], source: sourceOrChanges});
  }

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
      astOrSource : (parsed.source || helper._node2string(parsed)),
    result = helper.replaceNode(targetNode, replacementFunc, source);

  return result;
}

function oneDeclaratorPerVarDecl(astOrSource) {
  // exports.transform.oneDeclaratorPerVarDecl(
  //    "var x = 3, y = (function() { var y = 3, x = 2; })(); ").source

  var parsed = typeof astOrSource === 'object' ?
      astOrSource : parse(astOrSource),
    source = typeof astOrSource === 'string' ?
      astOrSource : (parsed.source || helper._node2string(parsed)),
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

  return helper.replaceNodes(targetsAndReplacements, source);
}

function oneDeclaratorForVarsInDestructoring(astOrSource) {
  var parsed = typeof astOrSource === 'object' ?
      astOrSource : parse(astOrSource),
    source = typeof astOrSource === 'string' ?
      astOrSource : (parsed.source || helper._node2string(parsed)),
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

  return helper.replaceNodes(targetsAndReplacements, source);
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
  return opts.asAST ?  {
   type: "Program",
   body: [{
    type: "ExpressionStatement",
    expression: {
     body: {body: transformed.body, type: "BlockStatement"},
     params: [],
     type: "FunctionExpression"
    },
   }]
  } : "function() {\n" + transformed + "\n}";
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export { 
  helper,
  replace,
  oneDeclaratorPerVarDecl,
  oneDeclaratorForVarsInDestructoring,
  returnLastStatement,
  wrapInFunction
};
