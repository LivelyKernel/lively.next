import { obj, arr, string, Path } from 'lively.lang';
import { withMozillaAstDo } from './mozilla-ast-visitor-interface.js';
import _Decorators from './acorn-decorators.cjs';
import _ClassFields from 'acorn-class-fields';
import _StaticClassFeatures from 'acorn-static-class-features';
import _PrivateMethods from 'acorn-private-methods';
import * as acornDefault from 'acorn';
import * as walk from 'acorn-walk';
import * as loose from 'acorn-loose';

// If we are running in node, load the modules natively.
// The reason is, that in node.js we can not load the esm
// compiled modules served via jspm.dev but instead have to
// use the ones that are installed from NPM.org via flatn.
// These are entirely written in cjs, which does not bode well
// with our SystemJS version + custom source transformation.
// If lively.ast is loaded entirely natively this is not an issue.
// If lively.ast is loaded in the client via lively.modules this is also not issue.
// However it becomes an issue when we load modules via lively.modules in node.js.
const isNode = typeof System !== 'undefined'
  ? System.get('@system-env').node
  : false;

let Decorators, ClassFields, StaticClassFeatures, PrivateMethods;
if (isNode) {
  // we need to utilize the native require here to bypass the source transform of the class
  // we can not use the native import, since that is asynchronous.
  // top level import is causing class instrumentation
  Decorators = _ClassFields ? _Decorators : System._nodeRequire('lively.ast/lib/acorn-decorators.cjs');
  ClassFields = _ClassFields || System._nodeRequire('acorn-class-fields');
  StaticClassFeatures = _StaticClassFeatures || System._nodeRequire('acorn-static-class-features');
  PrivateMethods = _PrivateMethods || System._nodeRequire('acorn-private-methods');
} else {
  Decorators = _Decorators;
  ClassFields = _ClassFields;
  StaticClassFeatures = _StaticClassFeatures;
  PrivateMethods = _PrivateMethods;
}

const custom = {};

custom.forEachNode = forEachNode;
custom.matchNodes = matchNodes;
custom.findNodesIncluding = findNodesIncluding;
custom.withParentInfo = withParentInfo;
custom.copy = copy;
custom.findSiblings = findSiblings;
custom.findNodeByAstIndex = findNodeByAstIndex;
custom.findStatementOfNode = findStatementOfNode;
custom.addAstIndex = addAstIndex;

const Parser = acornDefault.Parser.extend(ClassFields, StaticClassFeatures, PrivateMethods, Decorators);

const acorn = {};
Object.assign(acorn, acornDefault);
acorn.Parser = Parser;
acorn.parse = (source, opts) => Parser.parse(source, opts);

export {
  walk, loose, acorn, custom,
  findStatementOfNode,
  addAstIndex,
  findNodesIncluding,
  findSiblings,
  findNodeByAstIndex,
  copy
};

// -=-=-=-=-=-=-=-=-=-=-=-
// from lively.ast.acorn
// -=-=-=-=-=-=-=-=-=-=-=-
function forEachNode (parsed, func, state, options) {
  // note: func can get called with the same node for different
  // visitor callbacks!
  // func args: node, state, depth, type
  options = options || {};
  const traversal = options.traversal || 'preorder'; // also: postorder

  const visitors = obj.clone(options.visitors ? options.visitors : walk.make(custom.visitors.withMemberExpression));
  const iterator = traversal === 'preorder'
    ? function (orig, type, node, depth, cont) { func(node, state, depth, type); return orig(node, depth + 1, cont); }
    : function (orig, type, node, depth, cont) { const result = orig(node, depth + 1, cont); func(node, state, depth, type); return result; };
  Object.keys(visitors).forEach(function (type) {
    const orig = visitors[type];
    visitors[type] = function (node, depth, cont) { return iterator(orig, type, node, depth, cont); };
  });
  walk.recursive(parsed, 0, null, visitors);
  return parsed;
}

function matchNodes (parsed, visitor, state, options) {
  function visit (node, state, depth, type) {
    if (visitor[node.type]) visitor[node.type](node, state, depth, type);
  }
  return forEachNode(parsed, visit, state, options);
}

