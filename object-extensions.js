/*global Map, System*/
// extensions to native JS objects to support serialization

// Symbol
Object.defineProperty(Symbol.prototype, "__serialize__", {
  configurable: true,
  value: (() => {
    const knownSymbols = (() =>
            Object.getOwnPropertyNames(Symbol)
              .filter(ea => typeof Symbol[ea] === "symbol")
              .reduce((map, ea) => map.set(Symbol[ea], "Symbol." + ea), new Map()))(),
          symMatcher = /^Symbol\((.*)\)$/;

    return function() {
      // turns a symbol into a __expr__ object.
      var sym = typeof this[Symbol.toPrimitive] === "function" ?
                  this[Symbol.toPrimitive]() : this,
          symKey = Symbol.keyFor(sym);
      if (symKey) return {__expr__: `Symbol.for("${symKey}")`};
      if (knownSymbols.get(sym)) return {__expr__: knownSymbols.get(sym)};
      var match = String(sym).match(symMatcher)
      return {__expr__: match ? `Symbol("${match[1]}")` : "Symbol()"};
    }
  })()
});

// System
Object.defineProperty(System, "__serialize__", {
  configurable: true,
  value: () => ({__expr__: "System"})
});

// window/global
Object.defineProperty(System.global, "__serialize__", {
  configurable: true,
  value: () => ({__expr__: "System.global"})
});


// Map
Object.defineProperty(Map.prototype, "__serialize__", {
  configurable: true,
  value: function(pool, snapshots, path) {
    // ensure ObjectRef and snapshot object for map
    let ref = pool.add(this),
        rev = ref.currentRev,
        snapshot = ref.currentSnapshot,
        entries = snapshot.entries = [],
        i = 0;
    snapshots[ref.id] = snapshot;
    // store class info
    pool.classHelper.addClassInfo(ref, this, snapshot);
    for (let [key, value] of this) {
      i++;
      // serialize all entries into snapshot.entries
      let serializedKey = ref.snapshotProperty(ref.id, key, path.concat("key", String(i)), snapshots, pool),
          serializedValue = ref.snapshotProperty(ref.id, value, path.concat("value", String(i)), snapshots, pool);
      entries.push([serializedKey, serializedValue])
    }
    return ref.asRefForSerializedObjMap(rev);
  }
});
Object.defineProperty(Map.prototype, "__deserialize__", {
  configurable: true,
  value: function(snapshot, ref, serializedObjMap, pool, path) {
    // deserialize entries from snapshot.entries
    var {entries} = snapshot;
    for (let i = 0; i < entries.length; i++) {
      let [key, value] = entries[i],
          deserializedKey = ref.recreateProperty("key." + i, key, serializedObjMap, pool, path.concat("key", i)),
          deserializedValue = ref.recreateProperty("value." + i, value, serializedObjMap, pool, path.concat("value", i));
      this.set(deserializedKey, deserializedValue);
    }
  }
});

// Set
Object.defineProperty(Set.prototype, "__serialize__", {
  configurable: true,
  value: function(pool, snapshots, path) {
    // ensure ObjectRef and snapshot object for set
    let ref = pool.add(this),
        rev = ref.currentRev,
        snapshot = ref.currentSnapshot,
        entries = snapshot.entries = [],
        i = 0;
    snapshots[ref.id] = snapshot;
    // store class info
    pool.classHelper.addClassInfo(ref, this, snapshot);
    for (let entry of this) {
      i++;
      // serialize all entries into snapshot.entries
      let serializedEntry = ref.snapshotProperty(ref.id, entry, path.concat("entry", String(i)), snapshots, pool);
      entries.push(serializedEntry);
    }
    return ref.asRefForSerializedObjMap(rev);
  }
});
Object.defineProperty(Set.prototype, "__deserialize__", {
  configurable: true,
  value: function(snapshot, ref, serializedObjMap, pool, path) {
    // deserialize entries from snapshot.entries
    var {entries} = snapshot;
    for (let i = 0; i < entries.length; i++) {
      let deserializedEntry = ref.recreateProperty("entry." + i, entries[i], serializedObjMap, pool, path.concat("key", i));
      this.add(deserializedEntry);
    }
  }
});
