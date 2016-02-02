/*global process, beforeEach, afterEach, describe, it, expect*/

var env = typeof module !== "undefined" && module.require ? module.require("../env") : window;
var chai = env.isCommonJS ? module.require("chai") : window.chai;
var chaiSubset = env.isCommonJS ? module.require("chai-subset") : window.chaiSubset;
var expect = chai.expect; chaiSubset && chai.use(chaiSubset);
var lang = env.lively.lang || lively.lang, vm = env.isCommonJS ? require('../index') : lively.vm;
var Global = env.Global;

var cjs = vm.cjs;
var moduleName = "./test-resources/some-cjs-module";

describe("common-js modules", () => {

  before(() => cjs.wrapModuleLoad());
  after(() => cjs.unwrapModuleLoad());
  beforeEach(() => require(moduleName));
  afterEach(() => cjs.forgetModule(moduleName));

  it("captures internal module state", function() {
    expect(cjs.envFor(moduleName))
      .deep.property("recorder.internalState").equals(23);
    expect(cjs.envFor(moduleName))
      .deep.property("recorder.module.exports.state").equals(42);
  });

  it("evaluates inside of module", function() {
    expect(cjs.evalIn(moduleName, "internalState")).equals(23);
  });

});
