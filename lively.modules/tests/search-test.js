/* global System, before, after, beforeEach, afterEach, describe, it */

import { expect } from 'mocha-es6';

import { removeDir, createFiles } from './helpers.js';

import { getSystem, searchLoadedModules } from '../src/system.js';
import mod from '../src/module.js';
import { importPackage, removePackage, getPackage } from '../src/packages/package.js';

const dir = System.decanonicalize('lively.modules/tests/');
const testProjectDir = dir + 'search-test-project/';
const testProjectSpec = {
  'file1.js': "import { y } from './file2.js';\nexport var x = 'hello';",
  'file2.js': "export var y = 'world'; // comment",
  'package.json': '{"name":"search-test-project","main":"file1.js"}'
};
const file1m = testProjectDir + 'file1.js';
const file2m = testProjectDir + 'file2.js';

describe('search', () => {
  let S, module1, module2;

  before(async () => {
    await createFiles(testProjectDir, testProjectSpec);
    S = getSystem('test', { baseURL: dir });
    S.set('lively.transpiler', System.get('lively.transpiler'));
    S.config({ transpiler: 'lively.transpiler' });
    S.babelOptions = System.babelOptions;
    S.translate = async (load) => await System.translate.bind(S)(load);
    module1 = mod(S, file1m);
    module2 = mod(S, file2m);
  });

  after(() => removeDir(testProjectDir));

  describe('in modules', () => {
    it('finds string constants', async () => {
      const res = await module1.search('hello');
      expect(res).to.containSubset([{
        moduleId: file1m,
        lineString: "export var x = 'hello';",
        line: 2,
        column: 16,
        length: 5
      }]);
    });

    it('finds comments', async () => {
      const res = await module2.search('comment');
      expect(res).to.containSubset([{
        moduleId: file2m,
        lineString: "export var y = 'world'; // comment",
        line: 1,
        column: 27,
        length: 7
      }]);
    });

    it('by regex', async () => {
      const res = await module1.search(/(im|ex)port/);
      expect(res).to.containSubset([{
        moduleId: file1m,
        line: 1,
        column: 0,
        length: 6
      }, {
        moduleId: file1m,
        line: 2,
        column: 0,
        length: 6
      }]);
    });
  });

  describe('in all loaded modules', () => {
    it('does not find unloaded string constants', async () => {
      module1.unload(); module2.unload();
      const res = await searchLoadedModules(S, 'hello');
      expect(res).to.containSubset([]);
    });

    it('finds string constants', async () => {
      await S.import(file1m);
      const res = await searchLoadedModules(S, 'hello');
      expect(res).to.containSubset([{
        moduleId: file1m,
        line: 2,
        column: 16,
        length: 5
      }]);
    });

    it('finds comments', async () => {
      await S.import(file1m);
      const res = await searchLoadedModules(S, 'comment');
      expect(res).to.containSubset([{
        moduleId: file2m,
        line: 1,
        column: 27,
        length: 7
      }]);
    });

    it('finds syntax', async () => {
      await S.import(file1m);
      await S.import(file2m);
      const res = await searchLoadedModules(S, 'export');
      expect(res).to.containSubset([{
        moduleId: file1m,
        line: 2,
        column: 0,
        length: 6
      }, {
        moduleId: file2m,
        line: 1,
        column: 0,
        length: 6
      }]);
    });

    it('by regex', async () => {
      const res = await searchLoadedModules(S, /(im|ex)port/);
      expect(res).to.containSubset([{
        moduleId: file1m,
        line: 1,
        column: 0,
        length: 6
      }, {
        moduleId: file1m,
        line: 2,
        column: 0,
        length: 6
      }, {
        moduleId: file2m,
        line: 1,
        column: 0,
        length: 6
      }]);
    });

    it('can exclude modules', async () => {
      const res = await searchLoadedModules(S,
        /(im|ex)port/, { excludedModules: [ea => ea !== file2m] });
      expect(res).to.have.length(1);
      expect(res).to.containSubset([
        { moduleId: file2m, line: 1, column: 0, length: 6 }]);
    });
  });

  describe('in packages', () => {
    beforeEach(() => importPackage(S, testProjectDir));
    afterEach(() => removePackage(S, testProjectDir));

    it('finds string constants', async () => {
      const res = await getPackage(S, testProjectDir).search('hello');
      expect(res).to.containSubset([{
        pathInPackage: 'file1.js',
        packageName: 'search-test-project',
        moduleId: file1m,
        line: 2,
        column: 16,
        length: 5
      }]);
    });

    it('finds comments', async () => {
      const res = await getPackage(S, testProjectDir).search('comment');
      expect(res).to.containSubset([{
        moduleId: file2m,
        line: 1,
        column: 27,
        length: 7
      }]);
    });

    it('by regex', async () => {
      const res = await getPackage(S, testProjectDir).search(/(im|ex)port/);
      expect(res).to.containSubset([{
        moduleId: file1m,
        line: 1,
        column: 0,
        length: 6
      }, {
        moduleId: file1m,
        line: 2,
        column: 0,
        length: 6
      }, {
        moduleId: file2m,
        line: 1,
        column: 0,
        length: 6
      }]);
    });

    it('can exclude modules', async () => {
      const res = await getPackage(S, testProjectDir).search(/(im|ex)port/, { excludedModules: [file1m] });
      expect(res).to.have.length(1);
      expect(res).to.containSubset([
        { moduleId: file2m, line: 1, column: 0, length: 6 }]);
    });

    it('can exclude modules via regex matches', async () => {
      const res = await getPackage(S, testProjectDir).search(/(im|ex)port/, { excludedModules: [/file1.js/] });
      expect(res).to.have.length(1);
      expect(res).to.containSubset([
        { moduleId: file2m, line: 1, column: 0, length: 6 }]);
    });
  });
});
