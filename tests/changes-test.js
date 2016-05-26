/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { removeDir, createFiles } from "./helpers.js";

import { getSystem, removeSystem, moduleRecordFor, moduleEnv, sourceOf } from "../src/system.js";
import { moduleSourceChange, moduleSourceChangeAction } from "../src/change.js";
import { forgetModuleDeps } from "../src/dependencies.js";

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
    return moduleSourceChangeAction(S, module2, s => s.replace(/(internal = )([0-9]+)/, "$12"));
  }

  var S;
  beforeEach(() => {
    S = getSystem("test", {baseURL: testProjectDir});
    return createFiles(testProjectDir, testProjectSpec);
  });

  afterEach(() => { removeSystem("test"); return removeDir(testProjectDir); });


  it("modifies module and its exports", async () => {
    var m = await S.import(module1);
    expect(moduleEnv(S, module2).recorder.internal).to.equal(1, "internal state before change");
    expect(m.x).to.equal(3, "export state before change");
    await changeModule2Source();
    expect(moduleEnv(S, module2).recorder.internal).to.equal(2, "internal state after change");
    expect(m.x).to.equal(4, "export state after change");
  });

  it("modifies module declaration", async () => {
    var m = await S.import(module1);
    expect(moduleRecordFor(S, module2).importers[0]).equals(moduleRecordFor(S, module1));
    await moduleSourceChange(S, module1,
      testProjectSpec["file1.js"].replace("x = y + z;", "x = y - z;"),
      {evaluate: true});
    expect(m.x).to.equal(-1, "x after changing module1");
    await changeModule2Source();
    expect(m.x).to.equal(0, "x after changing module2, changing module2 is expected to update module1 as well – with module1's new definition!");
    expect(moduleRecordFor(S, module2).importers[0]).equals(moduleRecordFor(S, module1), "imported module recorded in file2.js is not the record of file1.js");
  });

  it("modifies imports", async () => {
    await S.import(module2);
    expect(moduleRecordFor(S, module2).dependencies.map(ea => ea.name))
      .to.deep.equal([], "deps before");
    await moduleSourceChange(S, module2,
      "import { z as x } from './sub-dir/file3.js'; export var y = x + 1;",
      {evaluate: true});
    expect(moduleRecordFor(S, module2).dependencies.map(ea => ea.name))
      .to.deep.equal([module3], "deps after");
  });

  it("affects dependent modules", async () => {
    var m1 = await S.import(module1);
    var m1Env = moduleEnv(S, module1);
    expect(m1Env).deep.property("recorder.y").equal(1, "internal state before change");
    expect(m1.x).to.equal(3, "before change");
    await changeModule2Source();
    expect(m1Env).deep.property("recorder.y").to.equal(2, "internal state after change");
    expect(m1.x).to.equal(4, "state after change");
  });

  it("affects eval state", async () => {
    var m = await S.import(module2)
    await changeModule2Source();
    expect(moduleEnv(S, module2).recorder).property("y").equal(2);
    expect(moduleEnv(S, module2).recorder).property("internal").equal(2);
  });

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

  it("modifies module and its exports", async () => {
    var m = await S.import(module1);
    expect(moduleEnv(S, module1).recorder.zzz).to.equal(4, "zzz state before change");
    expect(m.z).to.equal(2, "export state before change");
    await moduleSourceChangeAction(S, module1, s => s.replace(/zzz = 4;/, "zzz = 6;"))
    expect(moduleEnv(S, module1).recorder.zzz).to.equal(6, "zzz state after change");
    // expect(m.z).to.equal(3, "export state after change");
    var m = await S.import(module1)
    expect(m.z).to.equal(3, "export state after change and re-import");
  });


  it("affects eval state", async () =>{
    await S.import(module1);
    await moduleSourceChangeAction(S, module1, s => s.replace(/zzz = 4/, "zzz = 6"));
    expect(moduleEnv(S, module1).recorder).property("zzz").equal(6)
    expect(moduleEnv(S, module1).recorder).property("z").equal(3);
  });
});
