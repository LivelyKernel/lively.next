/*global process, beforeEach, afterEach, describe, it, expect*/

var env = typeof module !== "undefined" && module.require ? module.require("../env") : window;
var chai = env.isCommonJS ? module.require("chai") : window.chai;
var chaiSubset = env.isCommonJS ? module.require("chai-subset") : window.chaiSubset;
var expect = chai.expect; chaiSubset && chai.use(chaiSubset);
var lang = env.lively.lang || lively.lang, vm = env.isCommonJS ? require('../index') : lively.vm;
var Global = env.Global;

var cjs = vm.cjs;

describe("common-js modules", () => {

// /*global require, process, before, after, beforeEach, afterEach, describe, it, expect, global*/

// var chai = require("chai");
// var chaiSubset = require("chai-subset")
// var expect = chai.expect; chai.use(chaiSubset);
// var lang = require("lively.lang");
// var fs = require("fs");
// var evaluator = require("../lib/evaluator");

  var moduleName = "./test-resources/some-cjs-module";

  before(() => cjs.wrapModuleLoad());
  after(() => cjs.unwrapModuleLoad());
  beforeEach(() => require(moduleName));
  afterEach(() => delete require.cache[require.resolve(moduleName)]);

  it("captures internal module state", function() {
    expect(cjs.envFor(moduleName))
      .deep.property("recorder.internalState")
      .equals(23);
  });

  it("evaluates inside of module", function() {
    expect(cjs.evalIn(moduleName, "internalState")).equals(23);
  });

});
