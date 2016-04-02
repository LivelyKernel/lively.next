/*global process, require, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";

import { parse } from "../lib/parser.js";

describe('interface', function() {
  it('parses JavaScript code', function() {
    expect(parse("1 + 2")).deep.property("body[0].type")
      .equals("ExpressionStatement");
  });
});
