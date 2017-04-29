/*global describe, it, beforeEach, afterEach*/
import { expect, chai } from "mocha-es6";

import { obj, arr } from "lively.lang";
import { ObjectPool, requiredModulesOfSnapshot, ObjectRef, serialize } from "../index.js";
import { Plugin, plugins } from "../plugins.js";

function serializationRoundtrip(obj) {
  var ref = objPool.add(obj);
  return ObjectPool.fromJSONSnapshot(objPool.jsonSnapshot(), objPool.options).resolveToObj(ref.id);
}


function itSerializesInto(subject, expected) {
  var title = `serializes ${String(subject)} into ${JSON.stringify(expected)}`
  return it(title, () => {
    var {id, snapshot} = serialize(subject, {objPool});
    expect(snapshot[id]).deep.equals(expected);
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
    expect(objPool2.resolveToObj(ref.id))
      .deep.equals({...o, _rev: 0, ref: {...o.ref, _rev: 0}}, "object structure changed");
    expect(objPool.objects()).to.have.length(2);
    expect(objPool2.objects()).containSubset(objPool.objects(), "object list diverged");
  });


  it("snapshots and replaces ids", () => {
    var o1 = {id: "o1"}, o2 = {id: "o2"}

    o1.bar = [o2];
    o2.o1 = o1;

    objPool.add(o1);

    var opts = {
      reinitializeIds(id, ref) {
        if (id === "o1") return "new_o1";
        if (id === "o2") return "new_o2";
        return null;
      }
    }

    var newO1 = ObjectPool.fromSnapshot(objPool.snapshot(), opts).resolveToObj("o1");
    expect(newO1).containSubset({id: "new_o1", bar: [{id: "new_o2", o1: {}}]});
  });


});


