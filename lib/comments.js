/*global process, global, exports*/

import { obj, string, Path, chain, arr, fun } from "lively.lang";
import { parse } from "./parser.js";
import { statementOf } from "./query.js";
import Visitor from "../generated/estree-visitor.js";
import stringify from "./stringify.js";


function getCommentPrecedingNode(parsed, node) {
  var statementPath = statementOf(parsed, node, {asPath: true}),
      blockPath = statementPath.slice(0, -2),
      block = Path(blockPath).get(parsed);

  return !block.comments || !block.comments.length ? null :
    chain(extractComments(parsed))
      .reversed()
      .detect(function(ea) { return ea.followingNode === node; })
      .value();
}

function extractComments(astOrCode, optCode) {
  var parsed = typeof astOrCode === "string" ?
        parse(astOrCode, {withComments: true}) : astOrCode,
      code = optCode ? optCode : (typeof astOrCode === "string" ?
        astOrCode : stringify(astOrCode)),
      parsedComments = arr.sortBy(commentsWithPathsAndNodes(parsed), c => c.comment.start);

  return parsedComments.map(function(c, i) {

    // 1. a method comment like "x: function() {\n//foo\n ...}"?
    if (isInObjectMethod(c)) {
      return obj.merge([c, c.comment,
        {type: 'method', comment: c.comment.text},
        methodAttributesOf(c)]);
    }

    if (isInComputedMethod(c)) {
      return obj.merge([c, c.comment,
        {type: 'method', comment: c.comment.text},
        computedMethodAttributesOf(c)]);
    }

    // 2. function statement comment like "function foo() {\n//foo\n ...}"?
    if (isInFunctionStatement(c)) {
      return obj.merge([c, c.comment,
        {type: 'function', comment: c.comment.text},
        functionAttributesOf(c)]);
    }

    // 3. assigned method like "foo.bar = function(x) {/*comment*/};"
    if (isInAssignedMethod(c)) {
      return obj.merge([c, c.comment,
        {type: 'method', comment: c.comment.text},
        methodAttributesOfAssignment(c)]);
    }

    // 4. comment preceding another node?
    var followingNode = followingNodeOf(c);
    if (!followingNode) return obj.merge([c, c.comment, {followingNode:followingNode}, unknownComment(c)]);

    // is there another comment in front of the node>
    var followingComment = parsedComments[i+1];
    if (followingComment && followingComment.comment.start <= followingNode.start)
      return obj.merge([c, c.comment, {followingNode:followingNode}, unknownComment(c)]);

    // 3. an obj var comment like "// foo\nvar obj = {...}"?
    if (isSingleObjVarDeclaration(followingNode)) {
      return obj.merge([c, c.comment, {followingNode:followingNode},
        {type: 'object',comment: c.comment.text},
        objAttributesOf(followingNode)])
    }

    // 4. Is it a simple var declaration like "// foo\nvar obj = 23"?
    if (isSingleVarDeclaration(followingNode)) {
      return obj.merge([c, c.comment, {followingNode:followingNode},
        {type: 'var',comment: c.comment.text},
        objAttributesOf(followingNode)])
    }

    return obj.merge([c, c.comment, {followingNode:followingNode}, unknownComment(c)]);
  });

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function commentsWithPathsAndNodes(parsed) {
    var comments = [],
        v = new Visitor()
    v.accept = fun.wrap(v.accept, (proceed, node, state, path) => {
      if (node.comments) {
        arr.pushAll(comments,
          node.comments.map(function(comment) {
            return {path: path, comment: comment, node: node}; }));
      }
      return proceed(node, state, path);
    });
    v.accept(parsed, comments, []);
    return comments;
  }

  function followingNodeOf(comment) {
    return arr.detect(comment.node.body, function(node) {
      return node.start > comment.comment.end; });
  }

  function unknownComment(comment) {
    return {type: "unknown", comment: comment.comment.text}
  }
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function isInFunctionStatement(comment) {
    var node = Path(comment.path.slice(0,-1)).get(parsed);
    return node && node.type === "FunctionDeclaration";
  }

  function functionAttributesOf(comment) {
    var funcNode = Path(comment.path.slice(0,-1)).get(parsed),
      name = funcNode.id ? funcNode.id.name : "<error: no name for function>";
    return {name: name, args: arr.pluck(funcNode.params, "name")};
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function isInObjectMethod(comment) {
    return arr.equals(comment.path.slice(-2), ["value", "body"]) // obj expr
  }

  function isInAssignedMethod(comment) {
    return arr.equals(comment.path.slice(-2), ["right", "body"]); // asignment
  }

  function methodAttributesOf(comment) {
    var methodNode = Path(comment.path.slice(0, -2)).get(parsed),
        name = methodNode.key ? methodNode.key.name : "<error: no name for method>";

    // if it's someting like "var obj = {foo: function() {...}};"
    var p = comment.path.slice(),
        objectName = "<error: no object found for method>";

    while (p.length && arr.last(p) !== 'init') p.pop();
    if (p.length) {
      objectName = Path(p.slice(0, -1).concat(["id", "name"])).get(parsed);
    }

    // if it's someting like "exports.obj = {foo: function() {...}};"
    if (string.startsWith(objectName, "<error")) {
      p = comment.path.slice();
      while (p.length && arr.last(p) !== 'right') p.pop();
      if (p.length) {
        var assignNode = Path(p.slice(0, -1).concat(["left"])).get(parsed);
        objectName = code.slice(assignNode.start, assignNode.end);
      }
    }

    // if it's someting like "Object.extend(Foo.prototype, {m: function() {/*some comment*/ return 23; }})"
    if (string.startsWith(objectName, "<error")) {
      p = comment.path.slice();
      var callExpr = Path(p.slice(0, -6)).get(parsed),
        isCall = callExpr && callExpr.type === "CallExpression",
        firstArg = isCall && callExpr.arguments[0];
      if (firstArg) objectName = code.slice(firstArg.start, firstArg.end);
    }

    return {
      name: name,
      args: arr.pluck(methodNode.value.params, "name"),
      objectName: objectName
    }
  }

  function methodAttributesOfAssignment(comment) {

    var node = Path(comment.path.slice(0,-1)).get(parsed)
    if (node.type !== "FunctionExpression"
     && node.type !== "FunctionDeclaration") return {};

    var statement = statementOf(parsed, node);
    if (statement.type !== "ExpressionStatement"
     || statement.expression.type !== "AssignmentExpression") return {};

    var objName = code.slice(
      statement.expression.left.object.start,
      statement.expression.left.object.end);

    var methodName = code.slice(
      statement.expression.left.property.start,
      statement.expression.left.property.end);

    return {
      name: methodName,
      objectName: objName,
      args: arr.pluck(node.params, "name")
    };
  }

  function isInComputedMethod(comment) {
    var path = comment.path.slice(-5);
    arr.removeAt(path, 1);
    return arr.equals(path, ["properties","value","callee","body"]);
  }

  function computedMethodAttributesOf(comment) {
    var name, args, pathToProp;

    pathToProp = comment.path.slice(0, -3);
    var propertyNode = Path(pathToProp).get(parsed);
    if (propertyNode && propertyNode.type === "Property") {
      // if it is a function immediatelly called
      args = arr.pluck(propertyNode.value.callee.params, "name");
      name = propertyNode.key ? propertyNode.key.name : "<error: no name for method>";
    }

    if (!name) {
      // if it is an object member function
      pathToProp = comment.path.slice(0, -2);
      propertyNode = Path(pathToProp).get(parsed);
      if (propertyNode && propertyNode.type === "Property") {
      args = arr.pluck(propertyNode.value.params, "name");
      name = propertyNode.key ? propertyNode.key.name : "<error: no name for method>";
      }
    }

    if (!name) {
      name = "<error: no name for method>";
      args = [];
      pathToProp = comment.path
    }

    // if it's someting like "var obj = {foo: function() {...}};"
    var p = arr.clone(pathToProp);
    var objectName = "<error: no object found for method>";

    while (p.length && arr.last(p) !== 'init') p.pop();
    if (p.length) {
      objectName = Path(p.slice(0, -1).concat(["id", "name"])).get(parsed);
    }

    // if it's someting like "exports.obj = {foo: function() {...}};"
    if (string.startsWith(objectName, "<error")) {
      var p = arr.clone(pathToProp);
      while (p.length && arr.last(p) !== 'right') p.pop();
      if (p.length) {
        var assignNode = Path(p.slice(0, -1).concat(["left"])).get(parsed);
        objectName = code.slice(assignNode.start, assignNode.end);
      }
    }

    // if it's someting like "Object.extend(Foo.prototype, {m: function() {/*some comment*/ return 23; }})"
    if (string.startsWith(objectName, "<error")) {
      var p = arr.clone(pathToProp);
      var callExpr = Path(p.slice(0, -4)).get(parsed),
        isCall = callExpr && callExpr.type === "CallExpression",
        firstArg = isCall && callExpr.arguments[0];
      if (firstArg) objectName = code.slice(firstArg.start, firstArg.end);
    }

    return {name: name, args: args, objectName: objectName}
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  // like "var foo = {/*...*/}" or  "var foo = bar = {/*...*/};"
  function isSingleObjVarDeclaration(node) {
    // should be a var declaration with one declarator with a value
    // being an JS object
    return isSingleVarDeclaration(node)
      && (node.declarations[0].init.type === "ObjectExpression"
       || isObjectAssignment(node.declarations[0].init));
  }

  function isSingleVarDeclaration(node) {
    return node && node.type === 'VariableDeclaration'
      && node.declarations.length === 1;
  }

  function objAttributesOf(node) {
    return {name: node.declarations[0].id.name};
  };

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  // like "foo = {/*...*/}"
  function isObjectAssignment(node) {
    if (node.type !== "AssignmentExpression") return false;
    if (node.right.type === "ObjectExpression") return true;
    if (node.right.type === "AssignmentExpression") return isObjectAssignment(node.right);;
    return false;
  }
}

export {
  getCommentPrecedingNode,
  extractComments
}