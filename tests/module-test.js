/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { removeDir, createFiles } from "./helpers.js";
import { promise } from "lively.lang";

import module from "../src/module.js";
import { getSystem, removeSystem, loadedModules, whenLoaded } from "../src/system.js";
import { registerPackage } from "../src/packages.js";

var dir = System.decanonicalize("lively.modules/tests/"),
    testDir = dir + "test-project/",
    module1 = `${testDir}file1.js`;

describe("module loading", () => {

  var System;
  beforeEach(async () => {
    System = getSystem("test", {baseURL: dir});
    await createFiles(testDir, {
      "file1.js": "import { y } from './file2.js'; export var x = y + 1;",
      "file2.js": "import { z } from './file3.js'; export var y = 1 + z;",
      "file3.js": "export var z = 1;"
    });
  });

  afterEach(async() => {
    removeSystem("test");
    await removeDir(testDir);
  });

  it("loads files", async () => {
    var exports = await System.import(testDir + "file1.js");
    expect(exports).to.have.property("x", 3);
  });

  it("has module interface objects", async () => {
    await System.import(testDir + "file1.js");
    var m = loadedModules(System)[module1];
    expect(m.id).equals(module1);
    expect(m.record()).containSubset({exports: {x: 3}, importers: [], name: module1});
    /*...*/
  });

  it("module knows it's package", async () => {
    await registerPackage(System, testDir);
    await System.import(testDir + "file1.js");
    var m = loadedModules(System)[module1];
    expect(m.package()).containSubset({
      address: testDir.replace(/\/$/, "")
    });
    expect(m.pathInPackage()).equals("./file1.js")
  });

  it("module scope does not resolve references by default", async () => {
    await registerPackage(System, testDir);
    await System.import(testDir + "file1.js");
    const scope = await loadedModules(System)[module1].scope();
    expect(scope).containSubset({refs: [{name: "y"}]});
    expect(scope).to.not.have.property('referencesResolved');
    expect(scope.refs[0]).to.not.have.property('decl');
    expect(scope.refs[0]).to.not.have.property('declId');
  });

  it("module resolved scope resolves references", async () => {
    await registerPackage(System, testDir);
    await System.import(testDir + "file1.js");
    const scope = await loadedModules(System)[module1].resolvedScope();
    expect(scope.resolvedRefMap.get(scope.refs[0])).containSubset({decl: {type: "ImportDeclaration"}});
    expect(scope).to.not.property('_referencesResolved');
  });

  describe("onLoad callbacks", () => {

    it("can be registered lively.modules.whenLoaded", async () => {
      var called = 0;
      whenLoaded(System, testDir + "file2.js", () => called++);
      await System.import(testDir + "file1.js");
      await promise.delay(20);
      expect(called).equals(1);
    });

    it("get triggered on import", async () => {
      var called = 0;
      module(System, testDir + "file2.js").whenLoaded(() => called++);
      await System.import(testDir + "file1.js");
      await promise.delay(20);
      expect(called).equals(1);
    });

    it("get triggered immediately when module already loaded", async () => {
      await System.import(testDir + "file1.js");
      var called = 0;
      module(System, testDir + "file2.js").whenLoaded(() => called++);
      expect(called).equals(1);
    });
  });

});
