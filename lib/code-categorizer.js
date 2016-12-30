import { parse } from "../lib/parser.js";
import { arr, Path, string, obj } from "lively.lang";

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
export function findDecls(parsed, options) {
  // lively.debugNextMethodCall(lively.ast.codeCategorizer, "findDecls")

  options = options || obj.merge({hideOneLiners: false}, options);

  if (typeof parsed === "string")
    parsed = parse(parsed, {addSource: true});

  var topLevelNodes = parsed.type === "Program" ? parsed.body : parsed.body.body,
      defs = [],
      hideOneLiners = options.hideOneLiners && parsed.source;

  for (let node of topLevelNodes) {
    node = unwrapExport(node);
    var found = functionWrapper(node, options)
             || varDefs(node)
             || funcDef(node)
             || es6ClassDef(node)
             || someObjectExpressionCall(node);

    if (!found) continue;

    if (options.hideOneLiners) {
      if (parsed.loc) {
        found = found.filter(def =>
          !def.node.loc || (def.node.loc.start.line !== def.node.loc.end.line));
      } else if (parsed.source) {
        var filtered = [];
        for (let def of found) {
          if ((def.parent && filtered.includes(def.parent)) // parent is in
           || (def.node.source || "").includes("\n") // more than one line
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


function es6ClassDef(node) {
  if (node.type !== "ClassDeclaration") return null;
  var def = {
    type: "class-decl",
    name: node.id.name,
    node: node,
    children: []
  };
  def.children.push(...node.body.body.map((node, i) =>
                        es6ClassMethod(node, def, i))
                          .filter(Boolean))
  return [def, ...def.children]
}

function es6ClassMethod(node, parent, i) {
  if (node.type !== "MethodDefinition") return null;
  var type;
  if (node.kind === "constructor") type = "class-constructor";
  else if (node.kind === "method") type = node.static ? "class-class-method" : "class-instance-method";
  else if (node.kind === "get") type = node.static ? "class-class-getter" : "class-instance-getter";
  else if (node.kind === "set") type = node.static ? "class-class-setter" : "class-instance-setter";
  return type ? {
    type, parent, node,
    name: node.key.name,
  } : null;
}

function varDefs(varDeclNode) {
  if (varDeclNode.type !== "VariableDeclaration") return null;
  let result = [];

  for (let {id, node} of withVarDeclIds(varDeclNode)) {
    let def = {name: id.name, node: node, type: "var-decl"};
    result.push(def);
    if (!def.node.init) continue;

    let initNode = def.node.init;
    while (initNode.type === "AssignmentExpression")
      initNode = initNode.right;
    if (initNode.type === "ObjectExpression") {
      def.type = "object-decl";
      def.children = objectKeyValsAsDefs(initNode).map(ea =>
                      ({...ea, type: "object-" + ea.type, parent: def}));
      result.push(...def.children);
      continue;
    }

    var objDefs = someObjectExpressionCall(initNode, def);
    if (objDefs) {
      def.children = objDefs.map(d => ({...d, parent: def}));
      result.push(...def.children)
    }
  }

  return result;
}

function funcDef(node) {
  if (node.type !== "FunctionStatement"
   && node.type !== "FunctionDeclaration") return null;
  return [{name: node.id.name, node, type: "function-decl"}];
}

function someObjectExpressionCall(node, parentDef) {
  // like Foo({....})
  if (node.type === "ExpressionStatement") node = node.expression;
  if (node.type !== "CallExpression") return null;
  var objArg = node.arguments.find(a => a.type === "ObjectExpression");
  if (!objArg) return null;
  return objectKeyValsAsDefs(objArg, parentDef);
}

function functionWrapper(node, options) {
  if (!isFunctionWrapper(node)) return null;
  var decls;
  // Is it a function wrapper passed as arg?
  // like ;(function(run) {... })(function(exports) {...})
  var argFunc = Path("expression.arguments.0").get(node);
  if (argFunc
   && argFunc.type === "FunctionExpression"
   && string.lines(argFunc.source || "").length > 5) {
    // lively.debugNextMethodCall(lively.ast.CodeCategorizer, "findDecls");
    decls = findDecls(argFunc, options);
  } else {
    decls = findDecls(Path("expression.callee").get(node), options);
  }
  var parent = {node: node, name: Path("expression.callee.id.name").get(node)};
  decls.forEach(function(decl) { return decl.parent || (decl.parent = parent) });
  return decls;
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helpers
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function unwrapExport(node) {
  return (node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration")
      && node.declaration ? node.declaration : node;
}

function objectKeyValsAsDefs(objectExpression, parent) {
  return objectExpression.properties.map(node => ({
    name: node.key.name || node.key.value,
    type: node.value.type === "FunctionExpression" ? "method" : "property",
    node, parent
  }));
}

function isFunctionWrapper(node) {
  return Path("expression.type").get(node) === "CallExpression"
      && Path("expression.callee.type").get(node) === "FunctionExpression";
}

function declIds(idNodes) {
  return arr.flatmap(idNodes, function(ea) {
    if (!ea) return [];
    if (ea.type === "Identifier") return [ea];
    if (ea.type === "RestElement") return [ea.argument];
    if (ea.type === "ObjectPattern")
      return declIds(arr.pluck(ea.properties, "value"));
    if (ea.type === "ArrayPattern")
      return declIds(ea.elements);
    return [];
  });
}

function withVarDeclIds(varNode) {
  return varNode.declarations.map(declNode => {
    if (!declNode.source && declNode.init)
      declNode.source = declNode.id.name + " = " + declNode.init.source
    return {node: declNode, id: declNode.id};
  });
}
