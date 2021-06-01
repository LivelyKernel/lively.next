/* global describe, it, beforeEach, afterEach,System */
import { expect, chai } from 'mocha-es6';

import { obj, arr } from 'lively.lang';
import { ObjectPool, deserializeWithMigrations, requiredModulesOfSnapshot, ObjectRef, serialize } from '../index.js';
import { Plugin, plugins } from '../plugins.js';
import { removeUnreachableObjects } from '../snapshot-navigation.js';

function serializationRoundtrip (obj) {
  let snap = objPool.snapshotObject(obj);
  let id = objPool.ref(obj).id;
  removeUnreachableObjects([id], snap.snapshot);
  return ObjectPool.resolveFromSnapshotAndId(
    JSON.parse(JSON.stringify(snap)), objPool.options);
  return ObjectPool.resolveFromSnapshotAndId(
    JSON.parse(JSON.stringify(objPool.snapshotObject(obj))), objPool.options);
}

function itSerializesInto (subject, expected) {
  let title = `serializes ${String(subject)} into ${JSON.stringify(expected)}`;
  return it(title, () => {
    let { id, snapshot } = serialize(subject, { objPool });
    expect(snapshot[id]).deep.equals(expected);
  });
}

let objPool;

describe('object registration', () => {
  beforeEach(() => objPool = new ObjectPool());

  it('registers objects', () => {
    let o = { id: '123' };
    let ref = objPool.add(o);
    expect(objPool.resolveToObj('123')).equals(o, 'object not found in pool');
    expect(objPool.resolveToObj('1234')).equals(undefined, 'unknown id returned sth');
    expect(ref.id).equals('123');
  });

  it('pool remembers objects', () => {
    let o = {};
    let ref1 = objPool.add(o);
    let ref2 = objPool.add(o);
    expect(objPool.resolveToObj(ref1.id)).equals(o);
    expect(ref1).equals(ref2, 'different refs');
  });
});

describe('snapshots', () => {
  beforeEach(() => objPool = new ObjectPool());

  it('snapshots', () => {
    let o = { foo: 23, ref: { bar: 24 } };
    let { id, snapshot } = objPool.snapshotObject(o);
    let objPool2 = ObjectPool.fromSnapshot(snapshot);

    expect(objPool2.resolveToObj(id)).not.equals(o, 'identical object');
    expect(objPool2.resolveToObj(id))
      .deep.equals({ ...o, _rev: 0, ref: { ...o.ref, _rev: 0 } }, 'object structure changed');
    expect(objPool.objects()).to.have.length(2);
    expect(objPool2.objects()).containSubset(objPool.objects(), 'object list diverged');
  });

  it('snapshots and replaces ids', () => {
    let o1 = { id: 'o1' }; let o2 = { id: 'o2' };

    o1.bar = [o2];
    o2.o1 = o1;

    let opts = {
      reinitializeIds (id, ref) {
        if (id === 'o1') return 'new_o1';
        if (id === 'o2') return 'new_o2';
        return null;
      }
    };

    let newO1 = ObjectPool.resolveFromSnapshotAndId(objPool.snapshotObject(o1), opts);
    expect(newO1).containSubset({ id: 'new_o1', bar: [{ id: 'new_o2', o1: {} }] });
  });
});

