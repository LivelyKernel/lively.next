/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { promise } from "lively.lang";
import { removeDir, createFiles } from "./helpers.js";

import { getSystem, removeSystem, moduleEnv, moduleRecordFor } from "../src/system.js";
import { runEval } from "../src/eval.js";

var dir = System.normalizeSync("lively.modules/tests/"),
    testProjectDir = dir + "test-project-dir/",
    testProjectSpec = {
      "file1.js": "import { y } from './file2.js'; var z = 2; export var x = y + z;",
      "file2.js": "export var y = 1;",
      "file3.js": "export var bar = 5;",
      "package.json": '{"name": "test-project-1", "main": "file1.js"}',
    },
    module1 = testProjectDir + "file1.js",
    module2 = testProjectDir + "file2.js",
    module3 = testProjectDir + "file3.js";


describe("eval", () => {

  var System;
  beforeEach(() => {
    System = getSystem("test", {baseURL: dir});
    return createFiles(testProjectDir, testProjectSpec)
      .then(() => System.import(module1));
  });

  afterEach(() => {
    removeSystem("test");
    return removeDir(testProjectDir);
  });

  it("inside of module", () =>
    runEval(System, "1 + z + x", {targetModule: module1})
      .then(result => expect(result.value).equals(6)));

  it("of export statement", () =>
    promise.chain([
      () => Promise.all([System.import(module1), System.import(module2)]),
      ([m1, m2], state) => {
        state.m1 = m1; state.m2 = m2;
        expect(m1.x).to.equal(3);
        expect(m2.y).to.equal(1);
      },
        // Modify module1
      () => runEval(System, "export var y = 2;", {asString: true, targetModule: module2}),
      (result, {m1, m2}) => {
        expect(result.value).to.not.match(/error/i);
        expect(m2.y).to.equal(2, "file2.js not updated");
        expect(m1.x).to.equal(4, "file1.js not updated after its dependency changed");
        return Promise.all([
          System.import(module1).then(m => expect(m.x).to.equal(4)),
          System.import(module2).then(m => expect(m.y).to.equal(2)),
        ]);
      }]));

  it("of var being exported", () =>
    promise.chain([
      () => Promise.all([System.import(module1), System.import(module2)]),
      ([m1, m2], state) => {
        state.m1 = m1; state.m2 = m2;
        expect(m1.x).to.equal(3);
        expect(m2.y).to.equal(1);
      },
        // Modify module1
      () => runEval(System, "var y = 2;", {asString: true, targetModule: module2}),
      (result, {m1, m2}) => {
        expect(result.value).to.not.match(/error/i);
        expect(m2.y).to.equal(2, "file2.js not updated");
        expect(m1.x).to.equal(4, "file1.js not updated after its dependency changed");
        return Promise.all([
          System.import(module1).then(m => expect(m.x).to.equal(4)),
          System.import(module2).then(m => expect(m.y).to.equal(2)),
        ]);
      }]));

  it("of new var that is exported and then changes", () =>
    System.import(module1)
      // define a new var that is exported
      .then(_ => runEval(System, "var zork = 1; export { zork }", {asString: true, targetModule: module1}))
      .then(() => expect(moduleRecordFor(System, module1).exports).to.have.property("zork", 1, "of record"))
      .then(() => System.import(module1).then(m1 => expect(m1).to.have.property("zork", 1, "of module")))
      // now change that var and see if the export is updated
      .then(() => runEval(System, "var zork = 2;", {asString: true, targetModule: module1}))
      .then(() => expect(moduleRecordFor(System, module1).exports).to.have.property("zork", 2, "of record after change"))
      .then(() => System.import(module1).then(m1 => expect(m1).to.have.property("zork", 2, "of module after change")))
      );

  it("of export statement with new export", () =>
    promise.chain([
      () => () => Promise.all([System.import(module1), System.import(module2)]),
      (modules, state) => ([m1, m2], state) => { state.m1 = m1; state.m2 = m2; },
      () => runEval(System, "export var foo = 3;", {asString: true, targetModule: module2}),
      (result, {m1, m2}) => {
        expect(result.value).to.not.match(/error/i);
        // Hmmm.... frozen modules require us to re-import... damn!
        // expect(state.m1.foo).to.equal(3, "foo not defined in module1 after eval");
        return System.import(module2)
          .then((m) => expect(m.foo).to.equal(3, "foo not defined after eval"))
      },
      () => runEval(System, "export var foo = 5;", {asString: true, targetModule: module2}),
      (result, {m1, m2}) => {
        expect(result.value).to.not.match(/error/i);
        // expect(state.m1.foo).to.equal(5, "foo updated in module1 after re-eval");
        return System.import(module2)
          .then((m) => expect(m.foo).to.equal(5, "foo updated in module1 after re-eval"));
      }]));

  it("of import statement", () =>
    // test if import is transformed to lookup + if the imported module gets before eval
    promise.chain([
      () => runEval(System, "import { bar } from './file3.js'; bar", {targetModule: testProjectDir + "file1.js"}),
      (result, state) => {
        expect(result.value).to.not.match(/error/i);
        expect(result.value).to.equal(5, "imported value");
      }]));

});