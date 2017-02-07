import { arr, obj, num, string } from "lively.lang";
import { isPrimitive } from "./util.js";

var debugSerialization = false,
    debugDeserialization = false;

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

  get currentSnapshot() { return this.snapshots[arr.last(this.snapshotVersions)]}

  asRefForSerializedObjMap(rev = "????") {
    return {__ref__: true, id: this.id, rev}
  }

  snapshotObject(serializedObjMap, pool, path = []) {
    // serializedObjMap: maps ids to snapshots

    debugSerialization && console.log(`[serialize] ${path.join(".")}`);

    if (path.length > 100) throw new Error(
      `Stopping serializer, encountered a possibly infinit loop: ${path.join(".")}`);

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

    // can realObj be manually serialized, e.g. into an expression?
    if (typeof realObj.__serialize__ === "function") {
      var serialized = realObj.__serialize__(this, serializedObjMap, pool);
      if (serialized.hasOwnProperty("__expr__"))
        serialized = {__expr__: pool.expressionSerializer.exprStringEncode(serialized)};
      snapshots[rev] = serializedObjMap[id] = serialized;
      return ref;
    }

    // do the generic serialization, i.e. enumerate all properties and
    // serialize the referenced objects recursively
    var snapshot = snapshots[rev] = serializedObjMap[id] = {rev, props: {}},
        props = snapshot.props, keys;

    if (realObj.__dont_serialize__) {
      var exceptions = obj.mergePropertyInHierarchy(realObj, "__dont_serialize__");
      keys = arr.withoutAll(Object.getOwnPropertyNames(realObj), exceptions);

    } else if (realObj.__only_serialize__) {
      // FIXME what about __only_serialize__ && __dont_serialize__?
      keys = realObj.__only_serialize__;

    } else keys = Object.getOwnPropertyNames(realObj);

    for (let i = 0; i < keys.length; i++) {
      let key = keys[i];
      props[key] = {
        key,
        value: this.snapshotProperty(
                  realObj[key], path.concat([key]),
                  serializedObjMap, pool)
      };
    }
    pool.classHelper.addClassInfo(this, realObj, snapshots[rev]);

    if (typeof realObj.__additionally_serialize__ === "function")
      realObj.__additionally_serialize__(
        snapshot, this,
        (key, value, verbatim = false) =>
          props[key] = verbatim ? {key, value, verbatim} :
            {key, value: this.snapshotProperty(
              value, path.concat([key]), serializedObjMap, pool)});

    return ref;
  }

  snapshotProperty(value, path, serializedObjMap, pool) {
    // returns the value to serialize, i.e. what to put into the snapshot object

    if (typeof value === "function") return undefined; // FIXME

    if (isPrimitive(value)) return value; // stored as is

    if (typeof value.__serialize__ === "function") {
      var serialized = value.__serialize__(this, serializedObjMap, pool);
      if (serialized.hasOwnProperty("__expr__"))
        serialized = pool.expressionSerializer.exprStringEncode(serialized);
      return serialized;
    }

    if (Array.isArray(value))
      return value.map((ea, i) =>
        this.snapshotProperty(ea, path.concat(i), serializedObjMap, pool));

    let ref = pool.add(value);

    return ref && ref.isObjectRef ?
      ref.snapshotObject(serializedObjMap, pool, path) : ref;
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


  recreateObjFromSnapshot(serializedObjMap, pool, path) {
    // serializedObjMap: map from ids to object snapshots

    if (this.realObj) return this;

    debugDeserialization && console.log(`[deserialize] ${path.join(".")}`);

    var snapshot = serializedObjMap[this.id];
    if (!snapshot) {
      console.error(`Cannot recreateObjFromSnapshot ObjectRef `
                  + `${this.id} b/c of missing snapshot in snapshot map!`);
      return this;
    }

    var {rev, __expr__} = snapshot;
    rev = rev || 0;
    this.snapshotVersions.push(rev);
    this.snapshots[rev] = snapshot;

    var newObj;
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
      newObj.__deserialize__(snapshot, this);

    var {props} = snapshot;
    if (props) {
      var highPriorityKeys = ["submorphs"]; // FIXME!!!
      var lowPriorityKeys = ["attributeConnections"]; // FIXME!!!
      for (var i = 0; i < highPriorityKeys.length; i++) {
        var key = highPriorityKeys[i];
        if (key in props)
          this.recreatePropertyAndSetProperty(newObj, props, key, serializedObjMap, pool, path);
      }

      for (var key in props)
        if (!highPriorityKeys.includes(key) && !lowPriorityKeys.includes(key))
          this.recreatePropertyAndSetProperty(newObj, props, key, serializedObjMap, pool, path);

      for (var i = 0; i < lowPriorityKeys.length; i++) {
        var key = lowPriorityKeys[i];
        if (key in props)
          this.recreatePropertyAndSetProperty(newObj, props, key, serializedObjMap, pool, path);
      }

    }

    var idPropertyName = newObj.__serialization_id_property__ || this.idPropertyName;
    if (pool.reinitializeIds && newObj.hasOwnProperty(idPropertyName))
      newObj[idPropertyName] = pool.reinitializeIds(this.id, this);

    if (typeof newObj.__after_deserialize__ === "function")
      newObj.__after_deserialize__(snapshot, this);

    return this;
  }

  recreatePropertyAndSetProperty(newObj, props, key, serializedObjMap, pool, path) {
    var {verbatim, value} = props[key];
    try {
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
