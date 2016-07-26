/*global describe, it, beforeEach, afterEach*/
import { expect, chai } from "mocha-es6";

import { obj } from "lively.lang";
import { ObjectPool, ObjectRef, serialize } from "../index.js";

function serializationRoundtrip(obj) {
  var ref = objPool.add(obj);
  return ObjectPool.fromJSONSnapshot(objPool.jsonSnapshot()).resolveToObj(ref.id);
}


function itSerializesInto(subject, expected) {
  var title = `serializes ${String(subject)} into ${JSON.stringify(expected)}`
  return it(title, () => {
    expect(obj.values(serialize(subject))[0]).deep.equals(expected);
  });
}

var objPool;

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
    var o = {foo: 23, ref: {bar: 24}},
        ref = objPool.add(o),
        snapshot = objPool.jsonSnapshot(),
        objPool2 = ObjectPool.fromJSONSnapshot(snapshot);
    expect(objPool2.resolveToObj(ref.id)).not.equals(o, "identical object");
    expect(objPool2.resolveToObj(ref.id)).deep.equals({...o, _rev: 0, ref: {...o.ref, _rev: 0}}, "object structure changed");
    expect(objPool.objects()).to.have.length(2);
    expect(objPool2.objects()).containSubset(objPool.objects(), "object list diverged");
  });

});


describe("marshalling", () => {

  beforeEach(() => objPool = new ObjectPool());

  describe("symbols", () => {

    itSerializesInto(Symbol.for("test"), {__expr__: 'Symbol.for("test")'});
    itSerializesInto(Symbol.iterator, {__expr__: 'Symbol.iterator'});

    it("registers custom symbol", () => {
      var s = Symbol("foo"),
          ref = objPool.add(s);
      expect(ref).to.have.property("id")
      expect(ref.isObjectRef).equals(true);
      objPool.snapshot();
      expect(ref.currentSnapshot.__expr__).equals('Symbol("foo")');
      expect(objPool.resolveToObj(ref.id)).equals(s);
    });

    it("snapshots object with named / known symbols", () => {
      var obj = {foo: Symbol.for("test"), bar: Symbol.iterator},
          {foo, bar} = serializationRoundtrip(obj);
      expect(foo).equals(Symbol.for("test"));
      expect(bar).equals(Symbol.iterator);
    });

    it("snapshots object with custom symbols", () => {
      var obj = {foo: Symbol("test")},
          {foo} = serializationRoundtrip(obj);
      expect(foo).not.equals(obj.foo);
      expect(foo).stringEquals(obj.foo);
    });

    it("property symbols are ignored", () => {
      var obj = {[Symbol.for("test")]: 23, foo: 24};
      expect(serializationRoundtrip(obj)).deep.equals({foo: 24, _rev: 0});
    });

    it("serializes symbol directly", () => {
      var obj = {foo: Symbol("test")},
          obj2 = serializationRoundtrip(Symbol("test"));
      expect(obj2).not.equals(obj);
      expect(obj2).stringEquals(Symbol("test"));
    });

  });

  describe("serialized expressions", () => {

    it("simple", () => {
      var exprObj = {n: 1, __serialize__() { return {__expr__: `({n: ${this.n + 1}, __serialize__: ${this.__serialize__}})` }}},
          obj = {foo: exprObj},
          {id} = objPool.add(obj),
          objPool2 = ObjectPool.fromSnapshot(objPool.snapshot()),
          obj2 = objPool2.resolveToObj(id);
      expect(obj2).deep.property("foo.n", 2);
      expect(obj2.foo).property("__serialize__").to.be.a("function");
    });

    it("with expression evaluator", () => {
      var proto = {n: 1, __serialize__() { return {__expr__: `foo(${this.n+1})`}; }},
          obj = obj = {foo: Object.create(proto)},
          {id} = objPool.add(obj),
          objPool2 = new ObjectPool();


      objPool2.expressionEvaluator = exprObj => {
        var e = exprObj.__expr__;
        if (e.startsWith("foo")) return Object.create(proto, {n: {value: Number(e.match(/[0-9]+/)[0])}})
        return undefined;
      };

      objPool2.readSnapshot(objPool.snapshot());

      var obj2 = objPool2.resolveToObj(id);
      expect(obj2).deep.property("foo.n", 2);
      expect(obj2.foo).property("__serialize__").to.be.a("function");
    });

    it("serialized object is expr itself", () => {
      var exprObj = {n: 1, __serialize__() { return {__expr__: `({n: ${this.n + 1}})`} }},
          {id} = objPool.add(exprObj),
          objPool2 = ObjectPool.fromSnapshot(objPool.snapshot()),
          obj2 = objPool2.resolveToObj(id);
      expect(obj2).property("n", 2);
    });

  });

  describe("nested arrays", () => {

    it("serialize correctly", () => {
      var obj1a = {foo: 23},
          obj2a = {bar: [123, [obj1a]]},
          {id: id1a} = objPool.add(obj1a),
          {id: id2a} = objPool.add(obj2a),
          objPool2 = ObjectPool.fromSnapshot(objPool.snapshot()),
          obj2b = objPool2.resolveToObj(id2a),
          obj1b = objPool2.resolveToObj(id1a);

      expect(obj2b).containSubset({bar: [123, [{foo: 23}]]});

      expect(obj2b.bar[1][0]).equals(obj1b);
    });

  });
});

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function benchmarks() {

  var n = 100;
  var objs = Array.range(1,n).map(i => ({n: i}))
  objs.slice(0, -1).forEach((obj, i) => obj.next = objs[i+1]);
  objs[objs.length-1].first = objs[0]

  lively.lang.fun.timeToRunN(() => { new ObjectPool().add(objs[0]) }, 1000)

  lively.lang.fun.timeToRunN(() => {
    var r = new ObjectPool();
    r.add(objs[0])
    objPool.snapshot()
  }, 1000);


console.profile("s")
// var uuids = Array.range(0,10000).map(ea => lively.lang.string.newUUID())
  lively.lang.fun.timeToRunN(() => {
    var r = new ObjectPool(() => uuids.pop() || lively.lang.string.newUUID());
    r.add(objs[0])
    // var r2 = ObjectPool.fromJSONSnapshot(r.jsonSnapshot())
    var r2 = ObjectPool.fromSnapshot(r.snapshot())
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