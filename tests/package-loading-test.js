/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { removeDir, createFiles, modifyJSON, noTrailingSlash, inspect as i } from "./helpers.js";

import { obj } from "lively.lang";
import { getSystem, removeSystem, printSystemConfig, loadedModules } from "../src/system.js";
import { registerPackage } from "../src/packages.js";

var testDir = System.normalizeSync("lively.modules/tests/");


describe("package loading", function() {

  var project1aDir = testDir + "dep1/",
      project1bDir = testDir + "dep2/",
      project2Dir = testDir + "dependent-dir/",
      project1a = {
        "entry-a.js": "import { y } from './other.js'; var x = y + 1, version = 'a'; export { x, version };",
        "other.js": "export var y = 1;",
        "package.json": '{"name": "some-project", "main": "entry-a.js"}'
      },
      project1b = {
        "entry-b.js": "var x = 23, version = 'b'; export { x, version };",
        "package.json": '{"name": "some-project", "main": "entry-b.js"}'
      },
      project2 = {
        "index.js": "export { x, version } from 'some-project';",
        "package.json": JSON.stringify({
          name: "dependent-project", dependencies: {"some-project": "*"},
          lively: {packageMap: {"some-project": project1bDir + "entry-b.js"}}
        })
      }

  var System;

  beforeEach(() => {
    System = getSystem("test", {baseURL: testDir});
    return Promise.all([
      createFiles(project1aDir, project1a),
      createFiles(project1bDir, project1b),
      createFiles(project2Dir, project2)])
        .then(_ => registerPackage(System, project1aDir))
  });

  afterEach(() => {
    removeSystem("test")
    // show(printSystemConfig(System)) &&
    return Promise.all([
      removeDir(project1aDir),
      removeDir(project1bDir),
      removeDir(project2Dir)]);
  });

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  describe("basics", () => {
    
    it("registers and loads a package", () =>
      registerPackage(System, project1aDir)
        .then(_ => System.import("some-project"))
        .then(mod => expect(mod).to.have.property("x", 2))
        .then(m => expect(System.packages).to.deep.equal({
            [noTrailingSlash(project1aDir)]:
              {main: "entry-a.js", map: {}, names: ["some-project"]}})));

    it("registers and loads dependent packages", () =>
      Promise.all([
        registerPackage(System, project1bDir),
        registerPackage(System, project2Dir)])
        .then(_ => System.import("dependent-project"))
        .then(mod => expect(mod).to.have.property("x", 23)));
  });

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  describe("with pre-loaded dependent packages", function() {

    it("uses existing dependency by default", () =>
      registerPackage(System, project2Dir)
        .then(() => System.import("dependent-project"))
        .then(m => expect(m.version).to.equal("a")));

    it("uses specified dependency when preferLoaded is false", () =>
      modifyJSON(project2Dir + "package.json", {lively: {preferLoadedPackages: false}})
        .then(() => registerPackage(System, project2Dir).then(() => System.import("dependent-project")))
        .then(m => expect(m.version).to.equal("b")));

    it("deals with package map directory entry", () =>
      modifyJSON(project2Dir + "package.json", {lively: {preferLoadedPackages: false, packageMap: {"some-project": project1bDir}}})
        .then(() => registerPackage(System, project2Dir))
        .then(() => System.import("dependent-project"))
        .then(m => expect(m.version).to.equal("b")));

    it("deals with package map relative entry", () =>
      modifyJSON(project2Dir + "package.json", {lively: {preferLoadedPackages: false, packageMap: {"some-project": "../dep2/"}}})
        .then(() => registerPackage(System, project2Dir))
        .then(m => expect(System.packages).to.containSubset({
          [noTrailingSlash(project1bDir)]: {main: "entry-b.js", map: {}, names: ["some-project"]},
          [noTrailingSlash(project2Dir)]: {map: {"some-project": "../dep2/"}, names: ["dependent-project"]}
        }))
        .then(() => System.import("dependent-project"))
        .then(m => expect(m.version).to.equal("b")));

  });

});
