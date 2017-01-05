/*global beforeEach, afterEach, describe, it*/

import { string } from "lively.lang";
import { expect } from "mocha-es6";
import ObjectPackage, { ensureLocalPackage, addScript, ensureObjectClass } from "../object-classes.js";
import { createFiles, resource } from "lively.resources";
import { getSystem, removeSystem } from "lively.modules";
import { importPackage } from "lively.modules/src/packages.js";
import module from "lively.modules/src/module.js";


var testBaseURL = "local://object-scripting-test",
    project1Dir = testBaseURL + "/project1/",
    project1 = {
      "index.js": "export var x = 23;",
      "package.json": '{"name": "project1", "main": "index.js"}'
    },
    testResources = {
      "project1": project1,
    };

var S, opts;

describe("object package", function() {

  beforeEach(async () => {
    S = getSystem("test", {baseURL: testBaseURL});
    opts = {baseURL: testBaseURL, System: S};
    await createFiles(testBaseURL, testResources);
    await importPackage(S, "project1");
  });

  afterEach(() => {
    removeSystem("test");
    return resource(testBaseURL).remove();
  });

  it.only("ensure object package", async () => {
    var p = ObjectPackage.withIdAndObject("test-obj-package-" + string.newUUID(), null, opts);
    await p.ensureExistance();
    await p.objectModule.read()
    await p.resource("index.js").write("export var foo = 23");
    var {foo} = await p.load();
    expect(foo).equals(23);
  });

  it("creates object package with object-class for object", async () => {
    var obj = {name: "testObject"};
    var p = ObjectPackage.forObject(obj, opts);
    await p.ensureObjectClass();

    expect(obj.constructor.name).equals("TestObject");
    var {packageId} = obj[Symbol.for("lively-object-package-data")];
    expect(await resource(`${testBaseURL}/${packageId}/index.js`).read())
      .matches(/export default class TestObject/);
  });


  describe("addScript", () => {

    it("with simple object", async () => {
      var obj = {name: "testObject"};
      await addScript(obj, "function(a) { return a + 1; }", "foo", {baseURL: testBaseURL, System: S});
      expect(obj.foo(1)).equals(2);
      expect(obj.constructor.prototype.foo).equals(obj.foo, "not method of object class");
      await addScript(obj, "function(a) { return 22; }", "bar", {baseURL: testBaseURL, System: S});
      expect(obj.foo(1)).equals(2);
      expect(obj.bar()).equals(22);
    });

    it("of object with anonymouse class", () => {
      var obj = new (class { x() { return 23; }});
      expect(obj.x()).equals(23, "1");
      addScript(obj, "function(a) { return a + 1; }", "foo", {baseURL: testBaseURL, System: S});
      expect(obj.x()).equals(23, "2");
    });

  });

});
