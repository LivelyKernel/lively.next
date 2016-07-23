/*global describe, it, beforeEach, afterEach*/
import { expect, chai } from "mocha-es6";

import { ObjectPool, ObjectRef } from "../index.js";

function serializationRoundtrip(obj, serializer = new ObjectPool()) {
    var ref = objPool.add(obj);
    return ObjectPool.fromJSONSnapshot(objPool.jsonSnapshot()).resolveToObj(ref.id);
}

var objPool;

describe("marshalling", () => {

  describe("symbols", () => {

    beforeEach(() => objPool = new ObjectPool());

    it("register named and known sym => expression", () => {
      expect(objPool.add(Symbol.for("test"))).deep.equals({__expr__: 'Symbol.for("test")'});
      expect(objPool.add(Symbol.iterator)).deep.equals({__expr__: 'Symbol.iterator'});
    });

    it("registers custom symbol", () => {
      var s = Symbol("foo"),
          ref = objPool.add(s);
      expect(ref).to.have.property("id")
      expect(ref.isObjectRef).equals(true);
      expect(ref.serializedObj.__recreate__).equals('Symbol("foo")');
      expect(objPool.resolveToObj(ref.id)).equals(s);
    });

    it("snapshots object with named / known symbols", () => {
      var obj = {foo: Symbol.for("test"), bar: Symbol.iterator},
          {foo, bar} = serializationRoundtrip(obj);
      expect(foo).equals(Symbol.for("test"));
      expect(bar).equals(Symbol.iterator);
    });

    it("snapshots object with custom symbols", () => {
// registry = new Registry()
//     var ref = registry.add(obj);
//     registry.jsonSnapshot()
//     Registry.fromJSONSnapshot(registry.jsonSnapshot()).resolveToObj(ref.id)

      var obj = {foo: Symbol("test")},
          {foo} = serializationRoundtrip(obj);
      expect(foo).not.equals(obj.foo);
      expect(foo).stringEquals(obj.foo);
    });

    xdescribe("deserializes", () => {

      it("unknown sym", () => {
      });
    })
  });
});

describe("object registration", () => {
  beforeEach(() => objPool = new ObjectPool());

  it("registers objects", () => {
    var o = {id: "123"},
        ref = objPool.add(o);
    expect(objPool.resolveToObj("123")).equals(o, "object not found in pool");
    expect(objPool.resolveToObj("1234")).equals(undefined, "unknown id returned sth");
    expect(ref.id).equals("123");
  });

  it("pool remembers objects", () => {
    var o = {},
        ref1 = objPool.add(o),
        ref2 = objPool.add(o);
    expect(objPool.resolveToObj(ref1.id)).equals(o);
    expect(ref1).equals(ref2, "different refs");
  });

});


describe("snapshots", () => {

  beforeEach(() => objPool = new ObjectPool());

  it("snapshots", () => {
    var o = {foo: 23},
        ref = objPool.add(o),
        snapshot = objPool.jsonSnapshot(),
        objPool2 = ObjectPool.fromJSONSnapshot(snapshot);
    expect(objPool2.resolveToObj(ref.id)).not.equals(o, "identical object");
    expect(objPool2.resolveToObj(ref.id)).deep.equals(o, "object structure changed");
    expect(objPool.objects()).deep.equals(objPool2.objects(), "object list diverged");
  })

})


function benchmarks() {

  var n = 100;
  var objs = Array.range(1,n).map(i => ({n: i}))
  objs.slice(0, -1).forEach((obj, i) => obj.next = objs[i+1]);
  objs[objs.length-1].first = objs[0]

  lively.lang.fun.timeToRunN(() => { new ObjectPool().add(objs[0]) }, 1000)
  lively.lang.fun.timeToRunN(() => {
    var r = new ObjectPool();
    r.add(objs[0])
    objPool.jsonSnapshot()
  }, 1000);

console.profile("s")
  lively.lang.fun.timeToRunN(() => {
    var r = new ObjectPool();
    r.add(objs[0])
    var r2 = ObjectPool.fromJSONSnapshot(r.jsonSnapshot())
  }, 100);
console.profileEnd("s")

  lively.lang.fun.timeToRunN(() => {
    lively.persistence.Serializer.copy(objs[0])
  }, 100);

  var firstNewObj = objPool2.resolveToObj(objPool.ref(objs[0]).id)
  expect(objs[0]).not.equals(firstNewObj)
  expect(objs[0]).deep.equals(firstNewObj)
  expect(objs).deep.equals(objPool2.objects())


}