describe("marshalling", () => {

  beforeEach(() => objPool = new ObjectPool());

  describe("symbols", () => {

    beforeEach(() => objPool = new ObjectPool({plugins: [plugins.customSerializePlugin]}));

    itSerializesInto(Symbol.for("test"), {__expr__: '__lv_expr__:Symbol.for("test")'});
    itSerializesInto(Symbol.iterator, {__expr__: '__lv_expr__:Symbol.iterator'});

    it("registers custom symbol", () => {
      var s = Symbol("foo"),
          ref = objPool.add(s);
      expect(ref).to.have.property("id")
      expect(ref.isObjectRef).equals(true);
      objPool.snapshot();
      expect(ref.currentSnapshot.__expr__).equals('__lv_expr__:Symbol("foo")');
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

  describe("built-in js objects", () => {

    let pluginsForBuiltins = [plugins.customSerializePlugin, plugins.classPlugin, plugins.additionallySerializePlugin];

    it("Map", () => {
      let obj = {}, obj2 = {bar: 23},
          map = new Map([["a", 1], [obj2, 2], ["c", obj]]);
      obj.map = map;
      obj.obj2 = obj2;
      objPool = ObjectPool.withObject(obj, {plugins: pluginsForBuiltins});

      let objCopy = serializationRoundtrip(obj),
          copiedMap = objCopy.map;
      expect(copiedMap).instanceof(Map);
      expect(copiedMap.get("a")).equals(1);
      expect(copiedMap.get(objCopy.obj2)).equals(2);
      expect(copiedMap.get("c")).equals(objCopy);
    });

    it("Set", () => {
      let obj = {}, obj2 = {bar: 23},
          set = new Set(["a", obj, obj2]);
      obj.set = set;
      obj.obj2 = obj2;
      objPool = ObjectPool.withObject(obj, {plugins: pluginsForBuiltins});

      let objCopy = serializationRoundtrip(obj),
          entries = Array.from(objCopy.set.values());
      expect(entries).to.have.length(3);
      expect(entries[0]).equals("a");
      expect(entries[1]).equals(objCopy);
      expect(entries[2]).equals(objCopy.obj2);
    });

  });

  describe("serialized expressions", () => {

    beforeEach(() => objPool = new ObjectPool({plugins: [plugins.customSerializePlugin]}));

    it("simple", () => {
      function __serialize__() {
        return {
          __expr__: `({n: ${this.n + 1}, __serialize__: ${String(this.__serialize__)}})`
        }
      }
      var exprObj = {n: 1, __serialize__},
          obj = {foo: exprObj},
          {id} = objPool.add(obj),
          objPool2 = ObjectPool.fromSnapshot(objPool.snapshot(), objPool.options),
          obj2 = objPool2.resolveToObj(id);
      expect(obj2).deep.property("foo.n", 2);
      expect(obj2.foo).property("__serialize__").to.be.a("function");
    });

    it("serialized object is expr itself", () => {
      var exprObj = {n: 1, __serialize__() { return {__expr__: `({n: ${this.n + 1}})`} }},
          {id} = objPool.add(exprObj),
          objPool2 = ObjectPool.fromSnapshot(objPool.snapshot(), objPool.options),
          obj2 = objPool2.resolveToObj(id);
      expect(obj2).property("n", 2);
    });

    it("__serialize__ in property is inlined in snapshot", () => {
      var foo = {__serialize__: () => ({__expr__: "foo()"})},
          obj = {foo},
          {id} = objPool.add(obj),
          snapshot = objPool.snapshot();
      expect(snapshot).deep.equals(
        {[id]: {rev: 0, props: {foo: {key: "foo", value: "__lv_expr__:foo()"}}}});
      try {
        System.global.foo = () => foo;
        var obj2 = ObjectPool.fromSnapshot(objPool.snapshot(), objPool.options).resolveToObj(id);
      } finally { delete System.global.foo; }
      expect(obj2).deep.equals(obj2, "deserialize not working");
    });

    it("bindings via object import", async () => {
      // lively.modules.module("lively.serializer2/tests/test-resources/module1.js").unload()
      await System.import("lively.serializer2/tests/test-resources/module1.js");

      var exprObj = {
            n: 1, __serialize__() {
              return {
                __expr__: `createSomeObject(${this.n})`,
                bindings: {"lively.serializer2/tests/test-resources/module1.js": ["createSomeObject"]}
              }
            }
          },
          _ = objPool.add(exprObj),
          obj2 = ObjectPool.fromSnapshot(objPool.snapshot(), objPool.options).objects()[0];
      expect(obj2).property("n", 2);
    });

    it("finds required modules", async () => {
      // lively.modules.module("lively.serializer2/tests/test-resources/module1.js").unload()
      await System.import("lively.serializer2/tests/test-resources/module1.js");

      var exprObj = {
            n: 1, __serialize__() {
              return {
                __expr__: `createSomeObject(${this.n})`,
                bindings: {"lively.serializer2/tests/test-resources/module1.js": ["createSomeObject"]}
              }
            }
          },
          _ = objPool.add(exprObj);

      expect(requiredModulesOfSnapshot(objPool.snapshot()))
        .equals(["lively.serializer2/tests/test-resources/module1.js"])
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

  describe("ignore properties", () => {

    beforeEach(() => (objPool = new ObjectPool({plugins: [plugins.onlySerializePropsPlugin, plugins.dontSerializePropsPlugin]})));

    it("via __dont_serialize__", () => {
      var obj = {foo: 23, bar: 24, __dont_serialize__: ["bar"]},
          ref = objPool.add(obj),
          objCopy = ObjectPool.fromSnapshot(objPool.snapshot()).resolveToObj(ref.id);
      expect(objCopy).deep.equals({_rev: 0, foo: 23, __dont_serialize__: ["bar"]});
    });

    it("__dont_serialize__ is merged in proto chain", () => {
      var proto = Object.assign(Object.create({__dont_serialize__: ["bar"]}), {__dont_serialize__: ["baz"]}),
          obj = Object.assign(Object.create(proto), {__dont_serialize__: ["zork"], foo: 1, bar: 2, baz: 3, zork: 4}),
          ref = objPool.add(obj),
          objCopy = ObjectPool.fromSnapshot(objPool.snapshot()).resolveToObj(ref.id);
      expect(objCopy).deep.equals({_rev: 0, foo: 1, __dont_serialize__: ["zork"]});
    });

    it("__only_serialize__", () => {
      var obj = {foo: 23, bar: 24, __only_serialize__: ["bar"]},
          ref = objPool.add(obj),
          objCopy = ObjectPool.fromSnapshot(objPool.snapshot()).resolveToObj(ref.id);
      expect(objCopy).deep.equals({_rev: 0, bar: 24});
    });

    it("__only_serialize__ and __dont_serialize__", () => {
      var obj = {foo: 23, bar: 24, baz: 123, __only_serialize__: ["foo", "bar"], __dont_serialize__: ["bar"]},
          ref = objPool.add(obj),
          objCopy = ObjectPool.fromSnapshot(objPool.snapshot()).resolveToObj(ref.id);
      expect(objCopy).deep.equals({_rev: 0, foo: 23});
    });

  });

  describe("__additionally_serialize__ hook", () => {

    beforeEach(() => (objPool = new ObjectPool({plugins: [plugins.additionallySerializePlugin]})));

    it("gets called and has access to serialized obj", () => {
      var obj = {
        __additionally_serialize__: (snapshot, objRef) => snapshot.props.foo = 23
      }, {id} = objPool.add(obj);
      expect(objPool.snapshot()).containSubset({[id]: {"rev": 0, "props": {"foo": 23}}});
    });

    it("can register new objects", () => {
      var obj1 = {bar: 99}, obj2 = {
        __additionally_serialize__: (snapshot, objRef, pool, add) => add("other", [obj1])
      }, {id} = objPool.add(obj2);

      expect(obj.values(objPool.snapshot())).containSubset([
        {props: {other: {key: "other",value: []}}},
        {props: {bar: {key: "bar", value: 99}}}
      ]);

      expect(serializationRoundtrip(obj2))
        .containSubset({other: [{bar: 99}]});
    });

    it("can remove registered objects", () => {
      var other1 = {bar: 99},
          other2 = {zork: 33},
          obj3 = {
            other1, other2,
            __additionally_serialize__(snapshot, objRef, pool, add) { delete snapshot.props.other1; }
          },
          {id, snapshot} = serialize(obj3, {objPool}),
          ids = Object.keys(snapshot),
          otherId = arr.without(ids, id)[0];

      var expected = [{
          rev: 0,
          props: {other2: {key: "other2", value: {__ref__: true, id: otherId, rev: 0}}},
        },
        {props: {zork: {key: "zork", value: 33}}, rev: 0}
      ]

      expect(obj.values(snapshot)).containSubset(expected);
    });

    it("verbatim properties", () => {
      var obj = {
        __additionally_serialize__(snapshot, _, _2, add) { add("foo", [{xxx: 23}], true); }
      }, {id} = objPool.add(obj);

      expect(objPool.snapshot())
        .containSubset({[id]: {"rev": 0, "props": {foo: {value: [{xxx: 23}]}}}});

      expect(ObjectPool.fromSnapshot(objPool.snapshot()).resolveToObj(id))
        .containSubset({foo: [{xxx: 23}]});

    })
  });

});

describe("plugins", () => {
  
  it("serializeObject", () => {
    let o = {bar: 23},
        p = Object.assign(new Plugin(), {
          serializeObject(pool, objRef, serializedObjMap, path) { return {fooo: 23}; }
        }),
        s = ObjectPool.withObject(o, {plugins: [p]}).snapshot();
    expect(obj.values(s)).deep.equals([{fooo: 23}]);
  });

  it("additionallySerialize", () => {
    let o = {bar: 23},
        p = Object.assign(new Plugin(), {
          additionallySerialize(pool, ref, snapshot, addFn) {
            snapshot.props.bar.value++;
            addFn("foo", 99)
          }
        }),
        s = ObjectPool.withObject(o, {plugins: [p]}).snapshot();
    expect(obj.values(s)).deep.equals([
      {props: {bar: {key: "bar", value: 24}, foo: {key: "foo", value: 99}}, rev: 0}
    ]);
  });
  
  it("propertiesToSerialize", () => {
    let o = {bar: 23, foo: 99},
        p = Object.assign(new Plugin(), {
          propertiesToSerialize(pool, ref, snapshot, keysSoFar) { return ["bar"]; }
        }),
        s = ObjectPool.withObject(o, {plugins: [p]}).snapshot();
    expect(obj.values(s)).deep.equals([{props: {bar: {key: "bar", value: 23}}, rev: 0}]);
  });

  it("deserializeObject", () => {
    let snapshot = {
          a: {special: true, props: {bar: {key: "bar", value: 24}}},
          b: {props: {foo: {key: "foo", value: 99}}}
        },
        p = Object.assign(new Plugin(), {
          deserializeObject(pool, ref, snapshot, path) { return snapshot.special ? {verySpecial: true} : null }
        }),
        pool = ObjectPool.fromSnapshot(snapshot, {plugins: [p]});
        
    expect(pool.resolveToObj("b")).deep.equals({foo: 99, _rev: 0});
    expect(pool.resolveToObj("a")).deep.equals({verySpecial: true, bar: 24, _rev: 0});
  });

});


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function benchmarks() {

  var n = 100;
  var objs = lively.lang.arr.range(1,n).map(i => ({n: i}))
  objs.slice(0, -1).forEach((obj, i) => obj.next = objs[i+1]);
  objs[objs.length-1].first = objs[0]

  lively.lang.fun.timeToRunN(() => { new ObjectPool().add(objs[0]) }, 1000)

  lively.lang.fun.timeToRunN(() => {
    var r = new ObjectPool();
    r.add(objs[0])
    objPool.snapshot()
  }, 1000);


  console.profile("s")

  var uuids = Array.range(0,10000).map(ea => lively.lang.string.newUUID())
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