describe('marshalling', () => {
  beforeEach(() => objPool = new ObjectPool());

  describe('symbols', () => {
    beforeEach(() => objPool = new ObjectPool({ plugins: [plugins.customSerializePlugin] }));

    itSerializesInto(Symbol.for('test'), { __expr__: '__lv_expr__:Symbol.for("test")' });
    itSerializesInto(Symbol.iterator, { __expr__: '__lv_expr__:Symbol.iterator' });

    it('registers custom symbol', () => {
      let s = Symbol('foo');
      let ref = objPool.add(s);
      expect(ref).to.have.property('id');
      expect(ref.isObjectRef).equals(true);
      objPool.snapshot();
      expect(ref.currentSnapshot.__expr__).equals('__lv_expr__:Symbol("foo")');
      expect(objPool.resolveToObj(ref.id)).equals(s);
    });

    it('snapshots object with named / known symbols', () => {
      let obj = { foo: Symbol.for('test'), bar: Symbol.iterator };
      let { foo, bar } = serializationRoundtrip(obj);
      expect(foo).equals(Symbol.for('test'));
      expect(bar).equals(Symbol.iterator);
    });

    it('snapshots object with custom symbols', () => {
      let obj = { foo: Symbol('test') };
      let { foo } = serializationRoundtrip(obj);
      expect(foo).not.equals(obj.foo);
      expect(foo).stringEquals(obj.foo);
    });

    it('property symbols are ignored', () => {
      let obj = { [Symbol.for('test')]: 23, foo: 24 };
      expect(serializationRoundtrip(obj)).deep.equals({ foo: 24, _rev: 0 });
    });

    it('serializes symbol directly', () => {
      let obj = { foo: Symbol('test') };
      let obj2 = serializationRoundtrip(Symbol('test'));
      expect(obj2).not.equals(obj);
      expect(obj2).stringEquals(Symbol('test'));
    });
  });

  describe('built-in js objects', () => {
    let pluginsForBuiltins = [
      plugins.customSerializePlugin,
      plugins.classPlugin,
      plugins.additionallySerializePlugin];

    it('Map', () => {
      let obj = {}; let obj2 = { bar: 23 };
      obj.map = new Map([['a', 1], [obj2, 2], ['c', obj]]);
      objPool = ObjectPool.withObject(obj, { plugins: pluginsForBuiltins });

      let id = objPool.ref(obj).id;
      let snap = objPool.snapshotObject(obj);
      removeUnreachableObjects([id], snap.snapshot);

      let objCopy = ObjectPool.resolveFromSnapshotAndId(snap, objPool.options);
      // let objCopy = serializationRoundtrip(obj),
      let copiedMap = objCopy.map;

      expect(copiedMap).instanceof(Map);
      let entries = Array.from(copiedMap.entries());
      expect(entries).length(3);
      expect(entries[0]).equals(['a', 1]);
      expect(entries[1]).containSubset([{ bar: 23 }, 2]);
      expect(entries[2]).equals(['c', objCopy]);
    });

    it('Set', () => {
      let obj = {}; let obj2 = { bar: 23 };
      let set = new Set(['a', obj, obj2]);
      obj.set = set;
      obj.obj2 = obj2;
      objPool = ObjectPool.withObject(obj, { plugins: pluginsForBuiltins });

      let objCopy = serializationRoundtrip(obj);
      let entries = Array.from(objCopy.set.values());
      expect(entries).to.have.length(3);
      expect(entries[0]).equals('a');
      expect(entries[1]).equals(objCopy);
      expect(entries[2]).equals(objCopy.obj2);
    });
  });

  describe('serialized expressions', () => {
    beforeEach(() => objPool = new ObjectPool({ plugins: [plugins.customSerializePlugin] }));

    it('simple', () => {
      function __serialize__ () {
        return {
          __expr__: `({n: ${this.n + 1}, __serialize__: ${String(this.__serialize__)}})`
        };
      }
      let exprObj = { n: 1, __serialize__ };
      let obj = { foo: exprObj };
      let snap = objPool.snapshotObject(obj);
      let obj2 = ObjectPool.resolveFromSnapshotAndId(snap, objPool.options);
      expect(obj2).deep.property('foo.n', 2);
      expect(obj2.foo).property('__serialize__').to.be.a('function');
    });

    it('serialized object is expr itself', () => {
      let exprObj = { n: 1, __serialize__ () { return { __expr__: `({n: ${this.n + 1}})` }; } };
      let obj2 = ObjectPool.resolveFromSnapshotAndId(objPool.snapshotObject(exprObj), objPool.options);
      expect(obj2).property('n', 2);
    });

    it('__serialize__ in property is inlined in snapshot', () => {
      let foo = { __serialize__: () => ({ __expr__: 'foo()' }) };
      let obj = { foo };
      let { id, snapshot } = objPool.snapshotObject(obj);
      expect(snapshot).deep.equals(
        { [id]: { rev: 0, props: { foo: { value: '__lv_expr__:foo()' } } } });
      try {
        System.global.foo = () => foo;
        var obj2 = ObjectPool.resolveFromSnapshotAndId({ id, snapshot }, objPool.options);
      } finally { delete System.global.foo; }
      expect(obj2).deep.equals(obj2, 'deserialize not working');
    });

    it('bindings via object import', async () => {
      await System.import('lively.serializer2/tests/test-resources/module1.js');
      let exprObj = {
        n: 1,
        __serialize__ () {
          return {
            __expr__: `createSomeObject(${this.n})`,
            bindings: { 'lively.serializer2/tests/test-resources/module1.js': ['createSomeObject'] }
          };
        }
      };
      let obj2 = ObjectPool.resolveFromSnapshotAndId(objPool.snapshotObject(exprObj), objPool.options);
      expect(obj2).property('n', 2);
    });

    it('finds required modules', async () => {
      await System.import('lively.serializer2/tests/test-resources/module1.js');

      let exprObj = {
        n: 1,
        __serialize__ () {
          return {
            __expr__: `createSomeObject(${this.n})`,
            bindings: { 'lively.serializer2/tests/test-resources/module1.js': ['createSomeObject'] }
          };
        }
      };

      expect(requiredModulesOfSnapshot(objPool.snapshotObject(exprObj)))
        .equals(['lively.serializer2/tests/test-resources/module1.js']);
    });
  });

  describe('nested arrays', () => {
    it('serialize correctly', () => {
      let obj1a = { foo: 23 };
      let obj2a = { bar: [123, [obj1a]] };
      let { id: id1a } = objPool.add(obj1a);
      let { id: id2a } = objPool.add(obj2a);
      let objPool2 = ObjectPool.fromSnapshot(objPool.snapshot());
      let obj2b = objPool2.resolveToObj(id2a);
      let obj1b = objPool2.resolveToObj(id1a);

      expect(obj2b).containSubset({ bar: [123, [{ foo: 23 }]] });

      expect(obj2b.bar[1][0]).equals(obj1b);
    });
  });

  describe('ignore properties', () => {
    beforeEach(() => (objPool = new ObjectPool({ plugins: [plugins.onlySerializePropsPlugin, plugins.dontSerializePropsPlugin] })));

    it('via __dont_serialize__', () => {
      let obj = { foo: 23, bar: 24, __dont_serialize__: ['bar'] };
      let objCopy = ObjectPool.resolveFromSnapshotAndId(objPool.snapshotObject(obj));
      expect(objCopy).deep.equals({ _rev: 0, foo: 23, __dont_serialize__: ['bar'] });
    });

    it('__dont_serialize__ is merged in proto chain', () => {
      let proto = Object.assign(Object.create({ __dont_serialize__: ['bar'] }), { __dont_serialize__: ['baz'] });
      let obj = Object.assign(Object.create(proto), { __dont_serialize__: ['zork'], foo: 1, bar: 2, baz: 3, zork: 4 });
      let objCopy = ObjectPool.resolveFromSnapshotAndId(objPool.snapshotObject(obj));
      expect(objCopy).deep.equals({ _rev: 0, foo: 1, __dont_serialize__: ['zork'] });
    });

    it('__only_serialize__', () => {
      let obj = { foo: 23, bar: 24, __only_serialize__: ['bar'] };
      let objCopy = ObjectPool.resolveFromSnapshotAndId(objPool.snapshotObject(obj));
      expect(objCopy).deep.equals({ _rev: 0, bar: 24 });
    });

    it('__only_serialize__ and __dont_serialize__', () => {
      let obj = { foo: 23, bar: 24, baz: 123, __only_serialize__: ['foo', 'bar'], __dont_serialize__: ['bar'] };
      let objCopy = ObjectPool.resolveFromSnapshotAndId(objPool.snapshotObject(obj));
      expect(objCopy).deep.equals({ _rev: 0, foo: 23 });
    });
  });

  describe('__additionally_serialize__ hook', () => {
    beforeEach(() => (objPool = new ObjectPool({ plugins: [plugins.additionallySerializePlugin] })));

    it('gets called and has access to serialized obj', () => {
      let obj = {
        __additionally_serialize__: (snapshot, objRef) => snapshot.props.foo = 23
      }; let { id, snapshot } = objPool.snapshotObject(obj);
      expect(snapshot).containSubset({ [id]: { rev: 0, props: { foo: 23 } } });
    });

    it('can register new objects', () => {
      let obj1 = { bar: 99 }; let obj2 = {
        __additionally_serialize__: (snapshot, objRef, pool, add) => add('other', [obj1])
      }; let { id } = objPool.add(obj2);

      expect(obj.values(objPool.snapshot())).containSubset([
        { props: { other: { value: [] } } },
        { props: { bar: { value: 99 } } }
      ]);

      expect(serializationRoundtrip(obj2))
        .containSubset({ other: [{ bar: 99 }] });
    });

    it('can remove registered objects', () => {
      let other1 = { bar: 99 };
      let other2 = { zork: 33 };
      let obj3 = {
        other1,
        other2,
        __additionally_serialize__ (snapshot, objRef, pool, add) { delete snapshot.props.other1; }
      };
      let { id, snapshot } = serialize(obj3, { objPool });
      let ids = Object.keys(snapshot);
      let otherId = arr.without(ids, id)[0];

      let expected = [{
        rev: 0,
        props: { other2: { value: { __ref__: true, id: otherId, rev: 0 } } }
      },
      { props: { zork: { value: 33 } }, rev: 0 }
      ];

      expect(obj.values(snapshot)).containSubset(expected);
    });

    it('verbatim properties', () => {
      let obj = {
        __additionally_serialize__ (snapshot, _, _2, add) { add('foo', [{ xxx: 23 }], true); }
      }; let { id } = objPool.add(obj);

      expect(objPool.snapshot())
        .containSubset({ [id]: { rev: 0, props: { foo: { value: [{ xxx: 23 }] } } } });

      expect(ObjectPool.fromSnapshot(objPool.snapshot()).resolveToObj(id))
        .containSubset({ foo: [{ xxx: 23 }] });
    });
  });
});

