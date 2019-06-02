/*global beforeEach, afterEach, describe, it*/
import { expect } from "mocha-es6";

import { getSystem, removeSystem } from "../src/system.js";
import { install as installHook, remove as removeHook, isInstalled as isHookInstalled } from "../src/hooks.js";

describe("hooks", () => {

  var System;
  beforeEach(() => System = getSystem("test"));
  afterEach(() => removeSystem("test"));

  it("install normalize hook", () => {
    var hook = (proceed, name, parent) => (name === 'foo' && parent === 'bar' ? Promise.resolve('123') : proceed(name, parent));
    installHook(System, "normalize", hook);
    return Promise.all([
        System.normalize("foo", "bar").then(n => expect(n).to.equal("123", "install issue")),
        System.normalize("foo").then(n => expect(n).to.equal(System.baseURL + "foo"))]);
  });

  it("remove normalize hook", () => {
    var hook = (proceed, name, parent) => (name === 'foo' && parent === 'bar' ? Promise.resolve('123') : proceed(name, parent))
    installHook(System, "normalize", hook);
    removeHook(System, "normalize", hook);
    return System.normalize("foo", "bar").then(n => expect(n).to.equal(System.baseURL + "foo", "remove issue"));
  });

  it("remove normalize hook by name", () => {
    function hook(proceed, name, parent) { return name === 'foo' && parent === 'bar' ? Promise.resolve('123') : proceed(name, parent); }
    installHook(System, "normalize", hook);
    removeHook(System, "normalize", "hook");
    return System.normalize("foo", "bar").then(n => expect(n).to.equal(System.baseURL + "foo", "remove issue"));
  });

  it("hook installed test", () => {
    function hook(proceed, name, parent) { return proceed(name, parent); }
    installHook(System, "normalize", hook);
    expect(isHookInstalled(System, "normalize", "hook")).to.equal(true);
  });
});
