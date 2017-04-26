import { arr, obj, string } from "lively.lang";
import { isPrimitive } from "./util.js";
import ClassHelper from "./class-helper.js";
import ExpressionSerializer from "./plugins/expression-serializer.js";
import { allPlugins } from "./plugins.js";


/*

This module defines the classes ObjectPool and ObjectRef.  ObjectPool builds an
index of objects.


For serialization, the pool starts with a single root object for which it
creates an object ref.  The object ref then traverses all its properties and
recursively adds non-primitive objects to the pool, building a snapshot (a
serializable copy) of the objects it encounters.  A snapshot is a simple JS
map/object whose keys are ids if the serialized objects and whose values are
the snapshot representation of those objects.


Example:

ObjectPool.withObject({foo: {bar: 23}}).snapshot(); // =>
{
  A1CB461E-9187-4711-BEBA-B9E3D1B6D900: {
    props: {
      bar: {key: "bar",value: 23}
    },
    rev: 0
  },
  EDF8404A-243A-4858-9C98-0BFEE7DB369E: {
    props: {
      foo: {
        key: "foo",
        value: {__ref__: true, id: "A1CB461E-9187-4711-BEBA-B9E3D1B6D900", rev: 0}
      }
    },
    rev: 0
  }
}

For deserialization the process is reversed, i.e. object refs are created from
a snapshot which then re-instantiate objects.  Object properties are hooked up
so that a copy of the original object graph is re-created.


*/


const debugSerialization = false,
      debugDeserialization = false;

export class ObjectPool {

  static withDefaultPlugins(options) {
    return new this({plugins: allPlugins, ...options});
  }

  static fromJSONSnapshot(jsonSnapshoted, options) {
    return this.fromSnapshot(JSON.parse(jsonSnapshoted), options);
  }

  static fromSnapshot(snapshoted, options) {
    return new this(options).readSnapshot(snapshoted);
  }

  static withObject(obj, options) {
    var pool = new this(options);
    pool.add(obj);
    return pool;
  }

  constructor(options) {
    this.options = {ignoreClassNotFound: true, idPropertyName: "id", ...options};
    this.reset()
  }

  reset() {
    this.uuidGen = string.newUUID;
    this._obj_ref_map = new Map();
    this._id_ref_map = {};

    let {options} = this;
    this.classHelper = new ClassHelper(options);
    this.expressionSerializer = new ExpressionSerializer();

    if (options.idPropertyName) this.idPropertyName = options.idPropertyName;
    if (options.uuidGen) this.uuidGen = options.uuidGen;;
    if (options.reinitializeIds) this.reinitializeIds = options.reinitializeIds;
    if (options.hasOwnProperty("ignoreClassNotFound"))
      this.classHelper.options.ignoreClassNotFound = options.ignoreClassNotFound;

    let ps = this.plugins = {
      serializeObject: [],
      additionallySerialize: [],
      propertiesToSerialize: [],
      deserializeObject: []
    };
    if (options.plugins) {
      options.plugins.forEach(p => {
        if (typeof p.serializeObject === "function") ps.serializeObject.push(p);
        if (typeof p.additionallySerialize === "function") ps.additionallySerialize.push(p);
        if (typeof p.propertiesToSerialize === "function") ps.propertiesToSerialize.push(p);
        if (typeof p.deserializeObject === "function") ps.deserializeObject.push(p);
      });
    }
  }

  knowsId(id) { return !!this._id_ref_map[id]; }
  refForId(id) { return this._id_ref_map[id]; }
  resolveToObj(id) { var ref = this._id_ref_map[id]; return ref ? ref.realObj : undefined; }
  ref(obj) { return this._obj_ref_map.get(obj); }

  objects() { return Array.from(this._obj_ref_map.keys()); }
  objectRefs() { return Array.from(this._obj_ref_map.values()); }

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

    var idPropertyName = obj.__serialization_id_property__ || this.idPropertyName;
    return this.ref(obj)
        || this.internalAddRef(
              new ObjectRef(obj[idPropertyName] || this.uuidGen(),
                obj, undefined, this.idPropertyName));
  }

  snapshot() {
    // traverses the object graph and create serialized representation => snapshot
    let snapshot = {};
    for (let i = 0, ids = Object.keys(this._id_ref_map); i < ids.length; i++) {
      let ref = this._id_ref_map[ids[i]];
      ref.snapshotObject(snapshot, this);
    }    
    return snapshot;
  }

  jsonSnapshot() { return JSON.stringify(this.snapshot(), null, 2); }

  readSnapshot(snapshot) {
    // populates object pool with object refs read from the dead snapshot
    for (var i = 0, ids = Object.keys(snapshot); i < ids.length; i++)
      if (!this.resolveToObj(ids[i]))
        ObjectRef.fromSnapshot(ids[i], snapshot, this, [], this.idPropertyName);
    return this;
  }

  readJsonSnapshot(jsonString) {
    return this.readSnapshot(JSON.parse(jsonString));
  }

}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// ObjectRef

