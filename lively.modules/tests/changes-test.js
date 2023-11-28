/* global System, beforeEach, afterEach, describe, it */

import { expect } from 'mocha-es6';
import { createFiles, resource } from 'lively.resources';

import { getSystem, removeSystem } from '../src/system.js';
import module from '../src/module.js';

const dir = 'local://lively.modules-changes-test/';
const testProjectDir = dir + 'test-project-1-dir/';
const testProjectSpec = {
  'file1.js': "import { y, someFn } from './file2.js'; import { z } from './sub-dir/file3.js'; export var x = y + z; export { y }; export function someOtherFn(x) { return someFn() + x; }",
  'file2.js': 'var internal = 1;\nexport var y = internal;\nexport function someFn() { return 23; }',
  'file4.js': "'format esm'; var x = 23;",
  'package.json': '{"name": "test-project-1", "main": "file1.js"}',
  'sub-dir': { 'file3.js': 'export var z = 2;' }
};
const file1m = testProjectDir + 'file1.js';
const file2m = testProjectDir + 'file2.js';
const file3m = testProjectDir + 'sub-dir/file3.js';
const file4m = testProjectDir + 'file4.js';

let S, module1, module2, module4;

function changeModule2Source () {
  // "internal = 1" => "internal = 2"
  return module2.changeSourceAction(s => s.replace(/(internal = )([0-9]+;)/, '$12;'));
}

