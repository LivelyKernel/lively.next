/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { createFiles, resource } from "lively.resources";
import { getSystem, removeSystem } from "../src/system.js";
import module from "../src/module.js";
import { ExportLookup } from "../src/import-export.js";
import { importPackage, getPackage, getPackages } from "../src/packages.js";
import { moduleSourceChange } from "../src/change.js";
import { runEval } from "lively.vm";

var dir = "local://lively.modules.export-lookup-test/",
    testProjectDir = dir + "project/",
    testProjectSpec = {
      "file1.js": `import { y } from './file2.js'; `
                + `import { z } from './sub-dir/file3.js'; `
                + `export var x = {value: y + z};`,
      "file2.js": "export var y = 1; "
                + "function inc() { y = y+1; }",
      "sub-dir": {"file3.js": "export var z = 2;"},
      "package.json": `{`
                    + `"name": "test-project-1", `
                    + `"main": "file1.js", `
                    + `"version": "0.1.1"`
                    + `}`
    },
    file1m = testProjectDir + "file1.js",
    file2m = testProjectDir + "file2.js",
    file3m = testProjectDir + "sub-dir/file3.js";

let S, module1, module2, module3;

describe("export lookup", () => {

  beforeEach(async () => {
    S = getSystem("test", {baseURL: testProjectDir});
    await createFiles(testProjectDir, testProjectSpec);
    await importPackage(S, testProjectDir);
  });

  afterEach(() => { removeSystem("test"); return resource(dir).remove(); });

  it("computes exports", async () => {
    var exports = await ExportLookup.run(S);
    expect(exports).containSubset([
      {
        exported: "x",
        isMain: true,
        local: "x",
        moduleId: file1m,
        packageName: "test-project-1",
        packageURL: testProjectDir.replace(/\/$/, ""),
        packageVersion: "0.1.1",
        pathInPackage: "file1.js",
        type: "var"
      }, {
        exported: "y",
        local: "y",
        moduleId: file2m,
        packageName: "test-project-1",
        packageURL: testProjectDir.replace(/\/$/, ""),
        packageVersion: "0.1.1",
        pathInPackage: "file2.js",
        type: "var"
      }, {
        exported: "z",
        local: "z",
        moduleId: file3m,
        packageName: "test-project-1",
        packageURL: testProjectDir.replace(/\/$/, ""),
        packageVersion: "0.1.1",
        pathInPackage: "sub-dir/file3.js",
        type: "var"
      }
    ]);
  });
  
  it("exports from module changes are picked up", async () => {
    await ExportLookup.run(S);
    await module(S, file1m).changeSourceAction(
      oldSource => oldSource + "\nvar foo = 23; export { foo };");
    var exports = await ExportLookup.run(S);
    expect(exports).containSubset([
      {local: "x",moduleId: file1m},
      {local: "foo",moduleId: file1m},
      {local: "y",moduleId: file2m},
      {local: "z",moduleId: file3m}]);
  });
  
  // it("exports after eval are updated", async () => {
      // await ExportLookup.run(S);
  //   await runEval("export var foo = 23;", {targetModule: file1m, System: S})
  //   module(S, file1m).reset();
  //   var exports = await ExportLookup.run(S);
  //   expect(exports).containSubset([
  //     {local: "x",moduleId: file1m},
  //     {local: "foo",moduleId: file1m},
  //     {local: "y",moduleId: file2m},
  //     {local: "z",moduleId: file3m}]);
  // });

  it("exports after unloads are updated", async () => {
    var exports = await ExportLookup.run(S);
    await module(S, file1m).unload()
    var exports = await ExportLookup.run(S);
    expect(exports).containSubset([
      {local: "y",moduleId: file2m},
      {local: "z",moduleId: file3m}]);
  });

  it("find export of value", async () => {
    var exported = await ExportLookup.findExportOfValue(module(S, file1m).recorder.x, S);
    expect(exported).containSubset({local: "x", moduleId: file1m})
  });

});