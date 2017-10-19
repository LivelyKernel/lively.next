
;(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  if (typeof lively.lang === "undefined") GLOBAL.livey.lang = {};
})();
(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  this.lively = this.lively || {};
(function (exports,lively_lang,lively_ast) {
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





var defineProperty = function (obj$$1, key, value) {
  if (key in obj$$1) {
    Object.defineProperty(obj$$1, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj$$1[key] = value;
  }

  return obj$$1;
};

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

var get = function get(object, property, receiver) {
  if (object === null) object = Function.prototype;
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
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

var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};











var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
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
  function sliceIterator(arr, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
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

  return function (arr, i) {
    if (Array.isArray(arr)) {
      return arr;
    } else if (Symbol.iterator in Object(arr)) {
      return sliceIterator(arr, i);
    } else {
      throw new TypeError("Invalid attempt to destructure non-iterable instance");
    }
  };
}();













var toConsumableArray = function (arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

    return arr2;
  } else {
    return Array.from(arr);
  }
};

// compactness
// types -> fabrik
// serialization, obscure references
// debugging, more usful inspector
// change system -> synchronization, serialization, debugging
// initialization order, dependencies (ex. btn => label => submoprhs needed)
// declaratively configuring objects


// propertySettings: {
//   valueStoreProperty: STRING|SYMBOL - optional, defaults to _state. This is where the
//                                  actual values of the properties will be stored by default
//   defaultGetter: FUNCTION(STRING) - default getter to be used
//   defaultSetter: FUNCTION(STRING, VALUE) - default setter to be used
// }
// 
// ????????????
//   propertyDescriptorCacheKey: STRING|SYMBOL - where the result of
//                                               initializeProperties() should go
// ????????????


// properties:
// {STRING: DESCRIPTOR, ...}
// properties are merged in the proto chain
// 
// descriptor: {
//   get: FUNCTION       - optional
//   set: FUNCTION       - optional
//   defaultValue: OBJECT   - optional
//   initialize: FUNCTION   - optional, function that when present should
//                            produce a value for the property. Run after object creation
//   autoSetter: BOOL       - optional, true if not specified
//   usePropertyStore: BOOL - optional, true if not specified.
//   priority: NUMBER       - optional, true if not specified.
//   before: [STRING]       - optional, list of property names that depend on
//                            the descriptor's property and that should be
//                            initialized / sorted / ... *after*
//                            it. Think of it as a constraint: "this property
//                            needs to run before that property"
//   after: [STRING]        - optional, list of property names that this property depends on
//   internal: BOOL         - optional, if specified marks property as meant for
//                            internal housekeeping. At this point this is only used
//                            documentation and debugging purposes, it won't affect
//                            how the property works
// }


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var defaultPropertiesKey = "properties";
var propertiesAndSettingsCacheSym = Symbol.for("lively.classes-properties-and-settings");

var defaultPropertySettings = {
  defaultSetter: null,
  defaultGetter: null,
  valueStoreProperty: "_state"
};

function hasManagedProperties(klass) {
  return klass.hasOwnProperty(defaultPropertiesKey);
}

function prepareClassForManagedPropertiesAfterCreation(klass) {
  if (!hasManagedProperties(klass)) return;

  var _propertiesAndSetting = propertiesAndSettingsInHierarchyOf(klass),
      properties = _propertiesAndSetting.properties,
      propertySettings = _propertiesAndSetting.propertySettings;

  klass[propertiesAndSettingsCacheSym] = { properties: properties, propertySettings: propertySettings };
  if (!properties || (typeof properties === "undefined" ? "undefined" : _typeof(properties)) !== "object") {
    console.warn("Class " + klass.name + " indicates it has managed properties but its " + ("properties accessor (" + defaultPropertiesKey + ") does not return ") + "a valid property descriptor map");
    return;
  }
  prepareClassForProperties(klass, propertySettings, properties);
}

function prepareClassForProperties(klass, propertySettings, properties) {
  ensurePropertyInitializer(klass);

  var valueStoreProperty = propertySettings.valueStoreProperty,
      defaultGetter = propertySettings.defaultGetter,
      defaultSetter = propertySettings.defaultSetter,
      myProto = klass.prototype,
      keys = Object.keys(properties);


  keys.forEach(function (key) {
    var descriptor = properties[key];

    // ... define a getter to the property for the outside world...
    var hasGetter = myProto.hasOwnProperty(key) && myProto.__lookupGetter__(key);
    if (!hasGetter) {
      var getter = descriptor.get || typeof defaultGetter === "function" && function () {
        return defaultGetter.call(this, key);
      } || function () {
        return this[valueStoreProperty][key];
      };
      myProto.__defineGetter__(key, getter);
    }

    // ...define a setter if necessary
    var hasSetter = myProto.hasOwnProperty(key) && myProto.__lookupSetter__(key);
    if (!hasSetter) {
      var descrHasSetter = descriptor.hasOwnProperty("set"),
          setterNeeded = descrHasSetter || !descriptor.readOnly;
      if (setterNeeded) {
        var setter = descriptor.set || typeof defaultSetter === "function" && function (val) {
          defaultSetter.call(this, key, val);
        } || function (val) {
          this[valueStoreProperty][key] = val;
        };
        myProto.__defineSetter__(key, setter);
      }
    }
  });
}

function ensurePropertyInitializer(klass) {
  // when we inherit from "conventional classes" those don't have an
  // initializer method. We install a stub that calls the superclass function
  // itself
  Object.defineProperty(klass.prototype, "propertiesAndPropertySettings", {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function value() {
      var klass = this.constructor;
      return klass[propertiesAndSettingsCacheSym] || propertiesAndSettingsInHierarchyOf(klass);
    }
  });
  Object.defineProperty(klass.prototype, "initializeProperties", {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function value(values) {
      var _propertiesAndPropert = this.propertiesAndPropertySettings(),
          properties = _propertiesAndPropert.properties,
          propertySettings = _propertiesAndPropert.propertySettings;

      prepareInstanceForProperties(this, propertySettings, properties, values);
      return this;
    }
  });
}

function propertiesAndSettingsInHierarchyOf(klass) {
  // walks class proto chain
  var propertySettings = _extends({}, defaultPropertySettings),
      properties = {},
      allPropSettings = lively_lang.obj.valuesInPropertyHierarchy(klass, "propertySettings"),
      allProps = lively_lang.obj.valuesInPropertyHierarchy(klass, "properties");

  for (var i = 0; i < allPropSettings.length; i++) {
    var current = allPropSettings[i];
    current && (typeof current === "undefined" ? "undefined" : _typeof(current)) === "object" && Object.assign(propertySettings, current);
  }

  for (var i = 0; i < allProps.length; i++) {
    var _current = allProps[i];
    if ((typeof _current === "undefined" ? "undefined" : _typeof(_current)) !== "object") {
      console.error("[initializeProperties] " + klass + " encountered property declaration " + ("that is not a JS object: " + _current));
      continue;
    }
    // "deep" merge
    for (var name in _current) {
      if (!properties.hasOwnProperty(name)) properties[name] = _current[name];else Object.assign(properties[name], _current[name]);
    }
  }

  return { properties: properties, propertySettings: propertySettings };
}

function prepareInstanceForProperties(instance, propertySettings, properties, values) {
  var valueStoreProperty = propertySettings.valueStoreProperty,
      sortedKeys = lively_lang.obj.sortKeysWithBeforeAndAfterConstraints(properties),
      propsNeedingInitialize = [],
      initActions = {};

  // 1. this[valueStoreProperty] is were the actual values will be stored
  if (!instance.hasOwnProperty(valueStoreProperty)) instance[valueStoreProperty] = {};

  for (var i = 0; i < sortedKeys.length; i++) {
    var key = sortedKeys[i],
        descriptor = properties[key];

    var derived = descriptor.derived,
        foldable = !!descriptor.foldable,
        defaultValue = descriptor.hasOwnProperty("defaultValue") ? descriptor.defaultValue : undefined;
    if (Array.isArray(defaultValue)) defaultValue = defaultValue.slice();
    if (!derived && !foldable) instance[valueStoreProperty][key] = defaultValue;

    var initAction = void 0;
    if (descriptor.hasOwnProperty("initialize")) {
      initAction = initActions[key] = { initialize: defaultValue };
      propsNeedingInitialize.push(key);
    } else if (derived && defaultValue !== undefined) {
      initAction = initActions[key] = { derived: defaultValue };
      propsNeedingInitialize.push(key);
    } else if (foldable && defaultValue !== undefined) {
      initAction = initActions[key] = { folded: defaultValue };
      propsNeedingInitialize.push(key);
    }

    if (values && key in values) {
      if (descriptor.readOnly) {
        console.warn("Trying to initialize read-only property " + key + " in " + instance + ", " + "skipping setting value");
      } else {
        if (!initAction) {
          initAction = initActions[key] = {};
          propsNeedingInitialize.push(key);
        }
        initAction.value = values[key];
      }
    }
  }

  // 2. Run init code for properties
  // and if we have values we will initialize the properties from it. Values
  // is expected to be a JS object mapping property names to property values
  for (var i = 0; i < propsNeedingInitialize.length; i++) {
    var _key = propsNeedingInitialize[i],
        actions = initActions[_key],
        hasValue = actions.hasOwnProperty("value");

    // if we have an initialize function we call it either with the value from
    // values or with the defaultValue
    if (actions.hasOwnProperty("initialize")) {
      var value = hasValue ? actions.value : actions.initialize;
      properties[_key].initialize.call(instance, value);
      if (hasValue) instance[_key] = actions.value;
    }

    // if we have a derived property we will call the setter with the default
    // value or the value from values
    else if (actions.hasOwnProperty("derived")) {
        instance[_key] = hasValue ? actions.value : actions.derived;
      } else if (actions.hasOwnProperty("folded")) {
        instance[_key] = hasValue ? actions.value : actions.folded;
      }

      // if we only have the value from values we simply call the setter with it
      else if (hasValue) {
          instance[_key] = actions.value;
        }
  }
}

var initializeSymbol = Symbol.for("lively-instance-initialize");
var instanceRestorerSymbol = Symbol.for("lively-instance-restorer");
var superclassSymbol = Symbol.for("lively-instance-superclass");
var moduleMetaSymbol = Symbol.for("lively-module-meta");
var objMetaSymbol = Symbol.for("lively-object-meta");
var moduleSubscribeToToplevelChangesSym = Symbol.for("lively-klass-changes-subscriber");

var constructorArgMatcher = /\([^\\)]*\)/;

var defaultPropertyDescriptorForGetterSetter = {
  enumerable: false,
  configurable: true
};

var defaultPropertyDescriptorForValue = {
  enumerable: false,
  configurable: true,
  writable: true
};

var setPrototypeOf = typeof Object.setPrototypeOf === "function" ? function (obj$$1, proto) {
  return Object.setPrototypeOf(obj$$1, proto);
} : function (obj$$1, proto) {
  return obj$$1.__proto__ = proto;
};

function adoptObject(object, newClass) {
  // change the class of object to newClass
  if (newClass === object.constructor) return;
  object.constructor = newClass;
  setPrototypeOf(object, newClass.prototype);
}

function setSuperclass(klass, superclassOrSpec) {
  // define klass.prototype, klass.prototype[constructor], klass[superclassSymbol]
  var superclass = !superclassOrSpec ? Object : typeof superclassOrSpec === "function" ? superclassOrSpec : superclassOrSpec.value ? superclassOrSpec.value : Object;
  var existingSuperclass = klass && klass[superclassSymbol];
  // set the superclass if necessary and set prototype
  if (!existingSuperclass || existingSuperclass !== superclass) {
    ensureInitializeStub(superclass);
    klass[superclassSymbol] = superclass;
    setPrototypeOf(klass.prototype, superclass.prototype);
    if (superclass !== Object) setPrototypeOf(klass, superclass);
  }
  return superclass;
}

function installValueDescriptor(object, klass, descr) {
  descr = Object.assign(descr, defaultPropertyDescriptorForValue);
  descr.value.displayName = descr.key;
  if (descr.needsDeclaringClass) {
    var orig = descr.value.originalFunction || descr.value;
    descr.value = Object.assign(function declaring_class_wrapper() /*args*/{
      return orig.call.apply(orig, [this, klass].concat(Array.prototype.slice.call(arguments)));
    }, {
      originalFunction: orig,
      toString: function toString() {
        return orig.toString();
      },
      displayName: descr.key
    });
  }
  Object.defineProperty(object, descr.key, descr);
}

function installGetterSetterDescriptor(klass, descr) {
  descr = Object.assign(descr, defaultPropertyDescriptorForGetterSetter);
  Object.defineProperty(klass, descr.key, descr);
}

function installMethods(klass, instanceMethods, classMethods) {
  // install methods from two lists (static + instance) of {key, value} or
  // {key, get/set} descriptors

  classMethods && classMethods.forEach(function (ea) {
    ea.value ? installValueDescriptor(klass, klass, ea) : installGetterSetterDescriptor(klass, ea);
  });

  instanceMethods && instanceMethods.forEach(function (ea) {
    ea.value ? installValueDescriptor(klass.prototype, klass, ea) : installGetterSetterDescriptor(klass.prototype, ea);
  });

  // 4. define initializer method, in our class system the constructor is
  // generic and re-directs to the initializer method. This way we can change
  // the constructor without loosing the identity of the class
  if (!klass.prototype[initializeSymbol]) {
    Object.defineProperty(klass.prototype, initializeSymbol, {
      enumerable: false,
      configurable: true,
      writable: true,
      value: function value() {}
    });
    klass.prototype[initializeSymbol].isDefaultInitializer = true;
    klass.prototype[initializeSymbol].displayName = "lively-initialize";
  } else {
    if (Object.getOwnPropertySymbols(klass.prototype).includes(initializeSymbol)) {
      if (klass.prototype[initializeSymbol].isDefaultInitializer) {
        if (klass[superclassSymbol].prototype[initializeSymbol]) {
          delete klass.prototype[initializeSymbol];
        }
      }
    }
  }

  // 5. undefine properties that were removed form class definition
  var instanceMethodsInClass = instanceMethods.map(function (m) {
    return m.key;
  }).concat(["constructor", "arguments", "caller"]),
      instanceAttributes = Object.getOwnPropertyNames(klass.prototype);
  for (var i = 0; i < instanceAttributes.length; i++) {
    var name = instanceAttributes[i];
    if (!instanceMethodsInClass.includes(name)) delete klass.prototype[name];
  }

  var classMethodsInClass = classMethods.map(function (m) {
    return m.key;
  }).concat(["length", "name", "prototype", "arguments", "caller"]),
      classAttributes = Object.getOwnPropertyNames(klass);
  for (var _i = 0; _i < classAttributes.length; _i++) {
    var _name = classAttributes[_i];
    if (!classMethodsInClass.includes(_name)) delete klass[_name];
  }
}

function ensureInitializeStub(superclass) {
  // when we inherit from "conventional classes" those don't have an
  // initializer method. We install a stub that calls the superclass function
  // itself
  if (superclass === Object || superclass.prototype[initializeSymbol]) return;
  Object.defineProperty(superclass.prototype, initializeSymbol, {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function value() /*args*/{
      superclass.apply(this, arguments);
    }
  });
  superclass.prototype[initializeSymbol].displayName = "lively-initialize-stub";
}

function initializeClass(constructorFunc, superclassSpec) {
  var instanceMethods = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [];
  var classMethods = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [];
  var classHolder = arguments.length > 4 && arguments[4] !== undefined ? arguments[4] : {};
  var currentModule = arguments[5];
  var sourceLoc = arguments[6];

  // Given a `classHolder` object as "environment", will try to find a "class"
  // (JS constructor function) inside it. If no class is found it will create a
  // new costructor function object and will attach the methods to it. If a class
  // is found it will be modified.
  // This is being used as the compile target for es6 class syntax by the
  // lively.ast capturing / transform logic
  // Example:
  // var Foo = function(superclass) {
  //   function Foo() {}
  //   return initializeClass(Foo, superclass, [{key: "m", value: function m() { return 23 }}])
  // }();
  // new Foo().m() // => 23

  // 1. create a new constructor function if necessary, re-use an exisiting if the
  // classHolder object has it
  var className = constructorFunc.name,
      klass = className && classHolder.hasOwnProperty(className) && classHolder[className],
      existingSuperclass = klass && klass[superclassSymbol];
  if (!klass || typeof klass !== "function" || !existingSuperclass) klass = constructorFunc;

  // 2. set the superclass if necessary and set prototype
  var superclass = setSuperclass(klass, superclassSpec);

  // 3. Install methods
  installMethods(klass, instanceMethods, classMethods);

  klass[objMetaSymbol] = sourceLoc;

  // 4. If we have a `currentModule` instance (from lively.modules/src/module.js)
  // then we also store some meta data about the module. This allows us to
  // (de)serialize class instances in lively.serializer
  if (currentModule) {
    var p = currentModule.package();
    var prevMeta = klass[moduleMetaSymbol];
    var t = Date.now();
    klass[moduleMetaSymbol] = {
      package: p ? { name: p.name, version: p.version } : {},
      pathInPackage: p ? currentModule.pathInPackage() : currentModule.id,
      lastChange: prevMeta && prevMeta.lastChange && t <= prevMeta.lastChange ? prevMeta.lastChange + 1 : t,
      lastSuperclassChange: 0

      // if we have a module, we can listen to toplevel changes of it in case the
      // superclass binding changes. With that we can keep our class up-to-date
      // even if the superclass binding changes. This is especially useful for
      // situations where modules have a circular dependency and classes in modules
      // won't get defined correctly when loaded first. See
      // https://github.com/LivelyKernel/lively.modules/issues/27 for more details
    };if (superclassSpec && superclassSpec.referencedAs) {
      if (klass.hasOwnProperty(moduleSubscribeToToplevelChangesSym)) {
        currentModule.unsubscribeFromToplevelDefinitionChanges(klass[moduleSubscribeToToplevelChangesSym]);
      }
      klass[moduleSubscribeToToplevelChangesSym] = currentModule.subscribeToToplevelDefinitionChanges(function (name, val) {
        if (name !== superclassSpec.referencedAs) return;
        // console.log(`class ${className}: new superclass ${name} ${name !== superclassSpec.referencedAs ? '(' + superclassSpec.referencedAs + ')' : ''} was defined via module bindings`)

        // Only run through the (expensive) updates if superclass really has changes
        var superMeta = val && val[moduleMetaSymbol],
            myMeta = klass[moduleMetaSymbol];
        if (superMeta) {
          if (superMeta.lastChange === myMeta.lastSuperclassChange) return;
          myMeta.lastSuperclassChange = superMeta.lastChange;
        }
        setSuperclass(klass, val);
        installMethods(klass, instanceMethods, classMethods);
        prepareClassForManagedPropertiesAfterCreation(klass);
      });
    }
  }

  // 6. Add a toString method for the class to allows us to see its constructor arguments
  klass.toString = function () {
    var constructorArgs = String(this.prototype[initializeSymbol]).match(constructorArgMatcher),
        className = this.name,
        superclass = this[superclassSymbol];
    return "class " + className + " " + (superclass ? "extends " + superclass.name : "") + " {\n" + ("  constructor" + (constructorArgs ? constructorArgs[0] : "()") + " { /*...*/ }") + "\n}";
  };

  // 7. If the class allows managed properties (auto getters/setters etc., see
  // managed-properties.js) then setup those
  prepareClassForManagedPropertiesAfterCreation(klass);

  return klass;
}

initializeClass._get = function _get(object, property, receiver) {
  if (object === null) object = Function.prototype;
  var desc = Object.getOwnPropertyDescriptor(object, property);
  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);
    return parent === null ? undefined : _get(parent, property, receiver);
  }
  if ("value" in desc) return desc.value;
  var getter = desc.get;
  return getter === undefined ? undefined : getter.call(receiver);
};

