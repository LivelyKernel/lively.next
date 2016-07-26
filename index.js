import { string, arr } from "lively.lang";

function isPrimitive(obj) {
  // primitive objects don't need to be registered
  if (obj == null) return true;
  var t = typeof obj;
  if ("boolean" === t || "number" === t || "string" === t) return true;
  return false;
}

function defaultExpressionEvaluator(exprObj) {
  return eval(exprObj.__expr__);
}


Object.defineProperty(Symbol.prototype, "__serialize__", {
  configurable: true,
  value: (() => {
    const knownSymbols = (() =>
      Object.getOwnPropertyNames(Symbol)
        .filter(ea => typeof Symbol[ea] === "symbol")
        .reduce((map, ea) => map.set(Symbol[ea], "Symbol." + ea), new Map()))();
    const symMatcher = /^Symbol\((.*)\)$/;

    return function() {
      // turns a symbol into a __expr__ object.
      if (Symbol.keyFor(this)) return {__expr__: `Symbol.for("${Symbol.keyFor(this)}")`};
      if (knownSymbols.get(this)) return {__expr__: knownSymbols.get(this)};
      var match = String(this).match(symMatcher)
      return {__expr__: match ? `Symbol("${match[1]}")` : "Symbol()", isValue: false};
    }
  })()
})



// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export class ObjectRef {

  constructor(id, realObj, snapshot) {
    this.id = id;
    this.realObj = realObj;
    this.snapshotVersions = [];
    this.snapshots = {};
    if (snapshot) {
      var rev = snapshot.rev || 0;
      this.snapshotVersions.push(rev);
      this.snapshots[rev] = snapshot;
    }
  }

  get isObjectRef() { return true; }

  get currentSnapshot() { return this.snapshots[arr.last(this.snapshotVersions)]}

  asRefForSerializedObjMap(rev = "????") {
    return {__ref__: true, id: this.id, rev}
  }

  snapshotObject(serializedObjMap, pool) {
    // serializedObjMap: maps ids to snapshots

    var {id, realObj, snapshots} = this;

    if (!realObj) {
      console.error(`Cannot marshall object ref ${id}, no real object!`);
      return {...this.asRefForSerializedObjMap(), isMissing: true};
    }

    var rev = realObj._rev || 0,
        ref = this.asRefForSerializedObjMap(rev);
    arr.pushIfNotIncluded(this.snapshotVersions, rev);

    // do we already have serialized a current version of realObj?
    if (snapshots[rev]) {
      if (!serializedObjMap[id])
        serializedObjMap[id] = snapshots[rev];
      return ref;
    }

    // can realObj be serialized into an expression?
    if (typeof realObj.__serialize__ === "function") {
      snapshots[rev] = serializedObjMap[id] = realObj.__serialize__(this, serializedObjMap, pool);
      return ref;
    }

    // do the generic serialization, i.e. enumerate all properties and
    // serialize the referenced objects recursively
    var {props} = snapshots[rev] = serializedObjMap[id] = {rev, props: []};
    for (let i = 0, keys = Object.keys(realObj); i < keys.length; i++) {
      let key = keys[i];
      props.push({key, value: this.snapshotProperty(realObj[key], [key], serializedObjMap, pool)});
    }

    return ref;
  }

  snapshotProperty(value, path, serializedObjMap, pool) {
    // returns the value to serialize, i.e. what to put into the snapshot object

    if (typeof value === "function") return undefined; // FIXME

    if (isPrimitive(value)) return value; // stored as is

    if (typeof value.__serialize__ === "function")
      return value.__serialize__(this, serializedObjMap, pool);

    if (Array.isArray(value))
      return value.map((ea, i) => this.snapshotProperty(ea, path.concat(i), serializedObjMap, pool));

    let ref = pool.add(value);

    return ref && ref.isObjectRef ? ref.snapshotObject(serializedObjMap, pool) : ref;
  }

  recreateObjFromSnapshot(serializedObjMap, pool) {
    // serializedObjMap: map from ids to object snapshots

    if (this.realObj) return this;

    var snapshot = serializedObjMap[this.id];
    if (!snapshot) {
      console.error(`Cannot recreateObjFromSnapshot ObjectRef ${this.id} b/c of missing snapshot in snapshot map!`);
      return this;
    }

    var {rev, __expr__, props} = snapshot;
    rev = rev || 0;
    this.snapshotVersions.push(rev);
    this.snapshots[rev] = snapshot;

    var newObj = this.realObj = __expr__ ?
      pool.expressionEvaluator(snapshot) : {_rev: rev};
    pool.internalAddRef(this); // for updating realObj

    if (props) {
      for (var i = 0; i < props.length; i++) {
        var {key, value} = props[i];
        newObj[key] = this.recreateProperty(value, serializedObjMap, pool);
      }
    }

    return this;
  }

  recreateProperty(value, serializedObjMap, pool) {
    if (isPrimitive(value)) return value;

    if (Array.isArray(value)) return value.map((ea, i) => this.recreateProperty(ea, serializedObjMap, pool));

    if (value.__expr__) return pool.expressionEvaluator(value);

    var valueRef = pool.refForId(value.id) || ObjectRef.fromSnapshot(value.id, serializedObjMap, pool);
    return valueRef.realObj;
  }

  static fromSnapshot(id, snapshot, pool) {
    return pool.internalAddRef(new this(id)).recreateObjFromSnapshot(snapshot, pool);
  }
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export class ObjectPool {

  constructor(uuidGen = string.newUUID) {
    this._obj_ref_map = new Map();
    this._id_ref_map = {};
    this.uuidGen = uuidGen;
    this.expressionEvaluator = defaultExpressionEvaluator;
  }

  knowsId(id) { return !!this._id_ref_map[id]; }
  refForId(id) { return this._id_ref_map[id]; }
  resolveToObj(id) { var ref = this._id_ref_map[id]; return ref ? ref.realObj : undefined; }
  ref(obj) { return this._obj_ref_map.get(obj); }

  objects() { return Array.from(this._obj_ref_map.keys()); }

  internalAddRef(ref) {
    if (ref.realObj)
      this._obj_ref_map.set(ref.realObj, ref);
    this._id_ref_map[ref.id] = ref;
    return ref;
  }

  add(obj) {
    // adds an object to the object pool and returns a "ref" object
    // that is guaranteed to be JSON.stringifyable and that can be used as a place
    // holder in a serialized graph / list

    // primitive objects don't need to be registered
    if (isPrimitive(obj)) return undefined;

    if (Array.isArray(obj)) return obj.map(element => this.add(element));

    return this.ref(obj) || this.internalAddRef(new ObjectRef(obj.id || this.uuidGen(), obj));
  }

  snapshot() {
    var snapshot = {};
    for (var i = 0, ids = Object.keys(this._id_ref_map); i < ids.length; i++) {
      var ref = this._id_ref_map[ids[i]];
      ref.snapshotObject(snapshot, this);
    }
    return snapshot;
  }

  readSnapshot(snapshot) {
    for (var i = 0, ids = Object.keys(snapshot); i < ids.length; i++) {
      if (!this.resolveToObj(ids[i]))
        ObjectRef.fromSnapshot(ids[i], snapshot, this);
    }
    return this;
  }

  jsonSnapshot() { return JSON.stringify(this.snapshot(), null, 2); }

  static fromJSONSnapshot(jsonSnapshoted) {
    return this.fromSnapshot(JSON.parse(jsonSnapshoted));
  }

  static fromSnapshot(snapshoted) {
    return new this().readSnapshot(snapshoted);
  }
}