function findNodesIncluding (parsed, pos, test, base) {
  const nodes = [];
  base = base || walk.make(custom.visitors.withMemberExpression);
  Object.keys(walk.base).forEach(function (name) {
    const orig = base[name];
    base[name] = function (node, state, cont) {
      arr.pushIfNotIncluded(nodes, node);
      return orig(node, state, cont);
    };
  });
  base.Property = function (node, st, c) {
    arr.pushIfNotIncluded(nodes, node);
    c(node.key, st, 'Expression');
    c(node.value, st, 'Expression');
  };
  base.LabeledStatement = function (node, st, c) {
    node.label && c(node.label, st, 'Expression');
    c(node.body, st, 'Statement');
  };
  walk.findNodeAround(parsed, pos, test, base);
  return nodes;
}

function withParentInfo (parsed, iterator, options) {
  // options = {visitAllNodes: BOOL}
  options = options || {};
  function makeScope (parentScope) {
    const scope = { id: string.newUUID(), parentScope: parentScope, containingScopes: [] };
    parentScope && parentScope.containingScopes.push(scope);
    return scope;
  }
  const visitors = walk.make({
    Function: function (node, st, c) {
      if (st && st.scope) st.scope = makeScope(st.scope);
      c(node.body, st, 'ScopeBody');
    },
    VariableDeclarator: function (node, st, c) {
      // node.id && c(node.id, st, 'Identifier');
      node.init && c(node.init, st, 'Expression');
    },
    VariableDeclaration: function (node, st, c) {
      for (let i = 0; i < node.declarations.length; ++i) {
        const decl = node.declarations[i];
        if (decl) c(decl, st, 'VariableDeclarator');
      }
    },
    ObjectExpression: function (node, st, c) {
      for (let i = 0; i < node.properties.length; ++i) {
        const prop = node.properties[i];
        c(prop.key, st, 'Expression');
        c(prop.value, st, 'Expression');
      }
    },
    MemberExpression: function (node, st, c) {
      c(node.object, st, 'Expression');
      c(node.property, st, 'Expression');
    }
  }, walk.base);
  let lastActiveProp; const getters = [];
  forEachNode(parsed, function (node) {
    arr.withoutAll(Object.keys(node), ['end', 'start', 'type', 'source', 'raw']).forEach(function (propName) {
      if (node.__lookupGetter__(propName)) return; // already defined
      const val = node[propName];
      node.__defineGetter__(propName, function () { lastActiveProp = propName; return val; });
      getters.push([node, propName, node[propName]]);
    });
  }, null, { visitors: visitors });
  const result = [];
  Object.keys(visitors).forEach(function (type) {
    const orig = visitors[type];
    visitors[type] = function (node, state, cont) {
      if (type === node.type || options.visitAllNodes) {
        result.push(iterator.call(null, node, { scope: state.scope, depth: state.depth, parent: state.parent, type: type, propertyInParent: lastActiveProp }));
        return orig(node, { scope: state.scope, parent: node, depth: state.depth + 1 }, cont);
      } else {
        return orig(node, state, cont);
      }
    };
  });
  walk.recursive(parsed, { scope: makeScope(), parent: null, propertyInParent: '', depth: 0 }, null, visitors);
  getters.forEach(function (nodeNameVal) {
    delete nodeNameVal[0][nodeNameVal[1]];
    nodeNameVal[0][nodeNameVal[1]] = nodeNameVal[2];
  });
  return result;
}

