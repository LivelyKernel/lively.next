/*global System, beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import { removeDir, createFiles } from "./helpers.js";

import { getSystem, removeSystem } from "../src/system.js";
// import { runEval } from "../src/eval.js";
import { getNotifications, subscribe, unsubscribe } from "../src/notify.js";

var dir = System.decanonicalize("lively.modules/tests/"),
    testProjectDir = dir + "test-project-dir/",
    testProjectSpec = {
      "file1.js": "import { y } from './file2.js'; var z = 2; export var x = y + z;",
      "file2.js": "import { z } from './file3.js'; export var y = z;",
      "file3.js": "export var z = 1;",
      "package.json": '{"name": "test-project-1", "main": "file1.js"}',
    },
    module1 = testProjectDir + "file1.js",
    module2 = testProjectDir + "file2.js",
    module3 = testProjectDir + "file3.js";


xdescribe("notifications", () => {

  var System;
  beforeEach(() => {
    System = getSystem("test", {baseURL: dir});
    return createFiles(testProjectDir, testProjectSpec)
            .then(() => System.import(module1));
  });

  afterEach(() => { removeSystem("test"); return removeDir(testProjectDir); });

  describe("recordings", () => {

    it("doits", () =>
      runEval(System, "1 + z + x", {targetModule: module1})
        .then(_ => expect(getNotifications(System)).to.containSubset(
          [{type: "doitrequest", code: "1 + z + x"},
           {type: "doitresult", code: "1 + z + x", result: {value: 6}}])));
  
    it("module changes", () =>
      moduleSourceChangeAction(System, module1, s => s.replace(/z = 2/, "z = 3"))
        .then(_ => expect(getNotifications(System)).to.containSubset(
          [{type: "modulechange",
            error: null,
            module: module1,
            oldCode: "import { y } from './file2.js'; var z = 2; export var x = y + z;",
            newCode: "import { y } from './file2.js'; var z = 3; export var x = y + z;"}])));
    
  });

  describe("subscription", () => {

    it("calls event handler for type", () =>
      new Promise((resolve, reject) => {
        subscribe(System, "doitresult", (data) => resolve(data));
        runEval(System, "1 + z + x", {targetModule: module1});
      })
      .then(event => expect(event).to.containSubset(
        {type: "doitresult", code: "1 + z + x", result: {value: 6}})));

    it("can subscribe to all events", () =>
      new Promise((resolve, reject) => {
        var recorded = [];
        subscribe(System, event => recorded.push(event));
        runEval(System, "1 + z + x", {targetModule: module1});
        setTimeout(() => resolve(recorded), 20);
      })
      .then(recorded => expect(recorded).to.containSubset(
        [{type: "doitrequest", code: "1 + z + x"},
         {type: "doitresult", code: "1 + z + x", result: {value: 6}}])));

    it("unsubscribes", () => {
      var recorded = [], handler = event => recorded.push(event);
      return new Promise((resolve, reject) => {
        subscribe(System, handler);
        runEval(System, "1 + z + x", {targetModule: module1});
        setTimeout(() => { unsubscribe(System, handler); resolve(); }, 20);
      })
      .then(_ => expect(recorded).to.have.lengthOf(2))
      .then(() => runEval(System, "1 + z + x", {targetModule: module1}))
      .then(_ => expect(recorded).to.have.lengthOf(2))
    });

    it("unsubscribe via name", () => {
      var recorded = [];
      return new Promise((resolve, reject) => {
        subscribe(System, undefined, "test-handler", event => recorded.push(event));
        runEval(System, "1 + z + x", {targetModule: module1});
        setTimeout(() => { unsubscribe(System, "test-handler"); resolve(); }, 20);
      })
      .then(_ => expect(recorded).to.have.lengthOf(2))
      .then(() => runEval(System, "1 + z + x", {targetModule: module1}))
      .then(_ => expect(recorded).to.have.lengthOf(2))
    });

    it("does not duplicate subscription when name is used", () =>
      new Promise((resolve, reject) => {
        var recorded = [];
        subscribe(System, undefined, "test-handler", event => recorded.push(event));
        subscribe(System, undefined, "test-handler", event => recorded.push(event));
        runEval(System, "1 + z + x", {targetModule: module1});
        setTimeout(() => resolve(recorded), 20);
      })
      .then(recorded => expect(recorded).to.have.lengthOf(2)));

  });

});
