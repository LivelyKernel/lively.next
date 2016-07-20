/*global beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";

import { printAst } from "../lib/mozilla-ast-visitor-interface.js";
import { parse, parseFunction } from "../lib/parser.js";

describe('parse', function() {

  it('JavaScript code', () =>
    expect(parse("1 + 2"))
      .deep.property("body[0].type")
      .equals("ExpressionStatement"));

  describe("async / await", () => {

    it("parses nested awaits", () => {
        var src = "await (await foo()).bar()",
            parsed = parse(src),
            expected = ":Program(0-25)\n"
                     + "\\-.body[0]:ExpressionStatement(0-25)\n"
                     + "  \\-.body[0].expression:AwaitExpression(0-25)\n"
                     + "    \\-.body[0].expression.argument:CallExpression(6-25)\n"
                     + "      \\-.body[0].expression.argument.callee:MemberExpression(6-23)\n"
                     + "        |-.body[0].expression.argument.callee.object:AwaitExpression(7-18)\n"
                     + "        | \\-.body[0].expression.argument.callee.object.argument:CallExpression(13-18)\n"
                     + "        |   \\-.body[0].expression.argument.callee.object.argument.callee:Identifier(13-16)\n"
                     + "        \\-.body[0].expression.argument.callee.property:Identifier(20-23)"
        expect(printAst(parsed, {printPositions: true})).to.equal(expected);
    });

  });

  describe("parseFunction", () => {

    it("anonmyous function", () => {
      expect(parseFunction("function(x) { return x + 1; }").type).equals("FunctionExpression")
    });

    it("named function", () => {
      expect(parseFunction("function foo(x) { return x + 1; }")).containSubset({type: "FunctionExpression", id: {name: "foo"}})
    });

    it("arrow function", () => {
      expect(parseFunction("(x) => { return x + 1; }")).containSubset({type: "ArrowFunctionExpression"})
    });

    it("short function", () => {
      expect(parseFunction("x => x + 1")).containSubset({type: "ArrowFunctionExpression"})
    });

  });
});
