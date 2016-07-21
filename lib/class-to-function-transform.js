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

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function isFunctionNode(node) {
  return  node.type === "ArrowFunctionExpression"
       || node.type === "FunctionExpression"
       || node.type === "FunctionDeclaration"
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

const arguments_replacement_name = "__lively_arguments_fixed_bc_declaring_class_arg";

class ArgumentsReplaceVisitor extends Visitor {

  accept(node, rootNode, path) {
    return isFunctionNode(node) && node !== rootNode ?
      node : this.replace(super.accept(node, rootNode, path));
  }

  replace(node) {

    if (isFunctionNode(node) && Array.isArray(node.body.body)) {
      // insert var __lively_arguments_fixed_bc_super_arg = Array.from(arguments).slice(1)
      var newArgs = funcCall(member(funcCall(member("Array", "from"), id("arguments")), "slice"), literal(1)),
          newArgsDecl = varDecl(arguments_replacement_name, newArgs);
      node.body.body.unshift(newArgsDecl)

    } else if (node.type === "Identifier" && node.name === "arguments") {
      // replace arguments refs
      node = id(arguments_replacement_name);
    }

    return node;
  }

  static run(parsed) {

    return new this().accept(parsed, parsed, []);
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

const isTransformedClassVarDeclSymbol = Symbol();
const node_marker_super_found = Symbol();
const superclass_arg_name = "lively_declaring_class_arg";

class ClassReplaceVisitor extends Visitor {

  accept(node, state, path) {
    if (isFunctionNode(node)) {
      state = {...state, classHolder: objectLiteral([]), superFound: false, argumentsFound: false}
    }
    return this.replace(super.accept(node, state, path), state, path);
  }

  replace(node, state, path) {

    if (node.type === "ClassExpression" || node.type === "ClassDeclaration")
      return replaceClass(node, state, path, state.options);

    if (node.type === "Super")
      return replaceSuper(node, state, path, state.options);

    if (node.type === "CallExpression" && node.callee.type === "Super")
      return replaceDirectSuperCall(node, state, path, state.options);

    if (node.type === "CallExpression" && node.callee.object && node.callee.object.type === "Super")
      return replaceSuperMethodCall(node, state, path, state.options);

    if (node.type === "ExportDefaultDeclaration") {
      return splitExportDefaultWithClass(node, state, path, state.options);
    }

    if (node.type === "Identifier" && node.name === "arguments")
      state.argumentsFound = true;

    if (isFunctionNode(node)) {
      if (state.superFound) {
        node = insertSuperClassArgIntoParams(node);
        if (state.argumentsFound)
          node = ArgumentsReplaceVisitor.run(node);
        node[node_marker_super_found] = true;
      }
    }

    return node;
  }

  static run(parsed, options) {
    var v = new this(),
        classHolder = options.classHolder || objectLiteral([]);
    return v.accept(parsed, {options, classHolder, superFound: false, argumentsFound: false}, []);
  }

}

function replaceSuper(node, state, path, options) {
  // like super()
  console.assert(node.type === "Super");
  state.superFound = true;
  var [parentReferencedAs, referencedAs] = path.slice(-2);
  if ((parentReferencedAs === 'callee' && referencedAs === 'object') || referencedAs === 'callee')
    return node // deal with this in replaceSuperCall

  // return member(
  //   member(
  //     member("this", "constructor"),
  //     funcCall(
  //       member("Symbol", "for"),
  //       literal("lively-instance-superclass")), true),
  //   "prototype");
  // return member(id(superclass_arg_name), "prototype");
  return member(
    member(
      id(superclass_arg_name),
      funcCall(
        member("Symbol", "for"),
        literal("lively-instance-superclass")), true),
    "prototype");
}

function replaceSuperMethodCall(node, state, path, options) {
  // like super.foo()
  console.assert(node.type === "CallExpression");
  console.assert(node.callee.object.type === "Super");
  state.superFound = true;
  return funcCall(
    member(
      member(
        replaceSuper(node.callee.object, state.classHolder, [], options), node.callee.property),
        "call"),
    id("this"), ...node.arguments);
}

function replaceDirectSuperCall(node, state, path, options) {
  // like super.foo()
  console.assert(node.type === "CallExpression");
  console.assert(node.callee.type === "Super");
  state.superFound = true;
  return funcCall(
    member(
      member(
        replaceSuper(
          node.callee, state.classHolder, [], options),
          funcCall(member("Symbol", "for"), literal("lively-instance-initialize")), true),
        "call"),
    id("this"), ...node.arguments);
}


function insertSuperClassArgIntoParams(node) {
  node.params.unshift(id(superclass_arg_name));
  return node;
}


function replaceClass(node, state, path, options) {
  console.assert(node.type === "ClassDeclaration" || node.type === "ClassExpression");

  var {body: {body}, superClass, id: classId, type} = node,
      instanceProps = id("undefined"),
      classProps = id("undefined"),
      className = classId ? classId.name : "anonymous_class";

  if (body.length) {
    var {inst, clazz} = body.reduce((props, propNode) => {

      var decl, {key, kind, value, static: classSide} = propNode;

      if (key.type !== "Literal" && key.type !== "Identifier") {
        console.warn(`Unexpected key in classToFunctionTransform! ${JSON.stringify(key)}`);
      }

      if (kind === "method") {
        // The name is just for debugging purposes when it appears in
        // native debuggers. We have to be careful about it b/c it shadows
        // outer functions / vars, something that is totally not apparent for a user
        // of the class syntax. That's the reason for making it a little cryptic
        let methodId = id(className + "_" + (key.name || key.value) + "_"),
            props = [
              "key", literal(key.name || key.value),
              "value", {...value, id: methodId}];

        if (value[node_marker_super_found])
          props.push("needsDeclaringClass", literal(true));

        decl = objectLiteral(props);

      } else if (kind === "get" || kind === "set") {
        decl = objectLiteral([
          "key", literal(key.name || key.value),
          kind, Object.assign({}, value, {id: id(kind)})])

      } else if (kind === "constructor") {
        let props = [
          "key", funcCall(member("Symbol", "for"), literal("lively-instance-initialize")),
          "value", {...value, id: id(className + "_initialize_")}];
        if (value[node_marker_super_found])
          props.push("needsDeclaringClass", literal(true));
        decl = objectLiteral(props);

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
    state.classHolder,
    options.currentModuleAccessor || id("undefined"));

  if (type === "ClassExpression") return classCreator;

  var result = classCreator;

  if (options.declarationWrapper && state.classHolder === options.classHolder /*i.e. toplevel*/)
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
// stringify(classToFunctionTransform(parse("class Foo extends Bar {m() { super.m(arguments[1]); }}"), opts))
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
  options.scope = query.resolveReferences(query.scopes(parsed));

  var replaced = ClassReplaceVisitor.run(parsed, options);

  return replaced;
}
