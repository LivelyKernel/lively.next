/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { modifyJSON, noTrailingSlash, inspect as i } from "./helpers.js";

import { obj, arr } from "lively.lang";
import { getSystem, removeSystem, printSystemConfig, loadedModules } from "../src/system.js";
import { getPackage, applyConfig, getPackages } from "../src/packages.js";
import module from "../src/module.js";
import { resource, createFiles } from "lively.resources";

var testDir = System.decanonicalize("lively.modules/tests/package-tests-temp/");
// await resource(testDir).exists()
// await resource(testDir).remove()

var project1aDir = testDir + "dep1/",
    project1bDir = testDir + "dep2/",
    project2Dir = testDir + "project2/",
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
        name: "project2", dependencies: {"some-project": "*"},
        lively: {packageMap: {"some-project": project1bDir}}
      })
    },
    testResources = {
      "dep1": project1a,
      "dep2": project1b,
      "project2": project2
    };

describe("package loading", function() {

  var S;

  beforeEach(async () => {
    S = getSystem("test", {baseURL: testDir});
    await createFiles(testDir, testResources)
  });

  afterEach(() => {
    removeSystem("test");
    return resource(testDir).remove();
  });

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  describe("basics", () => {

    it("registers and loads a package", async () => {
      await getPackage(S, project1aDir).register();
      let mod = await S.import("some-project");
      expect(mod).to.have.property("x", 2);
      let p = getPackages(S);
      expect(p).to.containSubset([{
        address: noTrailingSlash(project1aDir),
        main: "entry-a.js",
        meta: {"package.json": {format: "json"}},
        map: {},
        referencedAs: ["some-project"]
      }]);
    });

    it("tracks package config", async () => {
      await getPackage(S, project1aDir).register();
      let p = getPackage(S, "some-project");
      expect(p.config).to.deep.equal({"name": "some-project", "main": "entry-a.js"});
      applyConfig(S, {lively: {foo: "bar"}}, "some-project")
      expect(p.config).to.deep.equal(
        {"name": "some-project", "main": "entry-a.js", "lively": {"foo": "bar"}});
    });

    it("registers and loads dependent packages", async () => {
      await Promise.all([
        getPackage(S, project1bDir).register(),
        getPackage(S, project2Dir).register()]);
      var mod = await S.import("project2")
      expect(mod).to.have.property("x", 23);
    });

    it("enumerates packages", async () => {
      await getPackage(S, project1aDir).register();
      await getPackage(S, project2Dir).import();
      expect(getPackages(S)).to.containSubset([
        {
          address: noTrailingSlash(project1aDir),
          name: `some-project`, referencedAs: [`some-project`],
          modules: [
            {deps: [`${project1aDir}other.js`], name: `${project1aDir}entry-a.js`},
            {deps: [],name: `${project1aDir}other.js`},
            {deps: [],name: `${project1aDir}package.json`}]
        },
        {
          address: noTrailingSlash(project2Dir),
          name: `project2`, referencedAs: [`project2`],
          modules: [
            {deps: [`${project1aDir}entry-a.js`], name: `${project2Dir}index.js`},
            {deps: [], name: `${project2Dir}package.json`}],
        }
      ])
    })

    it("doesnt group modules with package name as belonging to package", async () => {
      await getPackage(S, project2Dir).import();
      S.set(testDir + "project2.js", S.newModule({}));
      expect(getPackages(S).map(ea => Object.assign(ea, {System: null}))).to.containSubset([
        {
          address: noTrailingSlash(project2Dir),
          name: `project2`, referencedAs: [`project2`],
          modules: [
            {deps: [`${project1bDir}entry-b.js`], name: `${project2Dir}index.js`},
            {deps: [], name: `${project2Dir}package.json`}],
        },
        {
          address: noTrailingSlash(project1bDir),
          name: `some-project`, referencedAs: [`some-project`]
        }])
    })
  });

  describe("nested packages", () => {

    beforeEach(async () => {
      await createFiles(project1aDir, {
        "my-projects": {
          "sub-project": {
            "package.json": '{"name": "sub-project", "main": "index.js"}',
            "index.js": "export var state = 99;",
          }
        }
      })
    });

    it("finds loaded modules of registered package", async () => {
      await getPackage(S, project2Dir).import();

      var p = getPackage(S, project1aDir);
      await p.register();
      expect(arr.pluck(p.modules(), "id")).equals([project1aDir + "package.json"], "register")
      await p.import();

      expect(arr.pluck(p.modules(), "id"))
        .equals(["package.json", "entry-a.js", "other.js"].map(ea => project1aDir + ea), "import")

      var innerDir = project1aDir + "my-projects/sub-project/",
          p2 = getPackage(S, innerDir);
      await p2.import();
      expect(arr.pluck(p2.modules(), "id"))
        .equals(["package.json", "index.js"].map(ea => innerDir + ea), "import inner")

      expect(arr.pluck(p.modules(), "id"))
        .equals(["package.json", "entry-a.js", "other.js"].map(ea => project1aDir + ea), "after sub-project loaded")
    });

    it("finds resources of registered package", async () => {
      var innerDir = project1aDir + "my-projects/sub-project/",
          p2 = getPackage(S, innerDir);
      var p = getPackage(S, project1aDir);
      p.register();
      p2.register();

      expect(arr.pluck(await p.resources(), "url"))
        .equals(["entry-a.js", "other.js", "package.json"].map(ea => project1aDir + ea));
    });

  });

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  describe("with pre-loaded dependent packages", function() {

    it("uses existing dependency by default", async () => {
      await getPackage(S, project1aDir).register();
      await getPackage(S, project2Dir).register();
      var m = await S.import("project2");
      expect(m.version).to.equal("a");
    });

    it("uses specified dependency when preferLoaded is false", async () => {
      await getPackage(S, project1aDir).register();
      await modifyJSON(project2Dir + "package.json", {lively: {preferLoadedPackages: false}});
      await getPackage(S, project2Dir).register();
      var m = await S.import("project2");
      expect(m.version).to.equal("b");
    });

    it("deals with package map directory entry", async () => {
      await getPackage(S, project1aDir).register();
      await modifyJSON(project2Dir + "package.json", {lively: {preferLoadedPackages: false, packageMap: {"some-project": project1bDir}}});
      await getPackage(S, project2Dir).register();
      var m = await S.import("project2");
      expect(m.version).to.equal("b")
    });

    it("deals with package map relative entry", async () => {
      await getPackage(S, project1aDir).register();
      await modifyJSON(project2Dir + "package.json", {lively: {preferLoadedPackages: false, packageMap: {"some-project": "../dep2/"}}});
      await getPackage(S, project2Dir).register();
      expect(S.packages).to.containSubset({
        [noTrailingSlash(project1bDir)]: {main: "entry-b.js", map: {}, referencedAs: ["some-project"]},
        [noTrailingSlash(project2Dir)]: {map: {"some-project": "../dep2/"}}
      });
      var m = await S.import("project2");
      expect(m.version).to.equal("b");
    });

    it("Concurrent loading will not load multiple versions", async () => {
      var project2bDir = testDir + "project2b/",
          project2b = {
            "index.js": "export { x, version } from 'some-project';",
            "package.json": JSON.stringify({
              name: "project2", dependencies: {"some-project": "*"},
              lively: {packageMap: {"some-project": project1aDir}}
            })
          },
          project5Dir = testDir + "project5/",
          project5 = {
            "index.js": "export { version } from 'project2';",
            "package.json": JSON.stringify({
              name: "project5", dependencies: {"project2": "*"},
              lively: {packageMap: {"project2": project2bDir}}
            })
          };
      await createFiles(project2bDir, project2b);
      await createFiles(project5Dir, project5);
      await Promise.all([
        getPackage(S, project2Dir).import(),
        getPackage(S, project5Dir).import()
      ]);
      var packageCounts = arr.groupByKey(getPackages(S), "name").count();
      Object.keys(packageCounts).forEach(name =>
        expect(packageCounts[name]).equals(1, `package ${name} loaded mutiple times`));
    });

  });

  describe("package copying and renaming", () => {

    it("changeAddress renames resources and affects runtime", async () => {
      await getPackage(S, project1aDir).register();
      await S.import("some-project");
      let p = getPackage(S, "some-project"),
          newURL = testDir + "some-project-renamed",
          newP = await p.changeAddress(newURL, null/*name*/, true/*delete old*/);

      expect(newP).equals(getPackage(S, newURL), "getPAckage not working with renamed package");
      expect(newP.name).equals("some-project");
      expect(await resource(project1aDir).exists()).equals(false, "original project dir still exists");
      expect(await resource(newURL).exists()).equals(true, "new project dir does not exist");
      expect(await resource(newURL + "/other.js").exists()).equals(true, "other.js does not exist");
      expect(await resource(newURL + "/entry-a.js").exists()).equals(true, "entry-a.js does not exist");
      expect(await resource(newURL + "/package.json").exists()).equals(true, "package.json does not exist");

      expect(S.get(newURL + "/entry-a.js")).deep.equals({version: "a",x: 2});
      expect(S.get(newURL + "/package.json")).containSubset({main: "entry-a.js", name: "some-project"});
    });

    it("renameTo changes package name and address", async () => {
      await getPackage(S, project1aDir).register();
      await S.import("some-project");
      let p = getPackage(S, "some-project"),
          newURL = testDir + "some-project-renamed",
          newP = await p.rename("some-project-renamed");

      expect(newP).equals(getPackage(S, newURL), "getPAckage not working with renamed package");
      expect(newP.name).equals("some-project-renamed");
      expect(await resource(project1aDir).exists()).equals(false, "original project dir still exists");
      expect(await resource(newURL).exists()).equals(true, "new project dir does not exist");
      expect(JSON.parse(await resource(newURL + "/package.json").read())).containSubset({main: "entry-a.js", name: "some-project-renamed"});
      expect(S.get(newURL + "/package.json")).containSubset({main: "entry-a.js", name: "some-project-renamed"});
    });

    it("fork creates a new similar package with a changed name", async () => {
      await getPackage(S, project1aDir).register();
      await S.import("some-project");
      let p = getPackage(S, "some-project"),
          newURL = testDir + "some-project-copied",
          newP = await p.fork("some-project-copied");

      expect(newP).equals(getPackage(S, newURL), "getPAckage not working with renamed package");
      expect(newP.name).equals("some-project-copied");
      expect(await resource(project1aDir).exists()).equals(true, "original project does not exist anymore");
      expect(await resource(newURL).exists()).equals(true, "new project dir does not exist");
      expect(await resource(newURL + "/other.js").exists()).equals(true, "other.js does not exist");
      expect(await resource(newURL + "/entry-a.js").exists()).equals(true, "entry-a.js does not exist");
      expect(await resource(newURL + "/package.json").exists()).equals(true, "package.json does not exist");
      expect(JSON.parse(await resource(newURL + "/package.json").read())).containSubset({main: "entry-a.js", name: "some-project-copied"});

      expect(S.get(newURL + "/entry-a.js")).deep.equals({version: "a",x: 2});
      expect(S.get(newURL + "/package.json")).containSubset({main: "entry-a.js", name: "some-project-copied"});
    });

  });

});

