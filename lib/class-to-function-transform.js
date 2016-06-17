import Visitor from "../generated/estree-visitor.js";

import { arr } from "lively.lang";
import { parse } from "./parser.js";

import {
  member,
  id,
  exprStmt,
  funcCall,
  literal,
  objectLiteral,
  varDecl
} from "./nodes.js";

import stringify from "./stringify.js";

const isTransformedClassVarDeclSymbol = Symbol();

const simpleReplace = (function() {
  class ReplaceVisitor extends Visitor {
    accept(node, state, path) {
      return this.replacer(super.accept(node, state, path), path);
    }
  
    static run(parsed, replacer) {
      var v = new this();
      v.replacer = replacer;
      return v.accept(parsed, null, []);
    }
  }
  
  return function simpleReplace(parsed, replacer) { return ReplaceVisitor.run(parsed, replacer); }
})();

function replaceSuper(node, path, options) {
  console.assert(node.type === "Super");
  var [parentReferencedAs, referencedAs] = path.slice(-2);
  if ((parentReferencedAs === 'callee' && referencedAs === 'object') || referencedAs === 'callee')
    return node // deal with this in replaceSuperCall

  return member(
    member(
      member("this", "constructor"),
      funcCall(
        member("Symbol", "for"),
        literal("lively-instance-superclass")), true),
    "prototype");
}

function replaceSuperMethodCall(node, path, options) {
  // like super.foo()
  console.assert(node.type === "CallExpression");
  console.assert(node.callee.object.type === "Super");
  return funcCall(
    member(
      member(
        replaceSuper(node.callee.object, [], options), node.callee.property),
        "call"),
    id("this"), ...node.arguments);
}

function replaceDirectSuperCall(node, path, options) {
  // like super.foo()
  console.assert(node.type === "CallExpression");
  console.assert(node.callee.type === "Super");
  return funcCall(
    member(
      member(
        replaceSuper(node.callee, [], options), funcCall(member("Symbol", "for"), literal("lively-instance-initialize")), true),
        "call"),
    id("this"), ...node.arguments);
}

function replaceClass(node, path, options) {
  console.assert(node.type === "ClassDeclaration" || node.type === "ClassExpression");
  var instanceProps = id("undefined"),
      classProps = id("undefined");

  if (node.body.body.length) {
    var {inst, clazz} = node.body.body.reduce((props, propNode) => {
      var decl, {key, kind, value, static: classSide} = propNode;
      if (key.type !== "Literal" && key.type !== "Identifier") {
        debugger;
        console.warn(`Unexpected key in classToFunctionTransform! ${JSON.stringify(key)}`);
      }

      if (kind === "method") {
        decl = objectLiteral([
            "key", literal(key.name || key.value),
            "value", Object.assign({}, value, {id: null})]);

      } else if (kind === "get" || kind === "set") {
        decl = objectLiteral([
          "key", literal(key.name || key.value),
          kind, Object.assign({}, value, {id: id(kind)})])

      } else if (kind === "constructor") {
        decl = objectLiteral([
          "key", funcCall(member("Symbol", "for"), literal("lively-instance-initialize")),
          "value", Object.assign({}, value, {id: null})])

      } else {
        console.warn(`classToFunctionTransform encountered unknown class property with kind ${kind}, ignoring it, ${JSON.stringify(propNode)}`);
      }
      (classSide ? props.clazz : props.inst).push(decl);
      return props;
    }, {inst: [], clazz: []})

    if (inst.length) instanceProps = {type: "ArrayExpression", elements: inst};
    if (clazz.length) classProps = {type: "ArrayExpression", elements: clazz};
  }

  var classCreator = funcCall(options.functionNode,
    options.classHolder,
    node.superClass || id("undefined"),
    node.id ? literal(node.id.name) : id("undefined"),
    instanceProps, classProps);
    
  if (node.type === "ClassExpression")
    return classCreator;

  var result = classCreator;

  if (options.declarationWrapper) result = funcCall(options.declarationWrapper, literal(node.id.name), literal("class"), result, options.classHolder);
  // since it is a declaration and we removed the class construct we need to add a var-decl
  result = varDecl(node.id, result, "var");
  result[isTransformedClassVarDeclSymbol] = true;

  return result;

}

function splitExportDefaultWithClass(node, path, options) {
  return !node.declaration || !node.declaration[isTransformedClassVarDeclSymbol] ?
    node :
    [node.declaration, {
      declaration: node.declaration.declarations[0].id,
      type: "ExportDefaultDeclaration"
    }]
}

// var opts = {classHolder: {type: "Identifier", name: "_rec"}, functionNode: {type: "Identifier", name: "createOrExtendClass"}};
// stringify(classToFunctionTransform(parse("class Foo extends Bar {m() { super.m(); }}"), opts))
// stringify(classToFunctionTransform(parse("class Foo {constructor() {}}"), opts))

export function classToFunctionTransform(sourceOrAst, options) {
  // required: options = {functionNode, classHolder}
  // From
  //   class Foo extends SuperFoo { m() { return 2 + super.m() }}
  // produces something like
  //   createOrExtend({}, SuperFoo, "Foo2", [{
  //     key: "m",
  //     value: function m() {
  //       return 2 + this.constructor[superclassSymbol].prototype.m.call(this);
  //     }
  //   }])

  var parsed = typeof sourceOrAst === "string" ? parse(sourceOrAst) : sourceOrAst;
  return simpleReplace(parsed, (node, path) => {
    if (node.type === "ClassExpression" || node.type === "ClassDeclaration")
      return replaceClass(node, path, options);

    if (node.type === "Super")
      return replaceSuper(node, path, options);

    if (node.type === "CallExpression" && node.callee.type === "Super")
      return replaceDirectSuperCall(node, path, options);

    if (node.type === "CallExpression" && node.callee.object && node.callee.object.type === "Super")
      return replaceSuperMethodCall(node, path, options);

    if (node.type === "ExportDefaultDeclaration") {
      return splitExportDefaultWithClass(node, path, options);
    }

    return node;
  });
}