initializeClass._set = function _set(object, property, value, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);
  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);
    if (parent !== null) _set(parent, property, value, receiver);
  } else if ("value" in desc && desc.writable) desc.value = value;else {
    var setter = desc.set;
    if (setter !== undefined) setter.call(receiver, value);
  }
  return value;
};

var runtime = Object.freeze({
	initializeSymbol: initializeSymbol,
	instanceRestorerSymbol: instanceRestorerSymbol,
	superclassSymbol: superclassSymbol,
	moduleMetaSymbol: moduleMetaSymbol,
	objMetaSymbol: objMetaSymbol,
	moduleSubscribeToToplevelChangesSym: moduleSubscribeToToplevelChangesSym,
	setPrototypeOf: setPrototypeOf,
	adoptObject: adoptObject,
	setSuperclass: setSuperclass,
	initializeClass: initializeClass
});

var assign = lively_ast.nodes.assign;
var member = lively_ast.nodes.member;
var id = lively_ast.nodes.id;
var exprStmt = lively_ast.nodes.exprStmt;
var funcCall = lively_ast.nodes.funcCall;
var literal = lively_ast.nodes.literal;
var objectLiteral = lively_ast.nodes.objectLiteral;
var varDecl = lively_ast.nodes.varDecl;
var funcExpr = lively_ast.nodes.funcExpr;
var returnStmt = lively_ast.nodes.returnStmt;
var binaryExpr = lively_ast.nodes.binaryExpr;
var ifStmt = lively_ast.nodes.ifStmt;
var block = lively_ast.nodes.block;


