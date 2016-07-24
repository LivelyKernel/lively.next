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

function defaultObjectRecreator(exprObj) {
  return eval(exprObj.__recreate__);
}


function makeExpr(string) {
  return {__expr__: String(string)};
}


// turns a symbol into a __expr__ or a __recreate__ object.
var symbolExpression = (() => {

  const knownSymbols = (() =>
    Object.getOwnPropertyNames(Symbol)
      .filter(ea => typeof Symbol[ea] === "symbol")
      .reduce((map, ea) => map.set(Symbol[ea], "Symbol." + ea), new Map()))();
  const symMatcher = /^Symbol\((.*)\)$/;

  return function(sym) {
    if (Symbol.keyFor(sym)) return makeExpr(`Symbol.for("${Symbol.keyFor(sym)}")`);
    if (knownSymbols.get(sym)) return makeExpr(knownSymbols.get(sym));
    var match = String(sym).match(symMatcher)
    return {__recreate__: match ? `Symbol("${match[1]}")` : "Symbol()"};
  }
})();


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

  snapshotObj(serializedObjMap, pool) {
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
    if (typeof realObj.serializeExpr === "function") {
      snapshots[rev] = serializedObjMap[id] = {rev, __expr__: realObj.serializeExpr()};
      return ref;
    }

    // do the generic serialization, i.e. enumerate all properties and
    // serialize the referenced objects recursively
    var {props} = snapshots[rev] = serializedObjMap[id] = {rev, props: []};
    for (let i = 0, keys = Object.keys(realObj); i < keys.length; i++) {
      let key = keys[i], value = realObj[key];
      if (typeof value === "function") continue;
      else if (isPrimitive(value)) { /*...*/ }
      else if (typeof value.serializeExpr === "function") {
        value = {__expr__: value.serializeExpr()};
      } else {
        let ref = pool.add(realObj[key]);
        value = ref.isObjectRef ? ref.snapshotObj(serializedObjMap, pool) : ref;
      }
      props.push({key, value});
    }

    return ref;
  }

  recreateObjFromSnapshot(serializedObjMap, pool) {
    // serializedObjMap: map from ids to object snapshots

    if (this.realObj) return this;

    var snapshot = serializedObjMap[this.id];
    if (!snapshot) {
      console.error(`Cannot recreateObjFromSnapshot ObjectRef ${this.id} b/c of missing snapshot in snapshot map!`);
      return this;
    }

    var {rev, __recreate__, __expr__, props} = snapshot;
    rev = rev || 0;
    this.snapshotVersions.push(rev);
    this.snapshots[rev] = snapshot;

    var newObj = this.realObj = __expr__ ?
      pool.expressionEvaluator(snapshot) : __recreate__ ?
        pool.objectRecreator(snapshot) : {_rev: rev};
    pool.internalAddRef(this); // for updating realObj

    if (props) {
      for (var i = 0; i < props.length; i++) {
        var {key, value} = props[i];
        if (isPrimitive(value)) newObj[key] = value;
        else if (value.__expr__) newObj[key] = pool.expressionEvaluator(value);
        else {
          var valueRef = pool.refForId(value.id) || ObjectRef.fromSnapshot(value.id, serializedObjMap, pool);
          newObj[key] = valueRef.realObj;
        }
      }
    }
    
    return this;
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
    this.objectRecreator = defaultObjectRecreator;
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
    if (isPrimitive(obj)) return obj;

    // we have it already
    var ref = this.ref(obj);
    if (ref) return ref;

    // symbols only need to be registered when they aren't global or named
    // symbols
    if (typeof obj === "symbol") {
      let expr = symbolExpression(obj);
      if (!expr.__recreate__) return expr;
      return this.internalAddRef(new ObjectRef(this.uuidGen(), obj, expr));
    }

    return this.internalAddRef(new ObjectRef(obj.id || this.uuidGen(), obj));
  }

  snapshot() {
    var snapshot = {};
    for (var i = 0, ids = Object.keys(this._id_ref_map); i < ids.length; i++) {
      var ref = this._id_ref_map[ids[i]];
      ref.snapshotObj(snapshot, this);
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
