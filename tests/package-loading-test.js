/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { removeDir, createFiles, modifyFile } from "./helpers.js";

import { obj } from "lively.lang";
import { getSystem, removeSystem, printSystemConfig, loadedModules } from "../src/system.js";
import { registerPackage } from "../src/packages.js";

var dir = System.normalizeSync("lively.modules/tests/"),
    testProject1Dir = dir + "test-project-1-dir/",
    testProject1Spec = {
      "file1.js": "import { y } from './file2.js'; import { z } from './sub-dir/file3.js'; export var x = y + z;",
      "file2.js": "export var y = 1;",
      "package.json": '{"name": "test-project-1", "main": "file1.js"}',
      "sub-dir": {"file3.js": "export var z = 2;"}
    };

describe("package loading", () => {

  var System;
  beforeEach(() => System = getSystem("test", {baseURL: dir}));
  afterEach(() => removeSystem("test"));

  describe("basics", () => {
    beforeEach(() => createFiles(testProject1Dir, testProject1Spec));
    afterEach(() => removeDir(testProject1Dir));
    
    it("registers and loads a package", () =>
      registerPackage(System, testProject1Dir)
        .then(_ => System.import("test-project-1"))
        .then(mod => expect(mod).to.have.property("x", 3)));

    describe("dependency resolution", () => {
  
      var testProject2Dir = dir + "test-project-2-dir/",
          testProject2Spec = {
            "index.js": "import { x as importedX } from 'test-project-1/file1.js'; export var x = importedX + 20;",
            "package.json": '{"name": "test-project-2"}'};
  
      beforeEach(() => createFiles(testProject2Dir, testProject2Spec));
    
      afterEach(() => removeDir(testProject2Dir));
  
      it("across local packages", () =>
        Promise.all([
          registerPackage(System, testProject1Dir),
          registerPackage(System, testProject2Dir)])
          .then(_ => System.import("test-project-2"))
          .then(mod => expect(mod).to.have.property("x", 23)));
    })

  });

  describe("control over re-use of dependent packages", () => {

    var dep1Dir = dir + "dep1/",
        dep2Dir = dir + "dep2/",
        dependentDir = dir + "dependent-dir/",
        dependentDir2 = dir + "dependent-dir-2/",
        dep1 = {"index.js": "export var version = 'a';", "package.json": '{"name": "some-project"}'},
        dep2 = {"index.js": "export var version = 'b';", "package.json": '{"name": "some-project"}'},
        dependent = {
          "index.js": "export {version} from 'some-project';",
          "package.json": JSON.stringify({
            name: "dependent-project", dependencies: {"some-project": "*"},
            lively: {packageMap: {"some-project": dep2Dir + "index.js"}}
          })
        }

    beforeEach(() => Promise.all([
      createFiles(dep1Dir, dep1),
      createFiles(dep2Dir, dep2),
      createFiles(dependentDir, dependent)])
        .then(_ => registerPackage(System, dep1Dir)));

    afterEach(() => 
      // show(printSystemConfig(System)) && 
      Promise.all([
        removeDir(dep1Dir),
        removeDir(dep2Dir),
        removeDir(dependentDir)]));

    it("uses existing dependency by default", () =>
      registerPackage(System, dependentDir)
        .then(() => System.import("dependent-project"))
        .then(m => expect(m.version).to.equal("a")));

    it("uses specified dependency when preferLoaded is false", () =>
      modifyFile(
        dependentDir + "package.json",
        content => JSON.stringify(obj.deepMerge(JSON.parse(content), {lively: {preferLoadedPackages: false}})))
          .then(() => registerPackage(System, dependentDir))
          .then(() => System.import("dependent-project"))
          .then(m => expect(m.version).to.equal("b")));

  });

});
