/*global declare, it, describe, beforeEach, afterEach, before, after,System,xdescribe*/
import { expect } from "mocha-es6";
import { createFiles, resource } from "lively.resources";
import FreezerPackage from "../package.js";
import Bundle from "../bundle.js";

function buildPackage1() {
  return createFiles(baseDir, {
    "package1": {
      "package.json": `{"name": "package1", "version": "1"}`,
      "file1.js": "import { x } from './file2.js'; export var y = x + 2; export { z } from './file3.js'",
      "file2.js": "export var x = 23;",
      "file3.js": "export var z = 99;",
    }
  });
}

let baseDir = resource("local://freezer-tests/"), packages;

let expectedPackage1File1Code = `System.register("package1@1/file1.js", ["package1@1/file2.js", "package1@1/file3.js"], function(_export, _context) {
  "use strict";
  var x, z;
  return {
    setters: [
      function (package1_1_file2_js) {
        x = package1_1_file2_js.x;
      },
      function (package1_1_file3_js) {
        z = package1_1_file3_js.z;
      }
    ],
    execute: function() {
      var y = x + 2;
      _export("y", y);
      _export("z", z);
    }
  }
});`

let expectedPackage1File2Code = `System.register("package1@1/file2.js", [], function(_export, _context) {
  "use strict";
  return {
    setters: [],
    execute: function() {
      var x = 23;
      _export("x", x);
    }
  }
});`;

describe("bundler", function () {

  this.timeout(6000);

  beforeEach(async () => {
    await buildPackage1();
    packages = await FreezerPackage.buildPackageMap({package1: {path: baseDir.join("package1/")}});
  });

  afterEach(async () => {
    await baseDir.remove();
  });

  describe("resolves modules", () => {

    it("reads dependencies of simple package", async () => {
      let bundle = new Bundle(packages);
      await bundle.resolveDependenciesStartFrom("file1.js", "package1");
      expect(bundle.report().trim()).equals([
        `package1@1/file1.js`,
        `  => y, z`,
        `  <= package1@1/file2.js x`,
        `  <= package1@1/file3.js z`,
        ``,
        `package1@1/file2.js`,
        `  => x`,
        ``,
        `package1@1/file3.js`,
        `  => z`
      ].join("\n"));
    });
  });

  describe("module transforms", () => {

    it("into function", async () => {
      let bundle = new Bundle(packages);
      await bundle.resolveDependenciesStartFrom("file1.js", "package1");
      expect(bundle.entryModule.transformToRegisterFormat()).equals(expectedPackage1File1Code);
    });

  });

  describe("bundle execution", () => {

    afterEach(() => delete lively.FreezerRuntime);

    it("standalone", async () => {
      let bundle = new Bundle(packages);
      await bundle.resolveDependenciesStartFrom("file1.js", "package1");
      let source = bundle.standalone();
      eval(source);

      expect(lively.FreezerRuntime.get("package1@1/file1.js").exports)
        .deep.equals({y: 25,z: 99});
    });
  });

});