/*global beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";

import { parse } from "../lib/parser.js";
import stringify from "../lib/stringify.js";

describe('code generation', function() {

  it('works', () => 
    expect(stringify(parse("1 + 2"))).equal("1 + 2;"));

  it("can handle default parameters", () =>
    expect(stringify(parse("function foo(a=3) {}"))).equal("function foo(a = 3) {\n}"));
});
