/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { removeDir, createFiles } from "./helpers.js";

import { getSystem, removeSystem, printSystemConfig } from "../src/system.js";
import { registerPackage } from "../src/packages.js";

var dir = System.normalizeSync("lively.modules/tests/"),
    testProject1Dir = dir + "test-project-1-dir/",
    testProject2Dir = dir + "test-project-2-dir/",
    testProject1Spec = {
      "file1.js": "import { y } from './file2.js'; import { z } from './sub-dir/file3.js'; export var x = y + z;",
      "file2.js": "export var y = 1;",
      "package.json": '{"name": "test-project-1", "main": "file1.js", "systemjs": {"main": "file1.js"}}',
      "sub-dir": {"file3.js": "export var z = 2;"}
    },
    testProject2Spec = {
      "index.js": "import { x as importedX } from 'test-project-1/file1.js'; export var x = importedX + 20;",
      "package.json": '{"name": "test-project-2"}'
    }

describe("package loading", () => {

  var System;
  beforeEach(() => {
    System = getSystem("test", {baseURL: testProject1Dir});
    return createFiles(testProject1Dir, testProject1Spec);
  });

  afterEach(() => {
    removeSystem("test");
    return removeDir(testProject1Dir);
  });

  it("registers and loads a package", () =>
    registerPackage(System, testProject1Dir)
      .then(_ => System.import("test-project-1"))
      .then(mod => expect(mod).to.have.property("x", 3)));
      
  
  describe("dependency resolution", () => {

    beforeEach(() => {
      System = getSystem("test-2", {baseURL: dir});
      return createFiles(testProject2Dir, testProject2Spec);
    });
  
    afterEach(() => {
      // show(printSystemConfig(System))
      removeSystem("test-2");
      return removeDir(testProject2Dir);
    });

    it("across local packages", () =>
      Promise.all([
        registerPackage(System, testProject1Dir),
        registerPackage(System, testProject2Dir)])
        .then(_ => System.import("test-project-2"))
        .then(mod => expect(mod).to.have.property("x", 23)));

  });
});
