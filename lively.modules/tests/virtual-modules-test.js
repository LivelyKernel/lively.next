/* global System, beforeEach, afterEach, describe, it */

import { removeDir, createFiles } from './helpers.js';
import { expect } from 'mocha-es6';

import { getSystem, removeSystem } from 'lively.modules/src/system.js';
import module from 'lively.modules/src/module.js';
import { runEval } from 'lively.vm';

const dir = System.decanonicalize('lively.modules/tests/');
const testProjectDir = dir + 'files-for-virtual-modules-test/';
const testProjectSpec = {
  'file1.js': 'export var x = 23;',
  'package.json': '{"name": "a-project", "main": "file1.js"}'
};
const file1m = testProjectDir + 'file1.js';

describe('lively.modules aware eval', () => {
  let S, module1;
  beforeEach(async () => {
    S = getSystem('test', { baseURL: testProjectDir });
    S.set('lively.transpiler', System.get('lively.transpiler'));
    S.config({ transpiler: 'lively.transpiler' });
    S.babelOptions = System.babelOptions;
    S.translate = async (load) => await System.translate.bind(S)(load);
    await createFiles(testProjectDir, testProjectSpec);
    module1 = module(S, file1m);
  });

  afterEach(async () => {
    await removeSystem('test');
    await removeDir(testProjectDir);
  });

  it('virtual module dependencies stay up-to-date after reloading', async () => {
    // 1. import real module into virtual module
    // 2. reload real module
    // 3. re-import in virtual module
    // 4. real module source change => should update virtual module, no error
    await module1.load();
    let virtualModule = module(S, 'local://foo/mod1');
    await runEval(`import { x } from '${module1.id}';`, { targetModule: virtualModule.id, System: S });
    expect(virtualModule).to.have.deep.property('recorder.x', 23);
    await module1.reload();
    await runEval(`import { x } from '${module1.id}';`, { targetModule: virtualModule.id, System: S });
    await module1.changeSource('export var x = 24;');
    expect(virtualModule).to.have.deep.property('recorder.x', 24);
  });

  it('exports and imports are updated on eval', async () => {
    let m1 = S.get('@lively-env').moduleEnv('local://foo/mod1');
    let m2 = S.get('@lively-env').moduleEnv('local://foo/mod2');
    await runEval('export var z = 23;', { targetModule: m1.id, System: S });
    await runEval(`import { z } from '${m1.id}';`, { targetModule: m2.id, System: S });
    expect(m2).to.have.deep.property('recorder.z', 23);
    expect(m1.record().importers).to.containSubset([{ name: m2.id }]);
    expect(m2.record().dependencies).to.containSubset([{ name: m1.id }]);
    await runEval('export var z = 24;', { targetModule: m1.id, System: S });
    expect(m2).to.have.deep.property('recorder.z', 24);
  });
});
