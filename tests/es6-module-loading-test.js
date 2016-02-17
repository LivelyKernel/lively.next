/*global process, beforeEach, afterEach, describe, it, expect*/

var env = typeof module !== "undefined" && module.require ? module.require("../env") : window;
var chai = env.isCommonJS ? module.require("chai") : window.chai;
var chaiSubset = env.isCommonJS ? module.require("chai-subset") : window.chaiSubset;
var expect = chai.expect; chaiSubset && chai.use(chaiSubset);
var lang = env.lively.lang || lively.lang, vm = env.isCommonJS ? require('../index') : lively.vm;
var Global = env.Global;

var es6 = vm.es6, cjs = vm.cjs;

var module1 = "test-resources/some-es6-module.js";

describe("es6 modules", () => {

  beforeEach(function() {
    es6.config({baseURL: '/Users/robert/Lively/lively-dev/lively.vm/tests/'});

    if (typeof require === "function") {
      cjs.reloadModule(cjs.resolve("systemjs"));
      // es6 = require("../lib/es6-interface");
      // es6.config({baseURL: '/Users/robert/Lively/lively-dev/lively.vm/tests/'});
    } else {
      // es6 = vm.es6;
      // es6.config({baseURL: '/'});
      // es6.config({baseURL: '/tests', map: {babel: '../node_modules/babel-core/browser.js'}});
    }
    // if (System.loads) delete System.loads["file:///Users/robert/Lively/lively-dev/lively.vm/tests/test-resources/some-es6-module.js"];
    // System.delete("file:///Users/robert/Lively/lively-dev/lively.vm/tests/test-resources/some-es6-module.js");
    es6.wrapModuleLoad();
  });

  afterEach(() => {
    es6.unwrapModuleLoad();
  });

  it("can be loaded", () =>
    es6.import(module1).then(m => expect(m.x).equals(47)));

  it("captures internal module state", () =>
    Promise.all([es6.import(module1), es6.resolve(module1)])
      .then((exportsAndName) =>
        expect(es6.envFor(exportsAndName[1]))
          .deep.property('recorder.internalState').equals(23)));


  it("evaluates inside of module", () =>
    es6.runEval("2 + internalState", {targetModule: module1})
      .then(result => expect(result.value).equals(25)));

});



// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// describe("common-js modules", () => {

//   beforeEach(() => require(module1));
//   afterEach(() => cjs.forgetModule(module1));

//   describe("module state", () => {

//     it("captures internal module state", () => {
//       expect(cjs.envFor(module1))
//         .deep.property('recorder.internalState').equals(23);
//       expect(cjs.envFor(module1))
//         .deep.property('recorder.exports.state').equals(42);
//     });
//   });

//   describe("eval", () => {
//     it("evaluates inside of module", () =>
//       cjs.runEval("internalState", {targetModule: module1, parentModule: parentModule})
//         .then(evalResult => expect(evalResult).property("value").equals(23)));
//   });

//   describe("eval + print", () => {

//     it("asString", () =>
//       cjs.runEval("3 + 4", {targetModule: module1, parentModule: parentModule, printed: {asString: true}})
//         .then(printed => console.log(printed) || expect(printed).to.containSubset({value: "7"})));

//     it("inspect", () =>
//       cjs.runEval(
//         "({foo: {bar: {baz: 42}, zork: 'graul'}})",
//         {targetModule: module1, parentModule: parentModule, printed: {inspect: true, printDepth: 2}})
//           .then(printed => expect(printed).to.containSubset({value: "{\n  foo: {\n    bar: {/*...*/},\n    zork: \"graul\"\n  }\n}"})));

//     it("prints promises", () =>
//       cjs.runEval(
//         "Promise.resolve(23)", {targetModule: module1, parentModule: parentModule, printed: {asString: true}})
//           .then(printed => expect(printed).to.containSubset({value: 'Promise({status: "fulfilled", value: 23})'})));
//   });

//   describe("reloading", () => {

//     beforeEach(() => require(module3));
//     afterEach(() => cjs.forgetModule(module3));

//     it("computes required modules of some module", () => {
//       expect(cjs.findRequirementsOf(module3)).to.deep.equal(
//         [cjs.resolve(module2Full), cjs.resolve(module1Full), "fs"]);
//     });

//     it("computes dependent modules of some module", () => {
//       expect(cjs.findDependentsOf(module1)).to.deep.equal(
//         [parentModule, cjs.resolve(module2Full), cjs.resolve(module3Full)]);
//     });
    
//     it("can reload module dependencies", () => {
//       expect(require(module3).myVal).to.equal(44);
//       // we change module1 and check that the value of module3 that indirectly
//       // depends on module1 has changed as well
//       return cjs.sourceOf(module1, parentModule)
//         .then(s => s.replace(/(externalState = )([0-9]+)/, "$123"))
//         .then(s => cjs.runEval(s, {targetModule: module1, parentModule: parentModule}))
//         .then(() => cjs.forgetModuleDeps(module1, parentModule))
//         .then(() => expect(require(module3).myVal).to.equal(25))
//     });
//   });

// });
