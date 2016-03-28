/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { promise } from "lively.lang";
import { removeDir, createFiles } from "./helpers.js";

import { getSystem, removeSystem, moduleEnv } from "../src/system.js";
import { runEval } from "../src/eval.js";

var dir = System.normalizeSync("lively.modules/tests/"),
    testProjectDir = dir + "test-project-dir/",
    testProjectSpec = {
      "file1.js": "import { y } from './file2.js'; var z = 2; export var x = y + z;",
      "file2.js": "export var y = 1;",
      "package.json": '{"name": "test-project-1", "main": "file1.js"}',
    }


describe("eval", () => {

  var System;
  beforeEach(() => {
    System = getSystem("test", {baseURL: dir});
    return createFiles(testProjectDir, testProjectSpec)
      .then(() => System.import(testProjectDir + "file1.js"));
  });

  afterEach(() => {
    removeSystem("test");
    return removeDir(testProjectDir);
  });

  it("inside of module", () =>
    runEval(System, "1 + z + x", {targetModule: testProjectDir + "file1.js"})
      .then(result => expect(result.value).equals(6)));

  it("of export statement", () =>
    promise.chain([
      () => Promise.all([
        System.import(testProjectDir + "file1.js"),
        System.import(testProjectDir + "file2.js")]),
      ([m1, m2], state) => {
        state.m1 = m1; state.m2 = m2;
        expect(m1.x).to.equal(3);
        expect(m2.y).to.equal(1);
      },
        // Modify module1
      () => runEval(System, "export var y = 2;", {asString: true, targetModule: testProjectDir + "file2.js"}),
      (result, {m1, m2}) => {
        expect(result.value).to.not.match(/error/i);
        expect(m2.y).to.equal(2, "file2.js not updated");
        expect(m1.x).to.equal(4, "file1.js not updated after its dependency changed");
        return Promise.all([
          System.import(testProjectDir + "file1.js").then(m => expect(m.x).to.equal(4)),
          System.import(testProjectDir + "file2.js").then(m => expect(m.y).to.equal(2)),
        ]);
      }]));

  // it("of export statement with new export", () =>
  //   lang.promise.chain([
  //     () => Promise.all([es6.import(module1), es6.import(module2)]),
  //     (modules, state) => { state.m1 = modules[0]; state.m2 = modules[1]; },
  //     () => es6.runEval("export var foo = 3;", {asString: true, targetModule: module1}),
  //     (result, state) => {
  //       expect(result.value).to.not.match(/error/i);
  //       // Hmmm.... frozen modules require us to re-import... damn!
  //       // expect(state.m1.foo).to.equal(3, "foo not defined in module1 after eval");
  //       return es6.import(module1)
  //         .then((m1) => expect(m1.foo).to.equal(3, "foo not defined in module1 after eval"))
  //     },
  //     () => es6.runEval("export var foo = 5;", {asString: true, targetModule: module1}),
  //     (result, state) => {
  //       expect(result.value).to.not.match(/error/i);
  //       // expect(state.m1.foo).to.equal(5, "foo updated in module1 after re-eval");
  //       return es6.import(module1)
  //         .then((m1) => expect(m1.foo).to.equal(5, "foo updated in module1 after re-eval"))
  //     }]));

  // it("of import statement", () =>
  //   // test if import is transformed to lookup + if the imported module gets before eval
  //   lang.promise.chain([
  //     () => es6.runEval("import {y} from './module2.js'; y", {targetModule: module1}),
  //     (result, state) => {
  //       expect(result.value).to.not.match(/error/i);
  //       expect(result.value).to.equal(5, "imported value");
  //     }]))

  // it("of var being exported", () =>
  //   // Load module1 and module2 which depends on module1
  //   lang.promise.chain([
  //     () => Promise.all([es6.import(module1), es6.import(module2)]),
  //     (modules, state) => {
  //       state.m1 = modules[0]; state.m2 = modules[1];
  //       expect(state.m1.x).to.equal(3);
  //       expect(state.m2.y).to.equal(5);
  //     },
  //       // Modify module1
  //     () => es6.runEval("var x = 9;", {asString: true, targetModule: module1}),
  //     (result, state) => {
  //       expect(result.value).to.not.match(/error/i);
  //       expect(state.m1.x).to.equal(9, "module1 not updated");
  //       expect(state.m2.y).to.equal(11, "module2 not updated after its dependency changed");
  //       return Promise.all([
  //         es6.import(module1).then(m => expect(m.x).to.equal(9)),
  //         es6.import(module2).then(m => expect(m.y).to.equal(11)),
  //       ]);
  //     }]));

  // it("of new var that is exported and then changes", () =>
  //   es6.import(module1)
  //     // define a new var that is exported
  //     .then(_ => es6.runEval("var foo = 1; export { foo }", {asString: true, targetModule: module1}))
  //     .then(() => expect(es6._moduleRecordFor(module1).exports).to.have.property("foo", 1, "of record"))
  //     .then(() => es6.import(module1).then(m1 => expect(m1).to.have.property("foo", 1, "of module")))
  //     // now change that var and see if the export is updated
  //     .then(() => es6.runEval("var foo = 2;", {asString: true, targetModule: module1}))
  //     .then(() => expect(es6._moduleRecordFor(module1).exports).to.have.property("foo", 2, "of record after change"))
  //     .then(() => es6.import(module1).then(m1 => expect(m1).to.have.property("foo", 2, "of module after change"))));

});