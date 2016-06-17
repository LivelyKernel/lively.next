/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { removeDir, createFiles } from "./helpers.js";

import { getSystem, removeSystem } from "../src/system.js";
import module from "../src/module.js";

var dir = System.normalizeSync("lively.modules/tests/"),
    testProjectDir = dir + "test-project-1-dir/",
    testProjectSpec = {
      "file1.js": "import { y } from './file2.js'; import { z } from './sub-dir/file3.js'; export var x = y + z;",
      "file2.js": "export var y = 1;",
      "package.json": '{"name": "test-project-1", "main": "file1.js", "systemjs": {"main": "file1.js"}}',
      "sub-dir": {"file3.js": "export var z = 2;"}
    },
    file1m = testProjectDir + "file1.js",
    file2m = testProjectDir + "file2.js",
    file3m = testProjectDir + "sub-dir/file3.js";


describe("dependencies", () => {

  let S, module1, module2, module3;
  beforeEach(() => {
    S = getSystem("test", {baseURL: testProjectDir});
    module1 = module(S, file1m);
    module2 = module(S, file2m);
    module3 = module(S, file3m);
    return createFiles(testProjectDir, testProjectSpec);
  });

  afterEach(() => { removeSystem("test"); return removeDir(testProjectDir); });

  it("computes required modules of some module", async () => {
    await S.import("file1.js");
    expect(module1.requirements()).to.deep.equal([module2, module3]);
  });

  it("computes dependent modules of some module", async () => {
    await S.import("file1.js");
    expect(module2.dependents()).to.deep.equal([module1]);
  });

  describe("unload module", () => {
    
    it("forgets module and recordings", async () => {
      await S.import("file1.js");
      await module2.unload();
      expect(module1.record()).to.equal(null, "record for module1 still exists");
      expect(module2.record()).to.equal(null, "record for module2 still exists");
      expect(module1.env().recorder).to.not.have.property("x");
      expect(module2.env().recorder).to.not.have.property("y");
    });
  
  });

})