export function serialize(obj) {
  var objPool = new ObjectPool();
  objPool.add(obj);
  return objPool.snapshot();
}


// export class Serializer {

//   constructor(registry = new Registry()) {
//     this.registry = registry;
//   }

//   resolveToObj(id) { return this.registry.resolveToObj(id); }
//   objects() { return this.registry.objects(); }
//   add(obj) { return this.registry.add(obj); }
//   register(obj) { this.add(obj); return this; }

//   // deserialize(serialized) {
//   //   if (serialized.__expr__) return evalSerializedExpr(serialized);
//   //   var found = this.registry.resolveToObj(serialized.id);
//   //   if (found) return found;

//   //   if (serialized.__recreate__) {
//   //     var recreated = evalRecreateExpr(serialized);
//   //     this.registry.add(recreated);
//   //     return recreated;
//   //   }

//   //   throw new Error(`Don't know how to deserialize ${JSON.stringify(serialized)}`);
//   // }

//   static fromJSONSnapshot(jsonSnapshoted) {
//     return this.fromSnapshot(JSON.parse(jsonSnapshoted));
//   }
//   static fromSnapshot(snapshoted) {
//     return new this(new Registry().readSnapshot(snapshoted));
//   }

//   snapshot() { return this.registry.snapshot(); }
//   jsonSnapshot() { return JSON.stringify(this.snapshot()); }
// }
