import { prepareClassForManagedPropertiesAfterCreation } from './properties.js';
import { superclassSymbol, moduleSubscribeToToplevelChangesSym, moduleMetaSymbol, objMetaSymbol, initializeSymbol } from './util.js';

const constructorArgMatcher = /\([^\\)]*\)/;

const defaultPropertyDescriptorForGetterSetter = {
  enumerable: false,
  configurable: true
};

const defaultPropertyDescriptorForValue = {
  enumerable: false,
  configurable: true,
  writable: true
};

export const setPrototypeOf = typeof Object.setPrototypeOf === 'function'
  ? (obj, proto) => Object.setPrototypeOf(obj, proto)
  : (obj, proto) => obj.__proto__ = proto;

export function adoptObject (object, newClass) {
  // change the class of object to newClass
  if (newClass === object.constructor) return;
  object.constructor = newClass;
  setPrototypeOf(object, newClass.prototype);
}

export function setSuperclass (klass, superclassOrSpec) {
  // define klass.prototype, klass.prototype[constructor], klass[superclassSymbol]
  let superclass = !superclassOrSpec
    ? Object
    : typeof superclassOrSpec === 'function'
      ? superclassOrSpec
      : superclassOrSpec.value ? superclassOrSpec.value : Object;
  let existingSuperclass = klass && klass[superclassSymbol];
  // set the superclass if necessary and set prototype
  if (!existingSuperclass || existingSuperclass !== superclass) {
    ensureInitializeStub(superclass);
    klass[superclassSymbol] = superclass;
    setPrototypeOf(klass.prototype, superclass.prototype);
    if (superclass !== Object) setPrototypeOf(klass, superclass);
  }
  return superclass;
}

function installValueDescriptor (object, klass, descr) {
  descr = Object.assign(descr, defaultPropertyDescriptorForValue);
  descr.value.displayName = descr.key;
  if (descr.needsDeclaringClass) {
    let orig = descr.value.originalFunction || descr.value;
    descr.value = Object.assign(
      function declaring_class_wrapper (/* args */) { return orig.call(this, klass, ...arguments); },
      {
        originalFunction: orig,
        toString: () => orig.toString(),
        displayName: descr.key
      });
  }
  Object.defineProperty(object, descr.key, descr);
}

function installGetterSetterDescriptor (klass, descr) {
  descr = Object.assign(descr, defaultPropertyDescriptorForGetterSetter);
  Object.defineProperty(klass, descr.key, descr);
}

function installMethods (klass, instanceMethods, classMethods) {
  // install methods from two lists (static + instance) of {key, value} or
  // {key, get/set} descriptors

  classMethods && classMethods.forEach(ea => {
    ea.value
      ? installValueDescriptor(klass, klass, ea)
      : installGetterSetterDescriptor(klass, ea);
  });

  instanceMethods && instanceMethods.forEach(ea => {
    ea.value
      ? installValueDescriptor(klass.prototype, klass, ea)
      : installGetterSetterDescriptor(klass.prototype, ea);
  });

  // 4. define initializer method, in our class system the constructor is
  // generic and re-directs to the initializer method. This way we can change
  // the constructor without loosing the identity of the class
  if (!klass.prototype[initializeSymbol]) {
    Object.defineProperty(klass.prototype, initializeSymbol, {
      enumerable: false,
      configurable: true,
      writable: true,
      value: function () {}
    });
    klass.prototype[initializeSymbol].isDefaultInitializer = true;
    klass.prototype[initializeSymbol].displayName = 'lively-initialize';
  } else {
    const hasInitializerInstalled = Object.getOwnPropertySymbols(klass.prototype).includes(initializeSymbol);
    const hasInitializerDefined = instanceMethods.find(m => m.key == initializeSymbol);
    if (hasInitializerInstalled) {
      // if the class already has an initializer installed we need to proceed with care...
      const isDefaultInitializer = klass.prototype[initializeSymbol].isDefaultInitializer;
      const superControlledByUs = klass[superclassSymbol].prototype[initializeSymbol];
      if (isDefaultInitializer && superControlledByUs) {
        // we possibly override a meaningful constructor in the superclass
        // so we better delete the default initializer from this class
        // since it does not contribute anything
        delete klass.prototype[initializeSymbol];
      } else if (!hasInitializerDefined) {
        // the constructor was previously defined and has now been removed
        // from the definition. So we either...
        // 1. just remove from class and dispatch to super...
        if (superControlledByUs) delete klass.prototype[initializeSymbol];
        // 2 ... or fill in the default one if the superclass is not controlled by us.
        else klass.prototype[initializeSymbol] = function () {};
      }
    }
  }

  // 5. undefine properties that were removed form class definition
  let instanceMethodsInClass = instanceMethods.map(m => m.key)
    .concat(['constructor', 'arguments', 'caller']);
  let instanceAttributes = Object.getOwnPropertyNames(klass.prototype);
  for (let i = 0; i < instanceAttributes.length; i++) {
    let name = instanceAttributes[i];
    if (!instanceMethodsInClass.includes(name)) delete klass.prototype[name];
  }

  let classMethodsInClass = classMethods.map(m => m.key)
    .concat(['length', 'name', 'prototype', 'arguments', 'caller']);
  let classAttributes = Object.getOwnPropertyNames(klass);
  for (let i = 0; i < classAttributes.length; i++) {
    let name = classAttributes[i];
    if (!classMethodsInClass.includes(name)) delete klass[name];
  }
}

