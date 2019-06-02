/*global beforeEach, afterEach, describe, it*/

import { expect } from "mocha-es6";
import * as vm from "lively.vm";
import lang from "lively.lang";

describe("completion", () => {

  it("can compute properties and method completions of an object", () =>
    vm.completions.getCompletions(code => vm.syncEval(code, {topLevelVarRecorder: {foo: {bar: 23}}}), "foo.")
      .then(result => {
        expect(result).property("startLetters").to.equal("");
        expect(result).property("completions").property(0).to.deep.equal(["[object Object]", ["bar"]]);
        expect(result).property("completions").property(1).to.containSubset(["Object", [
          "__defineGetter__()",
          "__defineSetter__()",
          "__lookupGetter__()",
          "__lookupSetter__()",
          "constructor()",
          "hasOwnProperty()",
          "isPrototypeOf()",
          "propertyIsEnumerable()",
          "toLocaleString()",
          "toString()",
          "valueOf()"]]);
      }));

  it("finds inherited props", () =>
    vm.completions.getCompletions(
      vm.syncEval,
      "var obj1 = {m2: function() {}, m3:function(a, b, c) {}},\n"
            + "obj2 = {a: 3, m1: function(a) {}, m2:function(x) {}, __proto__: obj1};\n"
            + "obj2.")
      .then(result => {
        expect(result).property("startLetters").equal("");
        expect(result.startLetters).to.equal("");
        const compls = result.completions,
              objectCompletions = compls.slice(0,2),
              expected = [["[object Object]", ["m1(a)","m2(x)","a"]],
                          ["prototype", ["m3(a, b, c)"]]];
        expect(compls).to.have.length(3);
        expect(compls[2][0]).to.equal("Object");
        expect(objectCompletions).to.deep.equal(expected);
      }));

  it("of resolved promise", () => 
    vm.completions.getCompletions(
      code => vm.runEval(code, {waitForPromise: true}),
      "Promise.resolve(23).")
        .then(result =>
          expect(result).property("promiseResolvedCompletions").property(0)
            .to.deep.equal(["23", []])))
  });
