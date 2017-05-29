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
  "module2.js": "import {A} from './module1.js'; export class B extends A {}"
}

let testDir = resource("local://classesinmoduletest/")

describe("circular module deps", function() {

  beforeEach(async () => {
    await createFiles(testDir, spec);
    await module(testDir.join("module1.js").url).unload();
    await module(testDir.join("module2.js").url).unload();
  });

  afterEach(() => testDir.remove());

  it("constructor method of superclass that gets loaded later works", async () => {
    // let { B } = await module(testDir.join("module2.js").url).load(),
    //     { A } = await module(testDir.join("module1.js").url).load();
    let { A } = await module(testDir.join("module1.js").url).load(),
        { B } = await module(testDir.join("module2.js").url).load();
    expect(B.prototype[Symbol.for("lively-instance-initialize")])
      .equals(A.prototype[Symbol.for("lively-instance-initialize")]);
    expect(new B().x).equals(3);
  });

});
