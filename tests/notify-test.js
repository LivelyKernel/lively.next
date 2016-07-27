/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { subscribe, unsubscribe } from "lively.notifications";

import { removeDir, createFiles } from "./helpers.js";
import { getSystem, removeSystem } from "../src/system.js";
import module from "../src/module.js";
import { getPackage } from "../src/packages.js";

var dir = System.decanonicalize("lively.modules/tests/"),
    testProjectDir = dir + "test-project-dir",
    testProjectSpec = {
      "file1.js": "import { y } from './file2.js'; var z = 2; export var x = y + z;",
      "file2.js": "import { z } from './file3.js'; export var y = z;",
      "file3.js": "export var z = 1;",
      "package.json": '{"name": "test-project-1", "main": "file1.js"}',
    },
    module1 = testProjectDir + "/file1.js",
    module2 = testProjectDir + "/file2.js",
    module3 = testProjectDir + "/file3.js";


describe("notify", () => {

  let system, modulechanged, moduleloaded, moduleunloaded, packageregistered, packageremoved;
  
  function changeModule1Source() {
    const m1 = module(system, module1);
    return m1.changeSourceAction(s => s.replace(/(z = )([0-9]+;)/, "$13;"));
  }
  
  function onModuleLoaded(n)      { moduleloaded.push(n); }
  function onModuleChanged(n)     { modulechanged.push(n); }
  function onModuleUnloaded(n)    { moduleunloaded.push(n); }
  function onPackageRegistered(n) { packageregistered.push(n); }
  function onPackageRemoved(n)    { packageremoved.push(n); }
  
  beforeEach(() => {
    system = getSystem("test", {baseURL: dir});
    modulechanged = [];
    moduleloaded = [];
    moduleunloaded = [];
    packageregistered = [];
    packageremoved = [];
    subscribe("lively.modules/moduleloaded", onModuleLoaded);
    subscribe("lively.modules/modulechanged", onModuleChanged);
    subscribe("lively.modules/moduleunloaded", onModuleUnloaded);
    subscribe("lively.modules/packageregistered", onPackageRegistered);
    subscribe("lively.modules/packageremoved", onPackageRemoved);
    return createFiles(testProjectDir, testProjectSpec);
  });

  afterEach(() => {
    unsubscribe("lively.modules/moduleloaded", onModuleLoaded);
    unsubscribe("lively.modules/modulechanged", onModuleChanged);
    unsubscribe("lively.modules/moduleunloaded", onModuleUnloaded);
    unsubscribe("lively.modules/packageregistered", onPackageRegistered);
    unsubscribe("lively.modules/packageremoved", onPackageRemoved);
    removeSystem("test");
    return removeDir(testProjectDir);
  });

  it("when module changes", async () => {
    expect(modulechanged).to.deep.equal([]);
    await changeModule1Source();
    expect(modulechanged).to.containSubset([{
      type: "lively.modules/modulechanged",
      module: module1,
      oldSource: "import { y } from './file2.js'; var z = 2; export var x = y + z;",
      newSource: "import { y } from './file2.js'; var z = 3; export var x = y + z;"
    }]);
  });
  
  it("when module gets loaded", async () => {
    expect(moduleloaded).to.deep.equal([]);
    await module(system, module1).load();
    expect(moduleloaded).to.containSubset([{
      type: "lively.modules/moduleloaded",
      module: module1
    }]);
  });
  
  it("when module gets unloaded", async () => {
    expect(moduleunloaded).to.deep.equal([]);
    await module(system, module1).load();
    module(system, module1).unload();
    expect(moduleunloaded).to.containSubset([{
      type: "lively.modules/moduleunloaded",
      module: module1
    }]);
  });
  
  it("when package gets registered", async () => {
    expect(packageregistered).to.deep.equal([]);
    await getPackage(system, testProjectDir).register();
    expect(packageregistered).to.containSubset([{
      type: "lively.modules/packageregistered",
      "package": testProjectDir
    }]);
  });

  it("when package gets removed", async () => {
    expect(packageremoved).to.deep.equal([]);
    await getPackage(system, testProjectDir).register();
    getPackage(system, testProjectDir).remove();
    expect(packageremoved).to.containSubset([{
      type: "lively.modules/packageremoved",
      "package": testProjectDir
    }]);
  });
});
