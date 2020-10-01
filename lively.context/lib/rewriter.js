/*global global, module, Global,LivelyDebuggingASTRegistry*/
import { acorn, parse, walk } from "lively.ast";
import { obj, arr } from "lively.lang";

export let LivelyDebuggingASTRegistry = {};

let _currentASTRegistry = (function() {
    return typeof LivelyDebuggingASTRegistry !== 'undefined' ? LivelyDebuggingASTRegistry : {};
})()

function getCurrentASTRegistry() {
    if (_currentASTRegistry) return _currentASTRegistry;
    return {};
}

function setCurrentASTRegistry(astRegistry) {
    return _currentASTRegistry = astRegistry;
}

function rewrite(node, astRegistry, namespace) {
    var r = new Rewriter(astRegistry, namespace);
    return r.rewrite(node);
}

function rewriteFunction(node, astRegistry, namespace) {
    var r = new Rewriter(astRegistry, namespace);
    return r.rewriteFunction(node);
}

export {
  getCurrentASTRegistry, _currentASTRegistry, setCurrentASTRegistry, rewrite, rewriteFunction
}

export class Rewriter {

  constructor(astRegistry, namespace)  {
      // scopes is used for keeping track of local vars and computationProgress state
      // while rewriting. Whenever a local var or an intermediate computation result
      // is encoutered we store it in the scope. Then, when we create the actual
      // "scope wrapper" where the stack reification state gets initialized we use
      // this information to create the necessary declarations
      this.scopes = [];
      // module('StackReification').load();

      // Right now astRegistry is where the original ASTs for each
      // scope/function are stored
      // FIXME we need a more consistent storage/interface that might be integrated
      // with the source control?
      this.astRegistry = astRegistry || {};

      this.namespace = namespace;
      if (this.astRegistry[this.namespace] == undefined)
          this.astRegistry[this.namespace] = [];

      this.astIndex = 0;
  }

  createVisitor(registryIndex) {
      return new RewriteVisitor(registryIndex);
  }

  newNode(type, node) {
      node.type = type;
      node.start = 0;
      node.end = 0;
      return node;
  }

  newVariable(name, value) {
      if (value == '{}') {
          value = this.newNode('ObjectExpression', { properties: [] });
      } else if (obj.isArray(value)) {
          value = this.newNode('ArrayExpression', {
              elements: value.map(function(val) {
                  if (obj.isNumber(val)) {
                      return this.newNode('Literal', { value: val });
                  } else if (obj.isString(val)) {
                      return this.newNode('Identifier', { name: val });
                  } else {
                      throw new Error('Cannot interpret value in array.');
                  }
              }, this)
          }, this);
      } else if (obj.isObject(value) && (value.type != null)) {
          // expected to be valid Parser API object
      } else
          throw new Error('Cannot interpret value for newVariable: ' + value + '!');

      return this.newNode('VariableDeclarator', {
          id: this.newNode('Identifier', { name: name }),
          init: value
      });
  }

  newMemberExp(str) {
      var parts = str.split('.');
      parts = parts.map(function(part) {
          return this.newNode('Identifier', { name: part });
      }, this);
      var newNode = this.newNode.bind(this);
      return parts.reduce(function(object, property) {
          return newNode('MemberExpression', {
              object: object,
              property: property
          });
      });
  }

  wrapArgsAndDecls(args, decls) {
      if ((!args || !args.length) && (!decls || !decls.length)) return '{}';
      var wArgs = args ? args.map(function(ea) {
              return {
                  key: this.newNode('Literal', {value: ea.name}),
                  type: "Property", kind: 'init', value: ea
              };
          }, this) : [],
          wDecls = decls || [];
      return this.newNode('ObjectExpression', {properties: wArgs.concat(wDecls)});
  }

  enterScope(additionals) {
      additionals = additionals || {};
      return this.scopes.push(obj.extend(additionals, {localVars: [], computationProgress: []}));
  }

  exitScope() {
      this.scopes.pop();
  }

  lastFunctionScopeId() {
      return this.scopes.map(function(scope) {
          return !!(scope.isWithScope || scope.isCatchScope);
      }).lastIndexOf(false);
  }

  registerVars(varIdentifiers) {
      if (!this.scopes.length) return undefined;
      var scope = arr.last(this.scopes),
          that = this;
      return varIdentifiers.reduce(function(res, varIdentifier) {
          var varName = varIdentifier.name;
          if (scope.localVars.indexOf(varName) == -1) {
              scope.localVars.push(varName);
          }
          res.push(that.newNode('Identifier', { name: varName, astIndex: varIdentifier.astIndex }));
          return res;
      }, []);
  }

  registerDeclarations(ast, visitor) {
      if (!this.scopes.length) return;
      var scope = arr.last(this.scopes), that = this, decls = {};
      walk.matchNodes(ast, {
          'VariableDeclaration': function(node, state, depth, type) {
              if (node.type != type) return; // skip Expression, Statement, etc.
              node.declarations.forEach(function(n) {
                  // only if it has not been defined before (as variable or argument!)
                  if ((scope.localVars.indexOf(n.id.name) == -1) && (n.id.name != 'arguments')) {
                      state[n.id.name] = {
                          key: that.newNode('Literal', {value: n.id.name}),
                          type: "Property",
                          kind: 'init',
                          value: that.newNode('Identifier', {name: 'undefined'})
                      };
                      scope.localVars.push(n.id.name);
                  }
              });
          },
          'FunctionDeclaration': function(node, state, depth, type) {
              if (node.type != type) return; // skip Expression, Statement, etc.
              state[node.id.name] = node; // rewrite is done below (to know all local vars first)
              if (scope.localVars.indexOf(node.id.name) == -1)
                  scope.localVars.push(node.id.name);
          }
      }, decls, { visitors: walk.visitors.stopAtFunctions });

      return Object.getOwnPropertyNames(decls).map(function(decl) {
          var node = decls[decl];
          if (node.type == 'FunctionDeclaration') {
              node = {
                  key: that.newNode('Literal', {value: node.id.name}),
                  type: "Property",
                  kind: 'init',
                  value: that.rewriteFunctionDeclaration(node, visitor.registryIndex)
              }
          }
          return node;
      });
  }

  createPreamble(args, decls, level) {
      var lastFnLevel = this.lastFunctionScopeId();
      return [
          this.newNode('VariableDeclaration', {
              kind: 'var',
              declarations: [
                  this.newVariable('_', '{}'),
                  this.newVariable('lastNode', this.newNode('Identifier', {name: 'undefined'})),
                  this.newVariable('debugging', this.newNode('Literal', {value: false})),
                  this.newVariable('__' + level, []),
                  this.newVariable('_' + level, this.wrapArgsAndDecls(args, decls)),
              ]
          }),
          this.newNode('ExpressionStatement', {
              expression: this.newNode('CallExpression', {
                  callee: this.newNode('MemberExpression', {
                      object: this.newNode('Identifier', { name: '__' + level }),
                      property: this.newNode('Identifier', { name: 'push' }),
                      computed: false
                  }),
                  arguments: [
                      this.newNode('Identifier', { name: '_' }),
                      this.newNode('Identifier', { name: '_' + level }),
                      this.newNode('Identifier', { name: lastFnLevel < 0 ? (typeof window !== "undefined" ? 'window' : 'global') : '__' + lastFnLevel })
                  ]
              })
          })
      ];
  }

  createCatchForUnwind(node, originalFunctionIdx, level) {
      return this.newNode('TryStatement', {
          block: this.newNode('BlockStatement', {body: node.body, astIndex: node.astIndex}),
          handler: this.newNode('CatchClause', {guard: null,
              param: this.newNode('Identifier', {name: 'e'}),
              body: this.newNode('BlockStatement', {body: [
                  this.newNode('VariableDeclaration', {
                      kind: 'var',
                      declarations: [
                          this.newVariable('ex', this.newNode('ConditionalExpression', {
                              test: this.newMemberExp('e.isUnwindException'),
                              consequent: this.newNode('Identifier', {name: 'e'}),
                              alternate: this.newNode('NewExpression', {
                                  arguments: [this.newNode('Identifier', {name: 'e'})],
                                  callee: this.newMemberExp('UnwindException')
                              })
                          }))]
                      }),
                  this.newNode('ExpressionStatement', {
                      expression: this.newNode('CallExpression', {
                          callee: this.newMemberExp('ex.storeFrameInfo'),
                          arguments: [
                              this.newNode('Identifier', {name: 'this'}),
                              this.newNode('Identifier', {name: 'arguments'}),
                              this.newNode('Identifier', {name: '__' + level}),
                              this.newNode('Identifier', {name: "lastNode"}),
                              this.newNode('Literal', {value: this.namespace}),
                              this.newNode('Literal', {value: originalFunctionIdx})]
                      })
                  }),
                  this.newNode('ThrowStatement', {argument: this.newNode('Identifier', {name: 'ex'})})
              ]}),
          }),
          guardedHandlers: [], finalizer: null
      });
  }

