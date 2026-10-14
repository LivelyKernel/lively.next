/*global global, module, Global,LivelyDebuggingASTRegistry*/
import { acorn, parse, walk, query } from "lively.ast";
import { obj, arr } from "lively.lang";

const debuggerState = globalThis[Symbol.for('lively-debugger-state')] ||= {};
export let LivelyDebuggingASTRegistry = debuggerState.astRegistry ||= {};

let _currentASTRegistry = (function() {
    return typeof LivelyDebuggingASTRegistry !== 'undefined' ? LivelyDebuggingASTRegistry : {};
})()

function getCurrentASTRegistry() {
    if (debuggerState.astRegistry) return debuggerState.astRegistry;
    return {};
}

function setCurrentASTRegistry(astRegistry) {
    return _currentASTRegistry = debuggerState.astRegistry = astRegistry;
}

function rewrite(node, astRegistry, namespace) {
    var r = new Rewriter(astRegistry, namespace);
    return r.rewrite(node);
}

function rewriteFunction(node, astRegistry, namespace, outerScopeName, outerBindings = []) {
    var r = new Rewriter(astRegistry, namespace);
    r.outerScopeName = outerScopeName;
    r.outerBindings = outerBindings;
    return r.rewriteFunction(node);
}

export {
  getCurrentASTRegistry, _currentASTRegistry, setCurrentASTRegistry, rewrite, rewriteFunction
}

const iteratorFrameVisitor = {ForOfStatement(_node, state) { state.found = true; }};

