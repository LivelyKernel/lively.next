/*global before, after, beforeEach, afterEach, describe, it*/

import { expect } from "chai";
import { es6 } from "lively.vm";
import lang from "lively.lang";
import { cjs } from "lively.vm";
import { Module } from "module";

// yet-another-cjs-module depends on another-cjs-module
// another-cjs-module depends on some-cjs-module

var module1, module2, module3, module1Full, module2Full, module3Full, parentModule;

var __filename = cjs.resolve("./cjs-test.js");

function require(id) {
  return Module._load(id, {id: __filename})
}

if (System.get("@system-env").node) {

describe("common-js modules", () => {

  before(() => {
    cjs.wrapModuleLoad();
    module1 = "./test-resources/cjs/module1";
    module2 = "./test-resources/cjs/module2";
    module3 = "./test-resources/cjs/module3";
    module1Full = cjs.resolve(module1, __filename);
    module2Full = cjs.resolve(module2, __filename);
    module3Full = cjs.resolve(module3, __filename);
    parentModule = __filename;
  });
  after(() => cjs.unwrapModuleLoad());

  beforeEach(() => require(module1));
  afterEach(() => cjs.forgetModule(module1));

  describe("module state", () => {

    it("captures internal module state", () => {
      expect(cjs.envFor(module1))
        .deep.property('recorder.internalState').equals(23);
      expect(cjs.envFor(module1))
        .deep.property('recorder.exports.state').equals(42);
    });
  });

  describe("eval", () => {
    it("evaluates inside of module", () =>
      cjs.runEval("internalState", {targetModule: module1, parentModule: parentModule})
        .then(evalResult => expect(evalResult).property("value").equals(23)));
  });

  describe("reloading", () => {

    beforeEach(() => require(module3));
    afterEach(() => cjs.forgetModule(module3));

    it("computes required modules of some module", () => {
      expect(cjs.findRequirementsOf(module3)).to.deep.equal(
        [cjs.resolve(module2Full), cjs.resolve(module1Full), "fs"]);
    });

    it("computes dependent modules of some module", () => {
      expect(cjs.findDependentsOf(module1)).to.deep.equal(
        [parentModule, cjs.resolve(module2Full), cjs.resolve(module3Full)]);
    });
    
    it("can reload module dependencies", () => {
      expect(require(module3).myVal).to.equal(44);
      // we change module1 and check that the value of module3 that indirectly
      // depends on module1 has changed as well
      return cjs.sourceOf(module1, parentModule)
        .then(s => s.replace(/(externalState = )([0-9]+)/, "$123"))
        .then(s => cjs.runEval(s, {targetModule: module1, parentModule: parentModule}))
        .then(() => cjs.forgetModuleDeps(module1, parentModule))
        .then(() => expect(require(module3).myVal).to.equal(25))
    });
  });

});
  
}