  createCatchScope(catchVar) {
      var scopeIdx = this.scopes.length - 1;
      return this.newNode('VariableDeclaration', {
          kind: 'var',
          declarations: [
              this.newVariable('_' + scopeIdx, this.newNode('ObjectExpression', {
                  properties: [{
                      type: "Property",
                      key: this.newNode('Literal', {value: catchVar}),
                      kind: 'init', value: this.newNode('ConditionalExpression', {
                          test: this.newMemberExp(catchVar + '.isUnwindException'),
                          consequent: this.newMemberExp(catchVar + '.error'),
                          alternate: this.newNode('Identifier', {name: catchVar})
                      })
                  }]
              }))
          ]
      });
  }

  wrapSequence(node, args, decls, originalFunctionIdx) {
      var level = this.scopes.length;
      Array.prototype.unshift.apply(node.body, this.createPreamble(args, decls, level));
      return this.createCatchForUnwind(node, originalFunctionIdx, level);
  }

  wrapVar(name) {
      var scopeRef, withScopes = [], that = this;
      for (var i = this.scopes.length - 1; i >= 0; i--) {
          if (arr.include(this.scopes[i].localVars, name)) {
              scopeRef = this.newNode('Identifier', { name: '_' + i });
              break;
          } else if (this.scopes[i].isWithScope)
              withScopes.push(i);
      }

      var result = this.newNode('Identifier', { name: name });
      if ((scopeRef === undefined) && (withScopes.length > 0)) {
          // mr 2014-02-05: the reference is a global one - should throw error?
          scopeRef = this.newNode('ObjectExpression', { properties: [{
              type: "Property",
              kind: 'init',
              key: this.newNode('Literal', { value: name }),
              value: this.newNode('Identifier', { name: name })
          }]}); // { name: name }
      }
      if (scopeRef !== undefined) {
          result = this.newNode('MemberExpression', {
              property: result,
              computed: false
          });
      }

      if (withScopes.length > 0) {
          result.object = withScopes.reverse().reduce(function(alternate, idx) {
              // (name in _xx ? _xx : ...)
              return that.newNode('ConditionalExpression', {
                  test: that.newNode('BinaryExpression', {
                      operator: 'in',
                      left: that.newNode('Literal', { value: name }),
                      right: that.newNode('Identifier', { name: '_' + idx })
                  }),
                  consequent: that.newNode('Identifier', { name: '_' + idx }),
                  alternate: alternate
              });
          }, scopeRef);
      } else
          result.object = scopeRef;
      return result;
  }

  isWrappedVar(node) {
      return node.type == 'MemberExpression' && node.object.type == 'Identifier' &&
             node.object.name[0] == '_' && !isNaN(node.object.name.substr(1));
  }

  wrapClosure(node, namespace, idx) {
      var scopeIdx = this.scopes.length - 1,
          scopeIdentifier = scopeIdx < 0 ?
              this.newNode('Literal', {value: null}) :
              this.newNode('Identifier', { name: '__' + this.lastFunctionScopeId() });
      return this.newNode('CallExpression', {
          callee: this.newNode('Identifier', {name: '__createClosure'}),
          arguments: [
              this.newNode('Literal', {value: namespace}),
              this.newNode('Literal', {value: idx}),
              scopeIdentifier,
              node
          ]
      });
  }

  simpleStoreComputationResult(node, astIndex) {
      return this.newNode('AssignmentExpression', {
          operator: '=',
          left: this.computationReference(astIndex),
          right: node,
          astIndex: astIndex,
          _prefixResult: true
      });
  }

  storeComputationResult(node, start, end, astIndex, postfix) {
      postfix = !!postfix;
      if (this.scopes.length == 0) return node;
      var pos = (node.start || start || 0) + '-' + (node.end || end || 0);
      arr.last(this.scopes).computationProgress.push(pos);

      if (postfix) {
          // _[astIndex] = XX, lastNode = astIndex, _[astIndex]
          return this.newNode('SequenceExpression', {
              expressions: [
                  this.simpleStoreComputationResult(node, astIndex),
                  this.lastNodeExpression(astIndex),
                  this.computationReference(astIndex)
              ],
              _prefixResult: !postfix
          });
      } else {
          // _[lastNode = astIndex] = XX
          return this.newNode('AssignmentExpression', {
              operator: '=',
              left: this.computationReference(this.lastNodeExpression(astIndex)),
              right: node,
              _prefixResult: !postfix
          });
      }
  }

  isStoredComputationResult(node) {
      return this.isPrefixStored(node) || this.isPostfixStored(node);
  }

  isPrefixStored(node) {
      return node._prefixResult === true;
  }

  isPostfixStored(node) {
      return node._prefixResult === false;
  }

  inlineAdvancePC(node, astIndex) {
      return this.newNode('SequenceExpression', {
          expressions: [
              this.lastNodeExpression(astIndex),
              node
          ]
      });
  }

  lastNodeExpression(astIndex) {
      return this.newNode('AssignmentExpression', {
          operator: '=',
          left: this.newNode('Identifier', {name: 'lastNode'}),
          right: this.newNode('Literal', {value: astIndex}),
          astIndex: astIndex
      });
  }

  computationReference(astIndexOrNode) {
      return this.newNode('MemberExpression', {
          object: this.newNode('Identifier', { name: '_' }),
          property: isNaN(astIndexOrNode) ?
              astIndexOrNode : this.newNode('Literal', { value: astIndexOrNode }),
          computed: true
      });
  }

  rewrite(node) {
      this.enterScope();
      walk.addAstIndex(node);
      // FIXME: make astRegistry automatically use right namespace
      node.registryId = this.astRegistry[this.namespace].push(node) - 1;
      if (node.type == 'FunctionDeclaration')
          var args = this.registerVars(node.params); // arguments
      var rewriteVisitor = this.createVisitor(node.registryId),
          decls = this.registerDeclarations(node, rewriteVisitor), // locals
          rewritten = rewriteVisitor.accept(node, this);
      this.exitScope();
      var wrapped = this.wrapSequence(rewritten, args, decls, node.registryId);
      return this.newNode('Program', {body: [wrapped]});
  }

  rewriteFunction(node) {
      if (node.type !== "FunctionExpression")
          throw new Error('no a valid function expression/statement? ' + acorn.printAst(node));
      if (!node.id) node.id = this.newNode("Identifier", {name: ""});

      walk.addAstIndex(node);
      // FIXME: make astRegistry automatically use right namespace
      node.registryId = this.astRegistry[this.namespace].push(node) - 1;
      var rewriteVisitor = this.createVisitor(node.registryId),
          rewritten = rewriteVisitor.accept(node, this);
      // FIXME!
      rewritten = rewritten.expression.right.arguments[3];
      return rewritten;
  }

  rewriteFunctionDeclaration(node, originalRegistryIndex) {
      // FIXME: make astRegistry automatically use right namespace
      node.registryId = this.astRegistry[this.namespace].push(node) - 1;
      node._parentEntry = originalRegistryIndex;
      if (node.id.name.substr(0, 12) == '_NO_REWRITE_') {
          var astCopy = walk.copy(node);
          astCopy.type = 'FunctionExpression';
          return astCopy;
      }

      this.enterScope();
      var args = this.registerVars(node.params), // arguments
          rewriteVisitor = this.createVisitor(originalRegistryIndex),
          decls = this.registerDeclarations(node.body, rewriteVisitor), // locals
          rewritten = rewriteVisitor.accept(node.body, this);
      this.exitScope();
      var wrapped = this.wrapClosure({
          start: node.start, end: node.end, type: 'FunctionExpression',
          body: this.newNode('BlockStatement', {
              body: [this.wrapSequence(rewritten, args, decls, node.registryId)]}),
          id: node.id || null, params: args
      }, this.namespace, node.registryId);
      return wrapped;
  }

};

export class RecordingRewriter extends Rewriter {

  constructor(astRegistry, namespace, recordingFunction)  {
      super(astRegistry, namespace);
      this.recordingFunction = recordingFunction || "__recordComputationStep";
      this.parsedRecordingFunction = parse(this.recordingFunction).body[0].expression;
  }

  createVisitor(registryIndex) {
      return new RecordingVisitor(registryIndex);
  }

  rewrite(node) {
      this.enterScope();
      walk.addAstIndex(node);
      // FIXME: make astRegistry automatically use right namespace
      node.registryId = this.astRegistry[this.namespace].push(node) - 1;
      if (node.type == 'FunctionDeclaration')
          var args = this.registerVars(node.params); // arguments
      var recordingVisitor = this.createVisitor(node.registryId),
          decls = this.registerDeclarations(node, recordingVisitor), // locals
          rewritten = recordingVisitor.accept(node, this);
      this.exitScope();
      var wrapped = this.wrapSequence(rewritten, args, decls, node.registryId);
      return this.newNode('Program', {body: [wrapped]});
  }

  wrapSequence(node, args, decls, originalFunctionIdx) {
      var level = this.scopes.length;
      Array.prototype.unshift.apply(node.body, this.createPreamble(args, decls, level));
      return node;
      // return this.createCatchForUnwind(node, originalFunctionIdx, level);
  }