export function requiresIteratorFrame(node) {
    if (!node) return false;
    if (node.generator) return true;
    const state = {found: false};
    // Iterator.next() can itself suspend in a managed generator.
    walk.simple(node.body, iteratorFrameVisitor, walk.visitors.stopAtFunctions, state);
    return state.found;
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
          return !!(scope.isWithScope || scope.isCatchScope || scope.isBlockScope);
      }).lastIndexOf(false);
  }

  registerVars(varIdentifiers) {
      if (!this.scopes.length) return undefined;
      var scope = arr.last(this.scopes),
          that = this;
      return query.helpers.declIds(varIdentifiers.map(node => node.type ? node : {...node, type: 'Identifier'})).reduce(function(res, varIdentifier) {
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
      const body = ast.type === 'BlockStatement' || ast.type === 'Program' ? ast : ast.body;
      scope.functionBody = body;
      const directDeclarations = new Set(body.body);
      const lexicalDeclarations = body.body.filter(n => n.type === 'VariableDeclaration' && n.kind !== 'var')
          .flatMap(n => query.helpers.declIds(n.declarations.map(d => d.id)).map(id => [id.name, n.kind]));
      this.registerVars(lexicalDeclarations.map(([name]) => ({ name })));
      let hasLexicalScopes = lexicalDeclarations.length > 0;
      walk.matchNodes(ast, {
          'VariableDeclaration': function(node, state, depth, type) {
              if (node.type != type) return; // skip Expression, Statement, etc.
              if (node.kind !== 'var') { hasLexicalScopes = true; return; }
              query.helpers.declIds(node.declarations.map(n => n.id)).forEach(function(id) {
                  // only if it has not been defined before (as variable or argument!)
                  if ((scope.localVars.indexOf(id.name) == -1) && (id.name != 'arguments')) {
                      state[id.name] = {
                          key: that.newNode('Literal', {value: id.name}),
                          type: "Property",
                          kind: 'init',
                          value: that.newNode('Identifier', {name: 'undefined'})
                      };
                      scope.localVars.push(id.name);
                  }
              });
          },
          'FunctionDeclaration': function(node, state, depth, type) {
              if (node.type != type) return; // skip Expression, Statement, etc.
              if (!directDeclarations.has(node)) return;
              state[node.id.name] = node; // rewrite is done below (to know all local vars first)
              if (scope.localVars.indexOf(node.id.name) == -1)
                  scope.localVars.push(node.id.name);
          }
      }, decls, { visitors: walk.visitors.stopAtFunctions });

      const result = Object.getOwnPropertyNames(decls).map(function(decl) {
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
      result.lexicalDeclarations = lexicalDeclarations;
      result.hasLexicalScopes = hasLexicalScopes;
      result.hasBindingPatterns = body.body.some(node => node.type === 'VariableDeclaration' && node.kind !== 'var' && node.declarations.some(decl => decl.id.type !== 'Identifier'));
      return result;
  }

  createPreamble(args, decls, level) {
      var lastFnLevel = this.lastFunctionScopeId();
      let mapping = this.wrapArgsAndDecls(args, decls);
      if (decls && decls.lexicalDeclarations && decls.lexicalDeclarations.length) {
          mapping = this.newNode('MemberExpression', {
              object: this.newNode('CallExpression', {
                  callee: this.newNode('Identifier', {name: '__createLexicalScope'}),
                  arguments: [this.newNode('Literal', {value: null}), this.newNode('Identifier', {name: '_'}),
                      this.newNode('Identifier', {name: 'undefined'}), parse(JSON.stringify(decls.lexicalDeclarations)).body[0].expression,
                      typeof mapping === 'string' ? parse('(' + mapping + ')').body[0].expression : mapping]
              }), property: this.newNode('Literal', {value: 1}), computed: true
          });
      }
      return [
          this.newNode('VariableDeclaration', {
              kind: 'var',
              declarations: [
                  this.newVariable('_', '{}'),
                  this.newVariable('lastNode', this.newNode('Identifier', {name: 'undefined'})),
                  this.newVariable('debugging', this.newNode('Literal', {value: false})),
                  this.newVariable('__' + level, []),
                  this.newVariable('_' + level, mapping),
                  ...(decls?.hasBindingPatterns ? [this.newVariable('_initialize_' + level, this.newNode('CallExpression', {
                      callee: this.newNode('Identifier', {name: '__initializationTarget'}),
                      arguments: [this.newNode('Identifier', {name: '_' + level})]
                  }))] : []),
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
                      this.newNode('Identifier', { name: lastFnLevel < 0 ? (this.outerScopeName || (typeof window !== "undefined" ? 'window' : 'global')) : '__' + lastFnLevel })
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
                              this.newNode('Literal', {value: originalFunctionIdx}),
                              ...(['FunctionDeclaration', 'FunctionExpression'].includes(this.astRegistry[this.namespace][originalFunctionIdx].type)
                                  ? [this.newNode('MetaProperty', {meta: this.newNode('Identifier', {name: 'new'}), property: this.newNode('Identifier', {name: 'target'})})] : [])]
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
      const wrapped = this.createCatchForUnwind(node, originalFunctionIdx, level);
      if (decls && decls.hasLexicalScopes) {
          const call = wrapped.handler.body.body[1].expression;
          call.arguments[2] = parse('__scopeForUnwind(ex.error, __' + level + ')').body[0].expression;
      }
      return wrapped;
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

      if (scopeRef === undefined && this.outerBindings && this.outerBindings.includes(name)) {
          scopeRef = this.newNode('MemberExpression', {
              object: this.newNode('Identifier', { name: this.outerScopeName }),
              property: this.newNode('Literal', { value: 1 }),
              computed: true
          });
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
             node.object.name[0] == '_' && !isNaN(node.object.name.substr(1)) ||
          node.type == 'MemberExpression' && node.object.type == 'MemberExpression' &&
          node.object.object.name === this.outerScopeName;
  }

  wrapClosure(node, namespace, idx) {
      var scopeIdx = this.scopes.length - 1,
          scopeIdentifier = scopeIdx < 0 ?
              this.newNode('Literal', {value: null}) :
              this.newNode('Identifier', { name: '__' + (this.scopes[scopeIdx].isBlockScope ? scopeIdx : this.lastFunctionScopeId()) });
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

  wrapIteratorClosure(node) {
      node.iteratorFrame = true;
      return this.wrapClosure({type: 'FunctionExpression', id: node.id, params: [], body: {type: 'BlockStatement', body: []}}, this.namespace, node.registryId);
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
      if (node.type !== "FunctionExpression" && node.type !== 'ArrowFunctionExpression')
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
      if (requiresIteratorFrame(node)) return this.wrapIteratorClosure(node);
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
          id: node.id || null, params: structuredClone(node.params)
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
                      this.newNode('Identifier', { name: lastFnLevel < 0 ? (this.outerScopeName || 'Global') : '__' + lastFnLevel })
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
          id: node.id || null, params: structuredClone(node.params)
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

  visitMetaProperty(node, state) {
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

  visitSpreadElement(n, rewriter) {
      const value = this.accept(n.argument, rewriter);
      return {...n, argument: value.type === 'ExpressionStatement' ? value.expression : value};
  }

  visitChainExpression(n, rewriter) {
      const sequence = expressions => rewriter.newNode('SequenceExpression', {expressions});
      const missing = rewriter.newNode('UnaryExpression', {operator: 'void', prefix: true, argument: rewriter.newNode('Literal', {value: 0})});
      const optional = (node, ref, result) => node.optional ? rewriter.newNode('ConditionalExpression', {
          test: rewriter.newNode('LogicalExpression', {operator: '||',
              left: rewriter.newNode('BinaryExpression', {operator: '===', left: ref, right: rewriter.newNode('Literal', {value: null})}),
              right: rewriter.newNode('BinaryExpression', {operator: '===', left: ref, right: missing})}),
          consequent: missing, alternate: result
      }) : result;
      // Lower each link around the rest of the chain so a skipped link skips keys,
      // arguments and later links. Keep original node indices for continuation resume.
      const chain = (node, next) => {
          if (node.type === 'MemberExpression') return chain(node.object, value => {
              const ref = rewriter.computationReference(node.object.astIndex);
              const member = rewriter.storeComputationResult({...node, optional: false, object: ref,
                  property: node.computed ? this.patternExpression(node.property, rewriter) : node.property}, node.start, node.end, node.astIndex);
              return sequence([rewriter.storeComputationResult(value, node.object.start, node.object.end, node.object.astIndex, true),
                  optional(node, ref, next(member, ref))]);
          });
          if (node.type === 'CallExpression') return chain(node.callee, (value, receiver) => {
              const ref = rewriter.computationReference(node.callee.astIndex);
              const call = this.visitCallExpression({...node, optional: false,
                  callee: rewriter.newNode('MemberExpression', {object: ref, computed: false, property: rewriter.newNode('Identifier', {name: 'call'})}),
                  arguments: [receiver || rewriter.newNode('Identifier', {name: typeof window !== 'undefined' ? 'window' : 'global'}), ...node.arguments]
              }, rewriter);
              return sequence([rewriter.storeComputationResult(value, node.callee.start, node.callee.end, node.callee.astIndex, true),
                  optional(node, ref, next(call))]);
          });
          return next(this.patternExpression(node, rewriter));
      };
      return chain(n.expression, result => result);
  }

  visitTemplateLiteral(n, rewriter) {
      return {...n, expressions: n.expressions.map(expr => this.patternExpression(expr, rewriter))};
  }

  visitForOfStatement(n, rewriter) {
      if (n.await) throw new Error('Async iteration requires an async iterator continuation');
      const declaration = n.left.type === 'VariableDeclaration' ? n.left : null;
      const left = declaration ? declaration.declarations[0].id : n.left;
      const lexical = declaration && declaration.kind !== 'var';
      const root = rewriter.lastFunctionScopeId(), parent = rewriter.scopes.length - 1;
      const right = this.accept(n.right, rewriter);
      if (lexical) {
          rewriter.enterScope();
          const scope = rewriter.scopes[rewriter.scopes.length - 1];
          scope.isBlockScope = true;
          rewriter.registerVars([left]);
      }
      const level = rewriter.scopes.length - 1;
      const valueName = '__forValue_' + n.astIndex;
      const target = this.accept(left, rewriter);
      const body = this.accept(n.body, rewriter);
      const setup = lexical ? parse('let __' + level + ' = __createLexicalScope(__' + parent + ', _, ' + n.astIndex + ', ' + JSON.stringify([[left.name, declaration.kind]]) + '); let _' + level + ' = __' + level + '[1];').body : [];
      const initialize = lexical ? rewriter.newNode('CallExpression', {
          callee: {type: 'Identifier', name: '__initializeBinding'},
          arguments: [target.object, {type: 'Literal', value: left.name}, {type: 'Identifier', name: valueName}]
      }) : {type: 'AssignmentExpression', operator: '=', left: target, right: {type: 'Identifier', name: valueName}};
      const loop = parse('for (var ' + valueName + ' of []) { try {} catch (__forError) { __forError = __forError.isUnwindException ? __forError : new UnwindException(__forError); const __iterator = _[' + JSON.stringify('__forOf_' + n.astIndex) + ']; __iterator.suspended = true; (__forError.iteratorsToClose || (__forError.iteratorsToClose = [])).push(__iterator); throw __forError; } }').body[0];
      loop.right = rewriter.newNode('CallExpression', {
          callee: {type: 'Identifier', name: '__forOf'},
          arguments: [right, {type: 'Identifier', name: '_'}, {type: 'Literal', value: n.astIndex}]
      });
      const guarded = loop.body.body[0];
      guarded.block.body = [{type: 'ExpressionStatement', expression: initialize}, body];
      if (lexical) {
          guarded.handler.body.body.splice(1, 0, parse('__captureLexicalScope(__forError, __' + root + ', __' + level + ');').body[0]);
          rewriter.exitScope();
      }
      loop.body.body = [...setup, guarded];
      return {...loop, astIndex: n.astIndex};
  }

  visitAwaitExpression(n, rewriter) {
      rewriter.scopes[rewriter.lastFunctionScopeId()].hasAwait = true;
      return rewriter.newNode('CallExpression', {
          callee: rewriter.newNode('Identifier', {name: '__awaitValue'}),
          arguments: [this.accept(n.argument, rewriter), parse('(debugging = true, ' + n.astIndex + ')').body[0].expression],
          astIndex: n.astIndex
      });
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
      const scope = arr.last(rewriter.scopes);
      const declarations = scope.functionBody === n ? [] : n.body
          .filter(node => node.type === 'VariableDeclaration' && node.kind !== 'var')
          .flatMap(node => query.helpers.declIds(node.declarations.map(decl => decl.id)).map(id => [id.name, node.kind]));
      const functions = scope.functionBody === n ? [] : n.body.filter(node => node.type === 'FunctionDeclaration');
      const lexical = declarations.length || functions.length;
      const root = rewriter.lastFunctionScopeId();
      let level;
      if (lexical) {
          level = rewriter.enterScope({isBlockScope: true}) - 1;
          rewriter.registerVars(declarations.map(([name]) => ({name})).concat(functions.map(node => node.id)));
      }
      const result = {
          start: n.start, end: n.end, type: 'BlockStatement',
          body: n.body.map(function(node) {
              // node is of type Statement
              return this.accept(node, rewriter);
          }, this),
          astIndex: n.astIndex
      };
      if (!lexical) return result;
      const parent = '__' + (level - 1);
      // Catch/with scopes store their environment in the function's frame chain.
      const parentScope = rewriter.scopes[level - 1];
      const parentRef = parentScope.isCatchScope || parentScope.isWithScope ? '__' + root : parent;
      const preamble = parse('let __' + level + ' = __createLexicalScope(' + parentRef + ', _, ' + n.astIndex + ', ' + JSON.stringify(declarations) + '); let _' + level + ' = __' + level + '[1];').body;
      if (n.body.some(node => node.type === 'VariableDeclaration' && node.kind !== 'var' && node.declarations.some(decl => decl.id.type !== 'Identifier')))
          preamble.push(...parse('let _initialize_' + level + ' = __initializationTarget(_' + level + ');').body);
      const initializers = functions.map(node => rewriter.newNode('ExpressionStatement', {
          expression: rewriter.newNode('AssignmentExpression', {operator: '=', left: rewriter.wrapVar(node.id.name),
              right: rewriter.rewriteFunctionDeclaration(node, this.registryIndex)})
      }));
      const handler = parse('try {} catch (__scopeError) { throw __captureLexicalScope(__scopeError, __' + root + ', __' + level + '); }').body[0].handler;
      rewriter.exitScope();
      return {...result, body: [...preamble, ...initializers, rewriter.newNode('TryStatement', {
          block: {...result}, handler, finalizer: null
      })]};
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
      if (n.init && n.init.type === 'VariableDeclaration' && n.init.kind !== 'var') {
          const root = rewriter.lastFunctionScopeId(), parentLevel = rewriter.scopes.length - 1;
          const parent = rewriter.scopes[parentLevel].isBlockScope ? parentLevel : root;
          const level = rewriter.enterScope({isBlockScope: true}) - 1;
          const declarations = query.helpers.declIds(n.init.declarations.map(decl => decl.id)).map(id => [id.name, n.init.kind]);
          rewriter.registerVars(n.init.declarations.map(decl => decl.id));
          const init = this.accept(n.init, rewriter).expression;
          const test = n.test ? this.accept(n.test, rewriter) : rewriter.newNode('Literal', {value: true});
          const update = n.update && this.accept(n.update, rewriter);
          const body = this.accept(n.body, rewriter);
          const loop = parse('for (let __' + level + ' = __createLexicalScope(__' + parent + ', _, ' + n.astIndex + ', ' + JSON.stringify(declarations) + '), _' + level + ' = __' + level + '[1], __initialized = 0; true; __' + level + ' = __cloneLexicalScope(__' + level + '), _' + level + ' = __' + level + '[1]) {}').body[0];
          if (n.init.declarations.some(decl => decl.id.type !== 'Identifier')) loop.init.declarations.splice(2, 0,
              rewriter.newVariable('_initialize_' + level, parse('__initializationTarget(_' + level + ')').body[0].expression));
          loop.init.declarations[loop.init.declarations.length - 1].init = init;
          loop.test = test;
          if (update) loop.update.expressions.push(update);
          loop.body = parse('try {} catch (__scopeError) { throw __captureLexicalScope(__scopeError, __' + root + ', __' + level + '); }').body[0];
          loop.body.block = body.type === 'BlockStatement' ? body : rewriter.newNode('BlockStatement', {body: [body]});
          loop.body = rewriter.newNode('BlockStatement', {body: [loop.body]});
          loop.astIndex = n.astIndex;
          rewriter.exitScope();
          return loop;
      }
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
      const lexical = n.left.type === 'VariableDeclaration' && n.left.kind !== 'var';
      const root = rewriter.lastFunctionScopeId(), parent = rewriter.scopes.length - 1;
      const right = this.accept(n.right, rewriter);
      if (lexical) { rewriter.enterScope({isBlockScope: true}); rewriter.registerVars(n.left.declarations.map(decl => decl.id)); }
      const level = rewriter.scopes.length - 1;
      const keyName = '__forKey_' + n.astIndex;
      var left, body = this.accept(n.body, rewriter),
          start = n.start, end = n.end, astIndex = n.right.astIndex;
      if (lexical) left = parse('var ' + keyName).body[0];
      else if (n.left.type == 'VariableDeclaration') {
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
      if (lexical) {
          const declarations = query.helpers.declIds(n.left.declarations.map(decl => decl.id)).map(id => [id.name, n.left.kind]);
          const setup = parse('let __' + level + ' = __createLexicalScope(__' + parent + ', _, ' + n.astIndex + ', ' + JSON.stringify(declarations) + '); let _' + level + ' = __' + level + '[1]; __initializeBinding(_' + level + ', ' + JSON.stringify(declarations[0][0]) + ', ' + keyName + ');').body;
          const guarded = parse('try {} catch (__forError) { throw __captureLexicalScope(__forError, __' + root + ', __' + level + '); }').body[0];
          guarded.block = body;
          body = {type: 'BlockStatement', body: [...setup, guarded]};
          rewriter.exitScope();
      }
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
      if (!rewriter.isStoredComputationResult(test)) {
          test = rewriter.storeComputationResult(test, n.test.start, n.test.end, n.test.astIndex);
      }
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
    const result = this.visitFunctionExpression(n, rewriter);
    const wrapped = result.expression.right;
    const func = wrapped.arguments[3];
    func.type = 'ArrowFunctionExpression';
    func.expression = false;
    delete func.id;
    const call = func.body.body[0].handler.body.body[1].expression;
    call.arguments[1] = rewriter.newNode('ArrayExpression', {elements: query.helpers.declIds(n.params)});
    if (!n.params.some(param => param.name === 'arguments')) {
        const scopeName = func.body.body[0].block.body[0].declarations[4].id.name;
        func.body.body[0].block.body.splice(2, 0, ...parse(scopeName + '.arguments = typeof arguments === "undefined" ? undefined : arguments;').body);
    }
    wrapped.arguments.push(parse('({this: this, arguments: typeof arguments === "undefined" ? undefined : arguments})').body[0].expression);
    return result;
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

      if (requiresIteratorFrame(n)) return rewriter.newNode('ExpressionStatement', {
          expression: rewriter.simpleStoreComputationResult(rewriter.wrapIteratorClosure(n), n.astIndex), id: n.id
      });

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
          id: n.id || null, params: structuredClone(n.params), astIndex: n.astIndex
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
          if (decl.id.type !== 'Identifier') {
              const previous = this.initializingPattern;
              this.initializingPattern = n.kind !== 'var';
              let target;
              try { target = this.accept(decl.id, rewriter); }
              finally { this.initializingPattern = previous; }
              const value = this.accept(decl.init, rewriter);
              return rewriter.storeComputationResult({type: 'AssignmentExpression', operator: '=', left: target,
                  right: value.type === 'ExpressionStatement' ? value.expression : value}, start, end, decl.astIndex, true);
          }
          if (n.kind !== 'var') {
              const target = this.accept(decl.id, rewriter);
              const value = decl.init ? this.accept(decl.init, rewriter) : rewriter.newNode('Identifier', {name: 'undefined'});
              const call = rewriter.newNode('CallExpression', {
                  callee: rewriter.newNode('Identifier', {name: '__initializeBinding'}),
                  arguments: [target.object, rewriter.newNode('Literal', {value: decl.id.name}),
                      value.type === 'ExpressionStatement' ? value.expression : value]
              });
              return rewriter.storeComputationResult(call, start, end, decl.astIndex, true);
          }
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
          elements: this.rewriteExpressionList(n.elements, rewriter)
      };
  }

  visitObjectExpression(n, rewriter) {
      // each.key of n.properties is of type node
      // each.value of n.properties is of type node
      // each.kind of n.properties is "init" or "get" or "set"
      return {
          start: n.start, end: n.end, type: 'ObjectExpression', astIndex: n.astIndex,
          properties: n.properties.map(function(prop) {
              if (prop.type === 'SpreadElement') return this.accept(prop, rewriter);
              var value = this.accept(prop.value, rewriter);
              if (prop.kind != 'init') { // set or get
                  // function cannot be replace by a closure directly
                  value = value.expression.right.arguments[3]; // unwrap
              }
              var key = prop.key.type == 'Identifier' && !prop.computed ?
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
                  computed: !!prop.computed,
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

  rewriteExpressionList(nodes, rewriter) {
      return nodes.map(node => {
          if (!node) return null;
          let rewritten = this.accept(node, rewriter);
          if (rewritten.type === 'ExpressionStatement') rewritten = rewritten.expression;
          if (node.type === 'SpreadElement') {
              // Retain the expanded values, including for one-shot iterators, when a callee suspends.
              rewritten = {...rewritten, argument: rewriter.storeComputationResult({
                  type: 'ArrayExpression', elements: [rewritten]
              }, node.start, node.end, node.astIndex, true)};
          }
          return rewritten;
      });
  }

  visitNewExpression(n, rewriter) {
      // callee is a node of type Expression
      // each of n.arguments is of type Expression
      var start = n.start, end = n.end, astIndex = n.astIndex;
      return rewriter.storeComputationResult({
          type: 'NewExpression',
          callee: this.accept(n.callee, rewriter),
          arguments: this.rewriteExpressionList(n.arguments, rewriter)
      }, start, end, astIndex);
  }

  visitCallExpression(n, rewriter) {
      // callee is a node of type Expression
      // each of n.arguments is of type Expression
      var start = n.start, end = n.end, astIndex = n.astIndex,
          thisIsBound = n.callee.type == 'MemberExpression', // like foo.bar();
          callee = this.accept(n.callee, rewriter);

      if (callee.type == 'ExpressionStatement') callee = callee.expression; // unwrap
      var args = this.rewriteExpressionList(n.arguments, rewriter),
          lastArg = arr.last(args),
          lastSpread = lastArg?.type === 'SpreadElement' ? lastArg : null;
      if (lastSpread) lastArg = lastSpread.argument;

      if (lastArg !== undefined) {
          if (rewriter.isPrefixStored(lastArg))
              lastArg = lastArg.right; // unwrap
          if (!rewriter.isPostfixStored(lastArg)) {
              const argumentIndex = arr.last(n.arguments).astIndex;
              if (argumentIndex === undefined) lastArg = rewriter.inlineAdvancePC(lastArg, astIndex);
              else {
                  lastArg = rewriter.storeComputationResult(lastArg, lastArg.start, lastArg.end, argumentIndex, true);
                  // patch astIndex to calls astIndex
                  lastArg.expressions[1] = rewriter.lastNodeExpression(astIndex);
              }
          }
          if (lastSpread) lastSpread.argument = lastArg;
          else args[args.length - 1] = lastArg;
      }

      if (lastArg === undefined && n.callee.type === 'MemberExpression' &&
          ['CallExpression', 'NewExpression'].includes(n.callee.object.type)) {
          // Evaluate a receiver such as values() before recording the pending next() call.
          const receiver = rewriter.storeComputationResult(callee.object, n.callee.object.start, n.callee.object.end, n.callee.object.astIndex, true);
          receiver.expressions[1] = rewriter.lastNodeExpression(astIndex);
          callee.object = receiver;
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
      if (n.handler) handler.body.body.unshift(...parse('__closeIteratorsAfterCatch(' + n.handler.param.name + ');').body);
      if (!n.handler) handler.body.body.push(rewriter.newNode('ThrowStatement', {argument: rewriter.newNode('Identifier', {name: 'e'})}));

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
      if (rewriter.scopes[rewriter.lastFunctionScopeId()].hasAwait) {
          body.body.unshift(...parse('if (' + param.name + '.isUnwindException && ' + param.name + '.error.reason === "await") { debugging = true; throw ' + param.name + '; }').body);
      }
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
      if (this.initializingPattern) node.object = rewriter.newNode('Identifier', {name: '_initialize' + node.object.name});
      node.astIndex = n.astIndex;
      return node;
  }

  visitObjectPattern(n, rewriter) {
      return {...n, properties: n.properties.map(prop => prop.type === 'RestElement' ? this.accept(prop, rewriter) :
          {...prop, shorthand: false, key: prop.computed ? this.patternExpression(prop.key, rewriter) : walk.copy(prop.key), value: this.accept(prop.value, rewriter)})};
  }

  visitArrayPattern(n, rewriter) { return {...n, elements: n.elements.map(node => node && this.accept(node, rewriter))}; }

  visitRestElement(n, rewriter) { return {...n, argument: this.accept(n.argument, rewriter)}; }

  visitAssignmentPattern(n, rewriter) { return {...n, left: this.accept(n.left, rewriter), right: this.patternExpression(n.right, rewriter)}; }

  patternExpression(n, rewriter) {
      const previous = this.initializingPattern;
      this.initializingPattern = false;
      try { const result = this.accept(n, rewriter); return result.type === 'ExpressionStatement' ? result.expression : result; }
      finally { this.initializingPattern = previous; }
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
