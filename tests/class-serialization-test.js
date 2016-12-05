/*global describe, it, beforeEach, afterEach*/
import { expect } from "mocha-es6";

import { ObjectPool, ObjectRef } from "../index.js";
import ClassHelper from "../class-helper.js";

function serializationRoundtrip(obj, serializer = new ObjectPool()) {
  var ref = objPool.add(obj);
  return ObjectPool.fromJSONSnapshot(objPool.jsonSnapshot()).resolveToObj(ref.id);
}


var serializerPackage = System.decanonicalize("lively.serializer/"),
    relativeTestModulePath = System.decanonicalize("./tests/class-plugin-test.js");

class TestDummy {
  constructor(n) { this.n = n }
  get someProperty() { return 23 }
  m1() { return this.n + 1 }
  toString() { return 'a ' + this.constructor.name }
}

var objPool, instance1, instance2, refInstance1;

describe('class serialization', function() {

  beforeEach(() => {
    instance1 = new TestDummy(1);
    instance2 = new TestDummy(2);
    instance1.friend = instance2;
    instance2.specialProperty = 'some string';
    objPool = new ObjectPool();
    refInstance1 = objPool.add(instance1);
  });

  it("serialize class instance", function() {
    // serialization
    var objPool2 = new ObjectPool().readSnapshot(objPool.snapshot());
    var instance1_copy = objPool2.resolveToObj(refInstance1.id);

    expect(instance2.specialProperty).to.equal(instance1_copy.friend.specialProperty);
    expect(instance1.n).to.equal(instance1_copy.n);

    expect(instance1_copy).instanceOf(TestDummy, "obj1_b");
    expect(instance1_copy.friend).instanceOf(TestDummy, "obj2_b");


    expect().assert(instance1_copy.m1, 'deserialized does not have method');
    expect(2).to.equal(instance1_copy.m1(), 'wrong method invocation result');

    Object.defineProperty(TestDummy.prototype, "someProperty", {configurable: true, value: -1});
    // SmartRefTestDummy.prototype.someProperty = -1; // change after serialization
    var observed = instance1_copy.someProperty;
    Object.defineProperty(TestDummy.prototype, "someProperty", {configurable: true, value: 23});
    expect(-1).to.equal(observed, 'proto prop');

    expect(TestDummy).to.equal(instance1_copy.constructor, 'constructor 1');
    expect(TestDummy).to.equal(instance1_copy.friend.constructor, 'constructor 2');
    expect().assert(instance1_copy instanceof TestDummy, 'instanceof 1');
    expect().assert(instance1_copy.friend instanceof TestDummy, 'instanceof 2');
  });

  it("find packages and modules of classes in serialized blob", function() {
    var serialized = objPool.jsonSnapshot(),
        result = ClassHelper.sourceModulesIn(JSON.parse(serialized));

    expect(result).to.deep.equal([{
      className: "TestDummy",
      module: {
        package: {name: "lively.serializer2", version: "0.1.0"},
        pathInPackage: "./tests/class-serialization-test.js"
      }
    }]);
  });

  it("raise error when class not found", function() {
    var objPool = new ObjectPool(),
        klass = class Dummy_testRaiseErrorWhenClassNotFound {},
        instance = new klass(),
        _ = objPool.add(instance),
        serialized = objPool.jsonSnapshot();
    try {
      ObjectPool.fromJSONSnapshot(serialized, {ignoreClassNotFound: false})
    } catch(e) {
      expect(String(e)).match(/Trying to deserialize instance of Dummy_testRaiseErrorWhenClassNotFound but this class cannot be found/i);
      return;
    }
    expect().assert(false, 'No error rasied when deserializing obj without class')
  });

  it("raise no error when class not found when overridden", function() {
  
    var objPool = new ObjectPool(),
        klass = class Dummy_testDontRaiseErrorWhenClassNotFound {},
        instance = new klass(),
        ref = objPool.add(instance),
        serialized = objPool.jsonSnapshot();
    try {
      var result = ObjectPool.fromJSONSnapshot(serialized, {ignoreClassNotFound: true}).resolveToObj(ref.id);
    } catch(e) {
      expect().assert(false, `Should ignore class not found but raised error:\n${e}`);
    }
    expect().assert(result.isClassPlaceHolder)
    expect("Dummy_testDontRaiseErrorWhenClassNotFound").to.equal(result.className)
  });

});
