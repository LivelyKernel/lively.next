/* global beforeEach, afterEach, describe, it */

import { expect } from 'mocha-es6';

import { getSystem, removeSystem } from '../src/system.js';
import module from '../src/module.js';
import { registerPackage } from '../src/packages/package.js';
import { runEval } from 'lively.vm';
import { createFiles, resource } from 'lively.resources';

let dir = 'local://lively.modules-instrumentation-test/';
let testProjectDir = dir + 'test-project-dir/';
let testProjectSpec = {
  'file1.js': "import { y } from './file2.js'; export var x = y + 2;",
  'file2.js': 'export var y = 1;',
  'file3.js': 'var zzz = 4; System.global.z = zzz / 2;',
  'file4.js': 'export default class Foo { static bar() {} }; Foo.bar();',
  'file5.js': "import Foo from './file4.js'; class Bar extends Foo {}",
  'package.json': JSON.stringify({
    name: 'test-project-1',
    version: '1.2.3',
    main: 'file1.js',
    systemjs: { meta: { 'file3.js': { format: 'global', exports: 'z' } } }
  })
};

let S, module1, module3, module4, module5;

async function setup () {
  S = getSystem('test', { baseURL: dir });
  S.set('lively.transpiler', System.get('lively.transpiler'));
  S.config({ transpiler: 'lively.transpiler' });
  S.babelOptions = System.babelOptions;
  S.translate = async (load) => await System.translate.bind(S)(load);
  module1 = module(S, testProjectDir + 'file1.js');
  module3 = module(S, testProjectDir + 'file3.js');
  module4 = module(S, testProjectDir + 'file4.js');
  module5 = module(S, testProjectDir + 'file5.js');
  try { delete S.global.z; } catch (e) {}
  try { delete S.global.zzz; } catch (e) {}
  await createFiles(testProjectDir, testProjectSpec);
  await S.import(testProjectDir + 'file1.js');
}

function teardown () {
  removeSystem('test');
  return resource(testProjectDir).remove();
}

describe('instrumentation', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('gets access to internal module state', async () => {
    expect(module1).to.have.deep.property('recorder.y', 1);
    expect(module1).to.have.deep.property('recorder.x', 3);
  });

  it('modules can (re)define captures', async () => {
    module1.define('y', 2);
    expect(module1.recorder).to.have.property('y', 2);
    module1.define('newVar', 3);
    expect(module1.recorder).to.have.property('newVar', 3);
  });

  it('modules can undefine captures', async () => {
    module1.undefine('y');
    expect(module1.recorder).to.not.have.property('y');
    expect(module1.recorder).to.have.property('x', 3);
  });

  describe('definition callback', () => {
    let recorded;
    beforeEach(() => {
      let origDefine = module1.define;
      module1.define = (varName, value, exportImmediately = true, meta) => {
        recorded = { varName, value, meta };
        return origDefine.call(module1, varName, value, exportImmediately, meta);
      };
    });

    it('with function', async () => {
      await module1.changeSource('function foo() {}');
      expect(recorded.meta.evalId).match(/\d+/);
      expect(recorded).to.containSubset({
        varName: 'foo',
        value: () => module1.recorder.foo,
        meta: { end: 17, moduleSource: 'function foo() {}', start: 0, kind: 'function' }
      });
    });

    it('with class', async () => {
      await module1.changeSource('class Foo {}');
      expect(recorded).to.containSubset({
        varName: 'Foo',
        value: () => module1.recorder.Foo,
        meta: { end: 12, moduleSource: 'class Foo {}', start: 0, kind: 'class' }
      });
    });
  });

  describe('of global modules', () => {
    it('can access local state', () =>
      S.import(`${testProjectDir}file3.js`)
        .then(() => {
          expect(module3).to.have.deep.property('recorder.zzz', 4);
          expect(S.get(testProjectDir + 'file3.js').default).to.have.property('z', 2);
        }));
  });

  describe('classes', function () {
    let supersym = Symbol.for('lively-instance-superclass');

    it('class export is recorded', async () => {
      let exports = await S.import(`${testProjectDir}file4.js`);
      expect(exports.default).is.a('function');
      expect(module4).to.have.deep.property('recorder.Foo');
      expect(exports.default).to.equal(module4.recorder.Foo);
    });

    it('classes have module meta data', async () => {
      await registerPackage(S, testProjectDir);
      await S.import(`${testProjectDir}file4.js`);
      let Foo = module4.recorder.Foo;
      expect(Foo[Symbol.for('lively-instance-superclass')]).equals(Object);
      expect(Foo[Symbol.for('lively-module-meta')]).containSubset({
        package: {
          name: 'test-project-1',
          version: '1.2.3'
        },
        pathInPackage: 'file4.js'
      });
    });

    it('classes are updated when their toplevel superclasses change', async () => {
      await S.import(`${testProjectDir}file5.js`);
      module5.recorder.Bar[Symbol.for('lively-instance-superclass')];
      expect(module5.recorder.Bar[supersym]).equals(module4.recorder.Foo);
      await runEval('export default class Baz {}', { System: S, targetModule: module4.id });
      expect(module5.recorder.Bar[supersym]).equals(module4.recorder.Baz, "didn't update class");
    });
  });
});
