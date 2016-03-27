/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { removeDir, createFiles } from "./helpers.js";

import { getSystem, removeSystem } from "../src/system.js";
import { findRequirementsOf, findDependentsOf } from "../src/dependencies.js";


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


describe("dependencies", () => {

  var System;
  beforeEach(() => {
    System = getSystem("test", {baseURL: testProject1Dir});
    System.baseURL
    return Promise.all([
      createFiles(testProject1Dir, testProject1Spec),
      createFiles(testProject2Dir, testProject2Spec)]);
  });

  afterEach(() => {
    removeSystem("test");
    return Promise.all([
      removeDir(testProject1Dir),
      removeDir(testProject2Dir)]);
  });

  it("computes required modules of some module", () =>
    System.import("file1.js")
    .then(() => findRequirementsOf(System, "file1.js"))
    .then(result =>
      expect(result).to.deep.equal([testProject1Dir + "file2.js", testProject1Dir + "sub-dir/file3.js"])));

  it("computes dependent modules of some module", () =>
    System.import("file1.js")
      .then(() => findDependentsOf(System, "file2.js"))
      .then(result =>
        expect(result).to.deep.equal([testProject1Dir + "file1.js"])));

})
