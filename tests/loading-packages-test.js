/*global beforeEach, afterEach, describe, it*/
import { expect } from "mocha-es6";
import fetch from "fetch";
var f = fetch.bind(null);

import * as modules from "../index.js";

import { string } from "lively.lang";

var modName = System.normalizeSync("lively.modules/tests/load-packages.js");
var dir = System.normalizeSync(".", modName)

var testDir = string.joinPath(dir, "test-project/")


function createDirs(baseDir, fileSpec) {
  return f(baseDir, {method: "MKCOL"})
    .then(arg =>
      Promise.all(Object.keys(fileSpec).map(fileName =>
        typeof fileSpec[fileName] === "object" ?
          createDirs(baseDir + "/" + fileName, fileSpec[fileName]) :
          f(baseDir + "/" + fileName, {method: "PUT", body: String(fileSpec[fileName])}))));
}

function removeDir(dir) {
  return f(dir, {method: "DELETE"});
}

describe("project loading", () => {

  var System;
  beforeEach(() => {
    System = modules.getSystem("test", {baseURL: testDir});
    return createDirs(testDir, {
      "file1.js": "import { y } from './file2.js'; import { z } from './sub-dir/file3.js'; export var x = y + z;",
      "file2.js": "export var y = 1;",
      "package.json": '{"name": "test-project", "main": "file1.js", "systemjs": {"main": "file1.js"}}',
      "sub-dir": {"file3.js": "export var z = 2;"}
    });
  });

  afterEach(() => {
    show(modules.printSystemConfig(System));
    modules.removeSystem("test");
    return removeDir(testDir);
  });

  it("loads files", () =>
    System.import(testDir + "file1.js")
      .then(mod => expect(mod).to.have.property("x", 3)));

  it("registers and loads a package", () =>
    modules.registerPackage(System, testDir)
      .then(_ => System.import("test-project"))
      .then(mod => expect(mod).to.have.property("x", 3)));
});
