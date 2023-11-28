/* global System, beforeEach, afterEach, describe, it */

import { expect } from 'mocha-es6';
import { subscribe, unsubscribe } from 'lively.notifications';
import { runEval } from '../index.js';

let modules = typeof lively !== 'undefined' && lively.modules;

let dir = System.normalizeSync('lively.vm/tests/test-resources/');
let testProjectDir = dir + 'es6-project/';
let module1 = testProjectDir + 'file1.js';
let module2 = testProjectDir + 'file2.js';
let module3 = testProjectDir + 'file3.js';
let module4 = testProjectDir + 'file4.js';

describe('eval', () => {
  let S;
  beforeEach(function () {
    S = System;
    if (modules) {
      S = modules.getSystem('test', { baseURL: dir });
      S.babelOptions = System.babelOptions;
      S.set('lively.transpiler', System.get('lively.transpiler'));
      S.config({ transpiler: 'lively.transpiler' });
      S.translate = async (load) => await System.translate.bind(S)(load);
    }

    return S.import(module1);
  });

  afterEach(() => modules && modules.removeSystem('test'));

  it('inside of module', async () => {
    let result = await runEval('1 + z + x', { System: S, targetModule: module1 });
    expect(result.value).equals(6);
  });

  it('sets this', async () => {
    let result = await runEval('1 + this.x', { System: S, targetModule: module1, context: { x: 2 } });
    expect(result.value).equals(3);
  });

  it('**', () =>
    S.import(module1)
      .then(() => runEval('z ** 4', { System: S, targetModule: module1 })
        .then(result => expect(result).property('value').to.equal(16))));

  it('awaits async function', async () => {
    await S.import(module4);
    let result = await runEval('await foo(3)', { System: S, targetModule: module4 });
    await expect(result).property('value').to.equal(3);
  });

  it('nests await', async () => {
    await S.import(module4);
    let result = await runEval("await ('a').toUpperCase()", { System: S, targetModule: module4 });
    expect(result).property('value').to.equal('A');
  });

  it('notifies request', async () => {
    const doitrequest = [];
    function onDoItRequest (msg) { doitrequest.push(msg); }
    console.log('subscribed');
    subscribe('lively.vm/doitrequest', onDoItRequest, S);

    expect(doitrequest).to.deep.equal([]);
    await runEval('1 + z + x', { System: S, targetModule: module1 });
    unsubscribe('lively.vm/doitrequest', onDoItRequest, S);
    expect(doitrequest).to.containSubset([{
      type: 'lively.vm/doitrequest',
      code: '1 + z + x',
      targetModule: module1
    }]);
  });

  it('notifies result', async () => {
    const doitresult = [];
    function onDoItResult (msg) { doitresult.push(msg); }
    subscribe('lively.vm/doitresult', onDoItResult, S);

    expect(doitresult).to.deep.equal([]);
    await runEval('1 + z + x', { System: S, targetModule: module1 });
    unsubscribe('lively.vm/doitresult', onDoItResult, S);
    expect(doitresult).to.containSubset([{
      type: 'lively.vm/doitresult',
      code: '1 + z + x',
      result: {
        value: 6
      },
      targetModule: module1
    }]);
  });
});
