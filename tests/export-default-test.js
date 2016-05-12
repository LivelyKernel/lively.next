/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { removeDir, createFiles, inspect as i } from "./helpers.js";

import { getSystem, removeSystem, moduleEnv } from "../src/system.js";

var dir = System.normalizeSync("lively.modules/tests/"),
    testProjectDir = dir + "testmodules/";

describe("export default rewriting", function() {
  var S;
   this.timeout(15000);
  beforeEach((done) => {
    S = getSystem("test", {baseURL: dir});
     S.import(testProjectDir +"foo.js")
      .then(() => {
        console.log("here we here again...")
      })
      .then(done)
  });

  afterEach(() => {
    removeSystem("test");
  });

  it("module is correctly loaded", () => {
    var env = moduleEnv(S, testProjectDir + "foo.js");
    expect(env).to.have.deep.property("recorder.Foo");
  });
});
