/*global process, beforeEach, afterEach, describe, it*/

var env = typeof module !== "undefined" && module.require ? module.require("../env") : lively['lively.lang_env'];
var escodegen = env.escodegen, lang = env['lively.lang'], expect, ast;
if (env.isCommonJS) {
  var chai = module.require('chai');
  chai.use(require('chai-subset'));
  expect = chai.expect;
  ast = require('../index');
} else { expect = chai.expect; ast = env['lively.ast']; }

describe("parsing comments", function() {
  
  it("extractCommentFromMethod", function() {
    var code = lang.fun.extractBody(function() {
      var obj = {
        foo: function(arg1, arg2) {
          // This is a comment!
          return 123;
        }
      }
    });

    var comments = ast.comments.extractComments(code);
    var expected = [{
      comment: " This is a comment!",
      type: "method", name: "foo", objectName: "obj",
      args: ["arg1", "arg2"]}];
    expect(comments).to.containSubset(expected);
  });

  it("extractCommentFromFunction", function() {
    var code = lang.fun.extractBody(function() {
      function fooBar(x, y) {
        // this is a function comment!
        return x + y;
      }
    });

    var comments = ast.comments.extractComments(code);
    var expected = [{
      comment: " this is a function comment!",
      name: "fooBar", type: "function",
      args: ["x", "y"]}]
    expect(comments).to.containSubset(expected);
  });

  it("extractCommentFromObject", function() {
    var code = lang.fun.extractBody(function() {
      var bar = {x: 23, m: function() { return 24; }};
      // I don't belong to someObject...!

      // lalalala
      // 'nother comment!
      var someObject = exports.foo = {foo: function(arg1, arg2) { return 123; }};
    });

    var comments = ast.comments.extractComments(code);

    var expected = [
      {comment: " I don't belong to someObject...!"},
      {comment: " lalalala\n 'nother comment!",
       type: "object", name: "someObject"}]
    expect(comments).to.containSubset(expected);
  });

  it("extractCommentFromVarDeclaration", function() {
    var code = lang.fun.extractBody(function() {
      // test-test
      var Group = exports.GroupExport = function GroupFunc() {}
    });

    var comments = ast.comments.extractComments(code);
    var expected = [{
      comment: " test-test",
      type: "var", name: "Group"}]
    expect(comments).to.containSubset(expected);
  });

  it("extractCommentFromObjectExtension", function() {
    var code = lang.fun.extractBody(function() {
      lang.obj.extend(Foo.prototype, {
        m: function() {/*some comment*/ return 23; }
      })
    });

    var comments = ast.comments.extractComments(code);
    var expected = [{comment: "some comment", type: "method", name: "m", objectName: "Foo.prototype", args: []}];
    expect(comments).to.containSubset(expected);
  });

  it("extractCommentFromAssignment", function() {
    var code = lang.fun.extractBody(function() {
      exports.foo = {
        m: function() {/*some comment*/ return 23; }
      }
    });

    var comments = ast.comments.extractComments(code);
    var expected = [{comment: "some comment",type: "method", name: "m", objectName: "exports.foo",args: []}]
    expect(comments).to.containSubset(expected);
  });

  it("extractCommentFromAssignedFunction", function() {
    var code = lang.fun.extractBody(function() {
      Group.foo = function(test) {
        // hello
      };
    });
    var comments = ast.comments.extractComments(code);
    var expected = [{comment: " hello",type: "method", name: "foo", objectName: "Group", args: ["test"]}]
    expect(comments).to.containSubset(expected);

    var code = lang.fun.extractBody(function() {
      Group.bar.foo = function(test) {
        // hello
      };
    });
    var comments = ast.comments.extractComments(code);
    var expected = [{comment: " hello",type: "method", name: "foo", objectName: "Group.bar", args: ["test"]}]
    expect(comments).to.containSubset(expected);
  });

  it("extractFromAppliedFunction", function() {
    var code = lang.fun.extractBody(function() {
      var foo = {
        func: (function() {
        // test comment
        return function() { return 23; }
        })()
      }
    });

    var comments = ast.comments.extractComments(code);
    var expected = [{
      comment: " test comment",
      type: "method", name: "func", objectName: "foo", args: []}]
    expect(comments).to.containSubset(expected);
  });

  it("extractCommentBug", function() {
    var code = lang.fun.extractBody(function() {
      var string = exports.string = {
        format: function strings$format() {
        // Takes a variable number of arguments. The first argument is the format
        // string. Placeholders in the format string are marked with "%s".
        // Example:
        //
        // ```
        // jsext.string.format("Hello %s!", "Lively User"); // => "Hello Lively User!"
        // ```
        
        return string.formatFromArray(Array.prototype.slice.call(arguments));
        }
      }
    });

    var comments = ast.comments.extractComments(code);
    var expected = [{
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
    var code = lang.fun.extractBody(function() {
      // test-test
      var Group = exports.GroupExport = function GroupFunc() {}
      Group.foo = function(test) {
        // hello
      };
    });

    var comments = ast.comments.extractComments(code);
    var expected = [
      {comment: " test-test",type: "var", name: "Group"},
      {comment: " hello",type: "method", name: "foo", objectName: "Group", args: ["test"]}]
    expect(comments).to.containSubset(expected);
  });

  it("getCommentForFunctionCall", function() {
    var code = lang.fun.extractBody(function() {
      // comment 1
      
      // comment 2
      // comment 2
      var x = (function functionName() {
        var x = 23;
        bla(x);
      /* comment3 */
        foo(x);
      })();
      
      // comment 4
    });

    var parsed = ast.parse(code, {withComments: true});

    var node1 = parsed.body[0];
    var comment = ast.comments.getCommentPrecedingNode(parsed, node1);
    var expected = {comment: " comment 2\n comment 2",type: "var", name: "x"}

    expect(comment).to.containSubset(expected, "node1");

    var node2 = parsed.body[0].declarations[0].init.callee.body.body[2]
    var comment = ast.comments.getCommentPrecedingNode(parsed, node2);
    var expected = {isBlock: true, comment: " comment3 "};
    expect(comment).to.containSubset(expected, "node2");
  });

});