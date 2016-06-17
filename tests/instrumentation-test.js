/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { removeDir, createFiles, inspect as i } from "./helpers.js";

import { getSystem, removeSystem } from "../src/system.js";
import module from "../src/module.js";

var dir = System.normalizeSync("lively.modules/tests/"),
    testProjectDir = dir + "test-project-dir/",
    testProjectSpec = {
      "file1.js": "import { y } from './file2.js'; export var x = y + 2;",
      "file2.js": "export var y = 1;",
      "file3.js": "var zzz = 4; System.global.z = zzz / 2;",
      "file4.js": "export default class Foo { static bar() {} }; Foo.bar();",
      "package.json": JSON.stringify({
                        "name": "test-project-1",
                        "main": "file1.js",
                        "systemjs": {"meta": {"file3.js": {format: "global", exports: "z"}}}
                      })
    }


describe("instrumentation", () => {

  let S, module1, module2, module3, module4;
  beforeEach(() => {
    S = getSystem("test", {baseURL: dir});
    module1 = module(S, testProjectDir + "file1.js");
    module2 = module(S, testProjectDir + "file2.js");
    module3 = module(S, testProjectDir + "file3.js");
    module4 = module(S, testProjectDir + "file4.js");
    try { delete S.global.z; } catch (e) {}
    try { delete S.global.zzz; } catch (e) {}
    return createFiles(testProjectDir, testProjectSpec)
      .then(() => S.import(testProjectDir + "file1.js"));
  });

  afterEach(() => {
    removeSystem("test");
    return removeDir(testProjectDir);
  });

  it("gets access to internal module state", () => {
    expect(module1.env()).to.have.deep.property("recorder.y", 1);
    expect(module1.env()).to.have.deep.property("recorder.x", 3);
  });

  describe("of global modules", () => {

    it("can access local state", () => 
      S.import(`${testProjectDir}file3.js`)
        .then(() => {
          expect(module3.env()).to.have.deep.property("recorder.zzz", 4);
          expect(S.get(testProjectDir + "file3.js")).to.have.property("z", 2);
        }))

  });

  describe("of export default", function() {

    it("class export is recorded", async () => {
      await S.import(`${testProjectDir}file4.js`);
      expect(module4.env()).to.have.deep.property("recorder.Foo");
    });

  });

});