  recordExpression(node, optLevel, optAstIndex) {
      var level = typeof optLevel === 'number' ? optLevel : this.scopes.length-1;
      var astIndexNode = optAstIndex ?
          this.newNode('Literal', {value: optAstIndex}) :
          this.newNode('Identifier', {name: "lastNode"});

      // FIXME... this gets incorrect once we enter new scopes!....!
      var originalFunctionIdx = this.astRegistry[this.namespace].length-1;
      return this.newNode("CallExpression", {
          arguments: [
              node,
              this.newNode('Identifier', {name: '__' + level}),
              astIndexNode,
              this.newNode('Literal', {value: this.namespace}),
              this.newNode('Literal', {value: originalFunctionIdx})
          ],
          callee: this.parsedRecordingFunction,
          _prefixResult: node._prefixResult,
          _isRecordedExpression: true
      });
  }

  storeComputationResult($super, node, start, end, astIndex, postfix) {
      // show("%s %s %s", escodegen.generate(node), postfix, (new Error()).stack);
      if (node._isRecordedExpression) return node; // already recorded
      if (node.type === "Literal"
          || node.type === "ObjectExpression"
          || node.type === "ArrayExpression") return node;
      return this.recordExpression($super(node, start, end, astIndex, postfix), null, astIndex);
  }

  createPreamble(args, decls, level) {
      var lastFnLevel = this.lastFunctionScopeId();
      decls = decls || [];
      decls.unshift({
          key: this.newNode('Literal', {value: "this"}),
          type: "Property", kind: 'init', value: this.newNode('Identifier', {name: 'this'})
      });
      return [
          this.newNode('VariableDeclaration', {
              kind: 'var',
              declarations: [
                  this.newVariable('_', '{}'),
                  this.newVariable('lastNode', this.newNode('Identifier', {name: 'undefined'})),
                  this.newVariable('debugging', this.newNode('Literal', {value: false})),
                  this.newVariable('__' + level, []),
                  this.newVariable('_' + level, this.wrapArgsAndDecls(args, decls)),
              ]
          }),
          this.newNode('ExpressionStatement', {
              expression: this.newNode('CallExpression', {
                  callee: this.newNode('MemberExpression', {
                      object: this.newNode('Identifier', { name: '__' + level }),
                      property: this.newNode('Identifier', { name: 'push' }),
                      computed: false
                  }),
                  arguments: [
                      this.newNode('Identifier', { name: '_' }),
                      this.newNode('Identifier', { name: '_' + level }),
                      this.newNode('Identifier', { name: lastFnLevel < 0 ? 'Global' : '__' + lastFnLevel })
                  ]
              })
          })
      ].concat(args ? args.map(function(ea) {
              return this.newNode(
                  'ExpressionStatement', {
                      expression: this.recordExpression(
                          this.newNode('Identifier', {name: ea.name}),
                          lastFnLevel+1, ea.astIndex)
                  });
          }, this) : []);
  }

  rewriteFunctionDeclaration(node, originalRegistryIndex) {
      // FIXME: make astRegistry automatically use right namespace
      node.registryId = this.astRegistry[this.namespace].push(node) - 1;
      node._parentEntry = originalRegistryIndex;
      if (node.id.name.substr(0, 12) == '_NO_REWRITE_') {
          var astCopy = walk.copy(node);
          astCopy.type = 'FunctionExpression';
          return astCopy;
      }

      this.enterScope();
      var args = this.registerVars(node.params), // arguments
          rewriteVisitor = this.createVisitor(originalRegistryIndex),
          decls = this.registerDeclarations(node.body, rewriteVisitor), // locals
          rewritten = rewriteVisitor.accept(node.body, this);
      this.exitScope();
      var wrapped = this.wrapClosure({
          start: node.start, end: node.end, type: 'FunctionExpression',
          body: this.wrapSequence(rewritten, args, decls, node.registryId),
          id: node.id || null, params: args
      }, this.namespace, node.registryId);
      return wrapped;
  }
};

// This code was generated with:
// MozillaAST.createVisitorCode({openWindow: true, asLivelyClass: true, parameters: ["state"], useReturn: true, name: "Visitor"});
export class BaseVisitor {
  accept(node, state) {
      if (!this['visit' + node.type]) {
        throw new Error("Visitor " + this + " cannot deal with node of type " + node.type);
      }
      return node ? this['visit' + node.type](node, state) : null;
  }

  visitProgram(node, state) {
      node.body = node.body.map(function(ea) {
          // ea is of type Statement
          return this.accept(ea, state);
      }, this);
      return node;
  }

  visitFunction(node, state) {
      if (node.id) {
          // id is a node of type Identifier
          node.id = this.accept(node.id, state);
      }

      node.params = node.params.map(function(ea) {
          // ea is of type Pattern
          return this.accept(ea, state);
      }, this);

      if (node.defaults) {
          node.defaults = node.defaults.map(function(ea) {
              // ea is of type Expression
              return this.accept(ea, state);
          }, this);
      }

      if (node.rest) {
          // rest is a node of type Identifier
          node.rest = this.accept(node.rest, state);
      }

      // body is a node of type BlockStatement
      node.body = this.accept(node.body, state);

      // node.generator has a specific type that is boolean
      if (node.generator) {/*do stuff*/}

      // node.expression has a specific type that is boolean
      if (node.expression) {/*do stuff*/}
      return node;
  }

  visitStatement(node, state) {
      return node;
  }

  visitEmptyStatement(node, state) {
      return node;
  }

  visitBlockStatement(node, state) {
      node.body = node.body.map(function(ea) {
          // ea is of type Statement
          return this.accept(ea, state);
      }, this);
      return node;
  }

  visitExpressionStatement(node, state) {
      // expression is a node of type Expression
      node.expression = this.accept(node.expression, state);
      return node;
  }

  visitIfStatement(node, state) {
      // test is a node of type Expression
      node.test = this.accept(node.test, state);

      // consequent is a node of type Statement
      node.consequent = this.accept(node.consequent, state);

      if (node.alternate) {
          // alternate is a node of type Statement
          node.alternate = this.accept(node.alternate, state);
      }
      return node;
  }

  visitLabeledStatement(node, state) {
      // label is a node of type Identifier
      node.label = this.accept(node.label, state);

      // body is a node of type Statement
      node.body = this.accept(node.body, state);
      return node;
  }

  visitBreakStatement(node, state) {
      if (node.label) {
          // label is a node of type Identifier
          node.label = this.accept(node.label, state);
      }
      return node;
  }

  visitContinueStatement(node, state) {
      if (node.label) {
          // label is a node of type Identifier
          node.label = this.accept(node.label, state);
      }
      return node;
  }

  visitWithStatement(node, state) {
      // object is a node of type Expression
      node.object = this.accept(node.object, state);

      // body is a node of type Statement
      node.body = this.accept(node.body, state);
      return node;
  }

  visitSwitchStatement(node, state) {
      // discriminant is a node of type Expression
      node.discriminant = this.accept(node.discriminant, state);

      node.cases = node.cases.map(function(ea) {
          // ea is of type SwitchCase
          return this.accept(ea, state);
      }, this);

      // node.lexical has a specific type that is boolean
      if (node.lexical) {/*do stuff*/}
      return node;
  }

  visitReturnStatement(node, state) {
      if (node.argument) {
          // argument is a node of type Expression
          node.argument = this.accept(node.argument, state);
      }
      return node;
  }

  visitThrowStatement(node, state) {
      // argument is a node of type Expression
      node.argument = this.accept(node.argument, state);
      return node;
  }

  visitTryStatement(node, state) {
      // block is a node of type BlockStatement
      node.block = this.accept(node.block, state);

      if (node.handler) {
          // handler is a node of type CatchClause
          node.handler = this.accept(node.handler, state);
      }

      node.guardedHandlers = node.guardedHandlers && node.guardedHandlers.map(function(ea) {
          // ea is of type CatchClause
          return this.accept(ea, state);
      }, this);

      if (node.finalizer) {
          // finalizer is a node of type BlockStatement
          node.finalizer = this.accept(node.finalizer, state);
      }
      return node;
  }

  visitWhileStatement(node, state) {
      // test is a node of type Expression
      node.test = this.accept(node.test, state);

      // body is a node of type Statement
      node.body = this.accept(node.body, state);
      return node;
  }

  visitDoWhileStatement(node, state) {
      // body is a node of type Statement
      node.body = this.accept(node.body, state);

      // test is a node of type Expression
      node.test = this.accept(node.test, state);
      return node;
  }

  visitForStatement(node, state) {
      if (node.init) {
          // init is a node of type VariableDeclaration
          node.init = this.accept(node.init, state);
      }

      if (node.test) {
          // test is a node of type Expression
          node.test = this.accept(node.test, state);
      }

      if (node.update) {
          // update is a node of type Expression
          node.update = this.accept(node.update, state);
      }

      // body is a node of type Statement
      node.body = this.accept(node.body, state);
      return node;
  }

  visitForInStatement(node, state) {
      // left is a node of type VariableDeclaration
      node.left = this.accept(node.left, state);

      // right is a node of type Expression
      node.right = this.accept(node.right, state);

      // body is a node of type Statement
      node.body = this.accept(node.body, state);

      // node.each has a specific type that is boolean
      if (node.each) {/*do stuff*/}
      return node;
  }

  visitForOfStatement(node, state) {
      // left is a node of type VariableDeclaration
      node.left = this.accept(node.left, state);

      // right is a node of type Expression
      node.right = this.accept(node.right, state);

      // body is a node of type Statement
      node.body = this.accept(node.body, state);
      return node;
  }

