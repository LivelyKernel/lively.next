/*global describe,it*/

import { expect } from "mocha-es6";
import * as someModule from "../src/some-module.js";

console.log("loaded tests!");

describe("This is a test", () => {

  it("chai has containSubset powers", () =>
    expect({foo: 2, bar: 3}).to.containSubset({foo: 2}));

  it("...that works", () => expect(someModule.x).to.equal(23));

  it("...that fails", () => expect(false).to.equal(true));

});