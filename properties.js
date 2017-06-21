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

import { obj } from "lively.lang";

const defaultPropertiesSettingKey = "propertySettings",
      defaultPropertiesKey = "properties",
      defaultInstanceInitializerMethod = "initializeProperties",
      propertiesAndSettingsCacheSym = Symbol.for("lively.classes-properties-and-settings");

const defaultPropertySettings = {
  defaultSetter: null,
  defaultGetter: null,
  valueStoreProperty: "_state",
}

function hasManagedProperties(klass) {
  return klass.hasOwnProperty(defaultPropertiesKey);
}

export function prepareClassForManagedPropertiesAfterCreation(klass) {
  if (!hasManagedProperties(klass)) return;

  var {properties, propertySettings} = propertiesAndSettingsInHierarchyOf(klass);
  klass[propertiesAndSettingsCacheSym] = {properties, propertySettings};
  if (!properties || typeof properties !== "object") {
    console.warn(`Class ${klass.name} indicates it has managed properties but its `
               + `properties accessor (${defaultPropertiesKey}) does not return `
               + `a valid property descriptor map`);
    return;
  }
  prepareClassForProperties(klass, propertySettings, properties);
}

function prepareClassForProperties(klass, propertySettings, properties) {
  ensurePropertyInitializer(klass);

  var {
        valueStoreProperty,
        defaultGetter,
        defaultSetter
      } = propertySettings,
      myProto = klass.prototype,
      keys = Object.keys(properties);

  keys.forEach(key => {
    var descriptor = properties[key];

    // ... define a getter to the property for the outside world...
    var hasGetter = myProto.hasOwnProperty(key) && myProto.__lookupGetter__(key);
    if (!hasGetter) {
      var getter = descriptor.get
                || (typeof defaultGetter === "function" && function() { return defaultGetter.call(this, key); })
                || function() { return this[valueStoreProperty][key]; };
      myProto.__defineGetter__(key, getter);
    }

    // ...define a setter if necessary
    var hasSetter = myProto.hasOwnProperty(key) && myProto.__lookupSetter__(key);
    if (!hasSetter) {
      var descrHasSetter = descriptor.hasOwnProperty("set"),
          setterNeeded = descrHasSetter || !descriptor.readOnly;
      if (setterNeeded) {
        var setter = descriptor.set
                  || (typeof defaultSetter === "function" && function(val) { defaultSetter.call(this, key, val); })
                  || function(val) { this[valueStoreProperty][key] = val; };
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
    value: function() {
      var klass = this.constructor;
      return klass[propertiesAndSettingsCacheSym]
          || propertiesAndSettingsInHierarchyOf(klass);
    }
  });
  Object.defineProperty(klass.prototype, "initializeProperties", {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function(values) {
      var {properties, propertySettings} = this.propertiesAndPropertySettings();
      prepareInstanceForProperties(this, propertySettings, properties, values)
      return this;
    }
  });
}

function propertiesAndSettingsInHierarchyOf(klass) {
  // walks class proto chain
  var propertySettings = {...defaultPropertySettings},
      properties = {},
      allPropSettings = obj.valuesInPropertyHierarchy(klass, "propertySettings"),
      allProps = obj.valuesInPropertyHierarchy(klass, "properties");

  for (var i = 0; i < allPropSettings.length; i++) {
    let current = allPropSettings[i];
    current && typeof current === "object" && Object.assign(propertySettings, current);
  }

  for (var i = 0; i < allProps.length; i++) {
    let current = allProps[i];
    if (typeof current !== "object") {
      console.error(
        `[initializeProperties] ${klass} encountered property declaration ` +
          `that is not a JS object: ${current}`);
      continue;
    }
    // "deep" merge
    for (var name in current) {
      if (!properties.hasOwnProperty(name)) properties[name] = current[name];
      else Object.assign(properties[name], current[name]);
    }
  }

  return {properties, propertySettings};
}

function prepareInstanceForProperties(instance, propertySettings, properties, values) {
  var {valueStoreProperty} = propertySettings,
      sortedKeys = obj.sortKeysWithBeforeAndAfterConstraints(properties),
      propsNeedingInitialize = [],
      initActions = {};

  // 1. this[valueStoreProperty] is were the actual values will be stored
  if (!instance.hasOwnProperty(valueStoreProperty))
    instance[valueStoreProperty] = {};

  for (var i = 0; i < sortedKeys.length; i++) {
    let key = sortedKeys[i],
        descriptor = properties[key];

    let derived = descriptor.derived, foldable = !!descriptor.foldable,
        defaultValue = descriptor.hasOwnProperty("defaultValue") ?
                        descriptor.defaultValue : undefined;
    if (Array.isArray(defaultValue)) defaultValue = defaultValue.slice();
    if (!derived && !foldable) instance[valueStoreProperty][key] = defaultValue;

    let initAction;
    if (descriptor.hasOwnProperty("initialize")) {
      initAction = initActions[key] = {initialize: defaultValue}
      propsNeedingInitialize.push(key);
    } else if (derived && defaultValue !== undefined) {
      initAction = initActions[key] = {derived: defaultValue}
      propsNeedingInitialize.push(key);
    } else if (foldable && defaultValue !== undefined) {
      initAction = initActions[key] = {folded: defaultValue}
      propsNeedingInitialize.push(key);
    }

    if (values && key in values) {
      if (descriptor.readOnly) {
        console.warn(
          `Trying to initialize read-only property ${key} in ${instance}, ` +
            `skipping setting value`
        );
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
    let key = propsNeedingInitialize[i],
        actions = initActions[key],
        hasValue = actions.hasOwnProperty("value");

    // if we have an initialize function we call it either with the value from
    // values or with the defaultValue
    if (actions.hasOwnProperty("initialize")) {
      let value = hasValue ? actions.value : actions.initialize;
      properties[key].initialize.call(instance, value);
      if (hasValue) instance[key] = actions.value;
    }

    // if we have a derived property we will call the setter with the default
    // value or the value from values
    else if (actions.hasOwnProperty("derived")) {
      instance[key] = hasValue ? actions.value : actions.derived;
    }

    else  if (actions.hasOwnProperty("folded")) {
      instance[key] = hasValue ? actions.value : actions.folded;
    }

    // if we only have the value from values we simply call the setter with it
    else if (hasValue) {
      instance[key] = actions.value;
    }

  }

}

