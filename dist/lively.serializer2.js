(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  this.lively = this.lively || {};
(function (exports,lively_lang) {
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj$$1) {
  return typeof obj$$1;
} : function (obj$$1) {
  return obj$$1 && typeof Symbol === "function" && obj$$1.constructor === Symbol && obj$$1 !== Symbol.prototype ? "symbol" : typeof obj$$1;
};











var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();







var _extends = Object.assign || function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];

    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }

  return target;
};

var get$1 = function get$1(object, property, receiver) {
  if (object === null) object = Function.prototype;
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get$1(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;

    if (getter === undefined) {
      return undefined;
    }

    return getter.call(receiver);
  }
};

















var set = function set(object, property, value, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent !== null) {
      set(parent, property, value, receiver);
    }
  } else if ("value" in desc && desc.writable) {
    desc.value = value;
  } else {
    var setter = desc.set;

    if (setter !== undefined) {
      setter.call(receiver, value);
    }
  }

  return value;
};















var toConsumableArray = function (arr$$1) {
  if (Array.isArray(arr$$1)) {
    for (var i = 0, arr2 = Array(arr$$1.length); i < arr$$1.length; i++) arr2[i] = arr$$1[i];

    return arr2;
  } else {
    return Array.from(arr$$1);
  }
};

/*global Map, System*/
// extensions to native JS objects to support serialization


Object.defineProperty(Symbol.prototype, "__serialize__", {
  configurable: true,
  value: function () {
    var knownSymbols = function () {
      return Object.getOwnPropertyNames(Symbol).filter(function (ea) {
        return _typeof(Symbol[ea]) === "symbol";
      }).reduce(function (map, ea) {
        return map.set(Symbol[ea], "Symbol." + ea);
      }, new Map());
    }(),
        symMatcher = /^Symbol\((.*)\)$/;

    return function () {
      // turns a symbol into a __expr__ object.
      var sym = typeof this[Symbol.toPrimitive] === "function" ? this[Symbol.toPrimitive]() : this,
          symKey = Symbol.keyFor(sym);
      if (symKey) return { __expr__: "Symbol.for(\"" + symKey + "\")" };
      if (knownSymbols.get(sym)) return { __expr__: knownSymbols.get(sym) };
      var match = String(sym).match(symMatcher);
      return { __expr__: match ? "Symbol(\"" + match[1] + "\")" : "Symbol()" };
    };
  }()
});

Object.defineProperty(System, "__serialize__", {
  configurable: true,
  value: function value() {
    return { __expr__: "System" };
  }
});

var classMetaForSerializationProp = "lively.serializer-class-info";
var moduleMetaInClassProp = Symbol.for("lively-module-meta");

