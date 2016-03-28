/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { removeDir, createFiles } from "./helpers.js";

import { getSystem, removeSystem, moduleRecordFor, moduleEnv, sourceOf } from "../src/system.js";
import { moduleSourceChange } from "../src/change.js";
import { forgetModuleDeps } from "../src/dependencies.js";
import { runEval } from "../src/eval.js";

var dir = System.normalizeSync("lively.modules/tests/"),
    testProjectDir = dir + "test-project-1-dir/",
    testProjectSpec = {
      "file1.js": "import { y } from './file2.js'; import { z } from './sub-dir/file3.js'; export var x = y + z;",
      "file2.js": "var internal = 1; export var y = internal;",
      "package.json": '{"name": "test-project-1", "main": "file1.js"}',
      "sub-dir": {"file3.js": "export var z = 2;"}
    },
    module1 = testProjectDir + "file1.js",
    module2 = testProjectDir + "file2.js",
    module3 = testProjectDir + "sub-dir/file3.js";


describe("code changes", () => {

  function changeModule2Source() {
    // "internal = 1" => "internal = 2"
    return sourceOf(System, module2).then(s =>
      moduleSourceChange(System, module2,
        s.replace(/(internal = )([0-9]+)/, "$12"),
        {evaluate: true}));
  }

  var System;
  beforeEach(() => {
    System = getSystem("test", {baseURL: testProjectDir});
    return createFiles(testProjectDir, testProjectSpec);
  });

  afterEach(() => { removeSystem("test"); return removeDir(testProjectDir); });


  it("modifies module and its exports", () =>
    System.import(module1).then(m => {
      expect(moduleEnv(System, module2).recorder.internal).to.equal(1, "internal state before change");
      expect(m.x).to.equal(3, "export state before change");
      return changeModule2Source().then(() => {
          expect(moduleEnv(System, module2).recorder.internal).to.equal(2, "internal state after change");
          expect(m.x).to.equal(4, "export state after change");
      });
    }));

  it("modifies imports", () =>
    System.import(module2)
      .then(() =>
        expect(moduleRecordFor(System, module2).dependencies.map(ea => ea.name))
          .to.deep.equal([], "deps before"))
      .then(m => moduleSourceChange(System, module2,
                  "import { z as x } from './sub-dir/file3.js'; export var y = x + 1;",
                  {evaluate: true}))
      .then(() =>
        expect(moduleRecordFor(System, module2).dependencies.map(ea => ea.name))
            .to.deep.equal([module3], "deps after")));

  it("affects dependent modules", () =>
    System.import(module1).then(m => {
      expect(m.x).to.equal(3, "before change");
      return changeModule2Source().then(() =>
        expect(m.x).to.equal(4, "state after change"));
      }));

  it("affects eval state", () =>
    System.import(module2)
      .then(m => changeModule2Source())
      .then(() => runEval(System, "[internal, y]", {targetModule: module2}))
      .then(result => expect(result.value).to.deep.equal([2, 2])));

});
