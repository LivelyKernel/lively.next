/*global process, beforeEach, afterEach, describe, it, expect*/

var env = typeof module !== "undefined" && module.require ? module.require("../env") : window;
var chai = env.isCommonJS ? module.require("chai") : window.chai;
var chaiSubset = env.isCommonJS ? module.require("chai-subset") : window.chaiSubset;
var expect = chai.expect; chaiSubset && chai.use(chaiSubset);
var lang = env.lively.lang || lively.lang,
    vm = env.isCommonJS ? require('../index') : lively.vm;
var Global = env.Global;

describe("completion", () => {

  it("can compute properties and method completions of an object", () =>
    vm.getCompletions(code => vm.syncEval(code, {topLevelVarRecorder: {foo: {bar: 23}}}), "foo.")
      .then(result => {
        expect(result).property("startLetters").to.equal("");
        expect(result).property("completions").to.deep.equal([
          ["[object Object]", ["bar"]],
          ["Object", [
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
            "valueOf()",
            "__proto__"]]
        ]);
      }));

  it("finds inherited props", () =>
    vm.getCompletions(
      vm.syncEval,
      "obj1 = {m2: function() {}, m3:function(a,b,c) {}}\n"
            + "obj2 = {a: 3, m1: function(a) {}, m2:function(x) {}, __proto__: obj1}\n"
            + "obj2.")
      .then(result => {
        expect(result).property("startLetters").equal("");
        expect(result.startLetters).to.equal("");
        const compls = result.completions,
              objectCompletions = compls.slice(0,2),
              expected = [["[object Object]", ["m1(a)","m2(x)","a"]],
                          ["prototype", ["m3(a,b,c)"]]]
        expect(compls).to.have.length(3);
        expect(compls[2][0]).to.equal("Object");
        expect(objectCompletions).to.deep.equal(expected);
      }));

});