var ClassHelper = function () {
  createClass(ClassHelper, [{
    key: "classNameProperty",
    get: function get() {
      return '__LivelyClassName__';
    }
  }, {
    key: "sourceModuleNameProperty",
    get: function get() {
      return '__SourceModuleName__';
    }
  }], [{
    key: "moduleMetaInClassProp",
    get: function get() {
      return moduleMetaInClassProp;
    }
  }, {
    key: "classMetaForSerializationProp",
    get: function get() {
      return classMetaForSerializationProp;
    }
  }]);

  function ClassHelper(options) {
    classCallCheck(this, ClassHelper);

    this.options = _extends({ ignoreClassNotFound: true }, options);
    this[Symbol.for('lively-instance-restorer')] = true; // for Class.intializer
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // class info persistence

  createClass(ClassHelper, [{
    key: "addClassInfo",
    value: function addClassInfo(objRef, realObj, snapshot) {

      // store class into persistentCopy if original is an instance
      if (!realObj || !realObj.constructor) return;

      var className = realObj.constructor.name;

      if (!className) {
        console.warn("Cannot serialize class info of anonymous class of instance " + realObj);
        return;
      }

      var moduleMeta = realObj.constructor[moduleMetaInClassProp];
      if (className === "Object" && !moduleMeta) return;
      snapshot[classMetaForSerializationProp] = { className: className, module: moduleMeta };
    }
  }, {
    key: "restoreIfClassInstance",
    value: function restoreIfClassInstance(objRef, snapshot) {
      if (!snapshot.hasOwnProperty(classMetaForSerializationProp)) return;
      var meta = snapshot[classMetaForSerializationProp];
      if (!meta.className) return;

      var klass = this.locateClass(meta);
      if (!klass || typeof klass !== "function") {
        var msg = "Trying to deserialize instance of " + JSON.stringify(meta) + " but this class cannot be found!";
        if (!this.options.ignoreClassNotFound) throw new Error(msg);
        console.error(msg);
        return { isClassPlaceHolder: true, className: meta.className };
      }

      return new klass(this);
    }
  }, {
    key: "locateClass",
    value: function locateClass(meta) {
      // meta = {className, module: {package, pathInPackage}}
      var module = meta.module;
      if (module && module.package && module.package.name) {
        var packagePath = System.decanonicalize(module.package.name + "/"),
            moduleId = lively.lang.string.joinPath(packagePath, module.pathInPackage),
            module = System.get("@lively-env").moduleEnv(moduleId);
        if (!module) console.warn("Trying to deserialize instance of class " + meta.className + " but the module " + moduleId + " is not yet loaded");else return module.recorder[meta.className];
      }

      // is it a global?
      return System.global[meta.className];
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // searching

  }], [{
    key: "sourceModulesInObjRef",
    value: function sourceModulesInObjRef(snapshotedObjRef) {
      //                                  /--- that's the ref
      // from snapshot = {[key]: {..., props: [...]}}
      var modules = [],
          prop = snapshotedObjRef && snapshotedObjRef[classMetaForSerializationProp];
      if (prop && prop.module) modules.push(prop.module);
      return modules;
    }
  }, {
    key: "sourceModulesIn",
    value: function sourceModulesIn(snapshots) {

      var modules = [];

      Object.keys(snapshots).forEach(function (id) {
        var snapshot = snapshots[id];
        if (snapshot && snapshot[classMetaForSerializationProp]) modules.push(snapshot[classMetaForSerializationProp]);
      });

      return lively_lang.arr.uniqBy(modules, function (a, b) {
        var modA = a.module,
            modB = b.module;
        if (!modA && !modB || modA && !modB || !modA && modB) return a.className === b.className;
        return a.className === b.className && modA.package.name == modB.package.name && modA.package.pathInPackage == modB.package.pathInPackage;
      });
    }
  }]);
  return ClassHelper;
}();

var ExpressionSerializer = function () {
  function ExpressionSerializer(opts) {
    classCallCheck(this, ExpressionSerializer);

    var _prefix$opts = _extends({
      prefix: "__lv_expr__"
    }, opts),
        prefix = _prefix$opts.prefix;

    this.prefix = prefix + ":";
  }

  createClass(ExpressionSerializer, [{
    key: "isSerializedExpression",
    value: function isSerializedExpression(string$$1) {
      return string$$1.indexOf(this.prefix) === 0;
    }
  }, {
    key: "requiredModulesOf__expr__",
    value: function requiredModulesOf__expr__(__expr__) {
      if (!this.isSerializedExpression(__expr__)) return null;

      var _exprStringDecode = this.exprStringDecode(__expr__),
          bindings = _exprStringDecode.bindings;

      return bindings ? Object.keys(bindings) : null;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // encode / decode of serialized expressions
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "exprStringDecode",
    value: function exprStringDecode(string$$1) {
      // 1. read prefix
      // string = "_prefix:{foo}:package/foo.js:foo()"
      // => {expr: "foo()", bindings: {"package/foo.js": ["foo"]}}

      var idx, prefix, rest;

      idx = string$$1.indexOf(":"), prefix = string$$1.slice(0, idx), rest = string$$1.slice(idx + 1);

      var bindings = {},
          hasBindings = false;
      // 2. bindings?
      while (rest && rest.startsWith("{") && (idx = rest.indexOf("}:")) >= 0) {
        hasBindings = true;
        var importedVars = rest.slice(1, idx);
        rest = rest.slice(idx + 2); // skip }:
        idx = rest.indexOf(":"); // end of package
        var from = rest.slice(0, idx);
        bindings[from] = importedVars.split(",");
        rest = rest.slice(idx + 1); // skip :
      }

      return { __expr__: rest, bindings: hasBindings ? bindings : null };
    }
  }, {
    key: "exprStringEncode",
    value: function exprStringEncode(_ref) {
      var __expr__ = _ref.__expr__,
          bindings = _ref.bindings;

      // {expr: "foo()", bindings: {"package/foo.js": ["foo"]}}
      // => "_prefix:{foo}:package/foo.js:foo()"

      var string$$1 = String(__expr__);
      if (bindings) {
        var keys = Object.keys(bindings);
        for (var i = 0; i < keys.length; i++) {
          var from = keys[i];
          string$$1 = "{" + bindings[from].join(",") + "}:" + from + ":" + string$$1;
        }
      }
      return this.prefix + string$$1;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // serialization
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  }, {
    key: "convert__expr__obj",
    value: function convert__expr__obj(obj$$1) {
      // obj.__expr__ is encoded serialized expression *without* prefix
      console.assert("__expr__" in obj$$1, "obj has no property __expr__");
      return this.prefix + obj$$1.__expr__;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // deserialization
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    // note __boundValues__ becomes a dynamically scoped "variable" inside eval

  }, {
    key: "__eval__",
    value: function __eval__(__source__, __boundValues__) {
      return eval(__source__);
    }
  }, {
    key: "deserializeExpr",
    value: function deserializeExpr(encoded) {
      if (!encoded.startsWith(this.prefix)) throw new Error("\"" + encoded + "\" is not a serialized expression, missing prefix \"" + this.prefix + "\"");
      return this.deserializeExprObj(this.exprStringDecode(encoded));
    }
  }, {
    key: "deserializeExprObj",
    value: function deserializeExprObj(_ref2) {
      var source = _ref2.__expr__,
          bindings = _ref2.bindings;


      if (bindings) {
        var __boundValues__ = {},
            mods = bindings ? Object.keys(bindings) : [];

        // synchronously get modules specified in bindings object and pull out
        // the vars needed for evaluating source. Add those to __boundValues__
        for (var i = 0; i < mods.length; i++) {
          var modName = mods[i],
              vars = bindings[modName],
              module = System.get(System.decanonicalize(modName));
          if (!module) throw new Error("[lively.serializer] expression eval: bindings specify to import " + modName + " but this module is not loaded!");

          for (var j = 0; j < vars.length; j++) {
            var varName = vars[j];
            __boundValues__[varName] = module[varName];
            source = "var " + varName + " = __boundValues__." + varName + ";\n" + source;
          }
        }
      }

      // evaluate
      return this.__eval__(source, __boundValues__);
    }
  }]);
  return ExpressionSerializer;
}();

function isPrimitive(obj$$1) {
  // primitive objects don't need to be registered
  if (obj$$1 == null) return true;
  var t = typeof obj$$1 === "undefined" ? "undefined" : _typeof(obj$$1);
  if ("boolean" === t || "number" === t || "string" === t) return true;
  return false;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


var ObjectRef = function () {
  function ObjectRef(id, realObj, snapshot) {
    classCallCheck(this, ObjectRef);

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

  createClass(ObjectRef, [{
    key: "asRefForSerializedObjMap",
    value: function asRefForSerializedObjMap() {
      var rev = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "????";

      return { __ref__: true, id: this.id, rev: rev };
    }
  }, {
    key: "snapshotObject",
    value: function snapshotObject(serializedObjMap, pool) {
      var _this = this;

      var path = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];

      // serializedObjMap: maps ids to snapshots

      console.log("[serialize] " + path.join("."));
      if (path.length > 40) throw new Error("stop");

      var id = this.id,
          realObj = this.realObj,
          snapshots = this.snapshots;


      if (!realObj) {
        console.error("Cannot marshall object ref " + id + ", no real object!");
        return _extends({}, this.asRefForSerializedObjMap(), { isMissing: true });
      }

      var rev = realObj._rev || 0,
          ref = this.asRefForSerializedObjMap(rev);
      lively_lang.arr.pushIfNotIncluded(this.snapshotVersions, rev);

      // do we already have serialized a current version of realObj?
      if (snapshots[rev]) {
        if (!serializedObjMap[id]) serializedObjMap[id] = snapshots[rev];
        return ref;
      }

      // can realObj be manually serialized, e.g. into an expression?
      if (typeof realObj.__serialize__ === "function") {
        var serialized = realObj.__serialize__(this, serializedObjMap, pool);
        if (serialized.hasOwnProperty("__expr__")) serialized = { __expr__: pool.expressionSerializer.exprStringEncode(serialized) };
        snapshots[rev] = serializedObjMap[id] = serialized;
        return ref;
      }

      // do the generic serialization, i.e. enumerate all properties and
      // serialize the referenced objects recursively
      var snapshot = snapshots[rev] = serializedObjMap[id] = { rev: rev, props: {} },
          props = snapshot.props,
          keys;

      if (realObj.__dont_serialize__) {
        var exceptions = lively_lang.obj.mergePropertyInHierarchy(realObj, "__dont_serialize__");
        keys = lively_lang.arr.withoutAll(Object.getOwnPropertyNames(realObj), exceptions);
      } else if (realObj.__only_serialize__) {
        // FIXME what about __only_serialize__ && __dont_serialize__?
        keys = realObj.__only_serialize__;
      } else keys = Object.getOwnPropertyNames(realObj);

      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        props[key] = {
          key: key,
          value: this.snapshotProperty(realObj[key], path.concat([key]), serializedObjMap, pool)
        };
      }
      pool.classHelper.addClassInfo(this, realObj, snapshots[rev]);

      if (typeof realObj.__additionally_serialize__ === "function") realObj.__additionally_serialize__(snapshot, this, function (key, value) {
        var verbatim = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
        return props[key] = verbatim ? { key: key, value: value, verbatim: verbatim } : { key: key, value: _this.snapshotProperty(value, path.concat([key]), serializedObjMap, pool) };
      });

      return ref;
    }
  }, {
    key: "snapshotProperty",
    value: function snapshotProperty(value, path, serializedObjMap, pool) {
      var _this2 = this;

      // returns the value to serialize, i.e. what to put into the snapshot object

      if (typeof value === "function") return undefined; // FIXME

      if (isPrimitive(value)) return value; // stored as is

      if (typeof value.__serialize__ === "function") {
        var serialized = value.__serialize__(this, serializedObjMap, pool);
        if (serialized.hasOwnProperty("__expr__")) serialized = pool.expressionSerializer.exprStringEncode(serialized);
        return serialized;
      }

      if (Array.isArray(value)) return value.map(function (ea, i) {
        return _this2.snapshotProperty(ea, path.concat(i), serializedObjMap, pool);
      });

      var ref = pool.add(value);

      return ref && ref.isObjectRef ? ref.snapshotObject(serializedObjMap, pool, path) : ref;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


  }, {
    key: "recreateObjFromSnapshot",
    value: function recreateObjFromSnapshot(serializedObjMap, pool, path) {
      // serializedObjMap: map from ids to object snapshots

      if (this.realObj) return this;

      console.log("[deserialize] " + path.join("."));

      var snapshot = serializedObjMap[this.id];
      if (!snapshot) {
        console.error("Cannot recreateObjFromSnapshot ObjectRef " + this.id + " b/c of missing snapshot in snapshot map!");
        return this;
      }

      var rev = snapshot.rev,
          __expr__ = snapshot.__expr__,
          props = snapshot.props;

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

      if (typeof newObj.__deserialize__ === "function") newObj.__deserialize__(snapshot, this);

      if (props) {

        var highPriorityKeys = ["submorphs"]; // FIXME!!!
        for (var i = 0; i < highPriorityKeys.length; i++) {
          var key = highPriorityKeys[i];
          if (key in props) this.recreatePropertyAndSetProperty(newObj, props, key, serializedObjMap, pool, path);
        }

        for (var key in props) {
          if (!highPriorityKeys.includes(key)) this.recreatePropertyAndSetProperty(newObj, props, key, serializedObjMap, pool, path);
        }
      }

      return this;
    }
  }, {
    key: "recreatePropertyAndSetProperty",
    value: function recreatePropertyAndSetProperty(newObj, props, key, serializedObjMap, pool, path) {
      var _props$key = props[key],
          verbatim = _props$key.verbatim,
          value = _props$key.value;

      try {
        newObj[key] = verbatim ? value : this.recreateProperty(key, value, serializedObjMap, pool, path.concat(key));
      } catch (e) {
        var objString;
        try {
          objString = String(newObj);
        } catch (e) {
          objString = "[some " + newObj.constructor.name + "]";
        }
        if (!e.__seen) {
          var printedProp = key + " of " + objString + " (" + JSON.stringify(value) + ")";
          console.error("Error deserializing property " + printedProp);
          e.__seen = true;
        } else console.error("Error deserializing property " + key + " of " + objString);
        throw e;
      }
    }
  }, {
    key: "recreateProperty",
    value: function recreateProperty(key, value, serializedObjMap, pool, path) {
      var _this3 = this;

      if (typeof value === "string" && pool.expressionSerializer.isSerializedExpression(value)) return pool.expressionSerializer.deserializeExpr(value);

      if (isPrimitive(value)) return value;

      if (Array.isArray(value)) return value.map(function (ea, i) {
        return _this3.recreateProperty(i, ea, serializedObjMap, pool, path.concat(i));
      });

      var valueRef = pool.refForId(value.id) || ObjectRef.fromSnapshot(value.id, serializedObjMap, pool, path);
      return valueRef.realObj;
    }
  }, {
    key: "isObjectRef",
    get: function get() {
      return true;
    }
  }, {
    key: "currentSnapshot",
    get: function get() {
      return this.snapshots[lively_lang.arr.last(this.snapshotVersions)];
    }
  }], [{
    key: "fromSnapshot",
    value: function fromSnapshot(id, snapshot, pool) {
      var path = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];

      return pool.internalAddRef(new this(id)).recreateObjFromSnapshot(snapshot, pool, path);
    }
  }]);
  return ObjectRef;
}();

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


var ObjectPool = function () {
  createClass(ObjectPool, null, [{
    key: "requiredModulesOfSnapshot",
    value: function requiredModulesOfSnapshot(snapshot, options) {
      return new this(options).requiredModulesOfSnapshot(snapshot);
    }
  }, {
    key: "fromJSONSnapshot",
    value: function fromJSONSnapshot(jsonSnapshoted, options) {
      return this.fromSnapshot(JSON.parse(jsonSnapshoted), options);
    }
  }, {
    key: "fromSnapshot",
    value: function fromSnapshot(snapshoted, options) {
      return new this(options).readSnapshot(snapshoted);
    }
  }]);

  function ObjectPool() {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : { ignoreClassNotFound: true, uuidGen: null };
    classCallCheck(this, ObjectPool);

    this._obj_ref_map = new Map();
    this._id_ref_map = {};
    this.classHelper = new ClassHelper(options);
    this.uuidGen = options.uuidGen || lively_lang.string.newUUID;
    this.expressionSerializer = new ExpressionSerializer();
  }

  createClass(ObjectPool, [{
    key: "knowsId",
    value: function knowsId(id) {
      return !!this._id_ref_map[id];
    }
  }, {
    key: "refForId",
    value: function refForId(id) {
      return this._id_ref_map[id];
    }
  }, {
    key: "resolveToObj",
    value: function resolveToObj(id) {
      var ref = this._id_ref_map[id];return ref ? ref.realObj : undefined;
    }
  }, {
    key: "ref",
    value: function ref(obj$$1) {
      return this._obj_ref_map.get(obj$$1);
    }
  }, {
    key: "objects",
    value: function objects() {
      return Array.from(this._obj_ref_map.keys());
    }
  }, {
    key: "objectRefs",
    value: function objectRefs() {
      return Array.from(this._obj_ref_map.values());
    }
  }, {
    key: "internalAddRef",
    value: function internalAddRef(ref) {
      if (ref.realObj) this._obj_ref_map.set(ref.realObj, ref);
      this._id_ref_map[ref.id] = ref;
      return ref;
    }
  }, {
    key: "add",
    value: function add(obj$$1) {
      var _this4 = this;

      // adds an object to the object pool and returns a "ref" object
      // that is guaranteed to be JSON.stringifyable and that can be used as a place
      // holder in a serialized graph / list

      // primitive objects don't need to be registered
      if (isPrimitive(obj$$1)) return undefined;

      if (Array.isArray(obj$$1)) return obj$$1.map(function (element) {
        return _this4.add(element);
      });

      return this.ref(obj$$1) || this.internalAddRef(new ObjectRef(obj$$1.id || this.uuidGen(), obj$$1));
    }
  }, {
    key: "snapshot",
    value: function snapshot() {
      var snapshot = {};
      for (var i = 0, ids = Object.keys(this._id_ref_map); i < ids.length; i++) {
        var ref = this._id_ref_map[ids[i]];
        ref.snapshotObject(snapshot, this);
      }
      return snapshot;
    }
  }, {
    key: "readSnapshot",
    value: function readSnapshot(snapshot) {
      for (var i = 0, ids = Object.keys(snapshot); i < ids.length; i++) {
        if (!this.resolveToObj(ids[i])) ObjectRef.fromSnapshot(ids[i], snapshot, this);
      }return this;
    }
  }, {
    key: "jsonSnapshot",
    value: function jsonSnapshot() {
      return JSON.stringify(this.snapshot(), null, 2);
    }
  }, {
    key: "requiredModulesOfSnapshot",
    value: function requiredModulesOfSnapshot(snapshot) {
      var modules = [];

      for (var i = 0, ids = Object.keys(snapshot); i < ids.length; i++) {
        var _modules2;

        var ref = snapshot[ids[i]];

        if (ref.__expr__) {
          var _modules;

          var exprModules = this.expressionSerializer.requiredModulesOf__expr__(ref.__expr__);
          if (exprModules) (_modules = modules).push.apply(_modules, toConsumableArray(exprModules));
          continue;
        }

        var classModules = ClassHelper.sourceModulesInObjRef(ref);
        if (classModules && classModules.length) (_modules2 = modules).push.apply(_modules2, toConsumableArray(classModules.map(function (spec) {
          return console.log(spec) || (spec.package && spec.package.name || "") + "/" + spec.pathInPackage;
        })));

        if (ref.props) {
          for (var j = 0; j < ref.props.length; j++) {
            var val = ref.props[j].value;
            if (typeof val === "string") {
              var _modules3;

              var _exprModules = this.expressionSerializer.requiredModulesOf__expr__(val);
              if (_exprModules) (_modules3 = modules).push.apply(_modules3, toConsumableArray(_exprModules));
            }
          }
        }
      }

      modules = lively_lang.arr.uniq(modules);

      return modules;
    }
  }]);
  return ObjectPool;
}();

function serialize(obj$$1) {
  var objPool = new ObjectPool();
  objPool.add(obj$$1);
  return objPool.snapshot();
}

exports.ObjectRef = ObjectRef;
exports.ObjectPool = ObjectPool;
exports.serialize = serialize;

}((this.lively.serializer2 = this.lively.serializer2 || {}),lively.lang));

  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.serializer2;
})();