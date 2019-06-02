/*global process, require, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";

import { parse } from "../lib/parser.js";
import { fun, Group, obj } from "lively.lang";
import { extractComments, getCommentPrecedingNode } from "../lib/comments.js";


describe("parsing comments", function() {

  it("extract comment from method", function() {
    var code = "var obj = {\n"
             + "  foo: function(arg1, arg2) {\n"
             + "    // This is a comment!\n"
             + "    return 123;\n"
             + "  }\n"
             + "}\n",
        comments = extractComments(code),
        expected = [{
          comment: " This is a comment!",
          type: "method", name: "foo", objectName: "obj",
          args: ["arg1", "arg2"]}];
    expect(comments).to.containSubset(expected);
  });

  it("extract comment from function", function() {
    var code = "function fooBar(x, y) {\n"
            + "    // this is a function comment!\n"
            + "    return x + y;\n"
            + "  }\n",
        comments = extractComments(code),
        expected = [{
          comment: " this is a function comment!",
          name: "fooBar", type: "function",
          args: ["x", "y"]}]
    expect(comments).to.containSubset(expected);
  });

  it("extractCommentFromObject", function() {
    var code = "var bar = {x: 23, m: function() { return 24; }};\n"
             + "// I don't belong to someObject...!\n\n"
             + "// lalalala\n"
             + "// 'nother comment!\n"
             + "var someObject = exports.foo = {foo: function(arg1, arg2) { return 123; }};",
        comments = extractComments(code),
        expected = [
          {comment: " I don't belong to someObject...!"},
          {comment: " lalalala\n 'nother comment!",
           type: "object", name: "someObject"}]
    expect(comments).to.containSubset(expected);
  });

  it("extractCommentFromVarDeclaration", function() {
    var code = "// test-test\nvar Group = exports.GroupExport = function GroupFunc() {}\n",
        comments = extractComments(code),
        expected = [{comment: " test-test", type: "var", name: "Group"}];
    expect(comments).to.containSubset(expected);
  });

  it("extractCommentFromObjectExtension", function() {
    var code = "obj.extend(Foo.prototype, {\n"
             + "  m: function() {/*some comment*/ return 23; }\n"
             + "})\n",
        comments = extractComments(code),
        expected = [{comment: "some comment", type: "method", name: "m", objectName: "Foo.prototype", args: []}];
    expect(comments).to.containSubset(expected);
  });

  it("extractCommentFromAssignment", function() {
    var code = "exports.foo = {\nm: function() {/*some comment*/ return 23; }\n}\n";
    var comments = extractComments(code);
    var expected = [{comment: "some comment",type: "method", name: "m", objectName: "exports.foo",args: []}]
    expect(comments).to.containSubset(expected);
  });

  it("extractCommentFromAssignedFunction", function() {
    var code = "Group.foo = function(test) {\n// hello\n};\n",
        comments = extractComments(code),
        expected = [{comment: " hello",type: "method", name: "foo", objectName: "Group", args: ["test"]}]
    expect(comments).to.containSubset(expected);

    var code = "Group.bar.foo = function(test) {\n// hello\n};\n",
        comments = extractComments(code),
        expected = [{comment: " hello",type: "method", name: "foo", objectName: "Group.bar", args: ["test"]}]
    expect(comments).to.containSubset(expected);
  });

  it("extract from applied function", function() {
    var code = "var foo = {\n"
             + "  func: (function() {\n"
             + "  // test comment\n"
             + "  return function() { return 23; }\n"
             + "  })()\n"
             + "}\n",
        comments = extractComments(code),
        expected = [{
          comment: " test comment",
          type: "method", name: "func", objectName: "foo", args: []}];
    expect(comments).to.containSubset(expected);
  });

  it("extractCommentBug", function() {
    var code = "var string = exports.string = {\n"
             + "  format: function strings$format() {\n"
             + "  // Takes a variable number of arguments. The first argument is the format\n"
             + "  // string. Placeholders in the format string are marked with \"%s\".\n"
             + "  // Example:\n"
             + "  //\n"
             + "  // ```\n"
             + "  // jsext.string.format(\"Hello %s!\", \"Lively User\"); // => \"Hello Lively User!\"\n"
             + "  // ```\n\n\n"
             + "  return string.formatFromArray(Array.prototype.slice.call(arguments));\n"
             + "  }\n"
             + "}\n",
       comments = extractComments(code),
       expected = [{
        comment: " Takes a variable number of arguments. The first argument is the format\n"
           + " string. Placeholders in the format string are marked with \"%s\".\n"
           + " Example:\n"
           + "\n"
           + " ```\n"
           + " jsext.string.format(\"Hello %s!\", \"Lively User\"); // => \"Hello Lively User!\"\n"
           + " ```",
        type: "method", name: "format", objectName: "string", args: []}]
    expect(comments).to.containSubset(expected);
  });

  it("extractCommentBug2", function() {
    var code = "// test-test\n"
             + "var Group = exports.GroupExport = function GroupFunc() {}\n"
             + "Group.foo = function(test) {\n"
             + "  // hello\n"
             + "};\n",
        comments = extractComments(code),
        expected = [
          {comment: " test-test",type: "var", name: "Group"},
          {comment: " hello",type: "method", name: "foo", objectName: "Group", args: ["test"]}]
    expect(comments).to.containSubset(expected);
  });

  it("get comment for function call", function() {
    var code = "// comment 1\n"
             + "\n"
             + "// comment 2\n"
             + "// comment 2\n"
             + "var x = (function functionName() {\n"
             + "  var x = 23;\n"
             + "  bla(x);\n"
             + "/* comment3 */\n"
             + "  foo(x);\n"
             + "})();\n"
             + "\n"
             + "// comment 4\n",
        parsed = parse(code, {withComments: true});

    var node1 = parsed.body[0];
    var comment = getCommentPrecedingNode(parsed, node1);
    var expected = {comment: " comment 2\n comment 2", type: "var", name: "x"};
    expect(comment).to.containSubset(expected, "node1");

    var node2 = parsed.body[0].declarations[0].init.callee.body.body[2]
    var comment = getCommentPrecedingNode(parsed, node2);
    var expected = {isBlock: true, comment: " comment3 "};
    expect(comment).to.containSubset(expected, "node2");
  });

});