  visitLetStatement(node, state) {
      node.head = node.head.map(function(ea) {
          // ea.id is of type node
          ea.id = this.accept(ea.id, state);
          if (ea.init) {
              // ea.init can be of type node
              ea.init = this.accept(ea.init, state);
          }
          return ea;
      }, this);

      // body is a node of type Statement
      node.body = this.accept(node.body, state);
      return node;
  }

  visitDeclaration(node, state) {
      return node;
  }

  visitFunctionDeclaration(node, state) {
      // id is a node of type Identifier
      node.id = this.accept(node.id, state);

      node.params = node.params.map(function(ea) {
          // ea is of type Pattern
          return this.accept(ea, state);
      }, this);

      if (node.defaults) {
          node.defaults = node.defaults.map(function(ea) {
              // ea is of type Expression
              return this.accept(ea, state);
          }, this);
      }

      if (node.rest) {
          // rest is a node of type Identifier
          node.rest = this.accept(node.rest, state);
      }

      // body is a node of type BlockStatement
      node.body = this.accept(node.body, state);

      // node.generator has a specific type that is boolean
      if (node.generator) {/*do stuff*/}

      // node.expression has a specific type that is boolean
      if (node.expression) {/*do stuff*/}
      return node;
  }

  visitVariableDeclaration(node, depth, state, path) {
    var retVal;
    node.declarations.forEach(function(ea, i) {
      // ea is of type VariableDeclarator
      retVal = this.accept(ea, state);
    }, this);

    // node.kind is "var" or "let" or "const"
    return retVal;
  }

  visitVariableDeclarator(node, state) {
      // id is a node of type Pattern
      node.id = this.accept(node.id, state);

      if (node.init) {
          // init is a node of type Expression
          node.init = this.accept(node.init, state);
      }
      return node;
  }

  visitExpression(node, state) {
      return node;
  }

  visitThisExpression(node, state) {
      return node;
  }

  visitArrayExpression(node, state) {
      node.elements = node.elements.map(function(ea) {
          if (ea) {
              // ea can be of type Expression or
              return this.accept(ea, state);
          }
      }, this);
      return node;
  }

  visitArrowFunctionExpression(node, state) {
      node.params = node.params.map(function(ea) {
          // ea is of type Pattern
          return this.accept(ea, state);
      }, this);

      if (node.defaults) {
          node.defaults = node.defaults.map(function(ea) {
              // ea is of type Expression
              return this.accept(ea, state);
          }, this);
      }

      if (node.rest) {
          // rest is a node of type Identifier
          node.rest = this.accept(node.rest, state);
      }

      // body is a node of type BlockStatement
      node.body = this.accept(node.body, state);

      // node.generator has a specific type that is boolean
      if (node.generator) {/*do stuff*/}

      // node.expression has a specific type that is boolean
      if (node.expression) {/*do stuff*/}
      return node;
  }

  visitArrowExpression(node, state) {
    return this.visitArrowFunctionExpression(node,state);
  }

  visitSequenceExpression(node, state) {
      node.expressions = node.expressions.map(function(ea) {
          // ea is of type Expression
          return this.accept(ea, state);
      }, this);
      return node;
  }

  visitUnaryExpression(node, state) {
      // node.operator is an UnaryOperator enum:
      // "-" | "+" | "!" | "~" | "typeof" | "void" | "delete"

      // node.prefix has a specific type that is boolean
      if (node.prefix) {/*do stuff*/}

      // argument is a node of type Expression
      node.argument = this.accept(node.argument, state);
      return node;
  }

  visitBinaryExpression(node, state) {
      // node.operator is an BinaryOperator enum:
      // "==" | "!=" | "===" | "!==" | | "<" | "<=" | ">" | ">=" | | "<<" | ">>" | ">>>" | | "+" | "-" | "*" | "/" | "%" | | "|" | "^" | "&" | "in" | | "instanceof" | ".."

      // left is a node of type Expression
      node.left = this.accept(node.left, state);

      // right is a node of type Expression
      node.right = this.accept(node.right, state);
      return node;
  }

  visitAssignmentExpression(node, state) {
      // node.operator is an AssignmentOperator enum:
      // "=" | "+=" | "-=" | "*=" | "/=" | "%=" | | "<<=" | ">>=" | ">>>=" | | "|=" | "^=" | "&="

      // left is a node of type Pattern
      node.left = this.accept(node.left, state);

      // right is a node of type Expression
      node.right = this.accept(node.right, state);
      return node;
  }

  visitUpdateExpression(node, state) {
      // node.operator is an UpdateOperator enum:
      // "++" | "--"

      // argument is a node of type Expression
      node.argument = this.accept(node.argument, state);

      // node.prefix has a specific type that is boolean
      if (node.prefix) {/*do stuff*/}
      return node;
  }

  visitLogicalExpression(node, state) {
      // node.operator is an LogicalOperator enum:
      // "||" | "&&"

      // left is a node of type Expression
      node.left = this.accept(node.left, state);

      // right is a node of type Expression
      node.right = this.accept(node.right, state);
      return node;
  }

  visitConditionalExpression(node, state) {
      // test is a node of type Expression
      node.test = this.accept(node.test, state);

      // alternate is a node of type Expression
      node.alternate = this.accept(node.alternate, state);

      // consequent is a node of type Expression
      node.consequent = this.accept(node.consequent, state);
      return node;
  }

  visitNewExpression(node, state) {
      // callee is a node of type Expression
      node.callee = this.accept(node.callee, state);

      node.arguments = node.arguments.map(function(ea) {
          // ea is of type Expression
          return this.accept(ea, state);
      }, this);
      return node;
  }

  visitCallExpression(node, state) {
      // callee is a node of type Expression
      node.callee = this.accept(node.callee, state);

      node.arguments = node.arguments.map(function(ea) {
          // ea is of type Expression
          return this.accept(ea, state);
      }, this);
      return node;
  }

  visitMemberExpression(node, state) {
      // object is a node of type Expression
      node.object = this.accept(node.object, state);

      // property is a node of type Identifier
      node.property = this.accept(node.property, state);

      // node.computed has a specific type that is boolean
      if (node.computed) {/*do stuff*/}
      return node;
  }

  visitYieldExpression(node, state) {
      if (node.argument) {
          // argument is a node of type Expression
          node.argument = this.accept(node.argument, state);
      }
      return node;
  }

  visitComprehensionExpression(node, state) {
      // body is a node of type Expression
      node.body = this.accept(node.body, state);

      node.blocks = node.blocks.map(function(ea) {
          // ea is of type ComprehensionBlock
          return this.accept(ea, state);
      }, this);

      if (node.filter) {
          // filter is a node of type Expression
          node.filter = this.accept(node.filter, state);
      }
      return node;
  }

  visitGeneratorExpression(node, state) {
      // body is a node of type Expression
      node.body = this.accept(node.body, state);

      node.blocks = node.blocks.map(function(ea) {
          // ea is of type ComprehensionBlock
          return this.accept(ea, state);
      }, this);

      if (node.filter) {
          // filter is a node of type Expression
          node.filter = this.accept(node.filter, state);
      }
      return node;
  }

  visitLetExpression(node, state) {
      node.head = node.head.map(function(ea) {
          // ea.id is of type node
          ea.id = this.accept(ea.id, state);
          if (ea.init) {
              // ea.init can be of type node
              ea.init = this.accept(ea.init, state);
          }
          return ea;
      }, this);

      // body is a node of type Expression
      node.body = this.accept(node.body, state);
      return node;
  }

  visitPattern(node, state) {
      return node;
  }

  visitObjectPattern(node, state) {
      node.properties = node.properties.map(function(ea) {
          // ea.key is of type node
          ea.key = this.accept(ea.key, state);
          // ea.value is of type node
          ea.value = this.accept(ea.value, state);
          return ea;
      }, this);
      return node;
  }

  visitArrayPattern(node, state) {
      node.elements = node.elements.map(function(ea) {
          return this.accept(ea, state);
      }, this);
      return node;
  }

  visitSwitchCase(node, state) {
      if (node.test) {
          // test is a node of type Expression
          node.test = this.accept(node.test, state);
      }

      node.consequent = node.consequent.map(function(ea) {
          // ea is of type Statement
          return this.accept(ea, state);
      }, this);
      return node;
  }

  visitCatchClause(node, state) {
      // param is a node of type Pattern
      node.param = this.accept(node.param, state);

      if (node.guard) {
          // guard is a node of type Expression
          node.guard = this.accept(node.guard, state);
      }

      // body is a node of type BlockStatement
      node.body = this.accept(node.body, state);
      return node;
  }

  visitComprehensionBlock(node, state) {
      // left is a node of type Pattern
      node.left = this.accept(node.left, state);

      // right is a node of type Expression
      node.right = this.accept(node.right, state);

      // node.each has a specific type that is boolean
      if (node.each) {/*do stuff*/}
      return node;
  }

  visitComprehensionIf(node, state) {
      // test is a node of type Expression
      node.test = this.accept(node.test, state);
      return node;
  }

  visitIdentifier(node, state) {
      // node.name has a specific type that is string
      return node;
  }

