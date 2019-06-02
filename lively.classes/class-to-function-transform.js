import { arr } from "lively.lang";
import { parse, stringify, query, nodes, BaseVisitor as Visitor } from "lively.ast";

var {
  assign,
  member,
  id,
  exprStmt,
  funcCall,
  literal,
  objectLiteral,
  varDecl,
  funcExpr,
  returnStmt,
  binaryExpr,
  ifStmt,
  block
} = nodes;


function isFunctionNode(node) {
  return  node.type === "ArrowFunctionExpression"
       || node.type === "FunctionExpression"
       || node.type === "FunctionDeclaration"
}

const firstIdRe = /^[^_a-z]/i,
      trailingIdRe = /[^_a-z0-9]/ig;
function ensureIdentifier(name) {
  return name
    .replace(firstIdRe, "_")
    .replace(trailingIdRe, "_");
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function constructorTemplate(name) {
  // Creates a function like
  // function CLASS() {
  //   var firstArg = arguments[0];
  //   if (firstArg && firstArg[Symbol.for("lively-instance-restorer")]) {
  //     // for deserializing instances just do nothing
  //   } else {
  //     // automatically call the initialize method
  //     this[Symbol.for("lively-instance-initialize")].apply(this, arguments);
  //   }
  // }

  return funcExpr({id: name ? id(name) : null}, ["__first_arg__"],
    ifStmt(
      binaryExpr(
        id("__first_arg__"),
        "&&",
        member("__first_arg__", funcCall(member("Symbol", "for"), literal("lively-instance-restorer")), true)),
      block(),
      block(
        exprStmt(
          funcCall(
            member(
              member("this", funcCall(member("Symbol", "for"), literal("lively-instance-initialize")), true),
              "apply"), id("this"), id("arguments"))))));
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

const isTransformedClassVarDeclSymbol = Symbol();
const methodKindSymbol = Symbol();
const tempLivelyClassVar = "__lively_class__";
const tempLivelyClassHolderVar = "__lively_classholder__";

class ClassReplaceVisitor extends Visitor {

  accept(node, state, path) {
    if (isFunctionNode(node)) {
      state = {
        ...state, classHolder: objectLiteral([]),
        currentMethod: node[methodKindSymbol] ? node : state.currentMethod
      }
    }

    if (node.type === "ClassExpression" || node.type === "ClassDeclaration")
      node = replaceClass(node, state, path, state.options);

    if (node.type === "Super")
      node = replaceSuper(node, state, path, state.options);

    if (node.type === "MemberExpression" && node.object && node.object.type === "Super")
      node = replaceSuperGetter(node, state, path, state.options);

    if (node.type === "AssignmentExpression" && node.left.type === "MemberExpression" && node.left.object.type === "Super")
      node = replaceSuperSetter(node, state, path, state.options);

    if (node.type === "CallExpression" && node.callee.type === "Super")
      node = replaceDirectSuperCall(node, state, path, state.options);

    if (node.type === "CallExpression" && node.callee.object && node.callee.object.type === "Super")
      node = replaceSuperMethodCall(node, state, path, state.options);

    node = super.accept(node, state, path);

    if (node.type === "ExportDefaultDeclaration")
      return splitExportDefaultWithClass(node, state, path, state.options);

    return node;
  }

  static run(parsed, options) {
    var v = new this(),
        classHolder = options.classHolder || objectLiteral([]);
    return v.accept(parsed, {options, classHolder}, []);
  }

}

function replaceSuper(node, state, path, options) {
  // just super
  console.assert(node.type === "Super");

  var {currentMethod} = state;
  if (!currentMethod) {
    console.warn(`[lively.classes] Trying to transform es6 class but got super call outside a method! ${stringify(node)} in ${path.join(".")}`)
    // return node;
  }

  var [parentReferencedAs, referencedAs] = path.slice(-2);
  if ((parentReferencedAs === 'callee' && referencedAs === 'object') || referencedAs === 'callee')
    return node // deal with this in replaceSuperCall

  var methodHolder = currentMethod && currentMethod[methodKindSymbol] === "static" ?
    funcCall(member("Object", "getPrototypeOf"), id(tempLivelyClassVar)) :
    funcCall(member("Object", "getPrototypeOf"), member(id(tempLivelyClassVar), "prototype"));

  return methodHolder;
}


// parse("class Foo extends Bar { get x() { return super.x; }}").body[0]

function replaceSuperMethodCall(node, state, path, options) {
  // like super.foo()
  console.assert(node.type === "CallExpression");
  console.assert(node.callee.object.type === "Super");

  return funcCall(
            member(
              funcCall(
                member(options.functionNode, "_get"),
                replaceSuper(node.callee.object, state, path.concat(["callee", "object"]), options),
                literal(node.callee.property.value || node.callee.property.name),
                id("this")),
                "call"),
            id("this"), ...node.arguments);
}

function replaceDirectSuperCall(node, state, path, options) {
  // like super()
  console.assert(node.type === "CallExpression");
  console.assert(node.callee.type === "Super");

  return funcCall(
            member(
              funcCall(
                member(options.functionNode, "_get"),
                replaceSuper(node.callee, state, path.concat(["callee"]), options),
                funcCall(member("Symbol", "for"), literal("lively-instance-initialize")),
                id("this")),
                "call"),
            id("this"), ...node.arguments)
}

function replaceSuperGetter(node, state, path, options) {
  console.assert(node.type === "MemberExpression");
  console.assert(node.object.type === "Super");
  return funcCall(
          member(options.functionNode, "_get"),
          replaceSuper(node.object, state, path.concat(["object"]), options),
          literal(node.property.value || node.property.name),
          id("this"))
}

function replaceSuperSetter(node, state, path, options) {
  console.assert(node.type === "AssignmentExpression");
  console.assert(node.left.object.type === "Super");

  return funcCall(
          member(options.functionNode, "_set"),
          replaceSuper(node.left.object, state, path.concat(["left", "object"]), options),
          literal(node.left.property.value || node.left.property.name),
          node.right,
          id("this"))
}

function replaceClass(node, state, path, options) {
  console.assert(node.type === "ClassDeclaration" || node.type === "ClassExpression");  

  var {body: {body}, superClass, id: classId, type, start, end} = node,
      instanceProps = id("undefined"),
      classProps = id("undefined"),
      className = classId ? classId.name : "anonymous_class",
      evalId = options.evalId,
      sourceAccessorName = options.sourceAccessorName,
      loc = node["x-lively-object-meta"] || {start, end};

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
        let methodId = id(className + "_" + ensureIdentifier(key.name || key.value) + "_"),
            props = [
              "key", literal(key.name || key.value),
              "value", {...value, id: methodId, [methodKindSymbol]: classSide ? "static" : "proto"}];

        decl = objectLiteral(props);

      } else if (kind === "get" || kind === "set") {
        decl = objectLiteral([
          "key", literal(key.name || key.value),
          kind, Object.assign({}, value, {id: id(kind), [methodKindSymbol]: classSide ? "static" : "proto"})])

      } else if (kind === "constructor") {
        let props = [
          "key", funcCall(member("Symbol", "for"), literal("lively-instance-initialize")),
          "value", {...value, id: id(className + "_initialize_"), [methodKindSymbol]: "proto"}];
        decl = objectLiteral(props);

      } else {
        console.warn(`[lively.classes] classToFunctionTransform encountered unknown class property with kind ${kind}, ignoring it, ${JSON.stringify(propNode)}`);
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

  // For persistent storage and retrieval of pre-existing classes in "classHolder" object
  var useClassHolder = classId && type === "ClassDeclaration";

  var locKeyVals = ["start", literal(loc.start), "end", literal(loc.end)];
  if (typeof evalId !== "undefined") locKeyVals.push("evalId", literal(evalId));
  if (sourceAccessorName) locKeyVals.push("moduleSource", nodes.id(sourceAccessorName));
  var locNode = objectLiteral(locKeyVals);

  var classCreator =
    funcCall(
      funcExpr({}, ["superclass"],
        varDecl(tempLivelyClassHolderVar, state.classHolder),
        varDecl(tempLivelyClassVar,
          useClassHolder ? {
            type: "ConditionalExpression",
            test: binaryExpr(
              funcCall(member(tempLivelyClassHolderVar, "hasOwnProperty"), literal(classId.name)),
              "&&",
              binaryExpr(
                {
                  argument: member(tempLivelyClassHolderVar, classId),
                  operator: "typeof", prefix: true, type: "UnaryExpression"
                }, "===", literal("function"))),
            consequent: member(tempLivelyClassHolderVar, classId),
            alternate: assign(
                          member(tempLivelyClassHolderVar, classId),
                          constructorTemplate(classId.name))
          } : classId ? constructorTemplate(classId.name) : constructorTemplate(null)),
        returnStmt(
          funcCall(
            options.functionNode,
            id(tempLivelyClassVar),
            id("superclass"),
            instanceProps, classProps,
            id(tempLivelyClassHolderVar),
            options.currentModuleAccessor || id("undefined"),
            locNode
            ))),
      superClassSpec);

  if (type === "ClassExpression") return classCreator;

  var result = classCreator;

  if (options.declarationWrapper && state.classHolder === options.classHolder /*i.e. toplevel*/)
    result = funcCall(
      options.declarationWrapper,
      literal(classId.name),
      literal("class"),
      result,
      options.classHolder,
      locNode);

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

// console.log(typeof sourceOrAst === "string" ? sourceOrAst : stringify(sourceOrAst))

  var parsed = typeof sourceOrAst === "string" ? parse(sourceOrAst) : sourceOrAst;
  options.scope = query.resolveReferences(query.scopes(parsed));

  var replaced = ClassReplaceVisitor.run(parsed, options);

  return replaced;
}