function copy (ast, override) {
  const visitors = obj.extend({
    Program: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'Program',
        body: n.body.map(c),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    FunctionDeclaration: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'FunctionDeclaration',
        id: c(n.id),
        params: n.params.map(c),
        body: c(n.body),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    BlockStatement: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'BlockStatement',
        body: n.body.map(c),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    ExpressionStatement: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'ExpressionStatement',
        expression: c(n.expression),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    CallExpression: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'CallExpression',
        callee: c(n.callee),
        arguments: n.arguments.map(c),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    MemberExpression: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'MemberExpression',
        object: c(n.object),
        property: c(n.property),
        computed: n.computed,
        source: n.source,
        astIndex: n.astIndex
      };
    },
    NewExpression: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'NewExpression',
        callee: c(n.callee),
        arguments: n.arguments.map(c),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    VariableDeclaration: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'VariableDeclaration',
        declarations: n.declarations.map(c),
        kind: n.kind,
        source: n.source,
        astIndex: n.astIndex
      };
    },
    VariableDeclarator: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'VariableDeclarator',
        id: c(n.id),
        init: c(n.init),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    FunctionExpression: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'FunctionExpression',
        id: c(n.id),
        params: n.params.map(c),
        body: c(n.body),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    IfStatement: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'IfStatement',
        test: c(n.test),
        consequent: c(n.consequent),
        alternate: c(n.alternate),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    ConditionalExpression: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'ConditionalExpression',
        test: c(n.test),
        consequent: c(n.consequent),
        alternate: c(n.alternate),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    SwitchStatement: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'SwitchStatement',
        discriminant: c(n.discriminant),
        cases: n.cases.map(c),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    SwitchCase: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'SwitchCase',
        test: c(n.test),
        consequent: n.consequent.map(c),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    BreakStatement: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'BreakStatement',
        label: n.label,
        source: n.source,
        astIndex: n.astIndex
      };
    },
    ContinueStatement: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'ContinueStatement',
        label: n.label,
        source: n.source,
        astIndex: n.astIndex
      };
    },
    TryStatement: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'TryStatement',
        block: c(n.block),
        handler: c(n.handler),
        finalizer: c(n.finalizer),
        guardedHandlers: n.guardedHandlers.map(c),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    CatchClause: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'CatchClause',
        param: c(n.param),
        guard: c(n.guard),
        body: c(n.body),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    ThrowStatement: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'ThrowStatement',
        argument: c(n.argument),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    ForStatement: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'ForStatement',
        init: c(n.init),
        test: c(n.test),
        update: c(n.update),
        body: c(n.body),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    ForInStatement: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'ForInStatement',
        left: c(n.left),
        right: c(n.right),
        body: c(n.body),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    WhileStatement: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'WhileStatement',
        test: c(n.test),
        body: c(n.body),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    DoWhileStatement: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'DoWhileStatement',
        test: c(n.test),
        body: c(n.body),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    WithStatement: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'WithStatement',
        object: c(n.object),
        body: c(n.body),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    UnaryExpression: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'UnaryExpression',
        argument: c(n.argument),
        operator: n.operator,
        prefix: n.prefix,
        source: n.source,
        astIndex: n.astIndex
      };
    },
    BinaryExpression: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'BinaryExpression',
        left: c(n.left),
        operator: n.operator,
        right: c(n.right),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    LogicalExpression: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'LogicalExpression',
        left: c(n.left),
        operator: n.operator,
        right: c(n.right),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    AssignmentExpression: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'AssignmentExpression',
        left: c(n.left),
        operator: n.operator,
        right: c(n.right),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    UpdateExpression: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'UpdateExpression',
        argument: c(n.argument),
        operator: n.operator,
        prefix: n.prefix,
        source: n.source,
        astIndex: n.astIndex
      };
    },
    ReturnStatement: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'ReturnStatement',
        argument: c(n.argument),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    Identifier: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'Identifier',
        name: n.name,
        source: n.source,
        astIndex: n.astIndex
      };
    },
    Literal: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'Literal',
        value: n.value,
        raw: n.raw /* Acorn-specific */,
        source: n.source,
        astIndex: n.astIndex
      };
    },
    ObjectExpression: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'ObjectExpression',
        properties: n.properties.map(function (prop) {
          return {
            key: c(prop.key), value: c(prop.value), kind: prop.kind
          };
        }),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    ArrayExpression: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'ArrayExpression',
        elements: n.elements.map(c),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    SequenceExpression: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'SequenceExpression',
        expressions: n.expressions.map(c),
        source: n.source,
        astIndex: n.astIndex
      };
    },
    EmptyStatement: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'EmptyStatement',
        source: n.source,
        astIndex: n.astIndex
      };
    },
    ThisExpression: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'ThisExpression',
        source: n.source,
        astIndex: n.astIndex
      };
    },
    DebuggerStatement: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'DebuggerStatement',
        source: n.source,
        astIndex: n.astIndex
      };
    },
    LabeledStatement: function (n, c) {
      return {
        start: n.start,
        end: n.end,
        type: 'LabeledStatement',
        label: n.label,
        body: c(n.body),
        source: n.source,
        astIndex: n.astIndex
      };
    }
  }, override || {});

  function c (node) {
    if (node === null) return null;
    return visitors[node.type](node, c);
  }
  return c(ast);
}