describe('plugins', () => {
  it('serializeObject', () => {
    let o = { bar: 23 };
    let p = Object.assign(new Plugin(), {
      serializeObject (pool, objRef, serializedObjMap, path) { return { fooo: 23 }; }
    });
    let s = ObjectPool.withObject(o, { plugins: [p] }).snapshot();
    expect(obj.values(s)).deep.equals([{ fooo: 23 }]);
  });

  it('additionallySerialize', () => {
    let o = { bar: 23 };
    let p = Object.assign(new Plugin(), {
      additionallySerialize (pool, ref, snapshot, addFn) {
        snapshot.props.bar.value++;
        addFn('foo', 99);
      }
    });
    let s = ObjectPool.withObject(o, { plugins: [p] }).snapshot();
    expect(obj.values(s)).deep.equals([
      { props: { bar: { value: 24 }, foo: { value: 99 } }, rev: 0 }
    ]);
  });

  it('propertiesToSerialize', () => {
    let o = { bar: 23, foo: 99 };
    let p = Object.assign(new Plugin(), {
      propertiesToSerialize (pool, ref, snapshot, keysSoFar) { return ['bar']; }
    });
    let s = ObjectPool.withObject(o, { plugins: [p] }).snapshot();
    expect(obj.values(s)).deep.equals([{ props: { bar: { value: 23 } }, rev: 0 }]);
  });

  it('deserializeObject', () => {
    let snapshot = {
      a: { special: true, props: { bar: { key: 'bar', value: 24 } } },
      b: { props: { foo: { key: 'foo', value: 99 } } }
    };
    let p = Object.assign(new Plugin(), {
      deserializeObject (pool, ref, snapshot, path) { return snapshot.special ? { verySpecial: true } : null; }
    });
    let pool = ObjectPool.fromSnapshot(snapshot, { plugins: [p] });

    expect(pool.resolveToObj('b')).deep.equals({ foo: 99, _rev: 0 });
    expect(pool.resolveToObj('a')).deep.equals({ verySpecial: true, bar: 24, _rev: 0 });
  });
});

