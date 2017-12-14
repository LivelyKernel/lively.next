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

var slicedToArray = function () {
  function sliceIterator(arr$$1, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr$$1[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"]) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  return function (arr$$1, i) {
    if (Array.isArray(arr$$1)) {
      return arr$$1;
    } else if (Symbol.iterator in Object(arr$$1)) {
      return sliceIterator(arr$$1, i);
    } else {
      throw new TypeError("Invalid attempt to destructure non-iterable instance");
    }
  };
}();













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

// Symbol
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

// System
Object.defineProperty(System, "__serialize__", {
  configurable: true,
  value: function value() {
    return { __expr__: "System" };
  }
});

// window/global
Object.defineProperty(System.global, "__serialize__", {
  configurable: true,
  value: function value() {
    return { __expr__: "System.global" };
  }
});

// Map
Object.defineProperty(Map.prototype, "__serialize__", {
  configurable: true,
  value: function value(pool, snapshots, path) {
    // ensure ObjectRef and snapshot object for map
    var ref = pool.add(this),
        rev = ref.currentRev,
        snapshot = ref.currentSnapshot,
        entries = snapshot.entries = [],
        i = 0;
    snapshots[ref.id] = snapshot;
    // store class info
    pool.classHelper.addClassInfo(ref, this, snapshot);
    var _iteratorNormalCompletion = true;
    var _didIteratorError = false;
    var _iteratorError = undefined;

    try {
      for (var _iterator = this[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
        var _step$value = slicedToArray(_step.value, 2),
            key = _step$value[0],
            value = _step$value[1];

        i++;
        // serialize all entries into snapshot.entries
        var serializedKey = ref.snapshotProperty(ref.id, key, path.concat("key", String(i)), snapshots, pool),
            serializedValue = ref.snapshotProperty(ref.id, value, path.concat("value", String(i)), snapshots, pool);
        entries.push(serializedKey, serializedValue);
      }
    } catch (err) {
      _didIteratorError = true;
      _iteratorError = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion && _iterator.return) {
          _iterator.return();
        }
      } finally {
        if (_didIteratorError) {
          throw _iteratorError;
        }
      }
    }

    return ref.asRefForSerializedObjMap(rev);
  }
});
Object.defineProperty(Map.prototype, "__deserialize__", {
  configurable: true,
  value: function value(snapshot, ref, serializedObjMap, pool, path) {
    // deserialize entries from snapshot.entries
    var entries = snapshot.entries;

    for (var i = 0; i < entries.length; i = i + 2) {
      var key = entries[i],
          value = entries[i + 1],
          deserializedKey = ref.recreateProperty("key." + i, key, serializedObjMap, pool, path.concat("key", i)),
          deserializedValue = ref.recreateProperty("value." + i, value, serializedObjMap, pool, path.concat("value", i));
      this.set(deserializedKey, deserializedValue);
    }
  }
});

