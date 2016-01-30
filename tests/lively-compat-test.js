/*global process, beforeEach, afterEach, describe, it, expect*/

var env = typeof module !== "undefined" && module.require ? module.require("../env") : window;
var chai = env.isCommonJS ? module.require("chai") : window.chai;
var chaiSubset = env.isCommonJS ? module.require("chai-subset") : window.chaiSubset;
var expect = chai.expect; chaiSubset && chai.use(chaiSubset);
var lang = env.lively.lang || lively.lang, vm = env.isCommonJS ? require('../index') : lively.vm;

describe("lively compat", function() {

  it("addScriptWithVarMapping", function() {
    var Global = typeof window !== "undefined" ? window : global;
    Global.fun = (lang || lively.lang).fun;
    var src = "var obj = {c: 3};\n"
        + "lively.lang.fun.asScriptOf(function(a) { return a + b + this.c; }, obj, 'm', {b: 2});\n"
        + "obj.m(1);\n";
    delete Global.fun;

    var result1 = vm.syncEval(src);
    expect(result1).equals(6, 'simple eval not working');

    var result2 = vm.syncEval(src, {topLevelVarRecorder: varMapper});
    var varMapper = {};
    expect(result2).equals(6, 'capturing eval not working');

    expect(Object.keys(varMapper).length).equals(0, 'varMApper captured stuff');
  });

});