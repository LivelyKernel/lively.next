/*global process, before, beforeEach, afterEach, describe, it, expect*/

var env = typeof module !== "undefined" && module.require ? module.require("../env") : window;
var chai = env.isCommonJS ? module.require("chai") : window.chai;
var chaiSubset = env.isCommonJS ? module.require("chai-subset") : window.chaiSubset;
var expect = chai.expect; chaiSubset && chai.use(chaiSubset);
var lang = env.lively.lang || lively.lang, vm = env.isCommonJS ? require('../index') : lively.vm;
var Global = env.Global;
// if (typeof mocha === "undefined") {
//     var mocha = global.mocha = new (require("mocha"))();
//     mocha.suite.emit('pre-require', global, __filename, mocha);
//     mocha.suite.emit('require', module.exports, __filename, mocha);
//     mocha.suite.emit('post-require', global, __filename, mocha);
//     // mocha.run()
// }

var es6 = vm.es6;

var module1 = "test-resources/some-es6-module.js";
var module2 = "test-resources/another-es6-module.js";
var module3 = "test-resources/yet-another-es6-module.js";

describe("es6 modules", () => {

  before(function() {
    if (typeof require === "function") {
      // vm.cjs.reloadModule(vm.cjs.resolve("systemjs"));
      es6.config({baseURL: 'tests/'});
    } else {
      es6.config({
        transpiler: 'babel', babelOptions: {},
        baseURL: document.URL.replace(/\/[^\/]*$/, ""),
        map: {babel: '../node_modules/babel-core/browser.js'}
      });
    }
    es6.wrapModuleLoad();
  });

  afterEach(() => es6.forgetModule(module1));

  it("can be loaded", () =>
    es6.import(module1).then(m => expect(m.x).equals(3)));

  it("captures internal module state", () =>
    Promise.all([es6.import(module1), es6.resolve(module1)])
      .then((exportsAndName) =>
        expect(es6.envFor(exportsAndName[1]))
          .deep.property('recorder.internalState').equals(1)));


  describe("eval", () => {

    it("inside of module", () =>
      es6.runEval("2 + internalState", {targetModule: module1})
        .then(result => expect(result.value).equals(3)));

    it("of export statement", () =>
      // Load module1 and module2 which depends on module1
      lang.promise.chain([
        () => Promise.all([es6.import(module1), es6.import(module2)]),
        (modules, state) => {
          state.m1 = modules[0]; state.m2 = modules[1];
          expect(state.m1.x).to.equal(3);
          expect(state.m2.y).to.equal(5);
        },
          // Modify module1
        () => es6.runEval("export var x = 9;", {asString: true, targetModule: module1}),
        (result, state) => {
          expect(result.value).to.not.match(/error/i);
          expect(state.m1.x).to.equal(9, "module1 not updated");
          expect(state.m2.y).to.equal(11, "module2 not updated after its dependency changed");
          return Promise.all([
            es6.import(module1).then(m => expect(m.x).to.equal(9)),
            es6.import(module2).then(m => expect(m.y).to.equal(11)),
          ]);
        }]));

    it("of export statement with new export", () =>
      lang.promise.chain([
        () => Promise.all([es6.import(module1), es6.import(module2)]),
        (modules, state) => { state.m1 = modules[0]; state.m2 = modules[1]; },
        () => es6.runEval("export var foo = 3;", {asString: true, targetModule: module1}),
        (result, state) => {
          expect(result.value).to.not.match(/error/i);
          expect(state.m1.foo).to.equal(3, "foo not defined in module1 after eval");
        },
        () => es6.runEval("export var foo = 5;", {asString: true, targetModule: module1}),
        (result, state) => {
          expect(result.value).to.not.match(/error/i);
          expect(state.m1.foo).to.equal(5, "foo updated in module1 after re-eval");
        }]));

  });

  describe("dependencies", () => {

    it("computes required modules of some module", () =>
      es6.import(module3).then(() => {
        expect(es6.findRequirementsOf(module3)).to.deep.equal(
          [es6.resolve(module2), es6.resolve(module1)]);
      }));

    it("computes dependent modules of some module", () =>
      es6.import(module3).then(() => {
        expect(es6.findDependentsOf(module1)).to.deep.equal(
          [es6.resolve(module2), es6.resolve(module3)]);
        }));

  });

  describe("reloading", () => {

    beforeEach(() => es6.import(module3));
    // afterEach(() => cjs.forgetModule(module3));

    it("computes required modules of some module", () => {
      expect(es6.findRequirementsOf(module3)).to.deep.equal(
        [es6.resolve(module2), es6.resolve(module1)]);
    });

    it("computes dependent modules of some module", () => {
      expect(es6.findDependentsOf(module1)).to.deep.equal(
        [es6.resolve(module2), es6.resolve(module3)]);
    });

    it("can reload module dependencies", () => {
      return es6.import(module3)
        .then(m => expect(m.z).to.equal(147))
      // we change module1 and check that the value of module3 that indirectly
      // depends on module1 has changed as well
        .then(() => es6.sourceOf(module1))
        // es6.sourceOf("tests/" + module1)
        .then(s => s.replace(/(internalState = )([0-9]+)/, "$142"))
        .then(s => es6.runEval(s, {asString: true, targetModule: module1}))
        .then(result => expect(result.value).to.not.match(/error/i))
        .then(() => es6.forgetModuleDeps(module1))
        .then(() => es6.import(module3))
        .then(m => expect(m.z).to.equal(25));
    });
  });

});