function ensureInitializeStub (superclass) {
  // when we inherit from "conventional classes" those don't have an
  // initializer method. We install a stub that calls the superclass function
  // itself
  if (superclass === Object || superclass.prototype[initializeSymbol]) return;
  Object.defineProperty(superclass.prototype, initializeSymbol, {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function (/* args */) { superclass.apply(this, arguments); }
  });
  superclass.prototype[initializeSymbol].displayName = 'lively-initialize-stub';
}

export function initializeClass (
  constructorFunc, superclassSpec,
  instanceMethods = [],
  classMethods = [],
  classHolder = {},
  currentModule,
  sourceLoc) {
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
  let className = constructorFunc.name;
  let klass = className && classHolder.hasOwnProperty(className) && classHolder[className];
  let existingSuperclass = klass && klass[superclassSymbol];
  if (!klass || typeof klass !== 'function' || !existingSuperclass) { klass = constructorFunc; }

  // 2. set the superclass if necessary and set prototype
  let superclass = setSuperclass(klass, superclassSpec);

  // 3. Install methods
  installMethods(klass, instanceMethods, classMethods);

  klass[objMetaSymbol] = sourceLoc;

  // 4. If we have a `currentModule` instance (from lively.modules/src/module.js)
  // then we also store some meta data about the module. This allows us to
  // (de)serialize class instances in lively.serializer
  if (currentModule) {
    let p = currentModule.package();
    let prevMeta = klass[moduleMetaSymbol];
    let t = Date.now();
    klass[moduleMetaSymbol] = {
      package: p ? { name: p.name, version: p.version } : {},
      pathInPackage: p ? currentModule.pathInPackage() : currentModule.id,
      lastChange: prevMeta && prevMeta.lastChange && t <= prevMeta.lastChange
        ? prevMeta.lastChange + 1
        : t,
      lastSuperclassChange: 0
    };

    // if we have a module, we can listen to toplevel changes of it in case the
    // superclass binding changes. With that we can keep our class up-to-date
    // even if the superclass binding changes. This is especially useful for
    // situations where modules have a circular dependency and classes in modules
    // won't get defined correctly when loaded first. See
    // https://github.com/LivelyKernel/lively.modules/issues/27 for more details
    if (superclassSpec && superclassSpec.referencedAs) {
      if (klass.hasOwnProperty(moduleSubscribeToToplevelChangesSym)) {
        currentModule.unsubscribeFromToplevelDefinitionChanges(
          klass[moduleSubscribeToToplevelChangesSym]);
      }
      klass[moduleSubscribeToToplevelChangesSym] =
        currentModule.subscribeToToplevelDefinitionChanges((name, val) => {
          if (name !== superclassSpec.referencedAs) return;
          // console.log(`class ${className}: new superclass ${name} ${name !== superclassSpec.referencedAs ? '(' + superclassSpec.referencedAs + ')' : ''} was defined via module bindings`)

          // Only run through the (expensive) updates if superclass really has changes
          let superMeta = val && val[moduleMetaSymbol];
          let myMeta = klass[moduleMetaSymbol];
          if (superMeta) {
            if (superMeta.lastChange === myMeta.lastSuperclassChange) { return; }
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
    let constructorArgs = String(this.prototype[initializeSymbol]).match(constructorArgMatcher);
    let className = this.name;
    let superclass = this[superclassSymbol];
    return `class ${className} ${superclass ? `extends ${superclass.name}` : ''} {\n` +
         `  constructor${constructorArgs ? constructorArgs[0] : '()'} { /*...*/ }` +
         '\n}';
  };

  // 7. If the class allows managed properties (auto getters/setters etc., see
  // managed-properties.js) then setup those
  prepareClassForManagedPropertiesAfterCreation(klass);

  return klass;
}

initializeClass._get = function _get (object, property, receiver) {
  if (object === null) object = Function.prototype;
  let desc = Object.getOwnPropertyDescriptor(object, property);
  if (desc === undefined) {
    let parent = Object.getPrototypeOf(object);
    return parent === null ? undefined : _get(parent, property, receiver);
  }
  if ('value' in desc) return desc.value;
  let getter = desc.get;
  return getter === undefined ? undefined : getter.call(receiver);
};

initializeClass._set = function _set (object, property, value, receiver) {
  let desc = Object.getOwnPropertyDescriptor(object, property);
  if (desc === undefined) {
    let parent = Object.getPrototypeOf(object);
    if (parent !== null) _set(parent, property, value, receiver);
  } else if ('value' in desc && desc.writable) desc.value = value;
  else {
    let setter = desc.set;
    if (setter !== undefined) setter.call(receiver, value);
  }
  return value;
};
