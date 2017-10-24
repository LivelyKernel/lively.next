/*global declare, it, describe, beforeEach, afterEach, before, after,System,xdescribe*/
import { expect } from "mocha-es6";
import { createFiles, resource } from "lively.resources";
import FreezerPackage from "../package.js";
import Bundle from "../bundle.js";


function buildPackage1() {
  return createFiles(baseDir, {
    "package1": {
      "package.json": `{"name": "package1", "version": "1"}`,
      "file1.js": "import { x } from './file2.js'; export var y = x + 2;",
      "file2.js": "export var x = 23;"
    }
  });
}

let baseDir = resource("local://freezer-tests/"), packages;

describe("bundler", function () {

  this.timeout(6000);

  beforeEach(async () => {
    await buildPackage1();
    packages = await FreezerPackage.buildPackageMap([baseDir.join("package1/")]);
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
        `  => y`,
        `  <= package1@1/file2.js x`,
        ``,
        `package1@1/file2.js`,
        `  => x`
      ].join("\n"));
    });
  });

  describe("module transforms", () => {

    it("into function", async () => {
      let bundle = new Bundle(packages);
      await bundle.resolveDependenciesStartFrom("file1.js", "package1");

      expect(bundle.entryModule.transformToModuleFunction()).equals(
`function package1_1_file1_js(__imports__, __exports__) {
__exports__.__defineGetter__("y", () => y); var y = package1_1_file2_js.x + 2;

}`);

      expect(bundle.entryModule.transformToRegisterFormat()).equals(
`System.register("package1@1/file1.js", ["package1@1/file2.js"], function(_export, _context) {
  "use strict";
  var x;
  return {
    setters: [
      function (package1_1_file2_js) {
        x = package1_1_file2_js.x;
      }
    ],
    execute: function() {
       var y = x + 2;
      _export("y", y);
    }
  }
});`);
    });

  });

  xdescribe("bundle", () => {

    it("produces file spec for bundle", async () => {
      let bundle = new Bundle(packages);
      await bundle.resolveDependenciesStartFrom("file1.js", "package1");
      let source = bundle.bundleToSource({bundleName: "package1"});
      expect(source).equals(`

;(function() {
var G = typeof window !== "undefined" ? window :
    typeof global!=="undefined" ? global :
      typeof self!=="undefined" ? self : this;
if (typeof G.lively !== "object") G.lively = {};
if (!G.lively.bundled) G.lively.bundled = {};
G.lively.bundled["package1"] = {}
})();
`)
    });
  });

});
