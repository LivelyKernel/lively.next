/* global System, beforeEach, afterEach, describe, it */

import { expect } from 'mocha-es6';
import { removeDir, createFiles } from './helpers.js';

import { getSystem, removeSystem } from '../src/system.js';
import module from '../src/module.js';

let dir = System.decanonicalize('lively.modules/tests/');
let testProjectDir = dir + 'test-module-deps/';
let testProjectSpec = {
  'file1.js': "import { y } from './file2.js'; import { z } from './sub-dir/file3.js'; export var x = y + z;",
  'file2.js': 'export var y = 1; function inc() { y = y+1; }',
  'package.json': '{"name": "test-project-1", "main": "file1.js", "systemjs": {"main": "file1.js"}}',
  'sub-dir': { 'file3.js': 'export var z = 2;' }
};
let file1m = testProjectDir + 'file1.js';
let file2m = testProjectDir + 'file2.js';
let file3m = testProjectDir + 'sub-dir/file3.js';

let S, module1, module2, module3;

describe('dependencies', () => {
  beforeEach(async () => {
    S = getSystem('test', { baseURL: testProjectDir });
    S.set('lively.transpiler', System.get('lively.transpiler'));
    S.config({ transpiler: 'lively.transpiler' });
    S.babelOptions = System.babelOptions;
    S.translate = async (load) => await System.translate.bind(S)(load);
    module1 = module(S, file1m);
    module2 = module(S, file2m);
    module3 = module(S, file3m);
    await createFiles(testProjectDir, testProjectSpec);
  });

  afterEach(() => { removeSystem('test'); return removeDir(testProjectDir); });

  it('computes required modules of some module', async () => {
    await S.import('file1.js');
    expect(module1.requirements()).to.deep.equal([module2, module3]);
  });

  it('computes dependent modules of some module', async () => {
    await S.import('file1.js');
    expect(module2.dependents()).to.deep.equal([module1]);
  });

  it('updates exports when internal state changes', async () => {
    await S.import('file1.js');
    let { y } = await S.import('file2.js');
    expect(y).equals(1);
    expect(module2.recorder.y).equals(1);
    expect(module1.recorder.y).equals(1);
    module2.recorder.inc();
    ({ y } = await S.import('file2.js'));
    expect(y).equals(2, 'exported state not updated');
    expect(module2.recorder.y).equals(2, 'local state not updated');
    expect(module1.recorder.y).equals(2, 'imported state in module 1 not update');
  });

  describe('unload module', () => {
    it('forgets module and recordings', async () => {
      await S.import('file1.js');
      await module2.unload();
      expect(module1.record()).to.equal(null, 'record for module1 still exists');
      expect(module2.record()).to.equal(null, 'record for module2 still exists');
      expect(module1.env().recorder).to.not.have.property('x');
      expect(module2.env().recorder).to.not.have.property('y');
    });
  });
});
