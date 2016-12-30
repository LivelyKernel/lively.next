/*global beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { getSystem, removeSystem } from "lively.modules";
import { createFiles, resource } from "lively.resources";
import module from "lively.modules/src/module.js";
import { importPackage } from "lively.modules/src/packages.js";
import { RuntimeSourceDescriptor } from "../source-descriptors.js";

var testDir = "local://source-descriptor-test/";

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
    // S.debug = true
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
          descr = RuntimeSourceDescriptor.for(m.recorder.a, S);

      expect(await descr.source).equals("function a() { return b() + 3; }");
    });

  });
  
  describe("source modification", () => {

    it("source descriptors from module", async () => {
      var m = module(S, "project1/index.js"),
          descr = RuntimeSourceDescriptor.for(m.recorder.a, S);
      expect(descr.sourceLocation).deep.equals({start: 14, end: 46});
      await descr.changeSource("function a() { return b() + 444; }");
      expect(await m.source())
        .equals(project1["index.js"].replace("3", "444"), "module source wrong");
      expect(await m.source()).equals(await descr.moduleSource);
      expect(445).equals(m.recorder.a(), "module runtime not updated");
      expect(descr.sourceLocation).deep.equals({start: 14, end: 48});
    });
    
    // 2016-12-18 currently descriptors won't update
    xit("descriptors are updated", async () => {
      var m = module(S, "project1/index.js"),
          descr1 = RuntimeSourceDescriptor.for(m.recorder.a, S),
          descr2 = RuntimeSourceDescriptor.for(m.recorder.b, S);
      await descr1.write("function a() {\n  return b() + 4;\n}");
      expect(descr1.obj).equals(m.recorder.a, "obj of descr1 not updated");
      // expect(descr2.obj).equals(m.recorder.b, "obj of descr2 not updated");
      // expect(await descr2.read()).equals("function b() { return 1; }", "source of descr2 not updated");
    });

  });

});
