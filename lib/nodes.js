export {
  isIdentifier,
  id,
  literal,
  exprStmt,
  returnStmt,
  empty,
  binaryExpr,
  funcExpr,
  funcCall,
  varDecl,
  member,
  memberChain,
  assign,
  block,
  program,
  tryStmt  
}

var identifierRe = /[_$a-zA-Z\xA0-\uFFFF][_$a-zA-Z0-9\xA0-\uFFFF]*$/;
function isIdentifier(string) {
  // Note: It's not so easy...
  // http://wiki.ecmascript.org/doku.php?id=strawman:identifier_identification
  // https://mathiasbynens.be/notes/javascript-identifiers-es6
  return identifierRe.test(string) && string.indexOf("-") === -1;
}

function id(name) { return name === "this" ? {type: "ThisExpression"} : {name: name, type: "Identifier"}; }

function literal(value) { return {type: "Literal", value: value}; }

function exprStmt(expression) { return {type: "ExpressionStatement", expression: expression}; }

function returnStmt(expr) { return { type: "ReturnStatement", argument: expr}; }

function empty() { return {type: "EmptyStatement"}; }

function binaryExpr(left, op, right) {
  return {
    left: left, right: right, operator: op,
    type: "BinaryExpression"
  }
}

function funcExpr({arrow, id: funcId, expression, generator}, params = [], ...statements) {
  // lively.ast.stringify(funcExpr({id: "foo"}, ["a"], exprStmt(id("3"))))
  // // => "function foo(a) { 3; }"
  params = params.map(ea => typeof ea === "string" ? id(ea) : ea);
  return {
    type: (arrow ? "Arrow" : "") + "FunctionExpression",
    id: funcId ? (typeof funcId === "string" ? id(funcId) : funcId) : undefined,
    params: params,
    body: {body: statements, type: "BlockStatement"},
    expression: expression || false,
    generator: generator || false
  }
}

function funcCall(callee, ...args) {
  if (typeof callee === "string") callee = id(callee);
  return {
    type: "CallExpression",
    callee: callee,
    arguments: args
  }
}

function varDecl(id, init, kind) {
  if (typeof id === "string") id = {name: id, type: "Identifier"};
  return {
    type: "VariableDeclaration", kind: kind || "var",
    declarations: [{type: "VariableDeclarator", id: id, init: init}]
  }
}

function member(obj, prop, computed) {
  // Example:
  // lively.ast.stringify(member("foo", "bar"))
  // // => "foo.bar"
  // lively.ast.stringify(member("foo", "b-a-r"))
  // // => "foo['b-a-r']"
  // lively.ast.stringify(member("foo", "zork", true))
  // // => "foo['zork']"
  // lively.ast.stringify(member("foo", 0))
  // // => "foo[0]"
  if (typeof obj === "string") obj = id(obj);
  if (typeof prop === "string") {
    if (!computed && !isIdentifier(prop)) computed = true;
    prop = computed ? literal(prop) : id(prop);
  } else if (typeof prop === "number") {
    prop = literal(prop);
    computed = true;
  }
  return {
    type: "MemberExpression",
    computed: !!computed,
    object: obj, property: prop
  }
}

function memberChain(first, ...rest) {
  // lively.ast.stringify(memberChain("foo", "bar", 0, "baz-zork"));
  // // => "foo.bar[0]['baz-zork']"
  return rest.reduce((memberExpr, key) =>
    member(memberExpr, key),
    typeof first === "object" ? first : id(first));
}

function assign(left, right) {
  // lively.ast.stringify(assign("a", "x"))
  // // => "a = x"
  // lively.ast.stringify(assign(member("a", "x"), literal(23)))
  // // => "a.x = 23"
  return {
    type: "AssignmentExpression", operator: "=",
    right: right ? (typeof right === "string" ? id(right) : right) : id("undefined"),
    left: typeof left === "string" ? id(left) : left
  }
}

function block(...body) {
  return {body: Array.isArray(body[0]) ? body[0] : body, type: "BlockStatement"};
}

function program(...body) {
  return Object.assign(block(...body), {sourceType: "module", type: "Program"})
}

function tryStmt(exName, handlerBody, finalizerBody, ...body) {
  // Example:
  // var stmt = exprStmt(binaryExpr(literal(3), "+", literal(2)));
  // lively.ast.stringify(tryStmt("err", [stmt], [stmt], stmt, stmt))
  // // => "try { 3 + 2; 3 + 2; } catch (err) { 3 + 2; } finally { 3 + 2; }"
  if (!Array.isArray(finalizerBody)) {
    body.unshift(finalizerBody);
    finalizerBody = null;
  }
  return {
    block: block(body),
    finalizer: finalizerBody ? block(finalizerBody) : null,
    handler: {
      body: block(handlerBody),
      param: id(exName),
      type: "CatchClause"
    },
    type: "TryStatement"
  }
}
