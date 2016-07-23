import { string, arr } from "lively.lang";

var uuids = arr.range(0,10000).map(_ => string.newUUID());

function isPrimitive(obj) {
  // primitive objects don't need to be registered
  if (obj == null) return true;
  var t = typeof obj;
  if ("boolean" === t || "number" === t || "string" === t) return true;
  return false;
}

function evalSerializedExpr(exprObj) {
  return eval(exprObj.__expr__);
}

function evalRecreateExpr(exprObj) {
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

  static create(obj, serializedObj) {
    return new this(obj.id, obj, serializedObj);
  }

  constructor(id, realObj, serializedObj) {
    this.id = id || uuids.pop() || string.newUUID();
    this.realObj = realObj;
    this.serializedObj = serializedObj;
  }

  get isObjectRef() { return true; }

  asPropertyValueForSnapshot() {
    return {__ref__: true, id: this.id}
  }

  marshallInto(snapshot, pool) {
    if (this.serializedObj) {
      snapshot[this.id] = this.serializedObj;
      return this.asPropertyValueForSnapshot();
    }

    var obj = this.realObj;
    if (!obj) {
      console.error(`Cannot marshall object ref ${this.id}, no real object!`);
      return {...this.asPropertyValueForSnapshot(), isMissing: true};
    }

    var serializedObj = this.serializedObj = snapshot[this.id] = {props: []};
    
    for (let i = 0, keys = Object.keys(obj); i < keys.length; i++) {
      let key = keys[i],
          ref = pool.add(obj[key]);
      if (ref.isObjectRef) {
        serializedObj.props.push({key, value: ref.marshallInto(snapshot, pool)})
      } else {
        serializedObj.props.push({key, value: ref})
      }
    }

    return this.asPropertyValueForSnapshot();
  }

  unmarshall(snapshot, pool) {
    if (this.realObj) return this;

    var serializedObj = this.serializedObj;
    if (!serializedObj) {
      console.error(`Cannot unmarshall ObjectRef ${this.id} b/c of missing serializedObj`);
      return this;
    }

    if (serializedObj.__recreate__) {
      this.realObj = evalRecreateExpr(serializedObj);
      pool.internalAddRef(this); // for updating realObj
      return this;
    }

    var newObj = this.realObj = {};
    pool.internalAddRef(this); // for updating realObj

    for (var i = 0; i < serializedObj.props.length; i++) {
      var {key, value} = serializedObj.props[i];
      if (isPrimitive(value)) newObj[key] = value;
      else if (value.__expr__) newObj[key] = evalSerializedExpr(value);
      else {
        var valueRef = pool.refForId(value.id) || ObjectRef.fromSnapshot(value.id, snapshot, pool);
        newObj[key] = valueRef.realObj;
      }
    }
    
    return this;
  }

  static fromSnapshot(id, snapshot, pool) {
    var ref = new this(id, null, snapshot[id]);
    pool.internalAddRef(ref)
    return ref.unmarshall(snapshot, pool);
  }
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export class ObjectPool {

  constructor() {
    this._obj_ref_map = new Map();
    this._id_ref_map = {};
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
      return this.internalAddRef(ObjectRef.create(obj, expr));
    }

    return this.internalAddRef(ObjectRef.create(obj));
  }

  snapshot() {
    var snapshot = {};
    for (var i = 0, ids = Object.keys(this._id_ref_map); i < ids.length; i++) {
      var ref = this._id_ref_map[ids[i]];
      ref.marshallInto(snapshot, this);
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
