import Visitor from "../generated/estree-visitor.js";

import { arr } from "lively.lang";
import { parse } from "./parser.js";
import * as query from "./query.js";
import * as nodes from "./nodes.js";


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

function createsNewScope(node) {
  return  node.type === "ArrowFunctionExpression"
       || node.type === "FunctionExpression"
       || node.type === "FunctionDeclaration"
}

const simpleReplace = (function() {
  class ReplaceVisitor extends Visitor {
    accept(node, classHolder, path) {
      if (createsNewScope(node))
        classHolder = objectLiteral([]);
      return this.replacer(super.accept(node, classHolder, path), classHolder, path);
    }
  
    static run(parsed, classHolder, replacer) {
      var v = new this();
      v.replacer = replacer;
      return v.accept(parsed, classHolder, []);
    }
  }
  
  return function simpleReplace(parsed, classHolder, replacer) { return ReplaceVisitor.run(parsed, classHolder, replacer); }
})();

function replaceSuper(node, classHolder, path, options) {
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

function replaceSuperMethodCall(node, classHolder, path, options) {
  // like super.foo()
  console.assert(node.type === "CallExpression");
  console.assert(node.callee.object.type === "Super");
  return funcCall(
    member(
      member(
        replaceSuper(node.callee.object, classHolder, [], options), node.callee.property),
        "call"),
    id("this"), ...node.arguments);
}

function replaceDirectSuperCall(node, classHolder, path, options) {
  // like super.foo()
  console.assert(node.type === "CallExpression");
  console.assert(node.callee.type === "Super");
  return funcCall(
    member(
      member(
        replaceSuper(
          node.callee, classHolder, [], options),
          funcCall(member("Symbol", "for"), literal("lively-instance-initialize")), true),
        "call"),
    id("this"), ...node.arguments);
}

function replaceClass(node, classHolder, path, options) {
  console.assert(node.type === "ClassDeclaration" || node.type === "ClassExpression");
  var instanceProps = id("undefined"),
      classProps = id("undefined");

  var {body: {body}, superClass, id: classId, type} = node;

  if (body.length) {
    var {inst, clazz} = body.reduce((props, propNode) => {
      var decl, {key, kind, value, static: classSide} = propNode;
      if (key.type !== "Literal" && key.type !== "Identifier") {
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

  var scope = options.scope,
      superClassReferencedAs,
      superClassRef;

  if (superClass && options.currentModuleAccessor) {
    if (options.classHolder === superClass.object) {
      superClassRef = superClass;
      superClassReferencedAs = superClass.property.name;
    } else {
     var found = scope && scope.resolvedRefMap && scope.resolvedRefMap.get(superClass),
         isTopLevel = found && found.decl && scope.decls && scope.decls.find(([decl]) => decl === found.decl);
     if (isTopLevel) {
       superClassRef = superClass;
       superClassReferencedAs = superClass.name
     };
    }
  }

  var superClassSpec = superClassRef ?
        objectLiteral(["referencedAs", literal(superClassReferencedAs), "value", superClassRef]) :
        superClass || id("undefined");

  var classCreator = funcCall(
    options.functionNode,
    classId ? literal(classId.name) : id("undefined"),
    superClassSpec,
    instanceProps, classProps,
    classHolder,
    options.currentModuleAccessor || id("undefined"));

  if (type === "ClassExpression") return classCreator;

  var result = classCreator;

  if (options.declarationWrapper && classHolder === options.classHolder /*i.e. toplevel*/)
    result = funcCall(
      options.declarationWrapper,
      literal(classId.name),
      literal("class"),
      result,
      options.classHolder);
  
    // since it is a declaration and we removed the class construct we need to add a var-decl
    result = varDecl(classId, result, "var");
    result[isTransformedClassVarDeclSymbol] = true;

  return result;

}

function splitExportDefaultWithClass(node, classHolder, path, options) {
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
  //   createOrExtend({}, {referencedAs: "SuperFoo", value: SuperFoo}, "Foo2", [{
  //     key: "m",
  //     value: function m() {
  //       return 2 + this.constructor[superclassSymbol].prototype.m.call(this);
  //     }
  //   }])

  var parsed = typeof sourceOrAst === "string" ? parse(sourceOrAst) : sourceOrAst;
  options.scope = query.safeResolveReferences(query.scopes(parsed));

  var replaced = simpleReplace(parsed, options.classHolder, (node, classHolder, path) => {

    if (node.type === "ClassExpression" || node.type === "ClassDeclaration")
      return replaceClass(node, classHolder, path, options);

    if (node.type === "Super")
      return replaceSuper(node, classHolder, path, options);

    if (node.type === "CallExpression" && node.callee.type === "Super")
      return replaceDirectSuperCall(node, classHolder, path, options);

    if (node.type === "CallExpression" && node.callee.object && node.callee.object.type === "Super")
      return replaceSuperMethodCall(node, classHolder, path, options);

    if (node.type === "ExportDefaultDeclaration") {
      return splitExportDefaultWithClass(node, classHolder, path, options);
    }

    return node;
  });

  return replaced;
}
