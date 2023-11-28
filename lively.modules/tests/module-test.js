/* global beforeEach, afterEach, describe, it */

import { expect } from 'mocha-es6';
import { promise } from 'lively.lang';

import module, { isModuleLoaded, doesModuleExist } from '../src/module.js';
import { getSystem, removeSystem, loadedModules, whenLoaded } from '../src/system.js';
import { registerPackage, importPackage } from '../src/packages/package.js';
import { createFiles, resource } from 'lively.resources';

let dir = 'local://lively.modules-module-test/';
let testDir = dir + 'test-project/';
let module1 = `${testDir}file1.js`;
let S;

describe('module loading', () => {
  beforeEach(async () => {
    S = getSystem('test', { baseURL: dir });
    S.set('lively.transpiler', System.get('lively.transpiler'));
    S.config({ transpiler: 'lively.transpiler' });
    S.babelOptions = System.babelOptions;
    S.translate = async (load) => await System.translate.bind(S)(load);
    await createFiles(testDir, {
      'file1.js': "import { y } from './file2.js'; export var x = y + 1;",
      'file2.js': "import { z } from './file3.js'; export var y = 1 + z;",
      'file3.js': 'export var z = 1;'
    });
  });

  afterEach(async () => {
    removeSystem('test');
    await resource(testDir).remove();
  });

  it('loads files', async () => {
    let exports = await S.import(testDir + 'file1.js');
    expect(exports).to.have.property('x', 3);
  });

  it('has module interface objects', async () => {
    await S.import(testDir + 'file1.js');
    let m = loadedModules(S)[module1];
    expect(m.id).equals(module1);
    expect(m.record()).containSubset({ exports: { x: 3 }, importers: [], name: module1 });
    /* ... */
  });

  it("module knows it's package", async () => {
    await registerPackage(S, testDir);
    // S.packages["local://lively.modules-module-test/test-project"].configured = true
    // S.get(testDir + "package.json");
    await S.import(testDir + 'file1.js');
    let m = loadedModules(S)[module1];
    expect(m.package()).containSubset({
      address: testDir.replace(/\/$/, '')
    });
    expect(m.pathInPackage()).equals('file1.js');
  });

  it('module scope does not resolve references by default', async () => {
    await registerPackage(S, testDir);
    await S.import(testDir + 'file1.js');
    const scope = await loadedModules(S)[module1].scope();
    expect(scope).containSubset({ refs: [{ name: 'y' }] });
    expect(scope).to.not.have.property('referencesResolved');
    expect(scope.refs[0]).to.not.have.property('decl');
    expect(scope.refs[0]).to.not.have.property('declId');
  });

  it('module resolved scope resolves references', async () => {
    await registerPackage(S, testDir);
    await S.import(testDir + 'file1.js');
    const scope = await loadedModules(S)[module1].resolvedScope();
    expect(scope.resolvedRefMap.get(scope.refs[0])).containSubset({ decl: { type: 'ImportDeclaration' } });
    expect(scope).to.not.property('_referencesResolved');
  });

  it('rename module', async () => {
    await registerPackage(S, testDir);
    await S.import(module1);
    let m = await module(S, module1);
    let module1New = testDir + 'renamed-file1.js';
    await m.renameTo(module1New);
    expect().assert(!await resource(module1).exists(), `file ${module1} still exists`);
    expect().assert(await resource(module1New).exists(), `file ${module1New} does not exists`);
    expect().assert(!loadedModules(S).hasOwnProperty(module1), `${module1} still in loadedModules exists`);
    expect().assert(loadedModules(S).hasOwnProperty(module1New), `${module1New} not in loadedModules`);
    let { x } = S.get(module1New);
    expect(x).equals(3);
  });

  it('copy module', async () => {
    await registerPackage(S, testDir);
    await S.import(module1);
    let m = await module(S, module1);
    let module1New = testDir + 'copied-file1.js';
    await m.copyTo(module1New);
    expect().assert(await resource(module1).exists(), `file ${module1} does not exist anymore`);
    expect().assert(await resource(module1New).exists(), `file ${module1New} does not exists`);
    expect().assert(loadedModules(S).hasOwnProperty(module1), `${module1} not in runtime anymore`);
    expect().assert(loadedModules(S).hasOwnProperty(module1New), `${module1New} not in loadedModules`);
    let { x } = S.get(module1New);
    expect(x).equals(3);
  });

  describe('module exists', () => {
    it('when loaded', async () => {
      await registerPackage(S, testDir);
      await S.import(module1);
      expect(isModuleLoaded(S, module1)).equals(true, 'isLoaded');
      expect(await doesModuleExist(S, module1)).equals(true, 'exists');
    });

    it('when not loaded', async () => {
      await registerPackage(S, testDir);
      expect(isModuleLoaded(S, module1)).equals(false, 'isLoaded');
      expect(await doesModuleExist(S, module1)).equals(true, 'exists');
      expect(module1 in loadedModules(S)).equals(false, 'listed in loadedModules');
    });

    it('not existing', async () => {
      let uri = testDir + 'foo.js';
      await registerPackage(S, testDir);
      expect(isModuleLoaded(S, uri)).equals(false, 'isLoaded');
      expect(await doesModuleExist(S, uri)).equals(false, 'exists');
      expect(uri in loadedModules(S)).equals(false, 'listed in loadedModules');
    });

    it('without package', async () => {
      expect(isModuleLoaded(S, module1)).equals(false, 'isLoaded');
      expect(await doesModuleExist(S, module1)).equals(true, 'exists');
      expect(module1 in loadedModules(S)).equals(false, 'listed in loadedModules');
      let uri = testDir + 'foo.js';
      expect(isModuleLoaded(S, uri)).equals(false, 'isLoaded');
      expect(await doesModuleExist(S, uri)).equals(false, 'exists');
      expect(uri in loadedModules(S)).equals(false, 'listed in loadedModules');
    });
  });

  describe('imports', () => {
    it('adds import', async () => {
      await importPackage(S, testDir);
      let m = await module(S, testDir + 'file1.js');
      await m.addImports([{ exported: 'z', from: testDir + 'file3.js' }]);
      expect(await m.source()).equals("import { y } from './file2.js';\n" +
                                    'import { z } from "./file3.js";\n' +
                                    ' export var x = y + 1;');
      expect(m.recorder.z).equals(1);
    });

    it('removes import', async () => {
      await importPackage(S, testDir);
      let m = await module(S, testDir + 'file1.js');
      expect(await m.source()).equals("import { y } from './file2.js'; export var x = y + 1;");
      try {
        await m.removeImports([{ local: 'y' }]);
      } catch (err) {
        // Causes an error because the code is not longer valid
        // The error is caused by the acornjs parser throwing a syntax error
        // when the module wants to initialize the scope.
        // This used not to be the case in earlier versions of acorn.
        // Since the point of this test is not to test for this exception, we just
        // capture it here to move on with the test.
      }
      expect(await m.source()).equals(' export var x = y + 1;');
      expect().assert(!m.recorder.hasOwnProperty('y'), 'var y not removed from module internals');
    });
  });

  describe('onLoad callbacks', () => {
    it('can be registered lively.modules.whenLoaded', async () => {
      let called = 0;
      whenLoaded(S, testDir + 'file2.js', () => called++);
      await S.import(testDir + 'file1.js');
      await promise.delay(20);
      expect(called).equals(1);
    });

    it('get triggered on import', async () => {
      let called = 0;
      module(S, testDir + 'file2.js').whenLoaded(() => called++);
      await S.import(testDir + 'file1.js');
      await promise.delay(20);
      expect(called).equals(1);
    });

    it('get triggered immediately when module already loaded', async () => {
      await S.import(testDir + 'file1.js');
      let called = 0;
      module(S, testDir + 'file2.js').whenLoaded(() => called++);
      expect(called).equals(1);
    });
  });
});
