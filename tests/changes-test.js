/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { removeDir, createFiles } from "./helpers.js";

import { getSystem, removeSystem, moduleRecordFor, moduleEnv, sourceOf } from "../src/system.js";
import { moduleSourceChange } from "../src/change.js";
import { forgetModuleDeps } from "../src/dependencies.js";
import { runEval } from "../src/eval.js";

function changeModuleSource(System, moduleName, changeFunc) {
  return sourceOf(System, moduleName)
          .then(changeFunc)
          .then(newSource => moduleSourceChange(System, moduleName, newSource, {evaluate: true}));
}

describe("code changes of esm format module", () => {

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

  function changeModule2Source() {
    // "internal = 1" => "internal = 2"
    return changeModuleSource(S, module2, s => s.replace(/(internal = )([0-9]+)/, "$12"));
  }

  var S;
  beforeEach(() => {
    S = getSystem("test", {baseURL: testProjectDir});
    return createFiles(testProjectDir, testProjectSpec);
  });

  afterEach(() => { removeSystem("test"); return removeDir(testProjectDir); });


  it("modifies module and its exports", () =>
    S.import(module1).then(m => {
      expect(moduleEnv(S, module2).recorder.internal).to.equal(1, "internal state before change");
      expect(m.x).to.equal(3, "export state before change");
      return changeModule2Source().then(() => {
          expect(moduleEnv(S, module2).recorder.internal).to.equal(2, "internal state after change");
          expect(m.x).to.equal(4, "export state after change");
      });
    }));

  it("modifies imports", () =>
    S.import(module2)
      .then(() =>
        expect(moduleRecordFor(S, module2).dependencies.map(ea => ea.name))
          .to.deep.equal([], "deps before"))
      .then(m => moduleSourceChange(S, module2,
                  "import { z as x } from './sub-dir/file3.js'; export var y = x + 1;",
                  {evaluate: true}))
      .then(() =>
        expect(moduleRecordFor(S, module2).dependencies.map(ea => ea.name))
            .to.deep.equal([module3], "deps after")));

  it("affects dependent modules", () =>
    S.import(module1).then(m => {
      expect(m.x).to.equal(3, "before change");
      return changeModule2Source().then(() =>
        expect(m.x).to.equal(4, "state after change"));
      }));

  it("affects eval state", () =>
    S.import(module2)
      .then(m => changeModule2Source())
      .then(() => runEval(S, "[internal, y]", {targetModule: module2}))
      .then(result => expect(result.value).to.deep.equal([2, 2])));

});


describe("code changes of global format module", () => {

  var dir = System.normalizeSync("lively.modules/tests/"),
      testProjectDir = dir + "test-project-dir/",
      module1 = `${testProjectDir}file1.js`,
      testProjectSpec = {
        "file1.js": "var zzz = 4; System.global.z = zzz / 2;",
        "package.json": JSON.stringify({
                          "name": "test-project-1",
                          "main": "file1.js",
                          "systemjs": {"meta": {"file1.js": {format: "global", exports: "z"}}}
                        })
      }

  var S;
  beforeEach(() => {
    S = getSystem("test", {baseURL: dir});
    return createFiles(testProjectDir, testProjectSpec)
      .then(() => S.import(testProjectDir + "file1.js"));
  });

  afterEach(() => {
    try { delete S.global.z; } catch (e) {}
    try { delete S.global.zzz; } catch (e) {}
  });

  afterEach(() => { removeSystem("test"); return removeDir(testProjectDir); });

  it("modifies module and its exports", () =>
    S.import(module1).then(m => {
      expect(moduleEnv(S, module1).recorder.zzz).to.equal(4, "zzz state before change");
      expect(m.z).to.equal(2, "export state before change");
      return changeModuleSource(S, module1, s => s.replace(/zzz = 4;/, "zzz = 6;"))
        .then(() => {
            expect(moduleEnv(S, module1).recorder.zzz).to.equal(6, "zzz state after change");
            // expect(m.z).to.equal(3, "export state after change");
          })
        .then(() =>
          S.import(module1).then(m => expect(m.z).to.equal(3, "export state after change and re-import")))
    }));


  it("affects eval state", () =>
    S.import(module1)
      .then(m => changeModuleSource(S, module1, s => s.replace(/zzz = 4/, "zzz = 6")))
      .then(() => runEval(S, "[zzz, z]", {targetModule: module1}))
      .then(result => expect(result.value).to.deep.equal([6, 3])));

});
