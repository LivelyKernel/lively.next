/*global process, beforeEach, afterEach, describe, it, expect*/

import { expect } from "mocha-es6";
import * as vm from "lively.vm";
import lang from "lively.lang";

var Global = typeof global !== "undefined" ? global : window;

describe("lively compat", function() {

  it("addScriptWithVarMapping", function() {
    Global.fun = (lang || lively.lang).fun;
    var src = "var obj = {c: 3};\n"
        + "lively.lang.fun.asScriptOf(function(a) { return a + b + this.c; }, obj, 'm', {b: 2});\n"
        + "obj.m(1);\n";
    delete Global.fun;

    var result1 = vm.syncEval(src);
    expect(result1).property("value").equals(6, 'simple eval not working');

    var result2 = vm.syncEval(src, {topLevelVarRecorder: varMapper});
    var varMapper = {};
    expect(result2).property("value").equals(6, 'capturing eval not working');

    expect(Object.keys(varMapper).length).equals(0, 'varMApper captured stuff');
  });

});