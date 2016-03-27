/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { removeDir, createFiles } from "./helpers.js";

import { getSystem, removeSystem } from "../src/system.js";
import { registerPackage } from "../src/packages.js";

var dir = System.normalizeSync("lively.modules/tests/"),
    testDir = dir + "test-project/"

describe("project loading", () => {

  var System;
  beforeEach(() => {
    System = getSystem("test", {baseURL: testDir});
    return createFiles(testDir, {
      "file1.js": "import { y } from './file2.js'; export var x = y + 1;",
      "file2.js": "export var y = 1;",
    });
  });

  afterEach(() => { removeSystem("test"); return removeDir(testDir); });

  it("loads files", () =>
    System.import(testDir + "file1.js")
      .then(mod => expect(mod).to.have.property("x", 2)));

});