describe("package configuration test", () => {

  var S;
  beforeEach(() => S = getSystem("test", {baseURL: testDir}));
  afterEach(() => removeSystem("test"));

  it("installs hooks", () =>
    Promise.resolve()
      .then(() => applyConfig(S, {lively: {hooks: [{target: "normalize", source: "(proceed, name, parent, parentAddress) => proceed(name + 'x', parent, parentAddress)"}]}}, "barr"))
      .then(_ => (S.defaultJSExtensions = true) && S.normalize("foo"))
      .then(n => expect(n).to.match(/foox.js$/)));

  it("installs meta data in package", async () => {
    var p = await applyConfig(S, {lively: {meta: {"foo": {format: "global"}}}}, "some-project-url");
    var pURL = S.decanonicalize("some-project-url/").replace(/\/$/, "")
    expect(S.getConfig().packages[pURL].meta).to.deep.equal({"foo": {format: "global"}});
  });

  it("installs absolute addressed meta data in System.meta", async () => {
    var testName = testDir + "foo";
    await applyConfig(S, {lively: {meta: {[testName]: {format: "global"}}}}, "some-project-url");
    expect(S.getConfig().packages).to.not.have.property("some-project-url")
    expect(S.getConfig().meta).property(testName).deep.equals({format: "global"});
  });

  it("can resolve .. in url", async () => {
    expect(S.decanonicalize("..", testDir + "foo/bar.js")).to.equal(testDir + "index.js")
    var result = await S.normalize("..", testDir + "foo/bar.js")
    expect(result).to.equal(testDir + "index.js");
  })
});

describe("mutual dependent packages", () => {

  var p1Dir = testDir + "p1/",
      p2Dir = testDir + "p2/",
      p1 = {
        "index.js": "export var x = 3; import { y } from 'p2';",
        "package.json": '{"name": "p1", "lively": {"packageMap": {"p2": "../p2"}}}'
      },
      p2 = {
        "index.js": "export var y = 2; import { x } from 'p1';",
        "package.json": '{"name": "p2", "lively": {"packageMap": {"p1": "../p1"}}}'
      },
      testResources = {p1, p2}

  var System;

  beforeEach(async () => {
    System = getSystem("test", {baseURL: testDir});
    await createFiles(testDir, testResources);
  });


  afterEach(async () => {
    removeSystem("test")
    await resource(testDir).remove();
  });


  it("can be imported", async () => {
    await getPackage(System, p1Dir).import()
    expect(module(System, `${p1Dir}index.js`).env().recorder).property("y").equals(2);
    expect(module(System, `${p2Dir}index.js`).recorder).property("x").equals(3);
  });

});