describe('code changes of esm format module', function () {
  this.timeout(5000);

  beforeEach(async () => {
    S = getSystem('test', { baseURL: testProjectDir });
    S.set('lively.transpiler', System.get('lively.transpiler'));
    S.config({ transpiler: 'lively.transpiler' });
    S.translate = async (load) => await System.translate.bind(S)(load);
    S.useModuleTranslationCache = false;
    module1 = module(S, file1m);
    module2 = module(S, file2m);
    module4 = module(S, file4m);
    await createFiles(testProjectDir, testProjectSpec);
  });

  afterEach(async () => { removeSystem('test'); await resource(testProjectDir).remove(); });

  it('modifies module and its exports', async () => {
    const m1 = await S.import(file1m);
    const m2 = await S.import(file2m);

    expect(module2.env().recorder.internal).to.equal(1, 'internal state of module2 before change');
    expect(m1.x).to.equal(3, 'computed state in module1 before change');
    expect(m1.y).to.equal(1, 're-exported state in module1 before change');
    await changeModule2Source();
    expect(module2.env().recorder.internal).to.equal(2, 'internal state of module2 after change');
    expect(module1.env().recorder.y).to.equal(2, 'internal state of module1 after change');
    expect(m1.y).to.equal(2, 're-exported state in module1 after change');
    // We expect to still have the same internal computed state b/c module 1
    // won't get re-run!
    expect(m1.x).to.equal(3, 'computed state in module1 after change');
    let m1_reimported = await S.import(file1m);
    expect(m1).to.equal(m1_reimported, 'module1 identity changed');
    let m2_reimported = await S.import(file2m);
    expect(m2).to.equal(m2_reimported, 'module2 identity changed');
  });

  it('modifies module declaration', async () => {
    let m = await S.import(file1m);
    expect(module2.record().importers[0]).equals(module1.record());
    await module1.changeSource(
      testProjectSpec['file1.js'].replace('x = y + z;', 'x = y - z;'),
      { evaluate: true });
    expect(m.x).to.equal(-1, 'x after changing module1');
    await changeModule2Source();
    // We expect to still have the same internal computed state b/c module 1
    // won't get re-run!
    expect(m.x).to.equal(-1);
    expect(module2.record().importers[0]).equals(module1.record(), 'imported module recorded in file2.js is not the record of file1.js');
  });

  it('modifies imports', async () => {
    await S.import(file2m);
    expect(module2.record().dependencies.map(ea => ea.name))
      .to.deep.equal([], 'deps before');
    await module2.changeSource(
      "import { z as x } from './sub-dir/file3.js'; export var y = x + 1;",
      { evaluate: true });
    expect(module2.record().dependencies.map(ea => ea.name))
      .to.deep.equal([file3m], 'deps after');
  });

  it('affects dependent modules', async () => {
    let m1 = await S.import(file1m);
    expect(module1.env()).deep.property('recorder.y').equal(1, 'internal state before change');
    expect(m1.x).to.equal(3, 'before change');
    await changeModule2Source();
    expect(module1.env()).deep.property('recorder.y').to.equal(2, 'internal state after change');
    // We expect to still have the same internal computed state b/c module 1
    // won't get re-run!
    expect(m1.x).to.equal(3, 'state after change');
  });

  it('affects eval state', async () => {
    await changeModule2Source();
    expect(module2.env().recorder).property('y').equal(2);
    expect(module2.env().recorder).property('internal').equal(2);
  });

  it('adds new exports', async () => {
    let m = await S.import(file2m);
    expect(m).to.not.have.property('foo');
    await module2.changeSource(
      "import { z as x } from './sub-dir/file3.js'; export var y = 3; export var foo = 4;",
      { evaluate: true });
    expect(module2.env().recorder).property('y').equal(3);
    expect(module2.env().recorder).property('foo').equal(4);
    expect(m).property('y').equal(3);
    expect(module2.record()).property('exports')
      .deep.equal({ foo: 4, y: 3, someFn: m.someFn }, 'module record');
    expect(m).property('foo').equal(4, 'module not changes');
    let m_reimported = await S.import(file2m);
    expect(m_reimported).property('foo').equal(4, 'when re-importing, new export missing?');
    expect(m).equal(m_reimported, 'module identity has changed');
  });

  it('source change updates module dependency info', async () => {
    await S.import(module2.id);
    await S.import(module4.id);
    expect(module2.record().importers).deep.equals([]);
    expect(module4.record().dependencies).deep.equals([]);
    expect(module4.record().importers).deep.equals([]);

    await module4.changeSource("import { y } from './file2.js'", { evaluate: true });

    expect(module2.record().importers).to.containSubset([{ name: module4.id }]);
    expect(module4.record().dependencies).to.containSubset([{ name: module2.id }]);
    expect(module4.record().importers).deep.equals([]);
  });

  it('function dependencies are updated', async () => {
    let m1 = await S.import(module1.id);
    expect(m1.someOtherFn(1)).equals(24);
    await module2.changeSourceAction(src => src.replace('return 23', 'return 24'));
    expect(m1.someOtherFn(1)).equals(25);
  });

  it('affects file resource', async () => {
    await changeModule2Source();
    const newContent = await resource(file2m).read();
    expect(newContent).to.deep.equal('var internal = 2;\nexport var y = internal;\nexport function someFn() { return 23; }');
  });

  it('writes changes despite errors', async () => {
    try {
      await module2.changeSource('export export export');
    } catch (e) {}
    const newContent = await resource(file2m).read();
    expect(newContent).to.deep.equal('export export export');
  });
});

describe('code changes of global format module', () => {
  let dir = System.decanonicalize('lively.modules/tests/');
  let testProjectDir = dir + 'test-project-dir/';
  let file1m = `${testProjectDir}file1.js`;
  let testProjectSpec = {
    'file1.js': 'var zzz = 4; System.global.z = zzz / 2;',
    'package.json': JSON.stringify({
      name: 'test-project-1',
      main: 'file1.js',
      systemjs: { meta: { 'file1.js': { format: 'global', exports: 'z' } } }
    })
  };

  let S, module1;
  beforeEach(async () => {
    S = getSystem('test', { baseURL: dir });
    S.set('lively.transpiler', System.get('lively.transpiler'));
    S.config({ transpiler: 'lively.transpiler' });
    S.translate = async (load) => await System.translate.bind(S)(load);
    module1 = module(S, file1m);
    await createFiles(testProjectDir, testProjectSpec);
    await S.import(testProjectDir + 'file1.js');
  });

  afterEach(() => {
    try { delete S.global.z; } catch (e) {}
    try { delete S.global.zzz; } catch (e) {}
  });

  afterEach(async () => { removeSystem('test'); await resource(testProjectDir).remove(); });

  it('modifies module and its exports', async () => {
    let m = await S.import(file1m);
    expect(module1.env().recorder.zzz).to.equal(4, 'zzz state before change');
    expect(m.z).to.equal(2, 'export state before change');
    await module1.changeSourceAction(s => s.replace(/zzz = 4;/, 'zzz = 6;'));
    await module1.reload();
    expect(module1.env().recorder.zzz).to.equal(6, 'zzz state after change');
    // expect(m.z).to.equal(3, "export state after change");
    m = await S.import(file1m);
    expect(m.z).to.equal(3, 'export state after change and re-import');
  });

  it('affects eval state', async () => {
    await S.import(file1m);
    await module1.changeSourceAction(s => s.replace(/zzz = 4/, 'zzz = 6'));
    await module1.reload();
    expect(module1.env().recorder).property('zzz').equal(6);
    expect(module1.env().recorder).property('z').equal(3);
  });
});

