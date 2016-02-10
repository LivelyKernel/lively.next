/*global window, process, global*/

var ast = require("../index"),
    lang = require("lively.lang"),
    arr = lang.arr, chain = lang.chain, obj = lang.obj,
    p = lang.Path, str = lang.string;

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helpers

function objectKeyValsAsDefs(objectExpression) {
  return objectExpression.properties.map(function(prop) {
    return {
      name: prop.key.name || prop.key.value,
      type: prop.value.type === "FunctionExpression" ? "method" : "property",
      node: prop
    };
  });
}

function classDef(node) {
  if (p("expression.callee.property.name").get(node) !== "subclass") return null;
  var def = {
    type: "lively-class-definition",
    name: p("expression.arguments.0.value").get(node),
    node: node
  };
  var props = arr.flatmap(
    node.expression.arguments,
    function(argNode) {
      if (argNode.type !== "ObjectExpression") return [];
      return objectKeyValsAsDefs(argNode).map(function(ea) {
        ea.type = "lively-class-instance-" + ea.type;
        ea.parent = def;
        return ea;
      })
    });
  return [def].concat(props);
}

function extendDef(node) {
  if (p("expression.callee.property.name").get(node) !== "extend"
   || p("expression.arguments.0.type").get(node) !== "ObjectExpression") return null;
  var name = p("expression.arguments.0.name").get(node);
  if (!name) return null;
  var def = {
    name: name, node: node,
    type: "lively-extend-definition"
  };
  var props = (objectKeyValsAsDefs(p("expression.arguments.1").get(node)) || [])
    .map(function(d) { d.parent = def; return d; });
  return [def].concat(props);
}

function varDefs(node) {
  if (node.type !== "VariableDeclaration") return null;
  return arr.flatmap(
    withVarDeclIds(node),
    function(ea) {
      return arr.flatmap(
        ea.ids,
        function(id) {
          var def = {name: id.name, node: ea.node, type: "var-decl"};
          if (!def.node.init) return [def];
          var node = def.node.init;
          while (node.type === "AssignmentExpression") node = node.right;
          if (node.type === "ObjectExpression") {
            return [def].concat(objectKeyValsAsDefs(node).map(function(ea) {
              ea.type = "object-" + ea.type; ea.parent = def; return ea; }));
          }
          var objDefs = someObjectExpressionCall(node);
          if (objDefs) return [def].concat(objDefs.map(function(d) { d.parent = def; return d; }))
          return [def];
        });
      });
}

function funcDef(node) {
  if (node.type !== "FunctionStatement"
   && node.type !== "FunctionDeclaration") return null;
  return [{
    name: node.id.name,
    node: node,
    type: "function-decl"
  }];
}

function someObjectExpressionCall(node) {
  if (node.type === "ExpressionStatement") node = node.expression;
  if (node.type !== "CallExpression") return null;
  var objArg = node.arguments.detect(function(a) { return a.type === "ObjectExpression"; });
  if (!objArg) return null;
  return objectKeyValsAsDefs(objArg);
}

function moduleDef(node, options) {
  if (!isModuleDeclaration(node)) return null;
  var decls = findDecls(p("expression.arguments.0").get(node), options),
      parent = {node: node, name: p("expression.callee.object.callee.object.arguments.0.value").get(node)};
  decls.forEach(function(decl) { return decl.parent = parent; });
  return decls;
}

function functionWrapper(node, options) {
  if (!isFunctionWrapper(node)) return null
  var decls;
  // Is it a function wrapper passed as arg?
  // like ;(function(run) {... })(function(exports) {...})      
  var argFunc = p("expression.arguments.0").get(node);
  if (argFunc
   && argFunc.type === "FunctionExpression"
   && str.lines(argFunc.source || "").length > 5) {
    // lively.debugNextMethodCall(lively.ast.CodeCategorizer, "findDecls");
    decls = findDecls(argFunc, options);
  } else {
    decls = findDecls(p("expression.callee").get(node), options);
  }
  var parent = {node: node, name: p("expression.callee.id.name").get(node)};
  decls.forEach(function(decl) { return decl.parent || (decl.parent = parent) });
  return decls;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function isModuleDeclaration(node) {
  return p("expression.callee.object.callee.object.callee.name").get(node) === "module"
      && p("expression.callee.property.name").get(node) === "toRun";
}

function isFunctionWrapper(node) {
  return p("expression.type").get(node) === "CallExpression"
      && p("expression.callee.type").get(node) === "FunctionExpression";
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
  return varNode.declarations.map(function(declNode) {
    if (!declNode.source && declNode.init)
      declNode.source = declNode.id.name + " = " + declNode.init.source
    return {node: declNode, ids: declIds([declNode.id])};
  });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// main method
function findDecls(parsed, options) {
  // lively.debugNextMethodCall(lively.ast.codeCategorizer, "findDecls")

  options = options || obj.merge({hideOneLiners: false}, options);

  if (typeof parsed === "string")
    parsed = ast.parse(parsed, {addSource: true});

  var topLevelNodes = parsed.type === "Program" ? parsed.body : parsed.body.body,
      defs = arr.flatmap(topLevelNodes,
        function(n) {
          return moduleDef(n, options)
              || functionWrapper(n, options)
              || varDefs(n)
              || funcDef(n)
              || classDef(n)
              || extendDef(n)
              || someObjectExpressionCall(n);
        });

  if (options.hideOneLiners && parsed.source) {
    defs = defs.reduce(function(defs, def) {
      if (def.parent && defs.indexOf(def.parent) > -1) defs.push(def)
      else if ((def.node.source || "").indexOf("\n") > -1) defs.push(def)
      return defs;
    }, []);
  }

  if (options.hideOneLiners && parsed.loc)
    defs = defs.filter(function(def) {
      return !def.node.loc || (def.node.loc.start.line !== def.node.loc.end.line);
    parsed});

  return defs;
}

exports.codeCategorizer = {
  findDecls: findDecls
}
