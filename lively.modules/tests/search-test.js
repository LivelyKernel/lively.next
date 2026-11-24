/* global System, before, after, beforeEach, afterEach, describe, it */

import { expect } from 'mocha-es6';

import { removeDir, prepareSystem, createFiles } from './helpers.js';

import { searchLoadedModules } from '../src/system.js';
import mod from '../src/module.js';
import { importPackage, removePackage, getPackage } from '../src/packages/package.js';
import { searchInSource } from '../src/search.js';

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
    S = prepareSystem('test', dir);
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
      await module1.unload(); await module2.unload();
      const res = await searchLoadedModules(S, 'hello');
      expect(res).to.have.length(0);
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

  describe('in source text', () => {
    const source = 'const Foo = 1;\nfoo(Foo);\n// foo.bar';

    it('ignores case unless asked not to', () => {
      expect(searchInSource(source, 'foo').map(m => [m.line, m.column])).deep.equals([[1, 6], [2, 0], [2, 4], [3, 3]]);
      expect(searchInSource(source, 'foo', { caseSensitive: true }).map(m => [m.line, m.column])).deep.equals([[2, 0], [3, 3]]);
    });

    it('matches strings literally unless in regex mode', () => {
      expect(searchInSource(source, 'foo.bar')).to.have.length(1);
      expect(searchInSource(source, 'foo(', { regexMode: false })).to.containSubset([{ line: 2, column: 0, length: 4, lineString: 'foo(Foo);' }]);
      expect(searchInSource(source, 'f.o\\(', { regexMode: true })).to.containSubset([{ line: 2, column: 0, length: 4 }]);
    });

    it('shortens lines longer than 1000 characters around the match', () => {
      const [match] = searchInSource('x'.repeat(2000) + 'needle' + 'y'.repeat(200), 'needle');
      expect(match.lineString).equals('...' + 'x'.repeat(10) + 'needle' + 'y'.repeat(94) + '...');
    });

    it('terminates for patterns that match the empty string', () => {
      expect(searchInSource('ab\nab', 'x*', { regexMode: true })).to.have.length(6);
    });
  });
});