function findSiblings (parsed, node, beforeOrAfter) {
  if (!node) return [];
  const nodes = findNodesIncluding(parsed, node.start);
  const idx = nodes.indexOf(node);
  const parents = nodes.slice(0, idx);
  const parentWithBody = parents.reverse().find(function (p) { return Array.isArray(p.body); });
  const siblingsWithNode = parentWithBody.body;
  if (!beforeOrAfter) return arr.without(siblingsWithNode, node);
  const nodeIdxInSiblings = siblingsWithNode.indexOf(node);
  return beforeOrAfter === 'before'
    ? siblingsWithNode.slice(0, nodeIdxInSiblings)
    : siblingsWithNode.slice(nodeIdxInSiblings + 1);
}

// // cached visitors that are used often
custom.visitors = {
  stopAtFunctions: walk.make({
    Function: function () { /* stop descent */ },
    ...walk.base
  }),

  withMemberExpression: walk.make({
    MemberExpression: function (node, st, c) {
      c(node.object, st, 'Expression');
      c(node.property, st, 'Expression');
    }
  }, walk.base)
};

// -=-=-=-=-=-=-=-=-=-=-=-=-=-
// from lively.ast.AstHelper
// -=-=-=-=-=-=-=-=-=-=-=-=-=-
function findNodeByAstIndex (parsed, astIndexToFind, addIndex) {
  addIndex = addIndex == null ? true : !!addIndex;
  if (!parsed.astIndex && addIndex) addAstIndex(parsed);
  // we need to visit every node, forEachNode is highly
  // inefficient, the compilled Mozilla visitors are a better fit
  let found = null;
  withMozillaAstDo(parsed, null, function (next, node, state) {
    if (found) return;
    const idx = node.astIndex;
    if (idx < astIndexToFind) return;
    if (node.astIndex === astIndexToFind) { found = node; return; }
    next();
  });
  return found;
}

// FIXME: global (and temporary) findNodeByAstIndex is used by __getClosure and defined in Rewriting.js
// Global.findNodeByAstIndex = findNodeByAstIndex;

function findStatementOfNode (options, parsed, target) {
  // DEPRECATED in favor of query.statementOf(parsed, node)
  // Can also be called with just ast and target. options can be {asPath: BOOLEAN}.
  // Find the statement that a target node is in. Example:
  // let source be "var x = 1; x + 1;" and we are looking for the
  // Identifier "x" in "x+1;". The second statement is what will be found.
  if (!target) { target = parsed; parsed = options; options = null; }
  if (!options) options = {};
  if (!parsed.astIndex) addAstIndex(parsed);
  let found; let targetReached = false;
  const statements = [
    // ES5
    'EmptyStatement', 'BlockStatement', 'ExpressionStatement', 'IfStatement',
    'LabeledStatement', 'BreakStatement', 'ContinueStatement', 'WithStatement', 'SwitchStatement',
    'ReturnStatement', 'ThrowStatement', 'TryStatement', 'WhileStatement', 'DoWhileStatement',
    'ForStatement', 'ForInStatement', 'DebuggerStatement', 'FunctionDeclaration',
    'VariableDeclaration',
    // ES2015:
    'ClassDeclaration'
  ];
  withMozillaAstDo(parsed, {}, function (next, node, state, path) {
    if (targetReached || node.astIndex < target.astIndex) return;
    if (node === target || node.astIndex === target.astIndex) {
      targetReached = true;
      if (options.asPath) { found = path; } else {
        let p = Path(path);
        do {
          found = p.get(parsed);
          p = p.slice(0, p.size() - 1);
        } while ((statements.indexOf(found.type) == -1) && (p.size() > 0));
      }
    }
    !targetReached && next();
  });
  return found;
}

function addAstIndex (parsed) {
  // we need to visit every node, forEachNode is highly
  // inefficient, the compilled Mozilla visitors are a better fit
  withMozillaAstDo(parsed, { index: 0 }, function (next, node, state) {
    next(); node.astIndex = state.index++;
  });
  return parsed;
}