describe('object migrations', () => {
  it('applies snapshot converters', () => {
    let obj = { foo: { bar: 23 } };
    let migrations = [
      {
        snapshotConverter: snap => {
          let { snapshot } = snap;
          for (let key in snapshot) {
            if (snapshot[key].props.hasOwnProperty('bar')) {
              snapshot[key].props.baz = snapshot[key].props.bar;
              snapshot[key].props.baz.key = 'baz';
              delete snapshot[key].props.bar;
            }
          }
          return snap;
        }
      },

      {
        snapshotConverter: snap => {
          let { snapshot } = snap;
          for (let key in snapshot) {
            if (snapshot[key].props.hasOwnProperty('baz')) { snapshot[key].props.baz.value++; }
          }
        }
      }
    ];
    let copy = deserializeWithMigrations(serialize(obj), migrations);

    expect(copy).deep.equals({ _rev: 0, foo: { _rev: 0, baz: 24 } });
  });

  it('applies object converters', () => {
    let obj = { foo: { bar: 23 } };
    let migrations = [
      {
        objectConverter: (snap, pool) => {
          let { snapshot, id } = snap;
          pool.refForId(id).realObj.foo.bar++;
        }
      }
    ];
    let copy = deserializeWithMigrations(serialize(obj), migrations);

    expect(obj).deep.equals({ foo: { bar: 23 } });
    expect(copy).deep.equals({ _rev: 0, foo: { _rev: 0, bar: 24 } });
  });
});

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function benchmarks () {
  let n = 100;
  let objs = lively.lang.arr.range(1, n).map(i => ({ n: i }));
  objs.slice(0, -1).forEach((obj, i) => obj.next = objs[i + 1]);
  objs[objs.length - 1].first = objs[0];

  lively.lang.fun.timeToRunN(() => { new ObjectPool().add(objs[0]); }, 1000);

  lively.lang.fun.timeToRunN(() => {
    let r = new ObjectPool();
    r.add(objs[0]);
    objPool.snapshot();
  }, 1000);

  console.profile('s');

  let uuids = Array.range(0, 10000).map(ea => lively.lang.string.newUUID());
  lively.lang.fun.timeToRunN(() => {
    let r = new ObjectPool(() => uuids.pop() || lively.lang.string.newUUID());
    r.add(objs[0]);
    // var r2 = ObjectPool.fromJSONSnapshot(r.jsonSnapshot())
    let r2 = ObjectPool.fromSnapshot(r.snapshot());
  }, 100);
  console.profileEnd('s');

  lively.lang.fun.timeToRunN(() => {
    lively.persistence.Serializer.copy(objs[0]);
  }, 100);

  let firstNewObj = objPool.resolveToObj(objPool.ref(objs[0]).id);
  expect(objs[0]).not.equals(firstNewObj);
  expect(objs[0]).deep.equals(firstNewObj);
  expect(objs).deep.equals(objPool.objects());
}
