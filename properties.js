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

  var propertySettings = klass[defaultPropertiesSettingKey] || {};
  var properties = klass[defaultPropertiesKey];
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
      } = {...defaultPropertySettings, ...propertySettings },
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
  Object.defineProperty(klass.prototype, "initializeProperties", {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function(values) {
      var klass = this.constructor,
          {properties, propertySettings} = klass[propertiesAndSettingsCacheSym]
                                        || propertiesAndSettingsInHierarchyOf(klass);
      prepareInstanceForProperties(this, propertySettings, properties, values)
      return this;
    }
  });
}

function propertiesAndSettingsInHierarchyOf(klass) {
  // walks class proto chain
  var propertySettings = {},
      properties = {},
      allPropSettings = obj.valuesInPropertyHierarchy(klass, "propertySettings"),
      allProps = obj.valuesInPropertyHierarchy(klass, "properties");

  for (let i = 0; i < allPropSettings.length; i++) {
    let current = allPropSettings[i];
    current && typeof current === "object" && Object.assign(propertySettings, current);
  }

  for (let i = 0; i < allProps.length; i++) {
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
  var {valueStoreProperty} = {...defaultPropertySettings, ...propertySettings},
      sortedKeys = obj.sortKeysWithBeforeAndAfterConstraints(properties),
      propsNeedingInitialize = [],
      propsHavingValue = [];
  // 2. this[valueStoreProperty] is were the actual values will be stored
  if (!instance.hasOwnProperty(valueStoreProperty))
    instance[valueStoreProperty] = {};

  for (var i = 0; i < sortedKeys.length; i++) {
    var key = sortedKeys[i],
        descriptor = properties[key];

    var defaultValue = instance[valueStoreProperty][key] =
      descriptor.hasOwnProperty("defaultValue") ?
        descriptor.defaultValue : undefined;

    if (descriptor.hasOwnProperty("initialize"))
      propsNeedingInitialize.push({key, defaultValue});

    if (values && key in values) {
      if (descriptor.readOnly) {
        console.warn(
          `Trying to initialize read-only property ${key} in ${instance}, ` +
            `skipping setting value`
        );
      } else propsHavingValue.push(key);
    }

  }
  
  // 3. Run init code for properties
  for (var i = 0; i < propsNeedingInitialize.length; i++) {
    var {key, defaultValue} = propsNeedingInitialize[i];
    instance[valueStoreProperty][key] = properties[key].initialize.call(instance, defaultValue);
  }

  // 4. if we have values we will initialize the properties from it. Values
  // is expected to be a JS object mapping property names to property values
  if (values) {
    for (let i = 0; i < propsHavingValue.length; i++) {
      var key = propsHavingValue[i];
      instance[key] = values[key]; // go through the setter!
    }
  }

}