// Set
Object.defineProperty(Set.prototype, "__serialize__", {
  configurable: true,
  value: function value(pool, snapshots, path) {
    // ensure ObjectRef and snapshot object for set
    var ref = pool.add(this),
        rev = ref.currentRev,
        snapshot = ref.currentSnapshot,
        entries = snapshot.entries = [],
        i = 0;
    snapshots[ref.id] = snapshot;
    // store class info
    pool.classHelper.addClassInfo(ref, this, snapshot);
    var _iteratorNormalCompletion2 = true;
    var _didIteratorError2 = false;
    var _iteratorError2 = undefined;

    try {
      for (var _iterator2 = this[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
        var entry = _step2.value;

        i++;
        // serialize all entries into snapshot.entries
        var serializedEntry = ref.snapshotProperty(ref.id, entry, path.concat("entry", String(i)), snapshots, pool);
        entries.push(serializedEntry);
      }
    } catch (err) {
      _didIteratorError2 = true;
      _iteratorError2 = err;
    } finally {
      try {
        if (!_iteratorNormalCompletion2 && _iterator2.return) {
          _iterator2.return();
        }
      } finally {
        if (_didIteratorError2) {
          throw _iteratorError2;
        }
      }
    }

    return ref.asRefForSerializedObjMap(rev);
  }
});
Object.defineProperty(Set.prototype, "__deserialize__", {
  configurable: true,
  value: function value(snapshot, ref, serializedObjMap, pool, path) {
    // deserialize entries from snapshot.entries
    var entries = snapshot.entries;

    for (var i = 0; i < entries.length; i++) {
      var deserializedEntry = ref.recreateProperty("entry." + i, entries[i], serializedObjMap, pool, path.concat("key", i));
      this.add(deserializedEntry);
    }
  }
});

function isPrimitive(obj$$1) {
  // primitive objects don't need to be registered
  if (obj$$1 == null) return true;
  var t = typeof obj$$1 === "undefined" ? "undefined" : _typeof(obj$$1);
  if ("boolean" === t || "number" === t || "string" === t) return true;
  return false;
}

/*global System*/
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
      // Errrr FIXME
      if (moduleMeta) {
        delete moduleMeta.lastChange;
        delete moduleMeta.lastSuperclassChange;
      }
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

      // non-lively classes don't understand our instance restorer arg...!'
      var isLivelyClass = klass.hasOwnProperty(Symbol.for("lively-instance-superclass"));
      return isLivelyClass ? new klass(this) : new klass();
    }
  }, {
    key: "locateClass",
    value: function locateClass(meta) {
      // meta = {className, module: {package, pathInPackage}}
      var m = meta.module;
      if (m) {
        var moduleId = m.pathInPackage;
        if (m.package && m.package.name && m.package.name !== "no group" /*FIXME*/) {
            var packagePath = System.decanonicalize(m.package.name.replace(/\/*$/, "/"));
            moduleId = lively_lang.string.joinPath(packagePath, moduleId);
          }

        var livelyEnv = System.get("@lively-env"),
            realModule = livelyEnv.moduleEnv(moduleId) || livelyEnv.moduleEnv(m.pathInPackage);
        if (!realModule) console.warn("Trying to deserialize instance of class " + meta.className + " but the module " + moduleId + " is not yet loaded");else return realModule.recorder[meta.className];
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

/*global System*/
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

      var idx = string$$1.indexOf(":"),
          prefix = string$$1.slice(0, idx),
          rest = string$$1.slice(idx + 1),
          bindings = {},
          hasBindings = false;

      // 2. bindings?
      while (rest && rest.startsWith("{") && (idx = rest.indexOf("}:")) >= 0) {
        hasBindings = true;
        var importedVars = rest.slice(1, idx);
        rest = rest.slice(idx + 2); // skip }:
        idx = rest.indexOf(":"); // end of package
        var from = rest.slice(0, idx),
            imports = importedVars.split(",").filter(function (ea) {
          return Boolean(ea.trim());
        }).map(function (ea) {
          if (!ea.includes(":")) return ea;

          var _ea$split = ea.split(":"),
              _ea$split2 = slicedToArray(_ea$split, 2),
              exported = _ea$split2[0],
              local = _ea$split2[1];

          return { exported: exported, local: local };
        });
        bindings[from] = imports;
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
          var from = keys[i],
              binding = bindings[from];
          if (Array.isArray(binding)) {
            binding = binding.map(function (ea) {
              return typeof ea === "string" ? ea : ea.exported + ":" + ea.local;
            }).join(",");
          }
          string$$1 = "{" + binding + "}:" + from + ":" + string$$1;
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


      var __boundValues__ = {};

      if (bindings) {
        var mods = bindings ? Object.keys(bindings) : [];

        // synchronously get modules specified in bindings object and pull out
        // the vars needed for evaluating source. Add those to __boundValues__
        for (var i = 0; i < mods.length; i++) {
          var modName = mods[i],
              vars = bindings[modName],
              exports = System.get(System.decanonicalize(modName));
          if (!exports) throw new Error("[lively.serializer] expression eval: bindings specify to import " + modName + " but this module is not loaded!\nSource: " + source);

          for (var j = 0; j < vars.length; j++) {
            var varName = vars[j],
                local = void 0,
                exported = void 0;
            if (typeof varName === "string") {
              local = varName;exported = varName;
            } else if ((typeof varName === "undefined" ? "undefined" : _typeof(varName)) === "object") {
              local = varName.local; // alias

              exported = varName.exported;
            }
            __boundValues__[local] = exports[exported];
            source = "var " + local + " = __boundValues__." + local + ";\n" + source;
          }
        }
      }

      // evaluate
      return this.__eval__(source, __boundValues__);
    }
  }]);
  return ExpressionSerializer;
}();

/*

Plugins can implement the following methods to hook into and modify the
serialization process

# serialization

beforeSerialization(pool, realObj)
  Called before serialization starts

afterSerialization(pool, realObj, snapshot)
  Called after serialization ended

serializeObject(realObj, isProperty, pool, serializedObjMap, path)
  If an non-null value is returned this is taken as the value to be placed into
  the snapshot

propertiesToSerialize(pool, ref, snapshot, keysSoFar)
  Should either return null or a list of property names to serialize.  Plugins
  implementing this method get chained in the order in which the object pool
  has the plugins installed.  The return value of one plugin gets passed as
  `keysSoFar` to the next plugin.  The initial value of `keysSoFar` is
  Object.getOwnPropertyKeys(obj).  A nullish value is ignored.

additionallySerialize(pool, ref, snapshot, addFn)
  Can modify `snapshot`.  Return value is not used.


# deserialization

beforeDeserialization(pool, idAndSnapshot)
  Called before serialization starts

afterDeserialization(pool, idAndSnapshot)
  Called after deserialization ended

deserializeObject(pool, ref, snapshot, path)
  given snapshot can produce a new object as the instance to be used in the new
  object graph.  A nullish value will result in the deserializer using a plain
  Object instance.

additionallyDeserializeBeforeProperties(pool, ref, newObj, props, snapshot, serializedObjMap, path)
  Gets snapshot.props passed and can modify newObj.  A non-nullish value will
  be used as props, it is passed to the next plugin implementing this method.
  The result of the final plugin will be used for the normal props
  deserialization.

additionallyDeserializeAfterProperties(pool, ref, newObj, snapshot, serializedObjMap, path)
  Called for side effect, can modify newObj

*/



var CustomSerializePlugin = function () {
  function CustomSerializePlugin() {
    classCallCheck(this, CustomSerializePlugin);
  }

  createClass(CustomSerializePlugin, [{
    key: "serializeObject",


    // can realObj be manually serialized, e.g. into an expression?
    value: function serializeObject(realObj, isProperty, pool, serializedObjMap, path) {
      if (typeof realObj.__serialize__ !== "function") return null;
      var serialized = realObj.__serialize__(pool, serializedObjMap, path);
      if (serialized && serialized.hasOwnProperty("__expr__")) {
        var expr = pool.expressionSerializer.exprStringEncode(serialized);
        serialized = isProperty ? expr : { __expr__: expr };
      }
      return serialized;
    }
  }, {
    key: "deserializeObject",
    value: function deserializeObject(pool, ref, snapshot, path) {
      var __expr__ = snapshot.__expr__;

      return __expr__ ? pool.expressionSerializer.deserializeExpr(__expr__) : null;
    }
  }]);
  return CustomSerializePlugin;
}();

var ClassPlugin = function () {
  function ClassPlugin() {
    classCallCheck(this, ClassPlugin);
  }

  createClass(ClassPlugin, [{
    key: "additionallySerialize",


    // record class meta info for re-instantiating
    value: function additionallySerialize(pool, ref, snapshot, addFn) {
      pool.classHelper.addClassInfo(ref, ref.realObj, snapshot);
    }
  }, {
    key: "deserializeObject",
    value: function deserializeObject(pool, ref, snapshot, path) {
      return pool.classHelper.restoreIfClassInstance(ref, snapshot);
    }
  }]);
  return ClassPlugin;
}();

var AdditionallySerializePlugin = function () {
  function AdditionallySerializePlugin() {
    classCallCheck(this, AdditionallySerializePlugin);
  }

  createClass(AdditionallySerializePlugin, [{
    key: "additionallySerialize",

    // for objects with __additionally_serialize__(snapshot, ref, pool, addFn) method

    value: function additionallySerialize(pool, ref, snapshot, addFn) {
      var realObj = ref.realObj;

      if (realObj && typeof realObj.__additionally_serialize__ === "function") realObj.__additionally_serialize__(snapshot, ref, pool, addFn);
    }
  }, {
    key: "additionallyDeserializeBeforeProperties",
    value: function additionallyDeserializeBeforeProperties(pool, ref, newObj, props, snapshot, serializedObjMap, path) {
      if (typeof newObj.__deserialize__ === "function") newObj.__deserialize__(snapshot, ref, serializedObjMap, pool, path);
    }
  }, {
    key: "additionallyDeserializeAfterProperties",
    value: function additionallyDeserializeAfterProperties(pool, ref, newObj, snapshot, serializedObjMap, path) {
      if (typeof newObj.__after_deserialize__ === "function") newObj.__after_deserialize__(snapshot, ref);
    }
  }]);
  return AdditionallySerializePlugin;
}();

var OnlySerializePropsPlugin = function () {
  function OnlySerializePropsPlugin() {
    classCallCheck(this, OnlySerializePropsPlugin);
  }

  createClass(OnlySerializePropsPlugin, [{
    key: "propertiesToSerialize",
    value: function propertiesToSerialize(pool, ref, snapshot, keysSoFar) {
      var realObj = ref.realObj;

      return realObj && realObj.__only_serialize__ || null;
    }
  }]);
  return OnlySerializePropsPlugin;
}();

var DontSerializePropsPlugin = function () {
  function DontSerializePropsPlugin() {
    classCallCheck(this, DontSerializePropsPlugin);
  }

  createClass(DontSerializePropsPlugin, [{
    key: "propertiesToSerialize",
    value: function propertiesToSerialize(pool, ref, snapshot, keysSoFar) {
      var realObj = ref.realObj;

      if (!realObj || !realObj.__dont_serialize__) return null;
      var ignoredKeys = lively_lang.obj.mergePropertyInHierarchy(realObj, "__dont_serialize__"),
          keys = [];
      for (var i = 0; i < keysSoFar.length; i++) {
        var key = keysSoFar[i];
        if (!ignoredKeys.includes(key)) keys.push(key);
      }
      return keys;
    }
  }]);
  return DontSerializePropsPlugin;
}();

var LivelyClassPropertiesPlugin = function () {
  function LivelyClassPropertiesPlugin() {
    classCallCheck(this, LivelyClassPropertiesPlugin);
  }

  createClass(LivelyClassPropertiesPlugin, [{
    key: "propertiesToSerialize",
    value: function propertiesToSerialize(pool, ref, snapshot, keysSoFar) {
      // serialize class properties as indicated by realObj.constructor.properties
      var realObj = ref.realObj,
          classProperties = realObj.constructor[Symbol.for("lively.classes-properties-and-settings")];


      if (!classProperties) return null;

      var properties = classProperties.properties,
          propertySettings = classProperties.propertySettings,
          valueStoreProperty = propertySettings.valueStoreProperty || "_state",
          valueStore = realObj[valueStoreProperty],
          only = !!realObj.__only_serialize__,
          keys = [];


      if (!valueStore) return;

      // if __only_serialize__ is defined we will only consider those properties
      // that are in keysSoFar – it is expected that the OnlySerializePropsPlugin
      // was producing that list.

      if (only) {
        for (var i = 0; i < keysSoFar.length; i++) {
          var _key = keysSoFar[i],
              _spec = properties[_key];
          if (_key === valueStoreProperty) continue;
          if (_spec) {
            if (_spec && (_spec.derived || _spec.readOnly || _spec.hasOwnProperty("serialize") && !_spec.serialize)) continue;
          }
          keys.push(_key);
        }
        return keys;
      }

      // Otherwise properties add to keysSoFar
      var valueStoreKeyIdx = keysSoFar.indexOf(valueStoreProperty);
      if (valueStoreKeyIdx > -1) keysSoFar.splice(valueStoreKeyIdx, 1);

      for (var key in properties) {
        var spec = properties[key],
            idx = keysSoFar.indexOf(key);
        if (spec.derived || spec.readOnly || spec.hasOwnProperty("serialize") && !spec.serialize) {
          if (idx > -1) keysSoFar.splice(idx, 1);
        } else if (idx === -1) keys.push(key);
      }
      return keys.concat(keysSoFar);
    }
  }, {
    key: "additionallyDeserializeBeforeProperties",
    value: function additionallyDeserializeBeforeProperties(pool, ref, newObj, props, snapshot, serializedObjMap, path) {
      // deserialize class properties as indicated by realObj.constructor.properties
      var classProperties = newObj.constructor[Symbol.for("lively.classes-properties-and-settings")];
      if (!classProperties) return props;

      var properties = classProperties.properties,
          propertySettings = classProperties.propertySettings,
          valueStoreProperty = propertySettings.valueStoreProperty || "_state",
          props = snapshot.props;

      // if props has a valueStoreProperty then we directly deserialize that.
      // As of 2017-02-26 this is for backwards compat.

      if (props[valueStoreProperty]) return props;

      props = lively_lang.obj.clone(props);

      if (!newObj.hasOwnProperty(valueStoreProperty)) newObj.initializeProperties();

      var valueStore = newObj[valueStoreProperty],
          sortedKeys = lively_lang.obj.sortKeysWithBeforeAndAfterConstraints(properties);
      for (var i = 0; i < sortedKeys.length; i++) {
        var key = sortedKeys[i],
            spec = properties[key];
        if (!props.hasOwnProperty(key)) continue;
        ref.recreatePropertyAndSetProperty(newObj, props, key, serializedObjMap, pool, path);
        delete props[key];
      }

      return props;
    }
  }]);
  return LivelyClassPropertiesPlugin;
}();

var plugins = {
  livelyClassPropertiesPlugin: new LivelyClassPropertiesPlugin(),
  dontSerializePropsPlugin: new DontSerializePropsPlugin(),
  onlySerializePropsPlugin: new OnlySerializePropsPlugin(),
  additionallySerializePlugin: new AdditionallySerializePlugin(),
  classPlugin: new ClassPlugin(),
  customSerializePlugin: new CustomSerializePlugin()
};

var allPlugins = [plugins.customSerializePlugin, plugins.classPlugin, plugins.additionallySerializePlugin, plugins.onlySerializePropsPlugin, plugins.dontSerializePropsPlugin, plugins.livelyClassPropertiesPlugin];

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

new ObjectPool().snapshotObject({foo: {bar: 23}}); // =>
{
  id: "EDF8404A-243A-4858-9C98-0BFEE7DB369E"
  snapshot: {
    "A1CB461E-9187-4711-BEBA-B9E3D1B6D900": {
      props: {
        bar: {key: "bar",value: 23}
      },
      rev: 0
    },
    "EDF8404A-243A-4858-9C98-0BFEE7DB369E": {
      props: {
        foo: {
          key: "foo",
          value: {__ref__: true, id: "A1CB461E-9187-4711-BEBA-B9E3D1B6D900", rev: 0}
        }
      },
      rev: 0
    }
  }
}

For deserialization the process is reversed, i.e. object refs are created from
a snapshot which then re-instantiate objects.  Object properties are hooked up
so that a copy of the original object graph is re-created.

*/

var debugSerialization = false;
var debugDeserialization = false;

var ObjectPool = function () {
  createClass(ObjectPool, null, [{
    key: "withDefaultPlugins",
    value: function withDefaultPlugins(options) {
      return new this(_extends({ plugins: allPlugins }, options));
    }
  }, {
    key: "resolveFromSnapshotAndId",
    value: function resolveFromSnapshotAndId(snapshotAndId, options) {
      return new this(options).resolveFromSnapshotAndId(snapshotAndId);
    }
  }, {
    key: "fromSnapshot",
    value: function fromSnapshot(snapshoted, options) {
      return new this(options).readSnapshot(snapshoted);
    }
  }, {
    key: "withObject",
    value: function withObject(obj$$1, options) {
      var pool = new this(options);
      pool.add(obj$$1);
      return pool;
    }
  }]);

  function ObjectPool(options) {
    classCallCheck(this, ObjectPool);

    this.options = _extends({ ignoreClassNotFound: true, idPropertyName: "id" }, options);
    this.reset();
  }

  createClass(ObjectPool, [{
    key: "reset",
    value: function reset() {
      this.uuidGen = lively_lang.string.newUUID;
      this._obj_ref_map = new Map();
      this._id_ref_map = {};

      var options = this.options;

      this.classHelper = new ClassHelper(options);
      this.expressionSerializer = new ExpressionSerializer();

      if (options.idPropertyName) this.idPropertyName = options.idPropertyName;
      if (options.uuidGen) this.uuidGen = options.uuidGen;
      if (options.reinitializeIds) this.reinitializeIds = options.reinitializeIds;
      if (options.hasOwnProperty("ignoreClassNotFound")) this.classHelper.options.ignoreClassNotFound = options.ignoreClassNotFound;

      var ps = this.plugins = {
        serializeObject: [],
        additionallySerialize: [],
        propertiesToSerialize: [],
        deserializeObject: [],
        additionallyDeserializeBeforeProperties: [],
        additionallyDeserializeAfterProperties: [],
        afterDeserialization: [],
        beforeDeserialization: [],
        afterSerialization: [],
        beforeSerialization: []
      };

      if (options.plugins) {
        options.plugins.forEach(function (p) {
          if (typeof p.serializeObject === "function") ps.serializeObject.push(p);
          if (typeof p.additionallySerialize === "function") ps.additionallySerialize.push(p);
          if (typeof p.propertiesToSerialize === "function") ps.propertiesToSerialize.push(p);
          if (typeof p.deserializeObject === "function") ps.deserializeObject.push(p);
          if (typeof p.additionallyDeserializeBeforeProperties === "function") ps.additionallyDeserializeBeforeProperties.push(p);
          if (typeof p.additionallyDeserializeAfterProperties === "function") ps.additionallyDeserializeAfterProperties.push(p);
          if (typeof p.beforeDeserialization === "function") ps.beforeDeserialization.push(p);
          if (typeof p.afterDeserialization === "function") ps.afterDeserialization.push(p);
          if (typeof p.beforeSerialization === "function") ps.beforeSerialization.push(p);
          if (typeof p.afterSerialization === "function") ps.afterSerialization.push(p);
        });
      }
    }
  }, {
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
      var _this = this;

      // adds an object to the object pool and returns a "ref" object
      // that is guaranteed to be JSON.stringifyable and that can be used as a place
      // holder in a serialized graph / list

      // primitive objects don't need to be registered
      if (isPrimitive(obj$$1)) return undefined;

      if (Array.isArray(obj$$1)) return obj$$1.map(function (element) {
        return _this.add(element);
      });

      var idPropertyName = obj$$1.__serialization_id_property__ || this.idPropertyName;
      return this.ref(obj$$1) || this.internalAddRef(new ObjectRef(obj$$1[idPropertyName] || this.uuidGen(), obj$$1, undefined, this.idPropertyName));
    }
  }, {
    key: "snapshot",
    value: function snapshot(id) {
      // traverses the object graph and create serialized representation => snapshot
      var snapshot = {};
      this.plugin_beforeSerialization(snapshot, id);
      for (var i = 0, ids = Object.keys(this._id_ref_map); i < ids.length; i++) {
        var ref = this._id_ref_map[ids[i]];
        ref.snapshotObject(snapshot, this);
      }
      snapshot = this.plugin_afterSerialization(snapshot, id);
      return snapshot;
    }
  }, {
    key: "snapshotObject",
    value: function snapshotObject(obj$$1) {
      var _add = this.add(obj$$1),
          id = _add.id,
          snapshot = this.snapshot(id);

      return { id: id, snapshot: snapshot };
    }
  }, {
    key: "readSnapshot",
    value: function readSnapshot(snapshot) {
      // populates object pool with object refs read from the dead snapshot
      if (snapshot.hasOwnProperty("id")) {
        throw new Error("readSnapshot expects simple serialized object map, not id-snapshot pair!");
      }
      for (var i = 0, ids = Object.keys(snapshot); i < ids.length; i++) {
        if (!this.resolveToObj(ids[i])) ObjectRef.fromSnapshot(ids[i], snapshot, this, [], this.idPropertyName);
      }return this;
    }
  }, {
    key: "resolveFromSnapshotAndId",
    value: function resolveFromSnapshotAndId(idAndSnapshot) {
      if (!idAndSnapshot.hasOwnProperty("id")) throw new Error("idAndSnapshot does not have id");
      if (!idAndSnapshot.hasOwnProperty("snapshot")) throw new Error("idAndSnapshot does not have snapshot");
      idAndSnapshot = this.plugin_beforeDeserialization(idAndSnapshot);
      var _idAndSnapshot = idAndSnapshot,
          id = _idAndSnapshot.id,
          snapshot = _idAndSnapshot.snapshot;

      this.readSnapshot(snapshot);
      this.plugin_afterDeserialization(idAndSnapshot);
      return this.resolveToObj(id);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


  }, {
    key: "plugin_beforeSerialization",
    value: function plugin_beforeSerialization(snapshot, rootId) {
      for (var i = 0; i < this.plugins.beforeSerialization.length; i++) {
        var p = this.plugins.beforeSerialization[i];
        p.beforeSerialization(this, snapshot, rootId);
      }
    }
  }, {
    key: "plugin_afterSerialization",
    value: function plugin_afterSerialization(snapshot, rootId) {
      for (var i = 0; i < this.plugins.afterSerialization.length; i++) {
        var p = this.plugins.afterSerialization[i],
            result = p.afterSerialization(this, snapshot, rootId);
        if (result) snapshot = result;
      }
      return snapshot;
    }
  }, {
    key: "plugin_beforeDeserialization",
    value: function plugin_beforeDeserialization(idAndSnapshot) {
      for (var i = 0; i < this.plugins.beforeDeserialization.length; i++) {
        var p = this.plugins.beforeDeserialization[i],
            result = p.beforeDeserialization(this, idAndSnapshot);
        if (result) idAndSnapshot = result;
      }
      return idAndSnapshot;
    }
  }, {
    key: "plugin_afterDeserialization",
    value: function plugin_afterDeserialization(idAndSnapshot) {
      for (var i = 0; i < this.plugins.afterDeserialization.length; i++) {
        var p = this.plugins.afterDeserialization[i];
        p.afterDeserialization(this, idAndSnapshot);
      }
    }
  }, {
    key: "plugin_serializeObject",
    value: function plugin_serializeObject(realObj, isProperty, serializedObjMap, path) {
      for (var i = 0; i < this.plugins.serializeObject.length; i++) {
        var p = this.plugins.serializeObject[i],
            serialized = p.serializeObject(realObj, isProperty, this, serializedObjMap, path);
        if (serialized) return serialized;
      }
    }
  }, {
    key: "plugin_propertiesToSerialize",
    value: function plugin_propertiesToSerialize(ref, snapshot, keys) {
      for (var i = 0; i < this.plugins.propertiesToSerialize.length; i++) {
        var p = this.plugins.propertiesToSerialize[i],
            result = p.propertiesToSerialize(this, ref, snapshot, keys);
        if (result) keys = result;
      }
      return keys;
    }
  }, {
    key: "plugin_additionallySerialize",
    value: function plugin_additionallySerialize(ref, snapshot, serializedObjMap, path) {
      // add more / custom stuff to snapshot or modify it somehow
      var addFn = this.plugins.additionallySerialize.length ? __additionally_serialize__addObjectFunction(ref, snapshot, serializedObjMap, this, path) : null;
      for (var i = 0; i < this.plugins.additionallySerialize.length; i++) {
        var p = this.plugins.additionallySerialize[i];
        p.additionallySerialize(this, ref, snapshot, addFn);
      }
    }
  }, {
    key: "plugin_deserializeObject",
    value: function plugin_deserializeObject(ref, snapshot, path) {
      for (var i = 0; i < this.plugins.deserializeObject.length; i++) {
        var p = this.plugins.deserializeObject[i],
            newObj = p.deserializeObject(this, ref, snapshot, path);
        if (newObj) return newObj;
      }
    }
  }, {
    key: "plugin_additionallyDeserializeBeforeProperties",
    value: function plugin_additionallyDeserializeBeforeProperties(ref, newObj, props, snapshot, serializedObjMap, path) {
      for (var i = 0; i < this.plugins.additionallyDeserializeBeforeProperties.length; i++) {
        var p = this.plugins.additionallyDeserializeBeforeProperties[i],
            result = p.additionallyDeserializeBeforeProperties(this, ref, newObj, props, snapshot, serializedObjMap, path);
        if (result) props = result;
      }
      return props;
    }
  }, {
    key: "plugin_additionallyDeserializeAfterProperties",
    value: function plugin_additionallyDeserializeAfterProperties(ref, newObj, snapshot, serializedObjMap, path) {
      for (var i = 0; i < this.plugins.additionallyDeserializeAfterProperties.length; i++) {
        var p = this.plugins.additionallyDeserializeAfterProperties[i];
        p.additionallyDeserializeAfterProperties(this, ref, newObj, snapshot, serializedObjMap, path);
      }
    }
  }]);
  return ObjectPool;
}();

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// ObjectRef

function __additionally_serialize__addObjectFunction(objRef, snapshot, serializedObjMap, pool) {
  var path = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : [];

  // passed into __additionally_serialize__ as a parameter to allow object to add
  // other objects to serialization

  return function (key, value) {
    var verbatim = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : false;
    return snapshot.props[key] = verbatim ? { key: key, value: value, verbatim: verbatim } : { key: key, value: objRef.snapshotProperty(objRef.id, value, path.concat([key]), serializedObjMap, pool) };
  };
}

var ObjectRef = function () {
  createClass(ObjectRef, null, [{
    key: "fromSnapshot",
    value: function fromSnapshot(id, snapshot, pool) {
      var path = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
      var idPropertyName = arguments[4];

      var ref = new this(id, undefined, undefined, idPropertyName);
      return pool.internalAddRef(ref).recreateObjFromSnapshot(snapshot, pool, path);
    }
  }]);

  function ObjectRef(id, realObj, snapshot) {
    var idPropertyName = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : "id";
    classCallCheck(this, ObjectRef);

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

  createClass(ObjectRef, [{
    key: "asRefForSerializedObjMap",
    value: function asRefForSerializedObjMap() {
      var rev = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : "????";

      return { __ref__: true, id: this.id, rev: rev };
    }
  }, {
    key: "snapshotObject",
    value: function snapshotObject(serializedObjMap, pool) {
      var path = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];

      // serializedObjMap: maps ids to snapshots

      debugSerialization && console.log("[serialize] " + path.join("."));

      if (path.length > 100) throw new Error("Stopping serializer, encountered a possibly infinit loop: " + path.join("."));

      var id = this.id,
          realObj = this.realObj,
          snapshots = this.snapshots,
          rev = void 0,
          ref = void 0;


      if (!realObj) {
        console.error("Cannot marshall object ref " + id + ", no real object!");
        return _extends({}, this.asRefForSerializedObjMap(), { isMissing: true });
      }

      rev = realObj._rev || 0;
      ref = this.asRefForSerializedObjMap(rev);
      lively_lang.arr.pushIfNotIncluded(this.snapshotVersions, rev);

      // do we already have serialized a current version of realObj?
      if (snapshots[rev]) {
        if (!serializedObjMap[id]) serializedObjMap[id] = snapshots[rev];
        return ref;
      }

      var idType = typeof id === "undefined" ? "undefined" : _typeof(id);
      if (idType === "number") {
        id = String(id);idType = "string";
      }
      if (idType !== "string") {
        throw new Error("Error snapshoting " + realObj + ": " + ("id is not a string but " + id + " ") + ("(serialization path: " + path.join(".") + ")"));
      }

      var serialized = pool.plugin_serializeObject(realObj, false, serializedObjMap, path);
      if (serialized) {
        snapshots[rev] = serializedObjMap[id] = serialized;
        return ref;
      }

      // serialize properties
      var keys = Object.getOwnPropertyNames(realObj),
          props = {},
          snapshot = snapshots[rev] = serializedObjMap[id] = { rev: rev, props: props },
          pluginKeys = pool.plugin_propertiesToSerialize(this, snapshot, keys);
      if (pluginKeys) keys = pluginKeys;

      // do the generic serialization, i.e. enumerate all properties and
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        props[key] = {
          key: key,
          value: this.snapshotProperty(id, realObj[key], path.concat([key]), serializedObjMap, pool)
        };
      }

      // add more / custom stuff to snapshot or modify it somehow    
      pool.plugin_additionallySerialize(this, snapshot, serializedObjMap, path);

      return ref;
    }
  }, {
    key: "snapshotProperty",
    value: function snapshotProperty(sourceObjId, value, path, serializedObjMap, pool) {
      var _this2 = this;

      // returns the value to serialize, i.e. what to put into the snapshot object

      if (typeof value === "function") return undefined; // FIXME

      if (isPrimitive(value)) return value; // stored as is

      var serialized = pool.plugin_serializeObject(value, true, serializedObjMap, path);
      if (serialized) return serialized;

      if (Array.isArray(value)) return value.map(function (ea, i) {
        return _this2.snapshotProperty(sourceObjId, ea, path.concat(i), serializedObjMap, pool);
      });

      var objectRef = pool.add(value);
      return !objectRef || !objectRef.isObjectRef ? objectRef : objectRef.snapshotObject(serializedObjMap, pool, path);
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


  }, {
    key: "recreateObjFromSnapshot",
    value: function recreateObjFromSnapshot(serializedObjMap, pool, path) {
      // serializedObjMap: map from ids to object snapshots

      if (this.realObj) return this;

      debugDeserialization && console.log("[deserialize] " + this.id + " (via " + path.join(".") + ")");

      var snapshot = serializedObjMap[this.id];
      if (!snapshot) {
        console.error("Cannot recreateObjFromSnapshot ObjectRef " + (this.id + " b/c of missing snapshot in snapshot map!"));
        return this;
      }

      var rev = snapshot.rev,
          newObj = void 0;
      rev = rev || 0;
      this.snapshotVersions.push(rev);
      this.snapshots[rev] = snapshot;

      newObj = pool.plugin_deserializeObject(this, snapshot, path);

      if (!newObj) newObj = {};
      if (typeof newObj._rev === "undefined" && (typeof newObj === "undefined" ? "undefined" : _typeof(newObj)) === "object") newObj._rev = rev || 0;

      this.realObj = newObj;

      pool.internalAddRef(this); // for updating realObj

      if (!newObj) return this;

      var props = snapshot.props;

      var pluginProps = pool.plugin_additionallyDeserializeBeforeProperties(this, newObj, props, snapshot, serializedObjMap, path);
      if (pluginProps) props = pluginProps;

      if (props) {
        // deserialize generic properties
        for (var key in props) {
          this.recreatePropertyAndSetProperty(newObj, props, key, serializedObjMap, pool, path);
        }
      }

      var idPropertyName = newObj.__serialization_id_property__ || this.idPropertyName;
      if (pool.reinitializeIds && newObj.hasOwnProperty(idPropertyName)) newObj[idPropertyName] = pool.reinitializeIds(this.id, this);

      pool.plugin_additionallyDeserializeAfterProperties(this, newObj, snapshot, serializedObjMap, path);

      return this;
    }
  }, {
    key: "recreatePropertyAndSetProperty",
    value: function recreatePropertyAndSetProperty(newObj, props, key, serializedObjMap, pool, path) {
      try {
        var _ref = props[key] || { value: "NON EXISTING" },
            verbatim = _ref.verbatim,
            value = _ref.value;

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

      var idPropertyName = value.__serialization_id_property__ || this.idPropertyName,
          valueRef = pool.refForId(value[idPropertyName]) || ObjectRef.fromSnapshot(value[idPropertyName], serializedObjMap, pool, path, this.idPropertyName);
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
      var rev = void 0;
      if (!this.snapshotVersions.length) {
        rev = 0;
        this.snapshotVersions.push(rev);
      } else rev = lively_lang.arr.last(this.snapshotVersions);
      return this.snapshots[rev] || (this.snapshots[rev] = { rev: rev, props: {} });
    }
  }, {
    key: "currentRev",
    get: function get() {
      return this.snapshotVersions.length ? lively_lang.arr.last(this.snapshotVersions) : 0;
    }
  }]);
  return ObjectRef;
}();

/*global alert*/
function referenceGraph(snapshot) {
  var ids = Object.keys(snapshot),
      g = {};
  for (var id in snapshot) {
    g[id] = referencesOfId(snapshot, id);
  }return g;
}

function isReference(value) {
  return value && value.__ref__;
}

function referencesOfId(snapshot, id, withPath) {
  // all the ids an regObj (given by id) points to
  var ref = snapshot[id],
      result = [];
  for (var key in ref.props) {
    var _ref = ref.props[key] || {},
        value = _ref.value,
        verbatim = _ref.verbatim;

    if (Array.isArray(value)) {
      result.push.apply(result, toConsumableArray(referencesInArray(snapshot, value, withPath && key)));
      continue;
    }
    if (verbatim || !value || !isReference(value)) continue;
    result.push(withPath ? { key: key, id: value.id } : value.id);
  }

  // FIXME hack for maps and sets...
  if (ref.hasOwnProperty("entries")) {
    for (var i = 0; i < ref.entries.length; i++) {
      var entry = ref.entries[i];
      if (Array.isArray(entry)) {
        result.push.apply(result, toConsumableArray(referencesInArray(snapshot, entry, withPath && entry)));continue;
      } else if (!entry || !isReference(entry)) {} else result.push(withPath ? { key: entry, id: entry.id } : entry.id);
    }
  }
  return result;
}

function referencesInArray(snapshot, arr$$1, optPath) {
  // helper for referencesOfId
  var result = [];
  for (var i = 0; i < arr$$1.length; i++) {
    var value = arr$$1[i];
    if (Array.isArray(value)) {
      var path = optPath ? optPath + '[' + i + ']' : undefined;
      result.push.apply(result, toConsumableArray(referencesInArray(snapshot, value, path)));
      continue;
    }
    if (!value || !isReference(value)) continue;
    result.push(optPath ? { key: optPath + '[' + i + ']', id: value.id } : value.id);
  }
  return result;
}







function removeUnreachableObjects(rootIds, snapshot) {
  var idsToRemove = lively_lang.arr.withoutAll(Object.keys(snapshot), rootIds),
      refGraph = referenceGraph(snapshot);
  rootIds.forEach(function (rootId) {
    var subGraph = lively_lang.graph.subgraphReachableBy(refGraph, rootId);
    for (var i = idsToRemove.length; i--;) {
      var id = idsToRemove[i];
      if (id in subGraph) idsToRemove.splice(i, 1);
    }
  });

  idsToRemove.forEach(function (id) {
    return delete snapshot[id];
  });
  return idsToRemove;
}

var defaultExprSerializer = new ExpressionSerializer();

function requiredModulesOfSnapshot(snapshot) {
  var exprSerializer = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : defaultExprSerializer;

  // knows how to extract lively.modules packages/modules from __expr__ and
  // class data

  if (snapshot.snapshot) snapshot = snapshot.snapshot;

  var modules = [];

  for (var i = 0, ids = Object.keys(snapshot); i < ids.length; i++) {
    var _modules2;

    var ref = snapshot[ids[i]];

    if (ref.__expr__) {
      var _modules;

      var exprModules = exprSerializer.requiredModulesOf__expr__(ref.__expr__);
      if (exprModules) (_modules = modules).push.apply(_modules, toConsumableArray(exprModules));
      continue;
    }

    var classModules = ClassHelper.sourceModulesInObjRef(ref);
    if (classModules && classModules.length) (_modules2 = modules).push.apply(_modules2, toConsumableArray(classModules.map(function (spec) {
      return (spec.package && spec.package.name || "") + "/" + spec.pathInPackage;
    })));

    if (ref.props) {
      for (var j = 0; j < ref.props.length; j++) {
        var val = ref.props[j].value;
        if (typeof val === "string") {
          var _modules3;

          var _exprModules = exprSerializer.requiredModulesOf__expr__(val);
          if (_exprModules) (_modules3 = modules).push.apply(_modules3, toConsumableArray(_exprModules));
        }
      }
    }
  }

  modules = lively_lang.arr.uniq(modules);

  return modules;
}

var _name$version$depende = {
  name: "lively.serializer2",
  version: "0.1.3",
  dependencies: {
    "lively.lang": "^1.0.5"
  },
  devDependencies: {
    "mocha-es6": "*",
    rollup: "^0.36.1",
    "rollup-plugin-babel": "^2.6.1",
    "babel-plugin-external-helpers": "^6.8.0",
    "babel-plugin-syntax-object-rest-spread": "^6.13.0",
    "babel-plugin-transform-async-to-generator": "^6.16.0",
    "babel-plugin-transform-object-rest-spread": "^6.16.0",
    "babel-preset-es2015": "^6.16.0",
    "babel-preset-es2015-rollup": "^1.1.1",
    "babel-regenerator-runtime": "^6.5.0",
    "babel-plugin-inline-json-import": "^0.2.1"
  },
  scripts: {
    test: "mocha-es6 tests/{test,*-test}.js",
    build: "node build.js"
  }
};
var serializerVersion = _name$version$depende.version;

function normalizeOptions(options) {
  options = _extends({ plugins: allPlugins, reinitializeIds: false }, options);
  if (options.reinitializeIds && typeof options.reinitializeIds !== "function") throw new Error("serializer option 'reinitializeIds' needs to be a function(id, ref) => id");
  return options;
}

function normalizeMigrations() {
  var migrations = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : [];

  return {
    before: migrations.filter(function (ea) {
      return typeof ea.snapshotConverter === "function";
    }),
    after: migrations.filter(function (ea) {
      return typeof ea.objectConverter === "function";
    })
  };
}

function runMigrations(migrations, method, idAndSnapshot, pool) {
  for (var i = 0; i < migrations.length; i++) {
    var migration = migrations[i];
    try {
      idAndSnapshot = migration[method](idAndSnapshot, pool);
    } catch (err) {
      console.error("migration " + migration.name + " failed:");
      console.error(err);
    }
  }
  return idAndSnapshot;
}

var majorAndMinorVersionRe = /\.[^\.]+$/; // x.y.z => x.y

function serialize(obj$$1, options) {
  options = normalizeOptions(options);
  var objPool = options.objPool || new ObjectPool(options),
      requiredVersion = "~" + serializerVersion.replace(majorAndMinorVersionRe, ""),
      // semver
  snapshotAndId = objPool.snapshotObject(obj$$1);
  // object hooks are allowed to modify the snapshot graph and remove
  // references. To only serialize what's needed we cleanup the graph after all
  // hooks are done.
  removeUnreachableObjects([snapshotAndId.id], snapshotAndId.snapshot);
  snapshotAndId.requiredVersion = requiredVersion;
  return snapshotAndId;
}

function deserialize(idAndSnapshot, options) {
  options = normalizeOptions(options);
  var id = idAndSnapshot.id,
      snapshot = idAndSnapshot.snapshot,
      requiredVersion = idAndSnapshot.requiredVersion;

  if (requiredVersion && !lively.modules.semver.satisfies(serializerVersion, requiredVersion)) console.warn("[lively.serializer deserialization] snapshot requires version " + (requiredVersion + " but serializer has incompatible version ") + (serializerVersion + ". Deserialization might fail...!"));
  var objPool = options.objPool || new ObjectPool(options);
  return objPool.resolveFromSnapshotAndId(idAndSnapshot);
}

function deserializeWithMigrations(idAndSnapshot, migrations, options) {
  options = normalizeOptions(options);
  var objPool = options.objPool || (options.objPool = new ObjectPool(options)),
      _normalizeMigrations = normalizeMigrations(migrations),
      before = _normalizeMigrations.before,
      after = _normalizeMigrations.after,
      wait = void 0;

  runMigrations(before, "snapshotConverter", idAndSnapshot, objPool);
  if (typeof options.onDeserializationStart === "function") wait = options.onDeserializationStart(idAndSnapshot, options);
  return wait instanceof Promise ? wait.then(step2) : step2();

  function step2() {
    var deserialized = deserialize(idAndSnapshot, options);
    runMigrations(after, "objectConverter", idAndSnapshot, objPool);
    return deserialized;
  }
}

function copy(obj$$1, options) {
  return deserialize(serialize(obj$$1, options), options);
}

exports.serialize = serialize;
exports.deserialize = deserialize;
exports.deserializeWithMigrations = deserializeWithMigrations;
exports.copy = copy;
exports.ObjectRef = ObjectRef;
exports.ObjectPool = ObjectPool;
exports.requiredModulesOfSnapshot = requiredModulesOfSnapshot;
exports.removeUnreachableObjects = removeUnreachableObjects;

}((this.lively.serializer2 = this.lively.serializer2 || {}),lively.lang));

  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.serializer2;
})();