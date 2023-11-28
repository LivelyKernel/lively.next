/* global System, beforeEach, afterEach, describe, it */

import { removeDir, createFiles } from './helpers.js';
import { expect } from 'mocha-es6';
import { promise } from 'lively.lang';

import { getSystem, removeSystem } from 'lively.modules/src/system.js';
import module from 'lively.modules/src/module.js';
import { runEval } from 'lively.vm';

const dir = System.decanonicalize('lively.modules/tests/');
const testProjectDir = dir + 'files-for-eval-test/';
const testProjectSpec = {
  'file1.js': "import { y } from './file2.js';\nvar z = 2;\nexport var x = y + z;",
  'file2.js': "import { z } from './file3.js'; export var y = z;",
  'file3.js': 'export var z = 1;',
  'file4.js': 'export async function foo(arg) { return new Promise((resolve, reject) => setTimeout(resolve, 200, arg)); }',
  'package.json': '{"name": "test-project-1", "main": "file1.js"}'
};
const file1m = testProjectDir + 'file1.js';
const file2m = testProjectDir + 'file2.js';
const file3m = testProjectDir + 'file3.js';
const file4m = testProjectDir + 'file4.js';

describe('lively.modules aware eval', function () {
  this.timeout(6000);

  let S, module1, module2, module3, module4;
  beforeEach(async () => {
    S = getSystem('test', { baseURL: testProjectDir });
    S.set('lively.transpiler', System.get('lively.transpiler'));
    S.config({ transpiler: 'lively.transpiler' });
    S.babelOptions = System.babelOptions;
    S.translate = async (load) => await System.translate.bind(S)(load);
    module1 = module(S, file1m);
    module2 = module(S, file2m);
    module3 = module(S, file3m);
    module4 = module(S, file4m);
    await createFiles(testProjectDir, testProjectSpec);
    await S.import(module1.id);
  });

  afterEach(async () => {
    await removeSystem('test');
    await removeDir(testProjectDir);
  });

  it('inside of module', async () => {
    let result = await runEval('1 + z + x', { System: S, targetModule: module1.id });
    expect(result.value).equals(6);
  });

  it('of export statement', async () => {
    let m1 = await S.import(module1.id);
    let m2 = await S.import(module2.id);
    expect(m1.x).to.equal(3, 'module1 initial x');
    expect(m2.y).to.equal(1, 'module2 initial y');
    let result = await runEval('export var y = 2;', { asString: true, System: S, targetModule: module2.id });
    expect(result.value).to.not.match(/error/i);
    expect(m2.y).to.equal(2, 'file2.js not updated');
    let result2 = await runEval('y;', { System: S, targetModule: module1.id });
    expect(result2.value).to.equal(2);
    // expect(m1.x).to.equal(4, "file1.js not updated after its dependency changed");
  });

  it('of var being exported', async () => {
    let m1 = await S.import(module1.id);
    let m2 = await S.import(module2.id);
    expect(m1.x).to.equal(3);
    expect(m2.y).to.equal(1);

    let result = await runEval('var y = 2;', { asString: true, System: S, targetModule: module2.id });
    expect(result.value).to.not.match(/error/i);
    expect(m2.y).to.equal(2, 'file2.js not updated');
    let result2 = await runEval('y;', { System: S, targetModule: module1.id });
    expect(result2.value).to.equal(2);
  });

  it('of new export', async () => {
    let m2 = await S.import(module2.id);
    let result = await runEval('export var xxx = 99;', { asString: true, System: S, targetModule: module2.id });
    // result = await runEval("var xxx = 99; export { xxx }", {asString: true, System: S, targetModule: module2});
    expect(result.value).to.not.match(/error/i);
    expect(m2.xxx).to.equal(99, 'file2.js not updated');
    let result2 = await runEval("import { xxx } from './file2.js'; xxx", { System: S, targetModule: module1.id });
    expect(result2.value).to.equal(99, 'new export not available in another module');
  });

  it('of new var that is exported and then changes', async () => {
    await S.import(module1.id);
    // define a new var that is exported
    await runEval('var zork = 1; export { zork }', { asString: true, System: S, targetModule: module1.id });
    expect(module1.record().exports).to.have.property('zork', 1, 'of record');
    let m1 = await S.import(module1.id);
    expect(m1).to.have.property('zork', 1, 'of module');

    // now change that var and see if the export is updated
    await runEval('var zork = 2;', { asString: true, System: S, targetModule: module1.id });
    expect(module1.record().exports).to.have.property('zork', 2, 'of record after change');
    m1 = await S.import(module1.id);
    expect(m1).to.have.property('zork', 2, 'of module after change');
  });

  it('of export statement with new export', () =>
    promise.chain([
      () => () => Promise.all([S.import(module1.id), S.import(module2.id)]),
      (modules, state) => ([m1, m2], state) => { state.m1 = m1; state.m2 = m2; },
      () => runEval('export var foo = 3;', { asString: true, System: S, targetModule: module2.id }),
      (result, { m1, m2 }) => {
        expect(result.value).to.not.match(/error/i);
        // Hmmm.... frozen modules require us to re-import... damn!
        // expect(state.m1.foo).to.equal(3, "foo not defined in module1 after eval");
        return S.import(module2.id)
          .then((m) => expect(m.foo).to.equal(3, 'foo not defined after eval'));
      },
      () => runEval('export var foo = 5;', { asString: true, System: S, targetModule: module2.id }),
      (result, { m1, m2 }) => {
        expect(result.value).to.not.match(/error/i);
        // expect(state.m1.foo).to.equal(5, "foo updated in module1 after re-eval");
        return S.import(module2.id)
          .then((m) => expect(m.foo).to.equal(5, 'foo updated in module1 after re-eval'));
      }]));

  it('of import statement', async () => {
    // test if import is transformed to lookup + if the imported module gets before eval
    let result = await runEval("import { z } from './file3.js'; z", { System: S, targetModule: testProjectDir + 'file1.js' });
    expect(result.value).to.not.match(/error/i);
    expect(result.value).to.equal(1, 'imported value');
  });

  it('reload module dependencies', async () => {
    let m = await S.import(module1.id);
    expect(m.x).to.equal(3);
    // we change module3 and check that the value of module1 that indirectly
    // depends on module3 has changed as well
    let source = await module3.source();
    source = source.replace(/(z = )([0-9]+)/, '$12');
    let result = await runEval(source, { asString: true, System: S, targetModule: module3.id });
    expect(result.value).to.not.match(/error/i);
    module3.unloadDeps();
    m = await S.import(module1.id);
    expect(m.x).to.equal(4);
  });

  describe('es6 code', () => {
    it('**', () =>
      S.import(module1.id)
        .then(() => runEval('z ** 4', { System: S, targetModule: module1.id })
          .then(result => expect(result).property('value').to.equal(16))));
  });

  describe('async', () => {
    it('awaits async function', async () => {
      await S.import(module4.id);
      let result = await runEval('await foo(3)', { System: S, targetModule: module4.id });
      await expect(result).property('value').to.equal(3);
    });

    it('nests await', async () => {
      await S.import(module4.id);
      let result = await runEval("await ('a').toUpperCase()", { System: S, targetModule: module4.id });
      expect(result).property('value').to.equal('A');
    });
  });

  describe('notifications of toplevel changes', () => {
    it('triggers notification on change', async () => {
      let seen = {};
      module3.subscribeToToplevelDefinitionChanges((key, val) => seen[key] = val);
      await runEval('var z = 22, foo = 123;', { System: S, targetModule: module3.id });
      expect(seen).containSubset({ z: 22, foo: 123 });
    });
  });
});
