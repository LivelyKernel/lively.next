/* global System, beforeEach, afterEach, describe, it */

import { expect } from 'mocha-es6';
import { subscribe, unsubscribe } from 'lively.notifications';

import { removeDir, createFiles } from './helpers.js';
import { getSystem, removeSystem } from '../src/system.js';
import module from '../src/module.js';
import { ensurePackage } from '../src/packages/package.js';
import { promise } from 'lively.lang';

let dir = System.decanonicalize('lively.modules/tests/');
let testProjectDir = dir + 'test-project-dir';
let testProjectSpec = {
  'file1.js': "import { y } from './file2.js'; var z = 2; export var x = y + z;",
  'file2.js': "import { z } from './file3.js'; export var y = z;",
  'file3.js': 'export var z = 1;',
  'package.json': '{"name": "test-project-1", "main": "file1.js"}'
};
let module1 = testProjectDir + '/file1.js';

describe('notify', () => {
  let system, modulechanged, moduleloaded, moduleunloaded, packageregistered, packageremoved;

  function changeModule1Source () {
    const m1 = module(system, module1);
    return m1.changeSourceAction(s => s.replace(/(z = )([0-9]+;)/, '$13;'));
  }

  function onModuleLoaded (n) { moduleloaded.push(n); }
  function onModuleChanged (n) { modulechanged.push(n); }
  function onModuleUnloaded (n) { moduleunloaded.push(n); }
  function onPackageRegistered (n) { packageregistered.push(n); }
  function onPackageRemoved (n) { packageremoved.push(n); }

  beforeEach(() => {
    system = getSystem('test', { baseURL: dir });
    system.set('lively.transpiler', System.get('lively.transpiler'));
    system.config({ transpiler: 'lively.transpiler' });
    system.babelOptions = System.babelOptions;
    system.translate = async (load) => await System.translate.bind(system)(load);
    modulechanged = [];
    moduleloaded = [];
    moduleunloaded = [];
    packageregistered = [];
    packageremoved = [];
    subscribe('lively.modules/moduleloaded', onModuleLoaded, system);
    subscribe('lively.modules/modulechanged', onModuleChanged, system);
    subscribe('lively.modules/moduleunloaded', onModuleUnloaded, system);
    subscribe('lively.modules/packageregistered', onPackageRegistered, system);
    subscribe('lively.modules/packageremoved', onPackageRemoved, system);
    return createFiles(testProjectDir, testProjectSpec);
  });

  afterEach(() => {
    unsubscribe('lively.modules/moduleloaded', onModuleLoaded, system);
    unsubscribe('lively.modules/modulechanged', onModuleChanged, system);
    unsubscribe('lively.modules/moduleunloaded', onModuleUnloaded, system);
    unsubscribe('lively.modules/packageregistered', onPackageRegistered, system);
    unsubscribe('lively.modules/packageremoved', onPackageRemoved, system);
    removeSystem('test');
    return removeDir(testProjectDir);
  });

  it('when module changes', async () => {
    expect(modulechanged).to.deep.equal([]);
    await changeModule1Source();
    expect(modulechanged).to.containSubset([{
      type: 'lively.modules/modulechanged',
      module: module1,
      newSource: "import { y } from './file2.js'; var z = 3; export var x = y + z;"
    }]);
  });

  it('when module gets loaded', async () => {
    expect(moduleloaded).to.deep.equal([]);
    await module(system, module1).load();
    await promise.delay(20);
    expect(moduleloaded).to.containSubset([{
      type: 'lively.modules/moduleloaded',
      module: module1
    }]);
  });

  it('when module gets unloaded', async () => {
    expect(moduleunloaded).to.deep.equal([]);
    await module(system, module1).load();
    await module(system, module1).unload();
    expect(moduleunloaded).to.containSubset([{
      type: 'lively.modules/moduleunloaded',
      module: module1
    }]);
  });

  it('when package gets registered', async () => {
    expect(packageregistered).to.deep.equal([]);
    await ensurePackage(system, testProjectDir);
    expect(packageregistered).to.containSubset([{
      type: 'lively.modules/packageregistered',
      package: testProjectDir
    }]);
  });

  it('when package gets removed', async () => {
    expect(packageremoved).to.deep.equal([]);
    let p = await ensurePackage(system, testProjectDir);
    p.remove();
    expect(packageremoved).to.containSubset([{
      type: 'lively.modules/packageremoved',
      package: testProjectDir
    }]);
  });
});
