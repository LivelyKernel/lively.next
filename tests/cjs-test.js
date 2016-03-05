/*global require, before, after, beforeEach, afterEach, describe, it*/

var env = typeof module !== "undefined" && module.require ? module.require("../env") : window;
var chai = env.isCommonJS ? module.require("chai") : window.chai;
var chaiSubset = env.isCommonJS ? module.require("chai-subset") : window.chaiSubset;
var expect = chai.expect; chaiSubset && chai.use(chaiSubset);

var lang = env.lively.lang || lively.lang,
    vm, loadVM = require('../index-node').load;
    // vm = env.isCommonJS ? require('../index-node') : lively.vm;
    

// yet-another-cjs-module depends on another-cjs-module
// another-cjs-module depends on some-cjs-module

var module1, module2, module3, module1Full, module2Full, module3Full, parentModule;

describe("common-js modules", () => {

  before(() =>
    loadVM().then(_vm => {
      vm = _vm;
      vm.cjs.wrapModuleLoad();
      module1 = "./test-resources/cjs/module1";
      module2 = "./test-resources/cjs/module2";
      module3 = "./test-resources/cjs/module3";
      module1Full = vm.cjs.resolve(module1, __filename);
      module2Full = vm.cjs.resolve(module2, __filename);
      module3Full = vm.cjs.resolve(module3, __filename);
      parentModule = __filename;
    }));
  after(() => vm.cjs.unwrapModuleLoad());

  beforeEach(() => require(module1));
  afterEach(() => vm.cjs.forgetModule(module1));

  describe("module state", () => {

    it("captures internal module state", () => {
      expect(vm.cjs.envFor(module1))
        .deep.property('recorder.internalState').equals(23);
      expect(vm.cjs.envFor(module1))
        .deep.property('recorder.exports.state').equals(42);
    });
  });

  describe("eval", () => {
    it("evaluates inside of module", () =>
      vm.cjs.runEval("internalState", {targetModule: module1, parentModule: parentModule})
        .then(evalResult => expect(evalResult).property("value").equals(23)));
  });

  describe("reloading", () => {

    beforeEach(() => require(module3));
    afterEach(() => vm.cjs.forgetModule(module3));

    it("computes required modules of some module", () => {
      expect(vm.cjs.findRequirementsOf(module3)).to.deep.equal(
        [vm.cjs.resolve(module2Full), vm.cjs.resolve(module1Full), "fs"]);
    });

    it("computes dependent modules of some module", () => {
      expect(vm.cjs.findDependentsOf(module1)).to.deep.equal(
        [parentModule, vm.cjs.resolve(module2Full), vm.cjs.resolve(module3Full)]);
    });
    
    it("can reload module dependencies", () => {
      expect(require(module3).myVal).to.equal(44);
      // we change module1 and check that the value of module3 that indirectly
      // depends on module1 has changed as well
      return vm.cjs.sourceOf(module1, parentModule)
        .then(s => s.replace(/(externalState = )([0-9]+)/, "$123"))
        .then(s => vm.cjs.runEval(s, {targetModule: module1, parentModule: parentModule}))
        .then(() => vm.cjs.forgetModuleDeps(module1, parentModule))
        .then(() => expect(require(module3).myVal).to.equal(25))
    });
  });

});