  visitLiteral(node, state) {
      if (node.value) {
          // node.value has a specific type that is string or boolean or number or RegExp
      }
      return node;
  }

  visitClassDeclaration(node, state) {
      // id is a node of type Identifier
      node.id = this.accept(node.id, state);

      if (node.superClass) {
          // superClass is a node of type Identifier
          node.superClass = this.accept(node.superClass, state);
      }

      // body is a node of type ClassBody
      node.body = this.accept(node.body, state);
      return node;
  }

  visitClassBody(node, state) {
      node.body = node.body.map(function(ea) {
          // ea is of type MethodDefinition
          return this.accept(ea, state);
      }, this);
      return node;
  }

  visitMethodDefinition(node, state) {
      // node.static has a specific type that is boolean
      if (node.static) {/*do stuff*/}

      // node.computed has a specific type that is boolean
      if (node.computed) {/*do stuff*/}

      // node.kind is ""

      // key is a node of type Identifier
      node.key = this.accept(node.key, state);

      // value is a node of type FunctionExpression
      node.value = this.accept(node.value, state);
      return node;
  }

  visitJSXIdentifier(node, state) {
      return node;
  }

  visitJSXMemberExpression(node, state) {
      // object is a node of type JSXMemberExpression
      node.object = this.accept(node.object, state);

      // property is a node of type JSXIdentifier
      node.property = this.accept(node.property, state);
      return node;
  }

  visitJSXNamespacedName(node, state) {
      // namespace is a node of type JSXIdentifier
      node.namespace = this.accept(node.namespace, state);

      // name is a node of type JSXIdentifier
      node.name = this.accept(node.name, state);
      return node;
  }

  visitJSXEmptyExpression(node, state) {
      return node;
  }

  visitJSXBoundaryElement(node, state) {
      // name is a node of type JSXIdentifier
      node.name = this.accept(node.name, state);
      return node;
  }

  visitJSXOpeningElement(node, state) {
      node.attributes = node.attributes.map(function(ea) {
          // ea is of type JSXAttribute or JSXSpreadAttribute
          return this.accept(ea, state);
      }, this);

      // node.selfClosing has a specific type that is boolean
      if (node.selfClosing) {/*do stuff*/}
      return node;
  }

  visitJSXClosingElement(node, state) {
      return node;
  }

  visitJSXAttribute(node, state) {
      // name is a node of type JSXIdentifier
      node.name = this.accept(node.name, state);

      if (node.value) {
          // value is a node of type Literal
          node.value = this.accept(node.value, state);
      }
      return node;
  }

  visitSpreadElement(node, state) {
      // argument is a node of type Expression
      node.argument = this.accept(node.argument, state);
      return node;
  }

  visitJSXSpreadAttribute(node, state) {
      return node;
  }

  visitJSXElement(node, state) {
      // openingElement is a node of type JSXOpeningElement
      node.openingElement = this.accept(node.openingElement, state);

      node.children = node.children.map(function(ea) {
          // ea is of type Literal or JSXExpressionContainer or JSXElement
          return this.accept(ea, state);
      }, this);

      if (node.closingElement) {
          // closingElement is a node of type JSXClosingElement
          node.closingElement = this.accept(node.closingElement, state);
      }
      return node;
  }

};

//lang['class'].create(Rewriting.BaseVisitor, "Rewriting.RewriteVisitor",
export class RewriteVisitor extends BaseVisitor {

  constructor(registryIndex) {
      this.registryIndex = registryIndex;
  }

  visitProgram(n, rewriter) {
      return {
          start: n.start, end: n.end, type: 'Program',
          body: n.body.map(function(node) {
              // node is of type Statement
              return this.accept(node, rewriter);
          }, this),
          astIndex: n.astIndex
      };
  }        

  visitBlockStatement(n, rewriter) {
      return {
          start: n.start, end: n.end, type: 'BlockStatement',
          body: n.body.map(function(node) {
              // node is of type Statement
              return this.accept(node, rewriter);
          }, this),
          astIndex: n.astIndex
      };
  }

  visitSequenceExpression(n, rewriter) {
      return {
          start: n.start, end: n.end, type: 'SequenceExpression',
          expressions: n.expressions.map(function(node) {
              // node is of type Expression
              return this.accept(node, rewriter);
          }, this),
          astIndex: n.astIndex
      };
  }

  visitExpressionStatement(n, rewriter) {
      // expression is a node of type Expression
      var expr = this.accept(n.expression, rewriter);
      if (expr.type == 'ExpressionStatement')
          expr = expr.expression; // unwrap
      return {
          start: n.start, end: n.end, type: 'ExpressionStatement',
          expression: expr, astIndex: n.astIndex
      };
  }

  visitReturnStatement(n, rewriter) {
      // argument is a node of type Expression
      var arg = n.argument ?
          this.accept(n.argument, rewriter) : null;
      if (arg && arg.type == 'ExpressionStatement')
          arg = arg.expression; // unwrap
      return {
          start: n.start, end: n.end, type: 'ReturnStatement',
          argument: arg, astIndex: n.astIndex
      };
  }

  visitForStatement(n, rewriter) {
      // init is a node of type VariableDeclaration or Expression or null
      var init = n.init ? this.accept(n.init, rewriter) : null;
      if (init && init.type == 'ExpressionStatement') {
          init.expression.astIndex = init.astIndex;
          init = init.expression;
      }
      return {
          start: n.start, end: n.end, type: 'ForStatement', astIndex: n.astIndex,
          init: init,
          // test is a node of type Expression
          test: n.test ? this.accept(n.test, rewriter) : null,
          // update is a node of type Expression
          update: n.update ? this.accept(n.update, rewriter) : null,
          // body is a node of type Statement
          body: this.accept(n.body, rewriter)
      };
  }

  visitForInStatement(n, rewriter) {
      // left is a node of type VariableDeclaration
      // right is a node of type Expression
      // body is a node of type Statement
      // n.each has a specific type that is boolean
      var left, right = this.accept(n.right, rewriter),
          body = this.accept(n.body, rewriter),
          start = n.start, end = n.end, astIndex = n.right.astIndex;
      if (n.left.type == 'VariableDeclaration') {
          left = this.accept(n.left.declarations[0].id, rewriter);
          // fake astIndex for source mapping
          left.astIndex = n.left.astIndex;
          left.object.astIndex = n.left.declarations[0].astIndex;
          left.property.astIndex = n.left.declarations[0].id.astIndex;
      } else
          left = this.accept(n.left, rewriter);
      if (body.type !== 'BlockStatement') {
          body = rewriter.newNode('BlockStatement', {body: [body]})
      }
      // add expression like _[lastNode = x] = _[x] || Object.keys(b); to the top of the loop body
      body.body.unshift({
          type: 'ExpressionStatement',
          expression: rewriter.storeComputationResult({
              type: 'LogicalExpression',
              operator: '||',
              left: {
                  type: 'MemberExpression',
                  object: { type: 'Identifier', name: '_' },
                  property: { type: 'Literal', value: astIndex },
                  computed: true
              },
              right: {
                  type: 'CallExpression',
                  callee: {
                      type: 'MemberExpression',
                      object: { type: 'Identifier', name: 'Object' },
                      property: { type: 'Identifier', name: 'keys' },
                      computed: false
                  },
                  arguments: [ right ]
              }
          }, start, end, astIndex)
      });
      // add expression like _[x].shift(); to the bottom of the loop body
      body.body.push({
          type: 'ExpressionStatement',
          expression: {
              type: 'CallExpression',
              callee: {
                  type: 'MemberExpression',
                  object: {
                      type: 'MemberExpression',
                      object: { type: 'Identifier', name: '_' },
                      property: { type: 'Literal', value: astIndex },
                      computed: true
                  },
                  property: { type: 'Identifier', name: 'shift' },
                  computed: false
              },
              arguments: [ ]
          }
      });
      return {
          start: n.start, end: n.end, type: 'ForInStatement',
          left: left, right: right, body: body,
          each: n.each, astIndex: n.astIndex
      };
  }

  visitDoWhileStatement(n, rewriter) {
      // body is a node of type Statement
      // test is a node of type Expression
      return {
          start: n.start, end: n.end, type: 'DoWhileStatement',
          test: this.accept(n.test, rewriter),
          body: this.accept(n.body, rewriter),
          astIndex: n.astIndex
      };
  }

  visitWhileStatement(n, rewriter) {
      // test is a node of type Expression
      // body is a node of type Statement
      return {
          start: n.start, end: n.end, type: 'WhileStatement',
          test: this.accept(n.test, rewriter),
          body: this.accept(n.body, rewriter),
          astIndex: n.astIndex
      };
  }

  visitIfStatement(n, rewriter) {
      // Since visitDebuggerStatement creates an if block,
      // make sure to wrap it in a block when it is the only statement
      var test = this.accept(n.test, rewriter),
          consequent = this.accept(n.consequent, rewriter),
          alternate = n.alternate;
      if (n.consequent.type == 'DebuggerStatement')
          consequent = rewriter.newNode('BlockStatement', { body: [consequent] });
      if (alternate) {
          alternate = this.accept(alternate, rewriter);
          if (n.alternate.type == 'DebuggerStatement')
              alternate = rewriter.newNode('BlockStatement', { body: [alternate] });
      }
      return {
          start: n.start, end: n.end, type: 'IfStatement',
          test: test, consequent: consequent, alternate: alternate,
          astIndex: n.astIndex
      };
  }

