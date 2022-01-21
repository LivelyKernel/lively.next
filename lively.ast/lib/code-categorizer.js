import { parse } from '../lib/parser.js';
import { arr, Path, string, obj } from 'lively.lang';

/*

types found:

The def data structure:
  {type, name, node, children?, parent?}

class-decl
  class-constructor
  class-instance-method
  class-class-method
  class-instance-getter
  class-instance-setter
  class-class-getter
  class-class-setter

function-decl

var-decl

object-decl
  object-method
  object-property

*/

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// main method
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
export function findDecls (parsed, options) {
  // lively.debugNextMethodCall(lively.ast.codeCategorizer, "findDecls")
  options = options || obj.merge({ hideOneLiners: false }, options);

  if (typeof parsed === 'string') { parsed = parse(parsed, { addSource: true }); }

  const topLevelNodes = parsed.type === 'Program' ? parsed.body : parsed.body.body;
  const defs = [];

  for (let node of topLevelNodes) {
    node = unwrapExport(node);
    let found = functionWrapper(node, options) ||
             varDefs(node) ||
             funcDef(node) ||
             es6ClassDef(node) ||
             someObjectExpressionCall(node) ||
             describe(node);
    if (!found) continue;

    if (options.hideOneLiners) {
      if (parsed.loc) {
        found = arr.filter(found, def =>
          !def.node.loc || (def.node.loc.start.line !== def.node.loc.end.line));
      } else if (parsed.source) {
        const filtered = [];
        for (const def of found) {
          if ((def.parent && filtered.includes(def.parent)) || // parent is in
           (def.node.source || '').includes('\n') // more than one line
          ) filtered.push(def);
        }
        found = filtered;
      }
    }

    defs.push(...found);
  }
  return defs;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// defs
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function es6ClassDef (node) {
  if (node.type !== 'ClassDeclaration') return null;
  const def = {
    type: 'class-decl',
    name: node.id.name,
    node: node,
    children: []
  };
  def.children.push(...arr.compact(node.body.body.map((node, i) =>
    es6ClassMethod(node, def, i))));
  return [def, ...def.children];
}

function es6ClassMethod (node, parent, i) {
  if (node.type !== 'MethodDefinition') return null;
  let type;
  if (node.kind === 'constructor') type = 'class-constructor';
  else if (node.kind === 'method') type = node.static ? 'class-class-method' : 'class-instance-method';
  else if (node.kind === 'get') type = node.static ? 'class-class-getter' : 'class-instance-getter';
  else if (node.kind === 'set') type = node.static ? 'class-class-setter' : 'class-instance-setter';
  if (type === 'class-instance-getter' && node.key.name === 'commands') return parseCommandsMethod(node, parent, type);
  if (type === 'class-class-getter' && node.key.name === 'properties') return parsePropertiesMethod(node, parent, type);
  
  return type
    ? {
        type,
        parent,
        node,
        name: node.key.name
      }
    : null;
}

function parsePropertiesMethod (node, parent, type) {
  const propertiesNode = {
    type,
    parent,
    node,
    name: node.key.name
  };
  try {
    const children = [];
    propertiesNode.node.value.body.body[0].argument.properties.forEach(property => {
      children.push({
        type: property.type,
        parent: propertiesNode,
        node: property,
        name: property.key ? property.key.name : property.argument.arguments[0].value
      });
    });
    propertiesNode.children = children;
  } finally {
    // in case the try fails we are equivalent to the base case in es6ClassMethod
    return propertiesNode;
  }
}

function parseCommandsMethod (node, parent, type) {
  const commandsNode = {
    type,
    parent,
    node,
    name: node.key.name
  };
  try {
    const children = [];
    if (commandsNode.node.value.body.body) {
      const commands = commandsNode.node.value.body.body[0].argument.elements;
      if (commands) {
        commands.forEach(command => {
          children.push({
            type: command.type,
            parent: commandsNode,
            node: command,
            name: command.properties[0].value.value
          });
        });
        commandsNode.children = children;
      }
    }
  } finally {
    // in case the try fails we are equivalent to the base case in es6ClassMethod
    return commandsNode;
  }
}

function varDefs (varDeclNode) {
  if (varDeclNode.type !== 'VariableDeclaration') return null;
  const result = [];

  for (const { id, node } of withVarDeclIds(varDeclNode)) {
    const def = { name: id.name, node: node, type: 'var-decl' };
    result.push(def);
    if (!def.node.init) continue;

    let initNode = def.node.init;
    while (initNode.type === 'AssignmentExpression') { initNode = initNode.right; }
    if (initNode.type === 'ObjectExpression') {
      def.type = 'object-decl';
      def.children = objectKeyValsAsDefs(initNode).map(ea =>
        ({ ...ea, type: 'object-' + ea.type, parent: def }));
      result.push(...def.children);
      continue;
    }

    if (initNode.type === 'ArrayExpression') {
      def.type = 'array-decl';
      try {
        def.children = arrayEntriesAsDefs(initNode).map(ea =>
          ({ ...ea, type: 'object-' + ea.type, parent: def }));
        result.push(...def.children);
      } finally { continue; }
    }

    const objDefs = someObjectExpressionCall(initNode, def);
    if (objDefs) {
      def.children = objDefs.map(d => ({ ...d, parent: def }));
      result.push(...def.children);
    }
  }
  return result;
}

function funcDef (node) {
  if (node.type !== 'FunctionStatement' &&
   node.type !== 'FunctionDeclaration') return null;
  if (!node.id) return null; // no anonymous functions can serve as declarations
  return [{ name: node.id.name, node, type: 'function-decl' }];
}

function someObjectExpressionCall (node, parentDef) {
  // like Foo({....})
  if (node.type === 'ExpressionStatement') node = node.expression;
  if (node.type !== 'CallExpression') return null;
  const objArg = node.arguments.find(a => a.type === 'ObjectExpression');
  if (!objArg) return null;
  return objectKeyValsAsDefs(objArg, parentDef);
}

/**
 * @param { Node } parent A node representing a `describe` block
 * All subnodes of the passed `Node` will be parsed to extract declarations for contained `describe` blocks, test setup methods (like `after`,...) and test cases.
 */
function parseDescribeBlock (parent) {
  const parseInSuits = ['describe', 'xdescribe', 'it', 'xit', 'after', 'afterEach', 'before', 'beforeEach'];
  const nodes = [];
  
  parent.expression.arguments[1].body.body.forEach((subnode) => {
    if (subnode.type !== 'ExpressionStatement' || !subnode.expression.callee) return null;
    
    const type = subnode.expression.callee.name;
    if (!parseInSuits.includes(type)) return;
    // string of the describe/it block or function name like before, after,...
    const name = subnode.expression.arguments[0].value || subnode.expression.callee.name;
    
    let parsedSubNode = { name, node: subnode, type, parent: parent };
    // recursively parse describe blocks that can contain other describe blocks
    if (subnode.expression.callee.name === 'describe' || subnode.expression.callee.name === 'xdescribe') {
      parsedSubNode.children = parseDescribeBlock(subnode);
    }
    nodes.push(parsedSubNode);
  });
  return nodes;    
}

/**
 * @param { Node } node A toplevel node of the parsed source code
 * If the passed `Node` does not represent a `describe` block, it will not be processed.
 * If it represents a `describe` block, it will be shown as a declaration and all containing code will be parsed using `parseDescribeBlock()`
 */
function describe (node) {
  if (node.type !== 'ExpressionStatement') return null; 
  if (node.expression && Path('expression.callee.name').get(node) !== 'describe' && Path('expression.callee.name').get(node) !== 'xdescribe') return null;
  
  const parsedNode = { name: node.expression.arguments[0].value, node, type: node.expression.callee.name };
  parsedNode.children = parseDescribeBlock(node);
  
  return [parsedNode];
}

function functionWrapper (node, options) {
  if (!isFunctionWrapper(node)) return null;
  let decls;
  // Is it a function wrapper passed as arg?
  // like ;(function(run) {... })(function(exports) {...})
  const argFunc = Path('expression.arguments.0').get(node);
  if (argFunc &&
   argFunc.type === 'FunctionExpression' &&
   string.lines(argFunc.source || '').length > 5) {
    // lively.debugNextMethodCall(lively.ast.CodeCategorizer, "findDecls");
    decls = findDecls(argFunc, options);
  } else {
    decls = findDecls(Path('expression.callee').get(node), options);
  }
  const parent = { node: node, name: Path('expression.callee.id.name').get(node) };
  decls.forEach(function (decl) { return decl.parent || (decl.parent = parent); });
  return decls;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helpers
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function unwrapExport (node) {
  return (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') &&
      node.declaration
    ? node.declaration
    : node;
}

function objectKeyValsAsDefs (objectExpression, parent) {
  return objectExpression.properties.map(node => ({
    name: node.key.name || node.key.value,
    type: node.value.type === 'FunctionExpression' ? 'method' : 'property',
    node,
    parent
  }));
}

function arrayEntriesAsDefs (arrayExpression, parent) {
  return arrayExpression.elements.map(node => ({
    name: node.value || node.properties[0].value.value,
    type: node.type,
    node,
    parent
  }));
}

function isFunctionWrapper (node) {
  return Path('expression.type').get(node) === 'CallExpression' &&
      Path('expression.callee.type').get(node) === 'FunctionExpression';
}

function declIds (idNodes) { // eslint-disable-line no-unused-vars
  return arr.flatmap(idNodes, function (ea) {
    if (!ea) return [];
    if (ea.type === 'Identifier') return [ea];
    if (ea.type === 'RestElement') return [ea.argument];
    if (ea.type === 'ObjectPattern') { return declIds(arr.pluck(ea.properties, 'value')); }
    if (ea.type === 'ArrayPattern') { return declIds(ea.elements); }
    return [];
  });
}

function withVarDeclIds (varNode) {
  return varNode.declarations.map(declNode => {
    if (!declNode.source && declNode.init) { declNode.source = declNode.id.name + ' = ' + declNode.init.source; }
    return { node: declNode, id: declNode.id };
  });
}
