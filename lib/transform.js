/*global process, global, exports*/

import { arr, string, chain, Path } from "lively.lang";
import * as query from "./query.js";
import { parse } from "./parser.js";
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

  memberExpression: function(keys) {
    // var keys = ["foo", "bar", [0], "baz"];
    // stringify(this.ast.transform.helper.memberExpression(keys)); // => foo.bar[0].baz
    var memberExpression = keys.slice(1).reduce(function(memberExpr, key) {
      return {
        computed: typeof key !== "string",
        object: memberExpr,
        property: nodeForKey(key),
        type: "MemberExpression"
      }
    }, nodeForKey(keys[0]))
    return memberExpression;
    return {
      type: "ExpressionStatement",
      expression: memberExpression
    };

    function nodeForKey(key) {
      return typeof key === "string" ?
        {name: key, type: "Identifier"} :
        {raw: String(key), type: "Literal", value: key}
    }
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

function replaceTopLevelVarDeclAndUsageForCapturing(astOrSource, assignToObj, options) {
  /* replaces var and function declarations with assignment statements.
  * Example:
     exports.transform.replaceTopLevelVarDeclAndUsageForCapturing(
       "var x = 3, y = 2, z = 4",
       {name: "A", type: "Identifier"}, ['z']).source;
     // => "A.x = 3; A.y = 2; z = 4"
  */

  var ignoreUndeclaredExcept = (options && options.ignoreUndeclaredExcept) || null
  var whitelist = (options && options.include) || null;
  var blacklist = (options && options.exclude) || [];
  var recordDefRanges = options && options.recordDefRanges;

  var parsed = typeof astOrSource === 'object' ?
      astOrSource : parse(astOrSource),
    source = typeof astOrSource === 'string' ?
      astOrSource : (parsed.source || helper._node2string(parsed)),
    topLevel = query.topLevelDeclsAndRefs(parsed);

  if (ignoreUndeclaredExcept) {
    blacklist = arr.withoutAll(topLevel.undeclaredNames, ignoreUndeclaredExcept).concat(blacklist);
  }

  // 1. find those var declarations that should not be rewritten. we
  // currently ignore var declarations in for loops and the error parameter
  // declaration in catch clauses
  var scope = topLevel.scope;
  arr.pushAll(blacklist, arr.pluck(scope.catches, "name"));
  var forLoopDecls = scope.varDecls.filter(function(decl, i) {
    var path = Path(scope.varDeclPaths[i]),
        parent = path.slice(0,-1).get(parsed);
    return parent.type === "ForStatement" || parent.type === "ForInStatement";
  });
  arr.pushAll(blacklist, chain(forLoopDecls).pluck("declarations").flatten().pluck("id").pluck("name").value());

  // 2. make all references declared in the toplevel scope into property
  // reads of assignToObj
  // Example "var foo = 3; 99 + foo;" -> "var foo = 3; 99 + Global.foo;"
  var result = helper.replaceNodes(
    topLevel.refs
      .filter(shouldRefBeCaptured)
      .map(function(ref) {
       return {
        target: ref,
        replacementFunc: function(ref) { return member(ref, assignToObj); }
       };
      }), source);

  // 3. turn var declarations into assignments to assignToObj
  // Example: "var foo = 3; 99 + foo;" -> "Global.foo = 3; 99 + foo;"
  result = helper.replaceNodes(
    arr.withoutAll(topLevel.varDecls, forLoopDecls)
      .map(function(decl) {
        return {
          target: decl,
          replacementFunc: function(declNode, s, wasChanged) {
            if (wasChanged) {
              var scopes = query.scopes(parse(s, {addSource: true}));
              declNode = scopes.varDecls[0]
            }

            return declNode.declarations.map(function(ea) {
              var init = {
               operator: "||",
               type: "LogicalExpression",
               left: {computed: true, object: assignToObj,property: {type: "Literal", value: ea.id.name},type: "MemberExpression"},
               right: {name: "undefined", type: "Identifier"}
              }
              return shouldDeclBeCaptured(ea) ?
                assign(ea.id, ea.init || init) : varDecl(ea); });
          }
        }
      }), result);

  // 4. assignments for function declarations in the top level scope are
  // put in front of everything else:
  // "return bar(); function bar() { return 23 }" -> "Global.bar = bar; return bar(); function bar() { return 23 }"
  if (topLevel.funcDecls.length) {
    var globalFuncs = topLevel.funcDecls
      .filter(shouldDeclBeCaptured)
      .map(function(decl) {
        var funcId = {type: "Identifier", name: decl.id.name};
        return helper._node2string(assign(funcId, funcId));
      }).join('\n');


    var change = {type: 'add', pos: 0, string: globalFuncs};
    result = {
      source: globalFuncs + '\n' + result.source,
      changes: result.changes.concat([change])
    }
  }

  // 5. def ranges so that we know at which source code positions the
  // definitions are
  if (recordDefRanges)
    result.defRanges = chain(scope.varDecls)
      .pluck("declarations").flatten().value()
      .concat(scope.funcDecls)
      .reduce(function(defs, decl) {
        if (!defs[decl.id.name]) defs[decl.id.name] = []
        defs[decl.id.name].push({type: decl.type, start: decl.start, end: decl.end});
        return defs;
      }, {});

  result.ast = parsed;

  return result;

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function shouldRefBeCaptured(ref) {
    return blacklist.indexOf(ref.name) === -1
      && (!whitelist || whitelist.indexOf(ref.name) > -1);
  }

  function shouldDeclBeCaptured(decl) { return shouldRefBeCaptured(decl.id); }

  function assign(id, value) {
    return {
     type: "ExpressionStatement", expression: {
      type: "AssignmentExpression", operator: "=",
      right: value || {type: "Identifier", name: 'undefined'},
      left: {
        type: "MemberExpression", computed: false,
        object: assignToObj, property: id
      }
     }
    }
  }

  function varDecl(declarator) {
    return {
     declarations: [declarator],
     kind: "var", type: "VariableDeclaration"
    }
  }

  function member(prop, obj) {
    return {
      type: "MemberExpression", computed: false,
      object: obj, property: prop
    }
  }
}

function oneDeclaratorPerVarDecl(astOrSource) {
  // exports.transform.oneDeclaratorPerVarDecl(
  //    "var x = 3, y = (function() { var y = 3, x = 2; })(); ").source

  var parsed = typeof astOrSource === 'object' ?
      astOrSource : parse(astOrSource),
    source = typeof astOrSource === 'string' ?
      astOrSource : (parsed.source || helper._node2string(parsed)),
    scope = query.scopes(parsed),
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
    scope = query.scopes(parsed),
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

          var propDecls = arr.pluck(query.helpers.objPropertiesAsList(declNode.id, [], false), "key")
            .map(function(keyPath) {
              return {
                type: "VariableDeclaration", kind: "var",
                declarations: [{
                  type: "VariableDeclarator", kind: "var",
                  id: {type: "Identifier", name: arr.last(keyPath)},
                  init: helper.memberExpression([extractedId.name].concat(keyPath))}]
              }
            });

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
      last = parsed.body.pop(),
      newLastsource = 'return ' + source.slice(last.start, last.end);
  if (!opts.asAST) return source.slice(0, last.start) + newLastsource;

  var newLast = parse(newLastsource, {allowReturnOutsideFunction: true}).body.slice(-1)[0];
  parsed.body.push(newLast);
  parsed.end += 'return '.length;
  return parsed;
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
  replaceTopLevelVarDeclAndUsageForCapturing,
  oneDeclaratorPerVarDecl,
  oneDeclaratorForVarsInDestructoring,
  returnLastStatement,
  wrapInFunction
};
