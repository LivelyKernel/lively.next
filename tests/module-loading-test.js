/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { removeDir, createFiles } from "./helpers.js";

import { getSystem, removeSystem, moduleRecordFor, moduleEnv } from "../src/system.js";
import { forgetModule } from "../src/dependencies.js";

var dir = System.normalizeSync("lively.modules/tests/"),
    testDir = dir + "test-project/",
    module1 = testDir + "file1.js",
    module2 = testDir + "file2.js",
    module3 = testDir + "file3.js";

describe("project loading", () => {

  var System;
  beforeEach(() => {
    System = getSystem("test", {baseURL: testDir});
    return createFiles(testDir, {
      "file1.js": "import { y } from './file2.js'; export var x = y + 1;",
      "file2.js": "import { z } from './file3.js'; export var y = 1 + z;",
      "file3.js": "export var z = 1;"
    });
  });

  afterEach(() => { removeSystem("test"); return removeDir(testDir); });

  it("loads files", () =>
    System.import(testDir + "file1.js")
      .then(mod => expect(mod).to.have.property("x", 3)));

  describe("unload module", () => {
    
    it("forgets module and recordings", () =>
      System.import(module1)
        .then(() => forgetModule(System, module2))
        .then(_ => {
          expect(moduleRecordFor(System, module1)).to.equal(null);
          expect(moduleRecordFor(System, module2)).to.equal(null);
          expect(moduleEnv(System, module1).recorder).to.not.have.property("x");
          expect(moduleEnv(System, module2).recorder).to.not.have.property("y");
        }));
  
  })
});
