/*global beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { initializeClass } from "../runtime.js";
import "../properties.js";
import { resource, createFiles } from "lively.resources";
import { module } from "lively.modules";

// FIXME ???
var m = lively.modules.module("lively.classes/properties.js")
var  {
  prepareClassForProperties,
  prepareInstanceForProperties,
  propertiesAndSettingsInHierarchyOf
} = m.recorder;


let spec = {
  "module1.js": "import {B} from './module2.js'; export class A { constructor() { this.x = 3; } }",
  "module2.js": "import {A} from './module1.js'; export class B extends A {}",
  "module3.js": "import {D} from './module4.js'; export class C { constructor() { this.x = 3; } }",
  "module4.js": "import {C} from './module3.js'; export class D extends C {}; export class E extends D {}"
}

let testDir = resource("local://classesinmoduletest/")

describe("circular module deps", function() {

  beforeEach(async () => {
    await createFiles(testDir, spec);
  });

  afterEach(async () => {
    await testDir.remove()
    await module(testDir.join("module1.js").url).unload();
    await module(testDir.join("module2.js").url).unload();
    await module(testDir.join("module3.js").url).unload();
    await module(testDir.join("module4.js").url).unload();
  });

  it("constructor method of superclass that gets loaded later works", async () => {
    let { A } = await module(testDir.join("module1.js").url).load(),
        { B } = await module(testDir.join("module2.js").url).load();
    expect(B.prototype[Symbol.for("lively-instance-initialize")])
      .equals(A.prototype[Symbol.for("lively-instance-initialize")]);
    expect(new B().x).equals(3);
  });

  it("two classes", async () => {
    let { C } = await module(testDir.join("module3.js").url).load(),
        { D } = await module(testDir.join("module4.js").url).load();
    expect(D.prototype[Symbol.for("lively-instance-initialize")])
      .equals(C.prototype[Symbol.for("lively-instance-initialize")]);
    expect(new D().x).equals(3);
  });

});

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

let modules;

async function defineModule(modName, modSource) {
  let m = module(testDir.join(modName).url);
  if (modName in modules) await m.changeSource(modSource, {doSave: true,doEval: true})
  else {
    modules[modName] = m;
    await resource(m.id).write(modSource);
    await module(testDir.join(modName).url).load();
  }
}

async function evalIn(modName, modSource) {
  let {value} = await lively.vm.runEval(modSource, {targetModule: testDir.join(modName).url});
  return value;
}

describe("inheritance updates", () => {

  beforeEach(async () => {
    modules = {};
    await resource(testDir).ensureExistance();
  });

  afterEach(async () => {
    for (let name in modules) await modules[name].unload()
    await resource(testDir).remove();
  });

  it("subclass gets members when superclass changes", async () => {
    await defineModule("module1.js", "export class A {}");
    await defineModule("module2.js", "import {A} from './module1.js'; class B extends A {}");
    let obj = await evalIn("module2.js", "new B()");
    expect(obj).not.have.key("someMethod");
    await defineModule("module1.js", "export class A {someMethod() { return 23; }}");
    expect(obj.someMethod()).equals(23);
  });

  it("subclass updated when superclass member removed", async () => {
    await defineModule("module1.js", "export class A {someMethod() { return 23; }}");
    await defineModule("module2.js", "import {A} from './module1.js'; class B extends A {}");
    let obj = await evalIn("module2.js", "new B()");
    expect(obj.someMethod()).equals(23);
    await defineModule("module1.js", "export class A {}");
    expect(obj).not.have.key("someMethod");
  });

  it("subclass updated when superclass becomes available", async () => {
    await defineModule("module1.js", "export var A = undefined");
    await defineModule("module2.js", "import {A} from './module1.js'; class B extends A {}");
    await defineModule("module1.js", "export class A {someMethod() { return 23; }}");
    let obj = await evalIn("module2.js", "new B()");
    let A = await evalIn("module1.js", "A");
    expect(obj.someMethod()).equals(23);
    expect(obj).instanceOf(A);
  });

  describe("properties", () => {

    it("properties defined later reach subclass", async () => {
      await defineModule("module1.js", "export class A {}");
      await defineModule("module2.js", "import {A} from './module1.js'; class B extends A {}");
      let obj = await evalIn("module2.js", "new B()");
      await defineModule("module1.js", "export class A {static get properties() { return {test: {get() { return 3; }}} }}");
      expect(obj.test).equals(3);
    });

    it("properties removed later reach subclass", async () => {
      await defineModule("module1.js", "export class A {static get properties() { return {test: {get() { return 3; }}} }}");
      await defineModule("module2.js", "import {A} from './module1.js'; class B extends A {}");
      let obj = await evalIn("module2.js", "new B()");
      await defineModule("module1.js", "export class A {static get properties() { return {} }}");
      expect(obj).not.have.property("test");
    });

    it("properties updated in subclass", async () => {
      await defineModule("module1.js", "export class A {static get properties() { return {test: {get() { return 3; }}} }}");
      await defineModule("module2.js", "import {A} from './module1.js'; class B extends A {}");
      let obj = await evalIn("module2.js", "new B()");
      await defineModule("module1.js", "export class A {static get properties() { return {test: {get() { return 4; }}} }}");
      expect(obj.test).equals(4);
    });

  });

});
