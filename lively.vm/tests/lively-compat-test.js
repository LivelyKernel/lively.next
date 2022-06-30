/* global describe, it, expect,global */

import { expect } from 'mocha-es6';
import * as vm from 'lively.vm';
import * as lang from 'lively.lang';

let Global = typeof global !== 'undefined' ? global : window;

describe('lively compat', function () {
  it('addScriptWithVarMapping', function () {
    Global.fun = (lang || lively.lang).fun;
    let src = 'var obj = {c: 3};\n' +
        "fun.asScriptOf(function(a) { return a + b + this.c; }, obj, 'm', {b: 2});\n" +
        'obj.m(1);\n';

    let result1 = vm.syncEval(src);
    expect(result1).property('value').equals(6, 'simple eval not working');

    let result2 = vm.syncEval(src, { topLevelVarRecorder: varMapper });
    var varMapper = {};
    expect(result2).property('value').equals(6, 'capturing eval not working');

    expect(Object.keys(varMapper).length).equals(0, 'varMApper captured stuff');
    delete Global.fun;
  });
});