function isFunctionNode(node) {
  return node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression" || node.type === "FunctionDeclaration";
}

var firstIdRe = /^[^_a-z]/i;
var trailingIdRe = /[^_a-z0-9]/ig;
function ensureIdentifier(name) {
  return name.replace(firstIdRe, "_").replace(trailingIdRe, "_");
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function constructorTemplate(name) {
  // Creates a function like
  // function CLASS() {
  //   var firstArg = arguments[0];
  //   if (firstArg && firstArg[Symbol.for("lively-instance-restorer")]) {
  //     // for deserializing instances just do nothing
  //   } else {
  //     // automatically call the initialize method
  //     this[Symbol.for("lively-instance-initialize")].apply(this, arguments);
  //   }
  // }

  return funcExpr({ id: name ? id(name) : null }, ["__first_arg__"], ifStmt(binaryExpr(id("__first_arg__"), "&&", member("__first_arg__", funcCall(member("Symbol", "for"), literal("lively-instance-restorer")), true)), block(), block(exprStmt(funcCall(member(member("this", funcCall(member("Symbol", "for"), literal("lively-instance-initialize")), true), "apply"), id("this"), id("arguments"))))));
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var isTransformedClassVarDeclSymbol = Symbol();
var methodKindSymbol = Symbol();
var tempLivelyClassVar = "__lively_class__";
var tempLivelyClassHolderVar = "__lively_classholder__";

var ClassReplaceVisitor = function (_Visitor) {
  inherits(ClassReplaceVisitor, _Visitor);

  function ClassReplaceVisitor() {
    classCallCheck(this, ClassReplaceVisitor);
    return possibleConstructorReturn(this, (ClassReplaceVisitor.__proto__ || Object.getPrototypeOf(ClassReplaceVisitor)).apply(this, arguments));
  }

  createClass(ClassReplaceVisitor, [{
    key: "accept",
    value: function accept(node, state, path) {
      if (isFunctionNode(node)) {
        state = _extends({}, state, { classHolder: objectLiteral([]),
          currentMethod: node[methodKindSymbol] ? node : state.currentMethod
        });
      }

      if (node.type === "ClassExpression" || node.type === "ClassDeclaration") node = replaceClass(node, state, path, state.options);

      if (node.type === "Super") node = replaceSuper(node, state, path, state.options);

      if (node.type === "MemberExpression" && node.object && node.object.type === "Super") node = replaceSuperGetter(node, state, path, state.options);

      if (node.type === "AssignmentExpression" && node.left.type === "MemberExpression" && node.left.object.type === "Super") node = replaceSuperSetter(node, state, path, state.options);

      if (node.type === "CallExpression" && node.callee.type === "Super") node = replaceDirectSuperCall(node, state, path, state.options);

      if (node.type === "CallExpression" && node.callee.object && node.callee.object.type === "Super") node = replaceSuperMethodCall(node, state, path, state.options);

      node = get(ClassReplaceVisitor.prototype.__proto__ || Object.getPrototypeOf(ClassReplaceVisitor.prototype), "accept", this).call(this, node, state, path);

      if (node.type === "ExportDefaultDeclaration") return splitExportDefaultWithClass(node, state, path, state.options);

      return node;
    }
  }], [{
    key: "run",
    value: function run(parsed, options) {
      var v = new this(),
          classHolder = options.classHolder || objectLiteral([]);
      return v.accept(parsed, { options: options, classHolder: classHolder }, []);
    }
  }]);
  return ClassReplaceVisitor;
}(lively_ast.BaseVisitor);

function replaceSuper(node, state, path, options) {
  // just super
  console.assert(node.type === "Super");

  var currentMethod = state.currentMethod;

  if (!currentMethod) {
    console.warn("[lively.classes] Trying to transform es6 class but got super call outside a method! " + lively_ast.stringify(node) + " in " + path.join("."));
    // return node;
  }

  var _path$slice = path.slice(-2),
      _path$slice2 = slicedToArray(_path$slice, 2),
      parentReferencedAs = _path$slice2[0],
      referencedAs = _path$slice2[1];

  if (parentReferencedAs === 'callee' && referencedAs === 'object' || referencedAs === 'callee') return node; // deal with this in replaceSuperCall

  var methodHolder = currentMethod && currentMethod[methodKindSymbol] === "static" ? funcCall(member("Object", "getPrototypeOf"), id(tempLivelyClassVar)) : funcCall(member("Object", "getPrototypeOf"), member(id(tempLivelyClassVar), "prototype"));

  return methodHolder;
}

// parse("class Foo extends Bar { get x() { return super.x; }}").body[0]

function replaceSuperMethodCall(node, state, path, options) {
  // like super.foo()
  console.assert(node.type === "CallExpression");
  console.assert(node.callee.object.type === "Super");

  return funcCall.apply(undefined, [member(funcCall(member(options.functionNode, "_get"), replaceSuper(node.callee.object, state, path.concat(["callee", "object"]), options), literal(node.callee.property.value || node.callee.property.name), id("this")), "call"), id("this")].concat(toConsumableArray(node.arguments)));
}

function replaceDirectSuperCall(node, state, path, options) {
  // like super()
  console.assert(node.type === "CallExpression");
  console.assert(node.callee.type === "Super");

  return funcCall.apply(undefined, [member(funcCall(member(options.functionNode, "_get"), replaceSuper(node.callee, state, path.concat(["callee"]), options), funcCall(member("Symbol", "for"), literal("lively-instance-initialize")), id("this")), "call"), id("this")].concat(toConsumableArray(node.arguments)));
}

function replaceSuperGetter(node, state, path, options) {
  console.assert(node.type === "MemberExpression");
  console.assert(node.object.type === "Super");
  return funcCall(member(options.functionNode, "_get"), replaceSuper(node.object, state, path.concat(["object"]), options), literal(node.property.value || node.property.name), id("this"));
}

function replaceSuperSetter(node, state, path, options) {
  console.assert(node.type === "AssignmentExpression");
  console.assert(node.left.object.type === "Super");

  return funcCall(member(options.functionNode, "_set"), replaceSuper(node.left.object, state, path.concat(["left", "object"]), options), literal(node.left.property.value || node.left.property.name), node.right, id("this"));
}

function replaceClass(node, state, path, options) {
  console.assert(node.type === "ClassDeclaration" || node.type === "ClassExpression");

  var body = node.body.body,
      superClass = node.superClass,
      classId = node.id,
      type = node.type,
      start = node.start,
      end = node.end,
      instanceProps = id("undefined"),
      classProps = id("undefined"),
      className = classId ? classId.name : "anonymous_class",
      evalId = options.evalId,
      sourceAccessorName = options.sourceAccessorName,
      loc = node["x-lively-object-meta"] || { start: start, end: end };


  if (body.length) {
    var _body$reduce = body.reduce(function (props, propNode) {
      var decl,
          key = propNode.key,
          kind = propNode.kind,
          value = propNode.value,
          classSide = propNode.static;

      if (key.type !== "Literal" && key.type !== "Identifier") {
        console.warn("Unexpected key in classToFunctionTransform! " + JSON.stringify(key));
      }

      if (kind === "method") {
        // The name is just for debugging purposes when it appears in
        // native debuggers. We have to be careful about it b/c it shadows
        // outer functions / vars, something that is totally not apparent for a user
        // of the class syntax. That's the reason for making it a little cryptic
        var methodId = id(className + "_" + ensureIdentifier(key.name || key.value) + "_"),
            _props = ["key", literal(key.name || key.value), "value", _extends({}, value, defineProperty({ id: methodId }, methodKindSymbol, classSide ? "static" : "proto"))];

        decl = objectLiteral(_props);
      } else if (kind === "get" || kind === "set") {
        decl = objectLiteral(["key", literal(key.name || key.value), kind, Object.assign({}, value, defineProperty({ id: id(kind) }, methodKindSymbol, classSide ? "static" : "proto"))]);
      } else if (kind === "constructor") {
        var _props2 = ["key", funcCall(member("Symbol", "for"), literal("lively-instance-initialize")), "value", _extends({}, value, defineProperty({ id: id(className + "_initialize_") }, methodKindSymbol, "proto"))];
        decl = objectLiteral(_props2);
      } else {
        console.warn("[lively.classes] classToFunctionTransform encountered unknown class property with kind " + kind + ", ignoring it, " + JSON.stringify(propNode));
      }
      (classSide ? props.clazz : props.inst).push(decl);
      return props;
    }, { inst: [], clazz: [] }),
        inst = _body$reduce.inst,
        clazz = _body$reduce.clazz;

    if (inst.length) instanceProps = { type: "ArrayExpression", elements: inst };
    if (clazz.length) classProps = { type: "ArrayExpression", elements: clazz };
  }

  var scope = options.scope,
      superClassReferencedAs,
      superClassRef;

  if (superClass && options.currentModuleAccessor) {
    if (options.classHolder === superClass.object) {
      superClassRef = superClass;
      superClassReferencedAs = superClass.property.name;
    } else {
      var found = scope && scope.resolvedRefMap && scope.resolvedRefMap.get(superClass),
          isTopLevel = found && found.decl && scope.decls && scope.decls.find(function (_ref) {
        var _ref2 = slicedToArray(_ref, 1),
            decl = _ref2[0];

        return decl === found.decl;
      });
      if (isTopLevel) {
        superClassRef = superClass;
        superClassReferencedAs = superClass.name;
      }
    }
  }

  var superClassSpec = superClassRef ? objectLiteral(["referencedAs", literal(superClassReferencedAs), "value", superClassRef]) : superClass || id("undefined");

  // For persistent storage and retrieval of pre-existing classes in "classHolder" object
  var useClassHolder = classId && type === "ClassDeclaration";

  var locKeyVals = ["start", literal(loc.start), "end", literal(loc.end)];
  if (typeof evalId !== "undefined") locKeyVals.push("evalId", literal(evalId));
  if (sourceAccessorName) locKeyVals.push("moduleSource", lively_ast.nodes.id(sourceAccessorName));
  var locNode = objectLiteral(locKeyVals);

  var classCreator = funcCall(funcExpr({}, ["superclass"], varDecl(tempLivelyClassHolderVar, state.classHolder), varDecl(tempLivelyClassVar, useClassHolder ? {
    type: "ConditionalExpression",
    test: binaryExpr(funcCall(member(tempLivelyClassHolderVar, "hasOwnProperty"), literal(classId.name)), "&&", binaryExpr({
      argument: member(tempLivelyClassHolderVar, classId),
      operator: "typeof", prefix: true, type: "UnaryExpression"
    }, "===", literal("function"))),
    consequent: member(tempLivelyClassHolderVar, classId),
    alternate: assign(member(tempLivelyClassHolderVar, classId), constructorTemplate(classId.name))
  } : classId ? constructorTemplate(classId.name) : constructorTemplate(null)), returnStmt(funcCall(options.functionNode, id(tempLivelyClassVar), id("superclass"), instanceProps, classProps, id(tempLivelyClassHolderVar), options.currentModuleAccessor || id("undefined"), locNode))), superClassSpec);

  if (type === "ClassExpression") return classCreator;

  var result = classCreator;

  if (options.declarationWrapper && state.classHolder === options.classHolder /*i.e. toplevel*/) result = funcCall(options.declarationWrapper, literal(classId.name), literal("class"), result, options.classHolder, locNode);

  // since it is a declaration and we removed the class construct we need to add a var-decl
  result = varDecl(classId, result, "var");
  result[isTransformedClassVarDeclSymbol] = true;

  return result;
}

function splitExportDefaultWithClass(node, classHolder, path, options) {
  return !node.declaration || !node.declaration[isTransformedClassVarDeclSymbol] ? node : [node.declaration, {
    declaration: node.declaration.declarations[0].id,
    type: "ExportDefaultDeclaration"
  }];
}

// var opts = {classHolder: {type: "Identifier", name: "_rec"}, functionNode: {type: "Identifier", name: "createOrExtendClass"}};
// stringify(classToFunctionTransform(parse("class Foo extends Bar {m() { super.m(); }}"), opts))
// stringify(classToFunctionTransform(parse("class Foo extends Bar {m() { super.m(arguments[1]); }}"), opts))
// stringify(classToFunctionTransform(parse("class Foo {constructor() {}}"), opts))

function classToFunctionTransform(sourceOrAst, options) {
  // required: options = {functionNode, classHolder}
  // From
  //   class Foo extends SuperFoo { m() { return 2 + super.m() }}
  // produces something like
  //   createOrExtend({}, {referencedAs: "SuperFoo", value: SuperFoo}, "Foo2", [{
  //     key: "m",
  //     value: function m() {
  //       return 2 + this.constructor[superclassSymbol].prototype.m.call(this);
  //     }
  //   }])

  // console.log(typeof sourceOrAst === "string" ? sourceOrAst : stringify(sourceOrAst))

  var parsed = typeof sourceOrAst === "string" ? lively_ast.parse(sourceOrAst) : sourceOrAst;
  options.scope = lively_ast.query.resolveReferences(lively_ast.query.scopes(parsed));

  var replaced = ClassReplaceVisitor.run(parsed, options);

  return replaced;
}

exports.runtime = runtime;
exports.classToFunctionTransform = classToFunctionTransform;

}((this.lively.classes = this.lively.classes || {}),lively.lang,lively.ast));

  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.classes;
})();