  visitSwitchStatement(n, rewriter) {
      // discriminant is a node of type Expression
      var discriminant = this.accept(n.discriminant, rewriter);
      if (!rewriter.isStoredComputationResult(discriminant)) {
          // definitely capture state because it can be changed in switch cases (resume in case)
          discriminant = rewriter.storeComputationResult(discriminant,
              n.discriminant.start, n.discriminant.end, n.discriminant.astIndex);
      }
      return {
          start: n.start, end: n.end, type: 'SwitchStatement',
          discriminant: discriminant,
          cases: n.cases.map(function(node) {
              // node is of type SwitchCase
              return this.accept(node, rewriter);
          }, this),
          astIndex: n.astIndex
      };
  }

  visitSwitchCase(n, rewriter) {
      // test is a node of type Expression
      var test = null;
      if (n.test) {
          var test = this.accept(n.test, rewriter);
          if (test != null && !rewriter.isStoredComputationResult(test) && test.type != 'Literal') {
              // definitely capture state because it can be changed in cases' bodies (resume in case)
              test = rewriter.storeComputationResult(test,
                  n.test.start, n.test.end, n.test.astIndex);
          }
      }
      return {
          start: n.start, end: n.end, type: 'SwitchCase',
          test: test,
          consequent: n.consequent.map(function(node) {
              // node is of type Statement
              return this.accept(node, rewriter);
          }, this),
          source: n.source, astIndex: n.astIndex
      };
  }

  visitBreakStatement(n, rewriter) {
      // label is a node of type Identifier
      return {
          start: n.start, end: n.end, type: 'BreakStatement',
          label: n.label,
          astIndex: n.astIndex
      };
  }

  visitContinueStatement(n, rewriter) {
      // label is a node of type Identifier
      return {
          start: n.start, end: n.end, type: 'ContinueStatement',
          label: n.label,
          astIndex: n.astIndex
      };
  }

  visitDebuggerStatement(n, rewriter) {
      // do something to trigger the debugger
      var start = n.start, end = n.end, astIndex = n.astIndex;
      var fn = rewriter.newNode('FunctionExpression', {
          body: rewriter.newNode('BlockStatement', {
              body: [rewriter.newNode('ReturnStatement', {
                  argument: rewriter.newNode('Literal', { value: 'Debugger' })
              })]
          }), id: null, params: []
      });

      return rewriter.newNode('IfStatement', {
          // if (lively.lang.Path('lively.Config.enableDebuggerStatements').get([global or window]))
          test: rewriter.newNode('CallExpression', {
            callee: rewriter.newNode('MemberExpression', {
                object: rewriter.newNode('CallExpression', {
                    callee: rewriter.newNode('MemberExpression', {
                        object: rewriter.newNode('MemberExpression', {
                            object: rewriter.newNode('Identifier', { name: 'lively' }),
                            property: rewriter.newNode('Identifier', { name: 'lang' }),
                            computed: false
                        }),
                        property: rewriter.newNode('Identifier', { name: 'Path' }),
                        computed: false
                    }),
                    arguments: [
                        rewriter.newNode('Literal', { value: 'lively.Config.enableDebuggerStatements' })
                    ]
                }),
                property: rewriter.newNode('Identifier', { name: 'get' }),
                computed: false
            }),
            arguments: [
                rewriter.newNode('Identifier', { name: (typeof window !== "undefined" ? 'window' : 'global') })
            ]
          }),
          consequent: rewriter.newNode('BlockStatement', { body: [
              // debugging = true;
              rewriter.newNode('ExpressionStatement', {
                  expression: rewriter.newNode('AssignmentExpression', {
                      operator: '=',
                      left: rewriter.newNode('Identifier', { name: 'debugging' }),
                      right: rewriter.newNode('Literal', { value: true })
                  })
              }),
              // _[lastNode = xx] = undefined;
              rewriter.newNode('ExpressionStatement', {
                  expression: rewriter.storeComputationResult(
                      rewriter.newNode('Identifier', { name: 'undefined' }), n.start, n.end, astIndex)
              }),
              // throw { toString: function() { return 'Debugger'; }, astIndex: xx };
              rewriter.newNode('ThrowStatement', {
                  argument: rewriter.newNode('ObjectExpression', {
                      properties: [{
                          type: "Property",
                          key: rewriter.newNode('Identifier', { name: 'toString' }),
                          kind: 'init', value: fn
                      }, {
                          type: "Property",
                          key: rewriter.newNode('Identifier', { name: 'astIndex' }),
                          kind: 'init', value: rewriter.newNode('Literal', {value: astIndex})
                      }]
                  })
              })
          ]}),
          alternate: null
      });
  }

  visitFunctionDeclaration(n, rewriter) {
      // FunctionDeclarations are handled in registerDeclarations
      // only advance the pc
      return {
          type: 'ExpressionStatement',
          expression: rewriter.lastNodeExpression(n.astIndex)
      };
  }

  visitArrowFunctionExpression(n, rewriter) {
    return this.visitFunctionExpression(n, rewriter);
  }

  visitFunctionExpression(n, rewriter) {
      // id is a node of type Identifier
      // each of n.params is of type Pattern
      // each of n.defaults is of type Expression (optional)
      // rest is a node of type Identifier (optional)
      // body is a node of type BlockStatement
      // n.generator has a specific type that is boolean
      // n.expression has a specific type that is boolean

      // FIXME: make astRegistry automatically use right namespace
      n.registryId = rewriter.astRegistry[rewriter.namespace].push(n) - 1;
      n._parentEntry = this.registryIndex;

      var start = n.start, end = n.end, astIndex = n.astIndex;
      if (n.id && n.id.name.substr(0, 12) == '_NO_REWRITE_') {
          return rewriter.newNode('ExpressionStatement', {
              expression: rewriter.storeComputationResult(n, n.start, n.end, astIndex),
              id: n.id
          });
      }

      rewriter.enterScope();
      // Arrow functions can have a single node as body:
      var body = n.body.type === "BlockStatement" ? n.body :
            {type: "BlockStatement", body: [{type: "ReturnStatement", argument: n.body}]},
          args = rewriter.registerVars(n.params), // arguments
          decls = rewriter.registerDeclarations(body, this), // locals
          rewritten = this.accept(body, rewriter);
      rewriter.exitScope();
      var wrapped = rewriter.wrapClosure({
          start: n.start, end: n.end, type: 'FunctionExpression',
          body: rewriter.newNode('BlockStatement', {
              body: [rewriter.wrapSequence(rewritten, args, decls, n.registryId)]}),
          id: n.id || null, params: args, astIndex: n.astIndex
      }, rewriter.namespace, n.registryId);
      wrapped.astIndex = n.astIndex;
      wrapped = rewriter.newNode('ExpressionStatement', {
          expression: rewriter.simpleStoreComputationResult(wrapped, astIndex),
          id: n.id
      });
      return wrapped;
  }

  visitVariableDeclaration(n, rewriter) {
      // each of n.declarations is of type VariableDeclarator
      // n.kind is "var" or "let" or "const"
      var start = n.start, end = n.end, astIndex = n.astIndex;
      var decls = n.declarations.map(function(decl) {
          if (decl.init == null) { // no initialization, e.g. var x;
              // only advance the pc
              var node = rewriter.lastNodeExpression(decl.astIndex);
              node.right.astIndex = decl.id.astIndex; // fake astIndex for source mapping
              return node;
          }

          var value = this.accept(decl.init, rewriter);
          value = rewriter.newNode('AssignmentExpression', {
              left: this.accept(decl.id, rewriter),
              operator: '=',
              right: (decl.init && decl.init.type == 'FunctionExpression') ?
                  value.expression : // unwrap
                  value,
              astIndex: decl.astIndex
          });
          return rewriter.storeComputationResult(value, start, end, decl.astIndex, true);
      }, this);

      return rewriter.newNode('ExpressionStatement', {
          expression: decls.length == 1 ? decls[0] :
              rewriter.newNode('SequenceExpression', {expressions: decls}),
          astIndex: astIndex
      });
  }

  visitArrayExpression(n, rewriter) {
      // each of n.elements can be of type Expression
      return {
          start: n.start, end: n.end, type: 'ArrayExpression', astIndex: n.astIndex,
          elements: n.elements.map(function(element) {
              var elem = this.accept(element, rewriter);
              if (elem.type == 'ExpressionStatement')
                  elem = elem.expression; // unwrap
              return elem;
          }, this)
      };
  }

  visitObjectExpression(n, rewriter) {
      // each.key of n.properties is of type node
      // each.value of n.properties is of type node
      // each.kind of n.properties is "init" or "get" or "set"
      return {
          start: n.start, end: n.end, type: 'ObjectExpression', astIndex: n.astIndex,
          properties: n.properties.map(function(prop) {
              var value = this.accept(prop.value, rewriter);
              if (prop.kind != 'init') { // set or get
                  // function cannot be replace by a closure directly
                  value = value.expression.right.arguments[3]; // unwrap
              }
              var key = prop.key.type == 'Identifier' ?
                  { // original identifier rule
                      start: prop.key.start, end: prop.key.end, type: 'Identifier',
                      name: prop.key.name, astIndex: prop.key.astIndex
                  } : this.accept(prop.key, rewriter);
              return {
                  type: "Property",
                  key: key,
                  value: (value.type == 'ExpressionStatement') ?
                      value.expression : // unwrap
                      value,
                  kind: prop.kind,
                  astIndex: prop.astIndex
              };
          }, this)
      };
  }

