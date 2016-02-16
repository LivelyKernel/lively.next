/*global process, beforeEach, afterEach, describe, it, expect*/

var env = typeof module !== "undefined" && module.require ? module.require("../env") : window;
var chai = env.isCommonJS ? module.require("chai") : window.chai;
var chaiSubset = env.isCommonJS ? module.require("chai-subset") : window.chaiSubset;
var expect = chai.expect; chaiSubset && chai.use(chaiSubset);
var lang = env.lively.lang || lively.lang, vm = env.isCommonJS ? require('../index') : lively.vm;
var Global = env.Global;

var es6, cjs = vm.cjs;

var module1 = "test-resources/some-es6-module.js";

describe("es6 modules", () => {

  beforeEach(function() {
    if (typeof require === "function") {
      console.log("??");
      cjs.reloadModule(cjs.resolve("systemjs"));
      es6 = require("../lib/es6-interface");
      es6.config({baseURL: '/Users/robert/Lively/lively-dev/lively.vm/tests/'});
    } else {
      es6 = vm.es6;
      // es6.config({baseURL: '/'});
      // es6.config({baseURL: '/tests', map: {babel: '../node_modules/babel-core/browser.js'}});
    }
    // es6.wrapModuleLoad();
  });

  // afterEach(() => {
  //   es6.unwrapModuleLoad();
  // });

  it("can be loaded", () =>
    es6.import(module1).then(m =>
      expect(m.x).equals(47)));

  // it("captures internal module state", () => {
  //   es6.import(module1).then(m =>
  //     console.log(cjs.envFor(module1)));

  //   // expect(cjs.envFor(module1))
  //   //   .deep.property('recorder.internalState').equals(23);
  //   // expect(cjs.envFor(module1))
  //   //   .deep.property('recorder.exports.state').equals(42);
  // });

//   // before(() => es6.wrapModuleLoad());
//   // after(() => es6.unwrapModuleLoad());
//   // beforeEach(() => require(moduleName));
//   // afterEach(() => es6.forgetModule(moduleName));

//   it("captures internal module state", function() {
//     expect(es6.envFor(moduleName))
//       .deep.property("recorder.internalState").equals(23);
//     expect(es6.envFor(moduleName))
//       .deep.property("recorder.export.state").equals(42);
//   });

//   it("evaluates inside of module", function() {
//     expect(es6.evalIn(moduleName, "internalState")).equals(23);
//   });

});
