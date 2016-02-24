/*global process, before, beforeEach, afterEach, describe, it, expect*/

var env = typeof module !== "undefined" && module.require ? module.require("../env") : window;
var chai = env.isCommonJS ? module.require("chai") : window.chai;
var chaiSubset = env.isCommonJS ? module.require("chai-subset") : window.chaiSubset;
var expect = chai.expect; chaiSubset && chai.use(chaiSubset);
var lang = env.lively.lang || lively.lang,
    vm = env.isCommonJS ? require('../index') : lively.vm;
var Global = env.Global;

var es6 = vm.es6;
var cjs = vm.cjs;

var cjsModule1 = "test-resources/es6-with-cjs/module1.js";
var cjsModule2 = "test-resources/cjs/module2.js";
var es6Module1 = "test-resources/es6/module1.js";
var es6Module2 = "test-resources/es6-with-cjs/module2.js";
var cjsModule1Id = cjs.resolve(cjsModule1, __filename);;

describe("es6 + node modules", () => {

  before(function() {
    es6._init({
      baseURL: env.isCommonJS ? 'tests/' : document.URL.replace(/\/[^\/]*$/, ""),
      transpiler: 'babel', babelOptions: {},
      map: env.isCommonJS ? {} : {babel: '../node_modules/babel-core/browser.js'}
    });
    es6.wrapModuleLoad();
    cjs.wrapModuleLoad();
  });

  beforeEach(() => {
    cjs.forgetModule(cjsModule1);
    es6.forgetModule(es6Module1);
  });

  describe("cjs loads es6", () => {
    
    it("succeeds", () =>
      lang.promise.delay(120, // wait for es6 module to be loaded
        cjs.import(cjsModule1Id).then(m => expect(m.x).to.equal(1)))
          .then(() => expect(cjs.envFor(cjsModule1Id).recorder.loaded).to.equal(true))
          .then(() => expect(es6.envFor(es6.resolve(es6Module1)).recorder.x).to.equal(3)));
  });

  describe("es6 loads cjs", () => {

    it("succeeds", () =>
      es6.import(es6Module2)
        .then(m => expect(m.y).to.equal(43))
        .then(() => expect(es6.envFor(es6.resolve(es6Module2)).recorder.val).to.equal(43))
        .then(() => expect(cjs.envFor(cjs.resolve(cjsModule2, __filename)).recorder.someVal).to.equal(43)));

  });

});
