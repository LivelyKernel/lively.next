/*global beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";

import { stringify } from "../index.js";

import { id, member, memberChain, exprStmt, literal, funcExpr, assign, tryStmt } from "../lib/nodes.js";

var counter = {};
function itStringifiesTo(expected, func, ...args) {
  var name = func.name,
      i = counter[name] = (counter[name] || 0) + 1,
      title = `${name}${i === 1 ? "" : "-" + i}`;
  return it(title, () => {
    var result = stringify(func(...args));
    result = result.replace(/\s+/gm, " ");
    expect(result).to.equal(expected);
  });
}

describe('nodes', () => {

  itStringifiesTo("foo.bar", member, "foo", "bar");
  itStringifiesTo('foo["b-a-r"]', member, "foo", "b-a-r");
  itStringifiesTo('foo["zork"]', member, "foo", "zork", true);
  itStringifiesTo("foo[0]", member, "foo", 0);

  itStringifiesTo('foo[0].bar["zo-rk"]', memberChain, "foo", 0, "bar", "zo-rk");
  
  itStringifiesTo(
    "function foo(a) { 3; }",
    funcExpr, {id: "foo"}, ["a"], exprStmt(id("3")));

  itStringifiesTo("a = x", assign, "a", "x");
  itStringifiesTo("a.x = 23", assign, member("a", "x"), literal(23));

  itStringifiesTo(
    "try { c; d; } catch (err) { err; } finally { b; }",
    tryStmt, "err", [exprStmt(id("err"))], [exprStmt(id("b"))], exprStmt(id("c")), exprStmt(id("d")));

});
