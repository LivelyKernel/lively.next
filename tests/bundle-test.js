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
      "file_star_import.js": "import * as x from './file1.js'; export { x as file1 };",
      "file_star_export.js": "export * from './file1.js';",
      "file_package_import.js": "import { version } from './package.json'; export { version };"
    }
  });
}

let baseDir = resource("local://freezer-tests/"),
    standaloneOpts = {addRuntime: true, isExecutable: true, runtimeGlobal: "lively.freezerRuntimeTest"},
    packages, bundle;


let expectedPackage1File1Code = `System.register("package1@1/file1.js", ["package1@1/file2.js", "package1@1/file3.js"], function(_export, _context) {
  "use strict";
  var x;
  return {
    setters: [
      function (package1_1_file2_js) {
        x = package1_1_file2_js.x;
      },
      function (package1_1_file3_js) {
        _export("z", package1_1_file3_js.z);
      }
    ],
    execute: function() {
      var y = x + 2;
      _export("y", y);
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
    packages = await FreezerPackage.buildPackageMap(
      {package1: {path: baseDir.join("package1/")}});
    bundle = new Bundle(packages);
  });

  afterEach(async () => {
    await baseDir.remove();
  });

  describe("resolves modules", () => {

    it("reads dependencies of simple package", async () => {
      await bundle.resolveDependenciesStartFrom("file1.js", "package1");
      expect(bundle.report().trim()).equals(
`package1@1/file1.js (84B)
  => y, z
  <= package1@1/file2.js x
  <= package1@1/file3.js z

package1@1/file2.js (18B)
  => x

package1@1/file3.js (18B)
  => z`);
    });
  });

  describe("module transforms", () => {

    it("into function", async () => {
      await bundle.resolveDependenciesStartFrom("file1.js", "package1");
      expect(bundle.entryModule.transformToRegisterFormat()).equals(expectedPackage1File1Code);
    });

    it("star import", async () => {
      await bundle.resolveDependenciesStartFrom("file_star_import.js", "package1");
      expect(bundle.entryModule.transformToRegisterFormat())
        .contains('x = package1_1_file1_js;')
    });

    it("star export", async () => {
      await bundle.resolveDependenciesStartFrom("file_star_export.js", "package1");
      expect(bundle.entryModule.transformToRegisterFormat())
        .contains('_export(package1_1_file1_js);')
    });

  });

  describe("bundle execution", () => {

    afterEach(() => delete lively.freezerRuntimeTest);

    it("standalone", async () => {
      eval(await bundle.standalone({...standaloneOpts, entryModule: "package1/file1.js"}));
      expect(lively.freezerRuntimeTest.get("package1@1/file1.js").exports)
        .deep.equals({y: 25,z: 99});
    });

    it("star import", async () => {      
      eval(await bundle.standalone({...standaloneOpts, entryModule: "package1/file_star_import.js"}));
      expect(lively.freezerRuntimeTest.get("package1@1/file_star_import.js").exports)
        .deep.equals({file1: {y: 25,z: 99}});
    });

    it("star export", async () => {      
      eval(await bundle.standalone({...standaloneOpts, entryModule: "package1/file_star_export.js"}));
      expect(lively.freezerRuntimeTest.get("package1@1/file_star_export.js").exports)
        .deep.equals({y: 25,z: 99});
    });

    it("can import json", async () => {      
      eval(await bundle.standalone({...standaloneOpts, entryModule: "package1/file_package_import.js"}));
      expect(lively.freezerRuntimeTest.get("package1@1/file_package_import.js").exports)
        .deep.equals({version: "1"});
    });

  });

});