describe('persistent definitions', () => {
  let dir = System.decanonicalize('lively.modules/tests/');
  let testProjectDir = dir + 'test-project-2-dir/';
  let testProjectSpec = {
    'file1.js': "'format esm'; class Foo { m() { return 23 }}\nvar x = {bar: 123, foo() { return this.bar + 42 }}\n",
    'package.json': '{"name": "test-project-2", "main": "file1.js"}'
  };
  let file1m = testProjectDir + 'file1.js';

  let S, module1;
  beforeEach(async () => {
    S = getSystem('test', { baseURL: testProjectDir });
    S.set('lively.transpiler', System.get('lively.transpiler'));
    S.config({ transpiler: 'lively.transpiler' });
    S.translate = async (load) => await System.translate.bind(S)(load);
    module1 = module(S, file1m);
    await createFiles(testProjectDir, testProjectSpec);
  });

  afterEach(async () => {
    removeSystem('test');
    await resource(testProjectDir).remove();
  });

  it('keep identity of class', async () => {
    await S.import(file1m);
    let class1 = module1.env().recorder.Foo;
    expect(new class1().m()).equals(23, 'Foo class not working');
    await module1.changeSourceAction(s => "'format esm'; class Foo { m() { return 24 }}\n");
    let class2 = module1.env().recorder.Foo;
    expect(new class2().m()).equals(24, 'Foo class not changed');
    expect(class1).equals(class2, 'Foo class identity changed');
  });

  it("don't keep identity of anonymous class", async () => {
    await S.import(file1m);
    let class1 = module1.env().recorder.Foo;
    expect(new class1().m()).equals(23, 'Foo class not working');
    await module1.changeSourceAction(s => 'let Foo = class { m() { return 24 }}\n');
    let class2 = module1.env().recorder.Foo;
    expect(new class2().m()).equals(24, 'Foo class not changed');
    expect(class1).not.equals(class2, 'Foo class identity the same');
  });
});

describe('notifications of toplevel changes', () => {
  let S, module1, module2, module4;
  beforeEach(async () => {
    S = getSystem('test', { baseURL: testProjectDir });
    S.set('lively.transpiler', System.get('lively.transpiler'));
    S.config({ transpiler: 'lively.transpiler' });
    S.translate = async (load) => await System.translate.bind(S)(load);
    module1 = module(S, file1m);
    module2 = module(S, file2m);
    module4 = module(S, file4m);
    await createFiles(testProjectDir, testProjectSpec);
  });

  afterEach(async () => { removeSystem('test'); await resource(testProjectDir).remove(); });

  it('triggers notification on change', async () => {
    let seen = {};
    module4.subscribeToToplevelDefinitionChanges((key, val) => seen[key] = val);
    await module4.load();
    expect(seen).containSubset({ x: 23 });
    seen = {};
    await module4.changeSource("'format esm'; var x = 24;", { evaluate: true });
    expect(seen).containSubset({ x: 24 });
  });

  it('triggers notification via module binding', async () => {
    await module1.load();
    let seen = {};
    module1.subscribeToToplevelDefinitionChanges((key, val) => seen[key] = val);
    await module2.changeSource("'format esm'; \nvar y = 123;", { evaluate: true });
    expect(seen).containSubset({ y: 123 });
  });
});
