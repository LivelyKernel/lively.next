/*global describe,it*/

import { expect } from "mocha-es6";
import * as someModule from "./some-module.js";

console.log("loaded tests!");

describe("This is a test", () => {
  
  it("...that works", () => expect(someModule.x).to.equal(23));
  
  it("...that fails", () => expect(false).to.equal(true));

});