function __additionally_serialize__addObjectFunction(objRef, snapshot, serializedObjMap, pool, path = []) {
  // passed into __additionally_serialize__ as a parameter to allow object to add
  // other objects to serialization

  return (key, value, verbatim = false) =>
    snapshot.props[key] = verbatim ? {key, value, verbatim} :
      {key, value: objRef.snapshotProperty(
        objRef.id, value, path.concat([key]), serializedObjMap, pool)}
}

export class ObjectRef {

  static fromSnapshot(id, snapshot, pool, path = [], idPropertyName) {
    var ref = new this(id, undefined, undefined, idPropertyName);
    return pool.internalAddRef(ref).recreateObjFromSnapshot(snapshot, pool, path);
  }

  constructor(id, realObj, snapshot, idPropertyName = "id") {
    this.id = id;
    this.idPropertyName = idPropertyName;
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

  get currentSnapshot() {
    let rev;
    if (!this.snapshotVersions.length) {
      rev = 0;
      this.snapshotVersions.push(rev);
    } else rev = arr.last(this.snapshotVersions);
    return this.snapshots[rev]
        || (this.snapshots[rev] = {rev, props: {}});
  }

  get currentRev() {
    return this.snapshotVersions.length ?
      arr.last(this.snapshotVersions) : 0;
  }

  asRefForSerializedObjMap(rev = "????") {
    return {__ref__: true, id: this.id, rev}
  }

  snapshotObject(serializedObjMap, pool, path = []) {
    // serializedObjMap: maps ids to snapshots

    debugSerialization && console.log(`[serialize] ${path.join(".")}`);

    if (path.length > 100) throw new Error(
      `Stopping serializer, encountered a possibly infinit loop: ${path.join(".")}`);

    let {id, realObj, snapshots} = this;

    if (!realObj) {
      console.error(`Cannot marshall object ref ${id}, no real object!`);
      return {...this.asRefForSerializedObjMap(), isMissing: true};
    }

    let rev = realObj._rev || 0,
        ref = this.asRefForSerializedObjMap(rev);
    arr.pushIfNotIncluded(this.snapshotVersions, rev);

    // do we already have serialized a current version of realObj?
    if (snapshots[rev]) {
      if (!serializedObjMap[id])
        serializedObjMap[id] = snapshots[rev];
      return ref;
    }

    if (typeof id !== "string") {
      let msg = `Error snapshoting ${realObj}: `
              + `id is not a string but ${id} `
              + `(serialization path: ${path.join(".")})`;
      throw new Error(msg)
    }

    // maybe custom serialization
    for (let i = 0; i < pool.plugins.serializeObject.length; i++) {
      let p = pool.plugins.serializeObject[i],
          serialized = p.serializeObject(realObj, false, pool, serializedObjMap, path);
      if (serialized) {
        snapshots[rev] = serializedObjMap[id] = serialized;
        return ref;
      }
    }

    // serialize properties
    let keys = Object.getOwnPropertyNames(realObj),
        props = {},
        snapshot = snapshots[rev] = serializedObjMap[id] = {rev, props};

    for (let i = 0; i < pool.plugins.propertiesToSerialize.length; i++) {
      let p = pool.plugins.propertiesToSerialize[i],
          result = p.propertiesToSerialize(pool, this, snapshot, keys);
      if (result) keys = result;
    }

    // do the generic serialization, i.e. enumerate all properties and
    for (let i = 0; i < keys.length; i++) {
      var key = keys[i];
      props[key] = {
        key,
        value: this.snapshotProperty(
                  id, realObj[key], path.concat([key]),
                  serializedObjMap, pool)
      };
    }

    // add more / custom stuff to snapshot or modify it somehow
    let addFn = pool.plugins.additionallySerialize.length
             || typeof realObj.__additionally_serialize__ === "function"
              ? __additionally_serialize__addObjectFunction(
                this, snapshot, serializedObjMap, pool, path) : null;
    for (let i = 0; i < pool.plugins.additionallySerialize.length; i++) {
      let p = pool.plugins.additionallySerialize[i];
      p.additionallySerialize(pool, this, snapshot, addFn);
    }

    return ref;
  }

  snapshotProperty(sourceObjId, value, path, serializedObjMap, pool) {
    // returns the value to serialize, i.e. what to put into the snapshot object

    if (typeof value === "function") return undefined; // FIXME

    if (isPrimitive(value)) return value; // stored as is

    for (let i = 0; i < pool.plugins.serializeObject.length; i++) {
      let p = pool.plugins.serializeObject[i],
          serialized = p.serializeObject(value, true, pool, serializedObjMap, path);
      if (serialized) return serialized;
    }

    if (Array.isArray(value))
      return value.map((ea, i) =>
        this.snapshotProperty(sourceObjId, ea, path.concat(i), serializedObjMap, pool));

    let objectRef = pool.add(value);
    return !objectRef || !objectRef.isObjectRef ?
      objectRef :
      objectRef.snapshotObject(serializedObjMap, pool, path);
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


  recreateObjFromSnapshot(serializedObjMap, pool, path) {
    // serializedObjMap: map from ids to object snapshots

    if (this.realObj) return this;

    debugDeserialization && console.log(`[deserialize] ${path.join(".")}`);

    let snapshot = serializedObjMap[this.id];
    if (!snapshot) {
      console.error(`Cannot recreateObjFromSnapshot ObjectRef `
                  + `${this.id} b/c of missing snapshot in snapshot map!`);
      return this;
    }

    let {rev} = snapshot, newObj;
    rev = rev || 0;
    this.snapshotVersions.push(rev);
    this.snapshots[rev] = snapshot;

    for (let i = 0; i < pool.plugins.deserializeObject.length; i++) {
      let p = pool.plugins.deserializeObject[i];
      newObj = p.deserializeObject(pool, this, snapshot, path);
      if (newObj) break;
    }

    if (!newObj) newObj = {};
    if (typeof newObj._rev === "undefined" && typeof newObj === "object")
      newObj._rev = rev || 0;

    this.realObj = newObj;

    pool.internalAddRef(this); // for updating realObj

    if (!newObj) return this;

    if (typeof newObj.__deserialize__ === "function")
      newObj.__deserialize__(snapshot, this, serializedObjMap, pool, path);

    let {props} = snapshot,
        deserializedKeys = {};

    if (props) {

      // deserialize class properties as indicated by realObj.constructor.properties
      let classProperties = newObj.constructor[Symbol.for("lively.classes-properties-and-settings")];
      if (classProperties) {
        let {properties, propertySettings} = classProperties,
            valueStoreProperty = propertySettings.valueStoreProperty || "_state";

        // if props has a valueStoreProperty then we directly deserialize that.
        // As of 2017-02-26 this is for backwards compat.
        if (!props[valueStoreProperty]) {
          if (!newObj.hasOwnProperty(valueStoreProperty))
            newObj.initializeProperties();
          let valueStore = newObj[valueStoreProperty],
              sortedKeys = obj.sortKeysWithBeforeAndAfterConstraints(properties);
          for (let i = 0; i < sortedKeys.length; i++) {
            let key = sortedKeys[i],
                spec = properties[key];
            if (!(key in props)) continue;
            this.recreatePropertyAndSetProperty(newObj, props, key, serializedObjMap, pool, path);
            deserializedKeys[key] = true;
          }
        }
      }

      // deserialize generic properties
      for (var key in props)
        if (!deserializedKeys.hasOwnProperty(key))
          this.recreatePropertyAndSetProperty(newObj, props, key, serializedObjMap, pool, path);
    }

    var idPropertyName = newObj.__serialization_id_property__ || this.idPropertyName;
    if (pool.reinitializeIds && newObj.hasOwnProperty(idPropertyName))
      newObj[idPropertyName] = pool.reinitializeIds(this.id, this);

    if (typeof newObj.__after_deserialize__ === "function")
      newObj.__after_deserialize__(snapshot, this);

    return this;
  }

  recreatePropertyAndSetProperty(newObj, props, key, serializedObjMap, pool, path) {
    try {
      var {verbatim, value} = props[key] || {value: "NON EXISTING"};
      newObj[key] = verbatim ? value :
        this.recreateProperty(key, value, serializedObjMap, pool, path.concat(key));
    } catch (e) {
      var objString;
      try { objString = String(newObj); }
      catch (e) { objString = `[some ${newObj.constructor.name}]` }
      if (!e.__seen) {
        var printedProp = `${key} of ${objString} (${JSON.stringify(value)})`;
        console.error(`Error deserializing property ${printedProp}`);
        e.__seen = true;
      } else console.error(`Error deserializing property ${key} of ${objString}`);
      throw e;
    }
  }

  recreateProperty(key, value, serializedObjMap, pool, path) {
    if (typeof value === "string" && pool.expressionSerializer.isSerializedExpression(value))
      return pool.expressionSerializer.deserializeExpr(value);

    if (isPrimitive(value)) return value;

    if (Array.isArray(value)) return value.map((ea, i) =>
      this.recreateProperty(i, ea, serializedObjMap, pool, path.concat(i)));

    var idPropertyName = value.__serialization_id_property__ || this.idPropertyName;
    var valueRef = pool.refForId(value[idPropertyName])
                || ObjectRef.fromSnapshot(value[idPropertyName],
                                            serializedObjMap, pool, path, this.idPropertyName);
    return valueRef.realObj;
  }

}
