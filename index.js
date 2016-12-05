import "./object-extensions.js";

import { string, arr, obj } from "lively.lang";
import ClassHelper from "./class-helper.js";
import ExpressionSerializer from "./plugins/expression-serializer.js";

function isPrimitive(obj) {
  // primitive objects don't need to be registered
  if (obj == null) return true;
  var t = typeof obj;
  if ("boolean" === t || "number" === t || "string" === t) return true;
  return false;
}


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

  snapshotObject(serializedObjMap, pool, path = []) {
    // serializedObjMap: maps ids to snapshots

console.log(path.join("."));
if (path.length > 40) throw new Error("stop");

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
    var keys;

    if (realObj.__dont_serialize__) {
      var exceptions = obj.mergePropertyInHierarchy(realObj, "__dont_serialize__");
      keys = arr.withoutAll(Object.keys(realObj), exceptions);

    } else if (realObj.__only_serialize__) {
      // FIXME what about __only_serialize__ && __dont_serialize__?
      keys = realObj.__only_serialize__;

    } else keys = Object.keys(realObj)

    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];
      props.push({key, value: this.snapshotProperty(realObj[key], path.concat([key]), serializedObjMap, pool)});
    }
    pool.classHelper.addClassInfo(this, realObj, snapshots[rev]);

    return ref;
  }


  snapshotProperties(realObj, snapshot, propNames, path, serializedObjMap, pool) {
    // do the generic serialization, i.e. enumerate all properties and
    // serialize the referenced objects recursively
    var props = snapshot.props;
    for (let i = 0; i < propNames.length; i++) {
      let key = propNames[i];
      props.push({key, value: this.snapshotProperty(realObj[key], path.concat([key]), serializedObjMap, pool)});
    }
    pool.classHelper.addClassInfo(this, realObj, snapshot);
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

    return ref && ref.isObjectRef ? ref.snapshotObject(serializedObjMap, pool, path) : ref;
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


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

    var newObj;
    if (__expr__) {
      newObj = pool.expressionEvaluator(snapshot);
    } else {
      newObj = pool.classHelper.restoreIfClassInstance(this, snapshot) || {};
      if (!newObj._rev) newObj._rev = rev;
    }
    this.realObj = newObj;

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

  constructor(options = {ignoreClassNotFound: true, uuidGen: null}) {
    this._obj_ref_map = new Map();
    this._id_ref_map = {};
    this.classHelper = new ClassHelper(options);
    this.uuidGen = options.uuidGen || string.newUUID;
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
    for (var i = 0, ids = Object.keys(snapshot); i < ids.length; i++)
      if (!this.resolveToObj(ids[i]))
        ObjectRef.fromSnapshot(ids[i], snapshot, this);
    return this;
  }

  jsonSnapshot() { return JSON.stringify(this.snapshot(), null, 2); }

  static fromJSONSnapshot(jsonSnapshoted, options) {
    return this.fromSnapshot(JSON.parse(jsonSnapshoted), options);
  }

  static fromSnapshot(snapshoted, options) {
    return new this(options).readSnapshot(snapshoted);
  }
}

export function serialize(obj) {
  var objPool = new ObjectPool();
  objPool.add(obj);
  return objPool.snapshot();
}
