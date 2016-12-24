/*global beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { getSystem, removeSystem } from "lively.modules";
import { createFiles, resource } from "lively.resources";
import module from "lively.modules/src/module.js";
import { importPackage } from "lively.modules/src/packages.js";
import SourceDescriptor from "../source-descriptors.js";

var testDir = System.decanonicalize("lively.classes/tests/temp-test-projects/");

var project1Dir = testDir + "project1/",
    project1 = {
      "index.js": "'format esm';\nfunction a() { return b() + 3; };\nfunction b() { return 1; }",
      "file1.js": "",
      "package.json": '{"name": "project1", "main": "index.js"}'
    },
    testResources = {
      "project1": project1,
    };


var S;
describe("source descriptors", function() {


  beforeEach(async () => {
    S = getSystem("test", {baseURL: testDir});
    S.debug=true
    await createFiles(testDir, testResources);
    await importPackage(S, "project1");
  });

  afterEach(() => {
    removeSystem("test");
    return resource(testDir).remove();
  });

  describe("source retrieval", () => {

    it("source descriptors from module", async () => {
      var m = module(S, "project1/index.js"),
          descr = SourceDescriptor.for(m.recorder.a, S);
      expect(await descr.read()).equals("function a() { return b() + 3; }");
    });

  });
  
  describe("source modification", () => {

    it("source descriptors from module", async () => {
      var m = module(S, "project1/index.js"),
          descr = SourceDescriptor.for(m.recorder.a, S);

      await descr.write("function a() { return b() + 4; }");
      expect(await m.source())
        .equals(project1["index.js"].replace("3", "4"), "module source wrong");
      expect(5).equals(m.recorder.a(), "module runtime not updated");
    });
    
    // 2016-12-18 currently descriptors won't update
    xit("descriptors are updated", async () => {
      var m = module(S, "project1/index.js"),
          descr1 = SourceDescriptor.for(m.recorder.a, S),
          descr2 = SourceDescriptor.for(m.recorder.b, S);
      await descr1.write("function a() {\n  return b() + 4;\n}");
      expect(descr1.obj).equals(m.recorder.a, "obj of descr1 not updated");
      // expect(descr2.obj).equals(m.recorder.b, "obj of descr2 not updated");
      // expect(await descr2.read()).equals("function b() { return 1; }", "source of descr2 not updated");
    });

  });

});
