/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { removeDir, removeFile, createFiles, writeFile, modifyFile, readFile, inspect as i } from "./helpers.js";
import { registerPackage } from "../src/packages.js";
import { getSystem, removeSystem, printSystemConfig } from "../src/system.js";
import { bundle } from "../src/bundling.js";

var testDir = System.normalizeSync("lively.modules/tests/");


describe("bundling", function() {

  var System;

  var files = {
    "test-project": {
      "file-1.js": "export var y = 1;",
      "file-2.js": "import { y } from './file-1.js'; export var x = 1 + y;",
      "file-3.js": "exports.x = 23;",
      "file-4.js": "exports.y = require('./file-3.js').x;",
      "file-5.js": "import { x } from './file-3.js'; export var y = 1 + x;",
    }
  }

  beforeEach(() => {
    System = getSystem("test", {baseURL: testDir});
    return createFiles(testDir, files);
  });

  afterEach(() => {
    removeSystem("test");
    return removeDir(testDir + "test-project");
  });

  describe("creation", () => {
    
    it("can bundle es6 modules", () =>
      bundle(System, "test-project/test-bundle.js", ["test-project/file-1.js", "test-project/file-2.js"])
        .then(() => readFile(testDir + "test-project/test-bundle.js"))
        .then(content => expect(content)
          .to.match(new RegExp(`System.register\\('${testDir}test-project/file-1.js', \\[\\]`))
          .to.match(new RegExp(`System.register\\('${testDir}test-project/file-2.js', \\['./file-1.js'\\]`))));
    
    it("can bundle cjs files", () =>
      bundle(System, "test-project/test-bundle-2.js", ["test-project/file-3.js", "test-project/file-4.js"])
        .then(() => readFile(testDir + "test-project/test-bundle-2.js"))
        .then(content => expect(content).to.match(new RegExp(`System.registerDynamic\\('${testDir}test-project/file-4.js', \\['./file-3.js'\\]`))));
    
    it("can bundle es6 + cjs files", () =>
      bundle(System, "test-project/test-bundle-3.js", ["test-project/file-5.js", "test-project/file-3.js"])
        .then(() => readFile(testDir + "test-project/test-bundle-3.js"))
        .then(content => expect(content).to.match(new RegExp(`System.register\\('${testDir}test-project/file-5.js', \\['./file-3.js'\\]`))));

  });
  
  describe("loading", () => {

    it("loads bundle as part of package", () =>
      bundle(System, "test-project/test-bundle-3.js", ["test-project/file-5.js", "test-project/file-3.js"])
        .then(() => modifyFile(testDir + "test-project/file-5.js", content => content.replace(/1 \+ x/, "2 + x")))
        .then(() => { removeSystem("test"); System = getSystem("test", {baseURL: testDir}); })
        .then(() => {
          writeFile(testDir + "test-project/package.json", JSON.stringify({
            name: "test-project",
            lively: {bundles: {"test-bundle-3.js": ["./file-5.js", "./file-3.js"]}}
          }, null, 2))
        })
        .then(() => registerPackage(System, testDir + "test-project"))
        .then(() => System.import("test-project/file-5.js"))
        .then(m => expect(m.y).to.equal(24)));

  });
});