/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { removeDir, createFiles } from "./helpers.js";

import { getSystem, removeSystem, moduleEnv } from "../src/system.js";
// import { moduleState } from "../src/instrumentation.js";

// System.constructor.systems.test["__lively.modules__"].loadedModules

var dir = System.normalizeSync("lively.modules/tests/"),
// var dir = lively.vm.es6.currentSystem().normalizeSync("lively.modules/tests/"),
    testProjectDir = dir + "test-project-dir/",
    testProjectSpec = {
      "file1.js": "import { y } from './file2.js'; var z = 2; export var x = y + z;",
      "file2.js": "export var y = 1;",
      "package.json": '{"name": "test-project-1", "main": "file1.js"}',
    }


describe("instrumentation", () => {

  var S;
  beforeEach(() => {
    S = getSystem("test", {baseURL: dir});
    return createFiles(testProjectDir, testProjectSpec)
      .then(() => S.import(testProjectDir + "file1.js"));
  });

  afterEach(() => {
    removeSystem("test");
    return removeDir(testProjectDir);
  });

  it("gets access to internal module state", () => {
    var env = moduleEnv(S, testProjectDir + "file1.js");
    expect(env).to.have.deep.property("recorder.z", 2);
    expect(env).to.have.deep.property("recorder.x", 3);
  });

})