  visitAssignmentExpression(n, rewriter) {  // Set, ModifyingSet
      // n.operator is an AssignmentOperator enum:
      // "=" | "+=" | "-=" | "*=" | "/=" | "%=" | | "<<=" | ">>=" | ">>>=" | | "|=" | "^=" | "&="
      // left is a node of type Expression
      // right is a node of type Expression
      var start = n.start, end = n.end, astIndex = n.astIndex;
      var right = this.accept(n.right, rewriter);
      if (right.type == 'ExpressionStatement')
          right = right.expression; // unwrap
      return rewriter.storeComputationResult({
          type: 'AssignmentExpression',
          operator: n.operator,
          left: this.accept(n.left, rewriter),
          right: right
      }, start, end, astIndex);
  }

  visitUpdateExpression(n, rewriter) {
      // n.operator is an UpdateOperator enum:
      // "++" | "--"
      // argument is a node of type Expression
      // n.prefix has a specific type that is boolean
      var start = n.start, end = n.end, astIndex = n.astIndex;
      return rewriter.storeComputationResult({
          type: 'UpdateExpression',
          argument: this.accept(n.argument, rewriter),
          operator: n.operator, prefix: n.prefix
      }, start, end, astIndex);
  }

  visitUnaryExpression(n, rewriter) {
      // node.operator is an UnaryOperator enum:
      // "-" | "+" | "!" | "~" | "typeof" | "void" | "delete"
      // n.prefix has a specific type that is boolean
      // argument is a node of type Expression
      return {
          start: n.start, end: n.end, type: 'UnaryExpression',
          argument: this.accept(n.argument, rewriter),
          operator: n.operator, prefix: n.prefix,
          astIndex: n.astIndex
      };
  }

  visitBinaryExpression(n, rewriter) {
      // node.operator is an BinaryOperator enum:
      // "==" | "!=" | "===" | "!==" | | "<" | "<=" | ">" | ">=" | | "<<" | ">>" | ">>>" | | "+" | "-" | "*" | "/" | "%" | | "|" | "^" | "&" | "in" | | "instanceof" | ".."
      // left is a node of type Expression
      // right is a node of type Expression
      return {
          start: n.start, end: n.end, type: 'BinaryExpression',
          left: this.accept(n.left, rewriter),
          right: this.accept(n.right, rewriter),
          operator: n.operator, astIndex: n.astIndex
      };
  }

  visitLogicalExpression(n, rewriter) {
      // n.operator is an LogicalOperator enum:
      // "||" | "&&"
      // left is a node of type Expression
      // right is a node of type Expression
      var left = this.accept(n.left, rewriter);
      if (left.type == 'ExpressionStatement')
          left = left.expression; // unwrap
      var right = this.accept(n.right, rewriter);
      if (right.type == 'ExpressionStatement')
          right = right.expression; // unwrap
      return {
          start: n.start, end: n.end, type: 'LogicalExpression',
          left: left, operator: n.operator, right: right, astIndex: n.astIndex
      };
  }

  visitConditionalExpression(n, rewriter) {
      // test is a node of type Expression
      // alternate is a node of type Expression
      // consequent is a node of type Expression
      var consequent = this.accept(n.consequent, rewriter);
      if (consequent.type == 'ExpressionStatement')
          consequent = consequent.expression; // unwrap;
      var alternate = this.accept(n.alternate, rewriter);
      if (alternate.type == 'ExpressionStatement')
          alternate = alternate.expression; // unwrap;
      return {
          start: n.start, end: n.end, type: 'ConditionalExpression',
          test: this.accept(n.test, rewriter), consequent: consequent,
          alternate: alternate, astIndex: n.astIndex
      };
  }

  visitNewExpression(n, rewriter) {
      // callee is a node of type Expression
      // each of n.arguments is of type Expression
      var start = n.start, end = n.end, astIndex = n.astIndex;
      return rewriter.storeComputationResult({
          type: 'NewExpression',
          callee: this.accept(n.callee, rewriter),
          arguments: n.arguments.map(function(n) {
              var n = this.accept(n, rewriter);
              return (n.type == 'ExpressionStatement') ?
                  n.expression : // unwrap
                  n;
          }, this)
      }, start, end, astIndex);
  }

  visitCallExpression(n, rewriter) {
      // callee is a node of type Expression
      // each of n.arguments is of type Expression
      var start = n.start, end = n.end, astIndex = n.astIndex,
          thisIsBound = n.callee.type == 'MemberExpression', // like foo.bar();
          callee = this.accept(n.callee, rewriter);

      if (callee.type == 'ExpressionStatement') callee = callee.expression; // unwrap
      var args = n.arguments.map(function(n) {
              var n = this.accept(n, rewriter);
              return n.type == 'ExpressionStatement' ? n.expression : /*unwrap*/ n;
          }, this),
          lastArg = arr.last(args);

      if (lastArg !== undefined) {
          if (rewriter.isPrefixStored(lastArg))
              lastArg = lastArg.right; // unwrap
          if (!rewriter.isPostfixStored(lastArg)) {
              lastArg = args[args.length - 1] = rewriter.storeComputationResult(lastArg, lastArg.start, lastArg.end, arr.last(n.arguments).astIndex, true);
              // patch astIndex to calls astIndex
              lastArg.expressions[1] = rewriter.lastNodeExpression(astIndex);
          }
      }

      if (!thisIsBound && rewriter.isWrappedVar(callee)) {
          // something like "foo();" when foo is in rewrite scope.
          // we can't just rewrite it as _123['foo']()
          // as this would bind this to the scope object. Instead we ensure
          // that .call is used for invocation
          callee = {
              type: 'MemberExpression',
              computed: false,
              property: {name: "call", type: "Identifier"},
              object: callee
          }
          args.unshift({
              type: 'Identifier',
              name: (typeof window !== "undefined" ? 'window' : 'global')
          });
      }

      var callNode = {
          type: 'CallExpression', callee: callee,
          arguments: args, astIndex: astIndex
      };
      if (lastArg === undefined)
          return rewriter.storeComputationResult(callNode, start, end, astIndex);
      else
          return rewriter.simpleStoreComputationResult(callNode, astIndex);
  }

  visitMemberExpression(n, rewriter) {
      // object is a node of type Expression
      // property is a node of type Identifier
      // n.computed has a specific type that is boolean
      var object = this.accept(n.object, rewriter),
          property = n.computed ?
              this.accept(n.property, rewriter) :
              { // original identifier rule
                  start: n.property.start, end: n.property.end, type: 'Identifier',
                  name: n.property.name, astIndex: n.property.astIndex
              };
      if (object.type == 'ExpressionStatement')
          object = object.expression;
      return {
          start: n.start, end: n.end, type: 'MemberExpression',
          object: object, property: property, computed: n.computed, astIndex: n.astIndex
      };
  }

  visitTryStatement(n, rewriter) {
      // block is a node of type BlockStatement
      // handler is a node of type CatchClause or null
      // finalizer is a node of type BlockStatement null
      var block = this.accept(n.block, rewriter),
          handler = n.handler,
          finalizer = n.finalizer,
          guardedHandlers;
      if (n.guardedHandlers) {
          guardedHandlers = n.guardedHandlers.map(function(node) {
              // node is of type CatchClause
              return this.accept(node, rewriter);
          }, this);
      }
      if (!handler)
          handler = rewriter.newNode('CatchClause', {
              param: rewriter.newNode('Identifier', { name: 'e' }),
              body: rewriter.newNode('BlockStatement', { body: [] })
          });
      handler = this.accept(handler, rewriter);

      if (finalizer) {
          finalizer = rewriter.newNode('BlockStatement', { body: [
              rewriter.newNode('IfStatement', {
                  test: rewriter.newNode('UnaryExpression', {
                      operator: '!', prefix: true,
                      argument: rewriter.newNode('Identifier', { name: 'debugging' })
                  }),
                  consequent: this.accept(finalizer, rewriter),
                  alternate: null
              })
          ]});
      }

      return {
          start: n.start, end: n.end, type: 'TryStatement',
          block: block, handler: handler, finalizer: finalizer,
          guardedHandlers: guardedHandlers,
          astIndex: n.astIndex
      };
  }

