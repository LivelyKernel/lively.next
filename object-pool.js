// import "./object-extensions.js";
// 
// import { arr, obj, num, string } from "lively.lang";
import ClassHelper from "./class-helper.js";
import ExpressionSerializer from "./plugins/expression-serializer.js";
import { ObjectRef } from "./object-ref.js";
import { arr, string } from "lively.lang";
import { isPrimitive } from "./util.js";


export class ObjectPool {

  static requiredModulesOfSnapshot(snapshot, options) {
    return new this(options).requiredModulesOfSnapshot(snapshot);
  }

  static fromJSONSnapshot(jsonSnapshoted, options) {
    return this.fromSnapshot(JSON.parse(jsonSnapshoted), options);
  }

  static fromSnapshot(snapshoted, options) {
    return new this(options).readSnapshot(snapshoted);
  }

  constructor(options) {
    this.uuidGen = string.newUUID;
    this._obj_ref_map = new Map();
    this._id_ref_map = {};

    options = {ignoreClassNotFound: true, idPropertyName: "id", ...options};
    this.classHelper = new ClassHelper(options);
    this.expressionSerializer = new ExpressionSerializer();
    this.reinitializeIds = null;
    this.setOptions(options);
  }

  setOptions(options = {}) {
    if (options.idPropertyName) this.idPropertyName = options.idPropertyName;
    if (options.uuidGen) this.uuidGen = options.uuidGen;;
    if (options.reinitializeIds) this.reinitializeIds = options.reinitializeIds;
    if (options.hasOwnProperty("ignoreClassNotFound"))
      this.classHelper.options.ignoreClassNotFound = options.ignoreClassNotFound;
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
        ObjectRef.fromSnapshot(ids[i], snapshot, this, [], this.idPropertyName);
    return this;
  }

  jsonSnapshot() { return JSON.stringify(this.snapshot(), null, 2); }

  requiredModulesOfSnapshot(snapshot) {
    var modules = [];

    for (var i = 0, ids = Object.keys(snapshot); i < ids.length; i++) {
      var ref = snapshot[ids[i]];

      if (ref.__expr__) {
        let exprModules = this.expressionSerializer.requiredModulesOf__expr__(ref.__expr__);
        if (exprModules) modules.push(...exprModules);
        continue;
      }

      var classModules = ClassHelper.sourceModulesInObjRef(ref);
      if (classModules && classModules.length)
        modules.push(...classModules.map(spec =>
          ((spec.package && spec.package.name) || "") + "/" + spec.pathInPackage));

      if (ref.props) {
        for (var j = 0; j < ref.props.length; j++) {
          let val = ref.props[j].value;
          if (typeof val === "string") {
            let exprModules = this.expressionSerializer.requiredModulesOf__expr__(val);
            if (exprModules) modules.push(...exprModules);
          }
        }
      }

    }

    modules = arr.uniq(modules);

    return modules;
  }
}
