/* global beforeEach, afterEach, describe, it,xit */

import { string } from 'lively.lang';
import { expect } from 'mocha-es6';
import ObjectPackage, { ensureLocalPackage, addScript, ensureObjectClass } from '../object-classes.js';
import { createFiles, resource } from 'lively.resources';
import { getSystem, registerPackage, removeSystem, scripting } from 'lively.modules';
import { importPackage, lookupPackage } from 'lively.modules/src/packages/package.js';
import module from 'lively.modules/src/module.js';
import { RuntimeSourceDescriptor } from '../source-descriptors.js';
import { adoptObject } from 'lively.lang/object.js';

let testBaseURL = 'local://object-scripting-test';
let project1Dir = testBaseURL + '/project1/';
let project1 = {
  'index.js': 'export var x = 23;',
  'file1.js': 'export class Foo {}',
  'file2.js': 'export default class Bar {}',
  'package.json': '{"name": "project1", "main": "index.js"}'
};
let testResources = {
  project1: project1
};

let S, opts, packagesToRemove;

describe('object package', function () {
  beforeEach(async () => {
    S = getSystem('test', { baseURL: testBaseURL });
    S.set('lively.transpiler', System.get('lively.transpiler'));
    S.config({ transpiler: 'lively.transpiler' });
    S.translate = async (load) => await System.translate.bind(S)(load);
    S._scripting = scripting;
    opts = { baseURL: testBaseURL, System: S };
    await createFiles(testBaseURL, testResources);
    await importPackage(S, 'project1');
    packagesToRemove = [];
  });

  afterEach(async () => {
    removeSystem('test');
    try {
      await Promise.all(packagesToRemove.map(ea => ea.remove()));
      await resource(testBaseURL).remove();
    } catch (err) {

    }
  });

  it('ensure object package', async () => {
    let p = ObjectPackage.withId('test-obj-package-' + string.newUUID(), opts);
    packagesToRemove.push(p);
    await p.ensureExistance();
    await p.objectModule.read();
    await p.resource('index.js').write('export let foo = 23');
    let { foo } = await p.load();
    expect(foo).equals(23);
    expect(ObjectPackage.forSystemPackage(p.systemPackage))
      .equals(p, 'cannot retrieve package for system package');
  });

  it('creates object package with object-class for object', async () => {
    let obj = { name: 'testObject' };
    let p = ObjectPackage.withId('package-for-test', opts);
    packagesToRemove.push(p);
    await p.adoptObject(obj);
    expect(obj.constructor.name).equals('PackageForTest');
    let { id } = ObjectPackage.lookupPackageForObject(obj, opts);
    expect(await resource(`${testBaseURL}/${id}/index.js`).read())
      .matches(/export default class PackageForTest/);
  });

  it('imports superclass of object class', async () => {
    let m = await module(S, project1Dir + 'file1.js').load();
    let obj = Object.assign(new m.Foo(), { name: 'testObject' });
    let p = ObjectPackage.withId('package-for-test', opts);
    packagesToRemove.push(p);
    await p.adoptObject(obj);

    let { id } = ObjectPackage.lookupPackageForObject(obj, opts);
    let source = await resource(`${testBaseURL}/${id}/index.js`).read();
    expect(source).matches(/import \{ Foo \} from/);
    expect(source).matches(/export default class PackageForTest/);
  });

  describe('addScript', () => {
    it('with simple object', async () => {
      let obj = { name: 'testObject' };
      let p = ObjectPackage.withId('package-for-test', opts);
      packagesToRemove.push(p);
      await p.adoptObject(obj);
      await addScript(obj, 'function(a) { return a + 1; }', 'foo', opts);
      expect(p.objectModule.systemModule.recorder.PackageForTest.prototype.foo, 'foo is defined').not.to.be.undefined;
      expect(obj.constructor).equals(p.objectModule.systemModule.recorder.PackageForTest);
      expect(obj.foo(1)).equals(2);
      expect(obj.constructor.prototype.foo).equals(obj.foo, 'not method of object class');
      await addScript(obj, 'function(a) { return 22; }', 'bar', opts);
      expect(p.objectModule.systemModule.recorder.PackageForTest.prototype.bar, 'bar is defined').not.to.be.undefined;
      expect(obj.foo(1)).equals(2);
      expect(obj.bar()).equals(22);
    });

    it('to object with anonymous class', async () => {
      let obj = new (class { x () { return 23; }})();
      let p = ObjectPackage.withId('package-for-test', opts);
      packagesToRemove.push(p);
      await p.adoptObject(obj);
      expect(obj.x()).equals(23, '1');
      await addScript(obj, 'function(a) { return a + 1; }', 'foo', { ...opts, package: p });
      expect(obj.foo(22)).equals(23);
      expect(obj.x()).equals(23, '2');
    });

    xit('rename object package', async () => {
      let obj = new (class { x () { return 23; }})();
      let p = ObjectPackage.withId('package-for-test', opts);
      packagesToRemove.push(p);
      await p.adoptObject(obj);
      await p.rename('package-for-test-2');

      expect(obj.constructor.name).equals('PackageForTest2');
      expect(p.id).equals('package-for-test-2');
      expect(ObjectPackage.withId('package-for-test-2', opts)).equals(p);
      expect(await resource(`${testBaseURL}/${p.id}/index.js`).read())
        .matches(/export default class PackageForTest2/);
      expect(await resource(`${testBaseURL}/${p.id}/package.json`).read())
        .matches(/"name": "package-for-test-2"/);
    });

    it('rename object class', async () => {
      let obj = new (class { x () { return 23; }})();
      let p = ObjectPackage.withId('package-for-test', opts);
      packagesToRemove.push(p);
      await p.adoptObject(obj);
      await p.renameObjectClass('PackageForTest2', [obj]);
      expect(p.objectClass.name).equals('PackageForTest2', 'class name not changed');
      expect(obj.constructor).equals(p.objectClass, 'class of instance not changed');
      expect(await p.objectModule.read()).match(/class PackageForTest2/, 'source not changed');
    });
  });

  describe('forking', () => {
    it('forks from package', async () => {
      let obj = { name: 'testObject' };
      let p = ObjectPackage.withId('TestObject', opts);
      await p.adoptObject(obj);

      await addScript(obj, 'function() { return 1; }', 'foo', { ...opts, package: p });
      expect(obj.foo()).equals(1, 'obj.foo 1');
      // let obj2 = new obj.constructor();
      // expect(obj2.foo()).equals(1, "obj2.foo 1");

      let p2 = await p.fork('TestObject2', opts);
      expect(p2.objectClass.name).equals('TestObject2');
      await p2.adoptObject(obj);
      expect(obj.constructor).equals(p2.objectClass);
      expect(obj.foo()).equals(1, 'obj.foo 1');
    });
  });
});
