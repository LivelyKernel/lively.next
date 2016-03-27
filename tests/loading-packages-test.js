/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { removeDir, createFiles } from "./helpers.js";

import { getSystem, removeSystem } from "../system.js";
import { registerPackage } from "../packages.js";

var dir = System.normalizeSync("./tests/"),
    testDir = dir + "test-project/"

describe("package loading", () => {

  var System;
  beforeEach(() => {
    System = getSystem("test", {baseURL: testDir});
    return createFiles(testDir, {
      "file1.js": "import { y } from './file2.js'; import { z } from './sub-dir/file3.js'; export var x = y + z;",
      "file2.js": "export var y = 1;",
      "package.json": '{"name": "test-project", "main": "file1.js", "systemjs": {"main": "file1.js"}}',
      "sub-dir": {"file3.js": "export var z = 2;"}
    });
  });

  afterEach(() => {
    // show(modules.printSystemConfig(System));
    removeSystem("test");
    return removeDir(testDir);
  });

  it("registers and loads a package", () =>
    registerPackage(System, testDir)
      .then(_ => System.import("test-project"))
      .then(mod => expect(mod).to.have.property("x", 3)));
});
