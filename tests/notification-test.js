/*global beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";

import { a } from "../index.js";

describe("notifications", () => {

  it("is 1", () => {
    expect(a).to.be.equal(1);
  });

});
