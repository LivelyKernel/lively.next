/* global describe, it, beforeEach, afterEach,System */
import { expect } from 'mocha-es6';

import { ObjectPool, deserialize, serialize, ObjectRef } from '../index.js';
import ClassHelper from '../class-helper.js';
import { resource } from 'lively.resources';
import { version as serializerVersion } from '../package.json';
import { module } from 'lively.modules/index.js';

function serializationRoundtrip (obj, serializer = ObjectPool.withDefaultPlugins()) {
  let snapshotAndId = JSON.parse(JSON.stringify(objPool.snapshotObject(obj)));
  return ObjectPool.withDefaultPlugins().resolveFromSnapshotAndId(snapshotAndId);
}

let serializerPackage = System.decanonicalize('lively.serializer/');
let relativeTestModulePath = System.decanonicalize('./tests/class-plugin-test.js');

class TestDummy {
  constructor (n) { this.n = n; }
  get someProperty () { return 23; }
  m1 () { return this.n + 1; }
  toString () { return 'a ' + this.constructor.name; }
}

let objPool, instance1, instance2, refInstance1;

describe('class serialization', function () {
  beforeEach(() => {
    instance1 = new TestDummy(1);
    instance2 = new TestDummy(2);
    instance1.friend = instance2;
    instance2.specialProperty = 'some string';
    objPool = ObjectPool.withDefaultPlugins();
    refInstance1 = objPool.add(instance1);
  });

  it('serialize class instance', function () {
    // serialization
    let instance1_copy = ObjectPool.withDefaultPlugins()
      .resolveFromSnapshotAndId({ id: refInstance1.id, snapshot: objPool.snapshot() });

    expect(instance2.specialProperty).to.equal(instance1_copy.friend.specialProperty);
    expect(instance1.n).to.equal(instance1_copy.n);

    expect(instance1_copy).instanceOf(TestDummy, 'obj1_b');
    expect(instance1_copy.friend).instanceOf(TestDummy, 'obj2_b');

    expect().assert(instance1_copy.m1, 'deserialized does not have method');
    expect(2).to.equal(instance1_copy.m1(), 'wrong method invocation result');

    Object.defineProperty(TestDummy.prototype, 'someProperty', { configurable: true, value: -1 });
    // SmartRefTestDummy.prototype.someProperty = -1; // change after serialization
    let observed = instance1_copy.someProperty;
    Object.defineProperty(TestDummy.prototype, 'someProperty', { configurable: true, value: 23 });
    expect(-1).to.equal(observed, 'proto prop');

    expect(TestDummy).to.equal(instance1_copy.constructor, 'constructor 1');
    expect(TestDummy).to.equal(instance1_copy.friend.constructor, 'constructor 2');
    expect().assert(instance1_copy instanceof TestDummy, 'instanceof 1');
    expect().assert(instance1_copy.friend instanceof TestDummy, 'instanceof 2');
  });

  it('find packages and modules of classes in serialized blob', function () {
    let serialized = objPool.snapshot();
    let result = ClassHelper.sourceModulesIn(serialized);

    expect(result).to.containSubset([{
      className: 'TestDummy',
      module: {
        package: { name: 'lively.serializer2', version: serializerVersion },
        pathInPackage: 'tests/class-serialization-test.js'
      }
    }]);
  });

  it('raise error when class not found', function () {
    let objPool = ObjectPool.withDefaultPlugins();
    let klass = class Dummy_testRaiseErrorWhenClassNotFound {};
    let instance = new klass();
    let _ = objPool.add(instance);
    let serialized = objPool.snapshot();
    try {
      ObjectPool.withDefaultPlugins({ ignoreClassNotFound: false }).readSnapshot(serialized);
    } catch (e) {
      expect(String(e)).match(/Trying to deserialize instance of.*Dummy_testRaiseErrorWhenClassNotFound.*but this class cannot be found/i);
      return;
    }
    expect().assert(false, 'No error rasied when deserializing obj without class');
  });

  it('raise no error when class not found when overridden', function () {
    let objPool = ObjectPool.withDefaultPlugins();
    let klass = class Dummy_testDontRaiseErrorWhenClassNotFound {};
    let instance = new klass();
    let serialized = objPool.snapshotObject(instance);
    try {
      var result = ObjectPool.withDefaultPlugins({ ignoreClassNotFound: true })
        .resolveFromSnapshotAndId(serialized);
    } catch (e) {
      expect().assert(false, `Should ignore class not found but raised error:\n${e}`);
    }
    expect().assert(result.isClassPlaceHolder);
    expect('Dummy_testDontRaiseErrorWhenClassNotFound').to.equal(result.className);
  });
});

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

let testModule = 'local://lively-serializer-class-test/class-prop-test.js';

describe('class properties', () => {
  beforeEach(async () => {
    let source = `export class Foo {
       static get properties() {
         return {
           foo: {defaultValue: 23, serialize: false},
           bar: {defaultValue: 24},
         }
       }
       constructor() { this.initializeProperties(); }
    }`;
    await System.resource(testModule).write(source);
    await System.import(testModule);
  });

  afterEach(async () => module(testModule).unload());

  it('it can ignore properties and initializes them', async () => {
    let { Foo } = System.get(testModule);
    let instance = new Foo();
    let { id, snapshot } = serialize(new Foo());
    expect(snapshot[id].props).deep.equals({ bar: { value: 24 } });
    let instance2 = deserialize({ id, snapshot });
    expect(instance2.foo).equals(23);
    expect(instance2.bar).equals(24);
  });
});
