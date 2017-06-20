/*global beforeEach, afterEach, describe, it*/

import { string } from "lively.lang";
import { expect } from "mocha-es6";
import ObjectPackage, { ensureLocalPackage, addScript, ensureObjectClass } from "../object-classes.js";
import { createFiles, resource } from "lively.resources";
import { getSystem, registerPackage, removeSystem } from "lively.modules";
import { importPackage, lookupPackage } from "lively.modules/src/packages/package.js";
import module from "lively.modules/src/module.js";
import { RuntimeSourceDescriptor } from "../source-descriptors.js";


var testBaseURL = "local://object-scripting-test",
    project1Dir = testBaseURL + "/project1/",
    project1 = {
      "index.js": "export var x = 23;",
      "file1.js": "export class Foo {}",
      "file2.js": "export default class Bar {}",
      "package.json": '{"name": "project1", "main": "index.js"}'
    },
    testResources = {
      "project1": project1,
    };

var S, opts, packagesToRemove;

describe("object package", function() {

  beforeEach(async () => {
    S = getSystem("test", {baseURL: testBaseURL});
    opts = {baseURL: testBaseURL, System: S};
    await createFiles(testBaseURL, testResources);
    await importPackage(S, "project1");
    packagesToRemove = [];
  });

  afterEach(async () => {
    removeSystem("test");
    await Promise.all(packagesToRemove.map(ea => ea.remove()));
    return resource(testBaseURL).remove();
  });

  it("ensure object package", async () => {
    let p = ObjectPackage.withId("test-obj-package-" + string.newUUID(), opts);
    packagesToRemove.push(p);
    await p.ensureExistance();
    await p.objectModule.read();
    await p.resource("index.js").write("export let foo = 23");
    let {foo} = await p.load();
    expect(foo).equals(23);
    expect(ObjectPackage.forSystemPackage(p.systemPackage))
      .equals(p, "cannot retrieve package for system package")
  });

  it("creates object package with object-class for object", async () => {
    let obj = {name: "testObject"},
        p = ObjectPackage.withId("package-for-test", opts);
    packagesToRemove.push(p);
    await p.adoptObject(obj);
    expect(obj.constructor.name).equals("PackageForTest");
    let {id} = ObjectPackage.lookupPackageForObject(obj, opts);
    expect(await resource(`${testBaseURL}/${id}/index.js`).read())
      .matches(/export default class PackageForTest/);
  });

  it("imports superclass of object class", async () => {
    let m = await module(S, project1Dir + "file1.js").load(),
        obj = Object.assign(new m.Foo(), {name: "testObject"}),
        p = ObjectPackage.withId("package-for-test", opts);
    packagesToRemove.push(p);
    await p.adoptObject(obj);

    let {id} = ObjectPackage.lookupPackageForObject(obj, opts),
        source = await resource(`${testBaseURL}/${id}/index.js`).read();
    expect(source).matches(/import \{ Foo \} from/);
    expect(source).matches(/export default class PackageForTest/);
  });

  describe("addScript", () => {

    it("with simple object", async () => {
      let obj = {name: "testObject"},
          p = ObjectPackage.withId("package-for-test", opts);
      packagesToRemove.push(p);
      await p.adoptObject(obj);
      ObjectPackage.lookupPackageForObject(obj)
      await addScript(obj, "function(a) { return a + 1; }", "foo", {baseURL: testBaseURL, System: S});
      expect(obj.foo(1)).equals(2);
      expect(obj.constructor.prototype.foo).equals(obj.foo, "not method of object class");
      await addScript(obj, "function(a) { return 22; }", "bar", {baseURL: testBaseURL, System: S});
      expect(obj.foo(1)).equals(2);
      expect(obj.bar()).equals(22);
    });

    it("of object with anonymouse class", async () => {
      var obj = new (class { x() { return 23; }}),
          p = ObjectPackage.withId("package-for-test", opts);
      packagesToRemove.push(p);
      await p.adoptObject(obj);
      expect(obj.x()).equals(23, "1");
      addScript(obj, "function(a) { return a + 1; }", "foo", {baseURL: testBaseURL, System: S});
      expect(obj.x()).equals(23, "2");
    });

    xit("rename object package", async () => {
      var obj = new (class { x() { return 23; }}),
          p = ObjectPackage.withId("package-for-test", opts);
      packagesToRemove.push(p);
      await p.adoptObject(obj);
      await p.rename("package-for-test-2");

      expect(obj.constructor.name).equals("PackageForTest2");
      expect(p.id).equals("package-for-test-2");
      expect(ObjectPackage.withId("package-for-test-2", opts)).equals(p);
      expect(await resource(`${testBaseURL}/${p.id}/index.js`).read())
        .matches(/export default class PackageForTest2/);
      expect(await resource(`${testBaseURL}/${p.id}/package.json`).read())
        .matches(/"name": "package-for-test-2"/);
    });

    it("rename object class", async () => {
      var obj = new (class { x() { return 23; }}),
          p = ObjectPackage.withId("package-for-test", opts);
      packagesToRemove.push(p);
      await p.adoptObject(obj);
      await p.renameObjectClass("PackageForTest2", [obj]);
      expect(p.objectClass.name).equals("PackageForTest2", "class name not changed");
      expect(obj.constructor).equals(p.objectClass, "class of instance not changed");
      expect(await p.objectModule.read()).match(/class PackageForTest2/, "source not changed");
    });

  });

  describe("forking", () => {

    it("forks from package", async () => {
      let obj = {name: "testObject"},
          p = ObjectPackage.withId("TestObject", opts);
      await p.adoptObject(obj);

      await addScript(obj, "function() { return 1; }", "foo", {...opts, package: p});
      expect(obj.foo()).equals(1, "obj.foo 1");
      // let obj2 = new obj.constructor();
      // expect(obj2.foo()).equals(1, "obj2.foo 1");

      var p2 = await p.fork("TestObject2", opts);
      expect(p2.objectClass.name).equals("TestObject2");
      await p2.adoptObject(obj)
      expect(obj.constructor).equals(p2.objectClass);
      expect(obj.foo()).equals(1, "obj.foo 1");
    });

  });

});
