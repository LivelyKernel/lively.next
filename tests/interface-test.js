/*global process, require, beforeEach, afterEach, describe, it*/

import { expect } from "lively-mocha-tester/node_modules/chai/chai.js";

import { parse } from "../lib/parser.js";

describe('interface', function() {
  it('parses JavaScript code', function() {
    expect(parse("1 + 2")).deep.property("body[0].type")
      .equals("ExpressionStatement");
  });
});
