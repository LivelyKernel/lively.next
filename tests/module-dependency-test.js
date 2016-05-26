/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { removeDir, createFiles } from "./helpers.js";

import { getSystem, removeSystem, moduleRecordFor, moduleEnv } from "../src/system.js";
import { findRequirementsOf, findDependentsOf, forgetModule } from "../src/dependencies.js";

var dir = System.normalizeSync("lively.modules/tests/"),
    testProjectDir = dir + "test-project-1-dir/",
    testProjectSpec = {
      "file1.js": "import { y } from './file2.js'; import { z } from './sub-dir/file3.js'; export var x = y + z;",
      "file2.js": "export var y = 1;",
      "package.json": '{"name": "test-project-1", "main": "file1.js", "systemjs": {"main": "file1.js"}}',
      "sub-dir": {"file3.js": "export var z = 2;"}
    },
    module1 = testProjectDir + "file1.js",
    module2 = testProjectDir + "file2.js",
    module3 = testProjectDir + "sub-dir/file3.js";


describe("dependencies", () => {

  var System;
  beforeEach(() => {
    System = getSystem("test", {baseURL: testProjectDir});
    return createFiles(testProjectDir, testProjectSpec);
  });

  afterEach(() => { removeSystem("test"); return removeDir(testProjectDir); });

  it("computes required modules of some module", async () => {
    await System.import("file1.js");
    var reqs = findRequirementsOf(System, "file1.js");
    expect(reqs).to.deep.equal([testProjectDir + "file2.js", testProjectDir + "sub-dir/file3.js"]);
  });

  it("computes dependent modules of some module", async () => {
    await System.import("file1.js");
    var deps = findDependentsOf(System, "file2.js");
    expect(deps).to.deep.equal([testProjectDir + "file1.js"]);
  });


  describe("unload module", () => {
    
    it("forgets module and recordings", async () => {
      await System.import(module1);
      forgetModule(System, module2);
      expect(moduleRecordFor(System, module1)).to.equal(null);
      expect(moduleRecordFor(System, module2)).to.equal(null);
      expect(moduleEnv(System, module1).recorder).to.not.have.property("x");
      expect(moduleEnv(System, module2).recorder).to.not.have.property("y");
    });
  
  });

})
