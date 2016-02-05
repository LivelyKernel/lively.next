/*global require, before, after, beforeEach, afterEach, describe, it*/

var env = typeof module !== "undefined" && module.require ? module.require("../env") : window;
var chai = env.isCommonJS ? module.require("chai") : window.chai;
var chaiSubset = env.isCommonJS ? module.require("chai-subset") : window.chaiSubset;
var expect = chai.expect; chaiSubset && chai.use(chaiSubset);

var lang = env.lively.lang || lively.lang,
    vm = env.isCommonJS ? require('../index') : lively.vm;

describe("common-js modules", () => {

  var moduleName = "./test-resources/some-cjs-module";

  before(() => vm.cjs.wrapModuleLoad());
  after(() => vm.cjs.unwrapModuleLoad());
  beforeEach(() => require(moduleName));
  afterEach(() => vm.cjs.forgetModule(moduleName));

  describe("module state", () => {
    it("captures internal module state", () => {
      expect(vm.cjs.envFor(moduleName))
        .deep.property('recorder.internalState').equals(23);
      expect(vm.cjs.envFor(moduleName))
        .deep.property('recorder.module.exports.state').equals(42);
    });
  });

  describe("eval", () => {
    it("evaluates inside of module", () =>
      vm.cjs.evalIn(moduleName, "internalState")
        .then(evalResult => expect(evalResult).property("value").equals(23)));
  });

  describe("eval + print", () => {
    it("asString", () =>
      vm.cjs.evalInAndPrint("3 + 4", moduleName, {asString: true})
        .then(printed => console.log(printed) || expect(printed).equals("7")));

    it("inspect", () =>
      vm.cjs.evalInAndPrint(
        "({foo: {bar: {baz: 42}, zork: 'graul'}})", moduleName,{inspect: true, printDepth: 2})
          .then(printed => expect(printed).equals("{\n  foo: {\n    bar: {/*...*/},\n    zork: \"graul\"\n  }\n}")));

    it("prints promises", () =>
      vm.cjs.evalInAndPrint(
        "Promise.resolve(23)", moduleName, {asString: true})
          .then(printed => expect(printed).equals('Promise({status: "fulfilled", value: 23})')));
  });

});
