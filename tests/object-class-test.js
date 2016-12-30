/*global beforeEach, afterEach, describe, it*/

import { string } from "lively.lang";
import { expect } from "mocha-es6";
import { ensureLocalPackage, addScript, ensureObjectClass } from "../object-classes.js";
import { resource } from "lively.resources";
import { importPackage, removePackage, getPackage } from "lively.modules";


var testBaseURL = "local://object-scripting-test";

var cleanupFns;

describe("object package", function() {

  beforeEach(() => cleanupFns = []);
  afterEach(async () => {
    cleanupFns.forEach(ea => { try { ea(); } catch (e) {} });
    await resource(testBaseURL).remove();
  });

  it("ensure object package", async () => {
    cleanupFns.push(() => removePackage(packageId));
    var packageId = "test-obj-package-" + string.newUUID(),
        packageURL = await ensureLocalPackage(packageId, {baseURL: testBaseURL});
    await resource(packageURL).join("/index.js").write("export var foo = 23");
    var {foo} = await importPackage(packageURL);
    expect(foo).equals(23);
  });

  it("creates object package with object-class for object", async () => {
    var obj = {name: "testObject"};
    await ensureObjectClass(obj, {baseURL: testBaseURL});
    expect(obj.constructor.name).equals("TestObject");
    var {packageId} = obj[Symbol.for("lively-object-package-data")];
    expect(await resource(`${testBaseURL}/${packageId}/index.js`).read())
      .matches(/export default class TestObject/)
  });
  
  it("addScript", () => {
    var obj = {name: "testObject"};
    addScript(obj, "function(a) { return a + 1; }", "foo", {baseURL: testBaseURL});
    expect(obj.foo(1)).equals(2);
    expect(obj.constructor.prototype.foo).equals(obj.foo, "not method of object class");
    addScript(obj, "function(a) { return 22; }", "bar", {baseURL: testBaseURL});
    expect(obj.foo(1)).equals(2);
    expect(obj.bar()).equals(22);
  });

});
