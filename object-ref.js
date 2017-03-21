import { arr, obj, num, string } from "lively.lang";
import { isPrimitive } from "./util.js";

const debugSerialization = false,
      debugDeserialization = false;

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
    if (!this.snapshotVersions.length) {
      var rev = 0;
      this.snapshotVersions.push(rev);
      this.snapshots[rev] = {rev, props: {}};
    }
    return this.snapshots[arr.last(this.snapshotVersions)]
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

    // can realObj be manually serialized, e.g. into an expression?
    if (typeof realObj.__serialize__ === "function") {
      let serialized = realObj.__serialize__(pool, serializedObjMap, path, this);
      if (serialized.hasOwnProperty("__expr__"))
        serialized = {__expr__: pool.expressionSerializer.exprStringEncode(serialized)};
      snapshots[rev] = serializedObjMap[id] = serialized;
      return ref;
    }

    // serialize class properties as indicated by realObj.constructor.properties
    let snapshot = snapshots[rev] = serializedObjMap[id] = {rev, props: {}},
        props = snapshot.props,
        classProperties = realObj.constructor[Symbol.for("lively.classes-properties-and-settings")],
        onlyKeys = realObj.__only_serialize__,
        exceptKeys = realObj.__dont_serialize__ ?
          obj.mergePropertyInHierarchy(realObj, "__dont_serialize__") : [];

    if (classProperties) {
      let {properties, propertySettings} = classProperties,
          valueStoreProperty = propertySettings.valueStoreProperty || "_state",
          valueStore = realObj[valueStoreProperty];

      if (valueStore) {
        // don't save the store property as well - we are already saving the
        // managed properties directly
        for (let key in properties) {
          if (exceptKeys.includes(key) || (onlyKeys && !onlyKeys.includes(key))) continue;
          let spec = properties[key];
          if (spec.derived) continue;
          if (!spec || (spec.hasOwnProperty("serialize") && !spec.serialize)) continue;
          props[key] = {
            key,
            value: this.snapshotProperty(
                      id, realObj[key], path.concat([key]),
                      serializedObjMap, pool)
          };
          exceptKeys.push(key);
        }
        exceptKeys.push(valueStoreProperty);
      }
    }

    // do the generic serialization, i.e. enumerate all properties and
    let keys = onlyKeys || Object.getOwnPropertyNames(realObj);
    if (exceptKeys.length) keys = arr.withoutAll(keys, exceptKeys);
    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];
      props[key] = {
        key,
        value: this.snapshotProperty(
                  id, realObj[key], path.concat([key]),
                  serializedObjMap, pool)
      };
    }

    pool.classHelper.addClassInfo(this, realObj, snapshots[rev]);

    if (typeof realObj.__additionally_serialize__ === "function")
      realObj.__additionally_serialize__(
        snapshot, this, pool,
        __additionally_serialize__addObjectFunction(
          this, snapshot, serializedObjMap, pool, path));

    return ref;
  }

  snapshotProperty(sourceObjId, value, path, serializedObjMap, pool) {
    // returns the value to serialize, i.e. what to put into the snapshot object

    if (typeof value === "function") return undefined; // FIXME

    if (isPrimitive(value)) return value; // stored as is

    if (typeof value.__serialize__ === "function") {
      var serialized = value.__serialize__(pool, serializedObjMap, path, undefined);
      if (serialized.hasOwnProperty("__expr__"))
        serialized = pool.expressionSerializer.exprStringEncode(serialized);
      return serialized;
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

    let {rev, __expr__} = snapshot;
    rev = rev || 0;
    this.snapshotVersions.push(rev);
    this.snapshots[rev] = snapshot;

    let newObj;
    if (__expr__) {
      newObj = pool.expressionSerializer.deserializeExpr(__expr__);
    } else {
      newObj = pool.classHelper.restoreIfClassInstance(this, snapshot) || {};
      if (!newObj._rev) newObj._rev = rev;
    }

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
            if (spec.derived || !(key in props)) continue;
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