  visitCatchClause(n, rewriter) {
      // param is a node of type Pattern
      // guard is a node of type Expression (optional)
      // body is a node of type BlockStatement
      var start = n.param.start, end = n.param.end,
          param = obj.extend({}, n.param), // manually copy param without wrapping
          paramIndex = n.param.astIndex,
          guard = n.guard ?  this.accept(n.guard, rewriter) : guard;

      var scopeIdx = rewriter.enterScope({ isCatchScope: true }) - 1,
          catchParam = rewriter.registerVars([n.param]),
          body = this.accept(n.body, rewriter);
      if (paramIndex) {
          body.body.unshift(
              // lastNode = xx;
              rewriter.newNode('ExpressionStatement', {
                  expression: rewriter.lastNodeExpression(paramIndex)
              }),
              // __xx-1 = [_, _xx, __xx-1];
              rewriter.newNode('ExpressionStatement', {
                  expression: rewriter.newNode('AssignmentExpression', {
                      operator: '=',
                      left: rewriter.newNode('Identifier', { name: '__' + (scopeIdx - 1) }),
                      right: rewriter.newNode('ArrayExpression', { elements: [
                          rewriter.newNode('Identifier', { name: '_' }),
                          rewriter.newNode('Identifier', { name: '_' + scopeIdx }),
                          rewriter.newNode('Identifier', { name: '__' + (scopeIdx - 1) })
                      ]})
                  })
              })
          );
          body.body.push(
              // __xx-1 = __xx-1[2];
              rewriter.newNode('ExpressionStatement', {
                  expression: rewriter.newNode('AssignmentExpression', {
                      operator: '=',
                      left: rewriter.newNode('Identifier', { name: '__' + (scopeIdx - 1) }),
                      right: rewriter.newNode('MemberExpression', {
                          object: rewriter.newNode('Identifier', { name: '__' + (scopeIdx - 1) }),
                          property: rewriter.newNode('Literal', { value: 2 }),
                          computed: true
                      })
                  })
              })
          );
      }
      body.body.unshift(
          // var _xx = { 'e': e.isUnwindExpression ? e.error : e };
          rewriter.createCatchScope(param.name),
          // if (_xx[x].toString() == 'Debugger' && !(lively.Config && lively.Config.loadRewrittenCode))
          //     throw e;
          rewriter.newNode('IfStatement', {
              test: rewriter.newNode('LogicalExpression', {
                  operator: '&&',
                  left: rewriter.newNode('BinaryExpression', {
                      operator: '==',
                      left: rewriter.newNode('CallExpression', {
                          callee: rewriter.newNode('MemberExpression', {
                              object: rewriter.newNode('MemberExpression', {
                                  object: rewriter.newNode('Identifier', { name: '_' + scopeIdx }),
                                  property: rewriter.newNode('Literal', { value: param.name }),
                                  computed: true
                              }),
                              property: rewriter.newNode('Identifier', { name: 'toString' }),
                              computed: false
                          }), arguments: []
                      }),
                      right: rewriter.newNode('Literal', { value: 'Debugger' })
                  }),
                  right: rewriter.newNode('UnaryExpression', {
                      operator: '!',
                      prefix: true,
                      argument: rewriter.newNode('LogicalExpression', {
                          operator: '&&',
                          left: rewriter.newNode('MemberExpression', {
                              object: rewriter.newNode('Identifier', { name: 'lively' }),
                              property: rewriter.newNode('Identifier', { name: 'Config' }),
                              computed: false
                          }),
                          right: rewriter.newNode('MemberExpression', {
                              object: rewriter.newNode('MemberExpression', {
                                  object: rewriter.newNode('Identifier', { name: 'lively' }),
                                  property: rewriter.newNode('Identifier', { name: 'Config' }),
                                  computed: false
                              }),
                              property: rewriter.newNode('Identifier', { name: 'loadRewrittenCode' }),
                              computed: false
                          })
                      })
                  })
              }),
              consequent: rewriter.newNode('ThrowStatement', {
                  argument: rewriter.newNode('Identifier', { name: param.name })
              }),
              alternate: null
          })
      );
      rewriter.exitScope();
      return {
          start: n.start, end: n.end, type: 'CatchClause',
          param: param, guard: guard, body: body, astIndex: n.astIndex
      };
  }

  visitThrowStatement(n, rewriter) {
      // argument is a node of type Expression
      return {
          start: n.start, end: n.end, type: 'ThrowStatement',
          argument: rewriter.inlineAdvancePC(this.accept(n.argument, rewriter), n.astIndex),
          astIndex: n.astIndex
      };
  }

  visitIdentifier(n, rewriter) {
      // n.name has a specific type that is string
      var node = rewriter.wrapVar(n.name);
      node.astIndex = n.astIndex;
      return node;
  }

  visitWithStatement(n, rewriter) {
      // object is a node of type Expression
      // body is a node of type Statement
      var scopeIdx = rewriter.enterScope({ isWithScope: true }) - 1,
          lastFnScopeIdx = rewriter.lastFunctionScopeId(),
          block = this.accept(n.body, rewriter);
      rewriter.exitScope();
      if (block.type != 'BlockStatement')
          block = rewriter.newNode('BlockStatement', { body: [ block ] });

      block.body.unshift(
          // var _xx+1 = withObject;
          rewriter.newNode('VariableDeclaration', {
              kind: 'var',
              declarations: [
                  rewriter.newVariable('_' + scopeIdx, this.accept(n.object, rewriter))
              ]
          }),
          // __xx = [_, _xx+1, __xx];
          rewriter.newNode('ExpressionStatement', {
              expression: rewriter.newNode('AssignmentExpression', {
                  operator: '=',
                  left: rewriter.newNode('Identifier', { name: '__' + lastFnScopeIdx }),
                  right: rewriter.newNode('ArrayExpression', { elements: [
                      rewriter.newNode('Identifier', { name: '_' }),
                      rewriter.newNode('Identifier', { name: '_' + scopeIdx }),
                      rewriter.newNode('Identifier', { name: '__' + lastFnScopeIdx })
                  ]})
              })
          })
      );
      block.body.push(
          // __xx = __xx[2];
          rewriter.newNode('ExpressionStatement', {
              expression: rewriter.newNode('AssignmentExpression', {
                  operator: '=',
                  left: rewriter.newNode('Identifier', { name: '__' + lastFnScopeIdx }),
                  right: rewriter.newNode('MemberExpression', {
                      object: rewriter.newNode('Identifier', { name: '__' + lastFnScopeIdx }),
                      property: rewriter.newNode('Literal', { value: 2 }),
                      computed: true
                  })
              })
          })
      );

      return block;
  }

};

class RecordingVisitor extends RewriteVisitor {

  constructor(registryIndex) {
      this.registryIndex = registryIndex;
  }

  visitCallExpression(n, rewriter) {
      // callee is a node of type Expression
      // each of n.arguments is of type Expression
      var start = n.start, end = n.end, astIndex = n.astIndex,
          thisIsBound = n.callee.type == 'MemberExpression', // like foo.bar();
          callee = this.accept(n.callee, rewriter);

      if (callee.type == 'ExpressionStatement') callee = callee.expression; // unwrap
      var args = n.arguments.map(function(n) {
          var n = this.accept(n, rewriter);
          n = n.type == 'ExpressionStatement' ? n.expression : /*unwrap*/ n;
          return rewriter.storeComputationResult(n, n.start, n.end, n.astIndex, true)
      }, this);

      if (!thisIsBound && rewriter.isWrappedVar(callee)) {
          // something like "foo();" when foo is in rewrite scope.
          // we can't just rewrite it as _123['foo']()
          // as this would bind this to the scope object. Instead we ensure
          // that .call is used for invocation
          callee = {
              type: 'MemberExpression',
              computed: false,
              property: {name: "call", type: "Identifier"},
              object: callee
          }
          args.unshift({type: 'Identifier', name: 'Global'});
      }

      var callNode = {
          type: 'CallExpression', callee: callee,
          arguments: args, astIndex: astIndex
      };

      return rewriter.storeComputationResult(callNode, start, end, astIndex, true);
  }

  visitBinaryExpression($super, n, rewriter) {
      return rewriter.storeComputationResult(
          $super(n, rewriter), n.start, n.end, n.astIndex, true);
  }

  visitMemberExpression($super, n, rewriter) {
      var rewritten = $super(n, rewriter);
      return rewritten.computed ?
          rewriter.storeComputationResult(
              rewritten, rewritten.start, rewritten.end, rewritten.astIndex, true) :
          rewritten;
  }

  visitExpressionStatement($super, n, rewriter) {
      // expression is a node of type Expression
      var expr = $super(n, rewriter);
      expr = expr.expression; // unwrap
      expr = rewriter.storeComputationResult(
          expr, expr.start, expr.end, expr.astIndex, true);
      return {
          start: n.start, end: n.end, type: 'ExpressionStatement',
          expression: expr, astIndex: n.astIndex
      };
  }


  // visitReturnStatement($super, n, rewriter) {
  //     var rewritten = $super(n, rewriter);
  //     var arg = rewritten.argument;
  //     if (arg) {
  //       if (arg && arg.type == 'ExpressionStatement')
  //           arg = arg.expression;
  //       arg = rewriter.storeComputationResult(
  //         arg,arg.start,arg.end,arg.astIndex, true);
  //     }
  //     // argument is a node of type Expression
  //     var arg = n.argument ?
  //         this.accept(n.argument, rewriter) : null;
  //     if (arg && arg.type == 'ExpressionStatement')
  //         arg = arg.expression;

  //     arg = rewriter.storeComputationResult(
  //       arg,arg.start,arg.end,arg.astIndex, true);

  //     return {
  //         start: n.start, end: n.end, type: 'ReturnStatement',
  //         argument: arg, astIndex: n.astIndex
  //     };
  // }
};
