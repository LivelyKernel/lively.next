/* global beforeEach, afterEach, describe, it */
import { expect } from 'mocha-es6';
import { promise } from 'lively.lang';
import { createFiles, resource } from 'lively.resources';
import { prepareSystem } from './helpers.js';
import { removeSystem } from '../src/system.js';
import module from '../src/module.js';
import { setupBabelTranspiler } from 'lively.source-transform/babel/plugin.js';

describe('missing import diagnostics', () => {
  const dir = 'local://import-diagnostics/';
  let system, warn, warnings;
  beforeEach(async () => {
    system = prepareSystem('import-diagnostics', dir);
    setupBabelTranspiler(system);
    await createFiles(dir, {
      'dependency.js': 'export default { answer: 42 }; export var optional;',
      'named-only.js': 'export var answer = 42;',
      'empty.js': 'export {};',
      'disabled.js': "import optional, { named } from 'disabled'; export var result = [optional, named];",
      'missing-from-empty.js': "import optional, { named } from './empty.js'; export var result = [optional, named];",
      'cycle-a.js': "import { b } from './cycle-b.js'; export var a = 1; export function read() { return b; }",
      'cycle-b.js': "import { a } from './cycle-a.js'; export var b = 2; export function read() { return a; }",
      'missing.js': "import { answer } from './dependency.js'; export var result = answer;",
      'valid.js': "import pkg, { optional } from './dependency.js'; import * as all from './dependency.js'; export var result = [pkg.answer, optional, all.default.answer];"
    });
    warnings = [];
    warn = console.warn;
    console.warn = message => warnings.push(message);
  });
  afterEach(async () => {
    console.warn = warn;
    removeSystem('import-diagnostics');
    await resource(dir).remove();
  });

  it('warns about a normal module import and suggests the default object when applicable', async () => {
    await system.import(dir + 'missing.js');
    await promise.delay(100);
    expect(warnings.join('\n')).includes('answer');
    expect(warnings.join('\n')).includes(dir + 'missing.js');
    expect(warnings.join('\n')).includes('default');
    expect(warnings.join('\n')).includes('.answer');
  });

  it('gives the same useful guidance for evaluated imports', async () => {
    await system.import(dir + 'dependency.js');
    module(system, dir + 'eval.js').recorder._moduleImport('./dependency.js', 'answer');
    expect(warnings.join('\n')).includes('default');
    expect(warnings.join('\n')).includes('.answer');
  });

  it('lists available named exports for a missing default import', async () => {
    await system.import(dir + 'named-only.js');
    module(system, dir + 'eval.js').recorder._moduleImport('./named-only.js', 'default');
    expect(warnings.join('\n')).includes('Available exports: answer');
  });

  it('accepts undefined exports and namespace imports without warnings', async () => {
    const exports = await system.import(dir + 'valid.js');
    await promise.delay(100);
    expect(exports.result).deep.equals([42, undefined, 42]);
    expect(warnings).deep.equals([]);
  });

  it('accepts default and named imports intentionally mapped to @empty', async () => {
    system.config({ map: { disabled: '@empty' } });
    const exports = await system.import(dir + 'disabled.js');
    const recorder = module(system, dir + 'eval.js').recorder;
    expect(recorder._moduleImport('disabled', 'default')).equals(undefined);
    expect(recorder._moduleImport('disabled', 'named')).equals(undefined);
    await promise.delay(100);
    expect(exports.result).deep.equals([undefined, undefined]);
    expect(warnings).deep.equals([]);
  });

  it('still diagnoses missing exports from ordinary empty modules', async () => {
    await system.import(dir + 'missing-from-empty.js');
    await promise.delay(100);
    expect(warnings.join('\n')).includes(`Import of default from ${dir}empty.js`);
    expect(warnings.join('\n')).includes(`Import of named from ${dir}empty.js`);
    warnings.length = 0;
    const recorder = module(system, dir + 'eval.js').recorder;
    recorder._moduleImport('./empty.js', 'default');
    recorder._moduleImport('./empty.js', 'named');
    expect(warnings.join('\n')).includes(`Import of default from ${dir}empty.js`);
    expect(warnings.join('\n')).includes(`Import of named from ${dir}empty.js`);
  });

  it('waits for circular modules to initialize before diagnosing their imports', async () => {
    const a = await system.import(dir + 'cycle-a.js');
    const b = await system.import(dir + 'cycle-b.js');
    await promise.delay(100);
    expect(a.read()).equals(2);
    expect(b.read()).equals(1);
    expect(warnings).deep.equals([]);
  });
});
