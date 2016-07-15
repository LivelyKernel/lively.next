const initializerTemplate = `(function CLASS(){
  var firstArg = arguments[0];
  if (firstArg && firstArg[Symbol.for("lively-instance-restorer")]) {
    // for deserializing instances just do nothing
  } else {
    // automatically call the initialize method
    this[Symbol.for("lively-instance-initialize")].apply(this, arguments);
  }
})`

export const initializeSymbol = Symbol.for("lively-instance-initialize"),
             instanceRestorerSymbol = Symbol.for("lively-instance-restorer"),
             superclassSymbol = Symbol.for("lively-instance-superclass"),
             moduleMetaSymbol = Symbol.for("lively-instance-module-meta"),
             moduleSubscribeToToplevelChangesSym = Symbol.for("lively-klass-changes-subscriber");

const constructorArgMatcher = /\([^\\)]*\)/;

const defaultPropertyDescriptorForGetterSetter = {
  enumerable: false,
  configurable: true
}

const defaultPropertyDescriptorForValue = {
  enumerable: false,
  configurable: true,
  writable: true
}

function createClass(name) {
  if (!name) name = "anonymous_class";
  var constructor = eval(initializerTemplate.replace(/CLASS/, name));
  constructor.displayName = "class " + name;
  return constructor;
}


function setSuperclass(klass, superclassOrSpec) {
  // define klass.prototype, klass.prototype[constructor], klass[superclassSymbol]
  var superclass = !superclassOrSpec ? Object :
    typeof superclassOrSpec === "function" ? superclassOrSpec :
      superclassOrSpec.value ? superclassOrSpec.value : Object;
  var existingSuperclass = klass && klass[superclassSymbol];
  // set the superclass if necessary and set prototype
  if (!existingSuperclass || existingSuperclass !== superclass) {
    ensureInitializeStub(superclass);
    klass[superclassSymbol] = superclass;
    klass.prototype = Object.create(superclass.prototype);
    klass.prototype.constructor = klass;
  }
  return superclass
}

function addMethods(klass, instanceMethods, classMethods) {
  // install methods from two lists (static + instance) of {key, value} or
  // {key, get/set} descriptors
  classMethods && classMethods.forEach(ea => {
    var descr = ea.value ? defaultPropertyDescriptorForValue : defaultPropertyDescriptorForGetterSetter;
    Object.defineProperty(klass, ea.key, Object.assign(ea, descr))
    if (typeof ea.value === "function")
      klass[ea.key].displayName = ea.key;
  });

  instanceMethods && instanceMethods.forEach(ea => {
    var descr = ea.value ? defaultPropertyDescriptorForValue : defaultPropertyDescriptorForGetterSetter;
    Object.defineProperty(klass.prototype, ea.key, Object.assign(ea, descr))
    if (typeof ea.value === "function")
      klass.prototype[ea.key].displayName = ea.key;
  });

  // 4. define initializer method, in our class system the constructor is always
  // as defined in initializerTemplate and re-directs to the initializer method.
  // This way we can change the constructor without loosing the identity of the
  // class
  if (!klass.prototype[initializeSymbol]) {
    Object.defineProperty(klass.prototype, initializeSymbol, {
      enumerable: false,
      configurable: true,
      writable: true,
      value: function() {}
    });
    klass.prototype[initializeSymbol].displayName = "lively-initialize";
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
    value: function(/*args*/) { superclass.apply(this, arguments); }
  });
  superclass.prototype[initializeSymbol].displayName = "lively-initialize-stub";
}

export function createOrExtend(
  name, superclassSpec,
  instanceMethods = [],
  classMethods = [],
  classHolder = {},
  currentModule) {
  // Given a `classHolder` object as "environment", will try to find a "class"
  // (JS constructor function) inside it. If no class is found it will create a
  // new costructor function object and will attach the methods to it. If a class
  // is found it will be modified.
  // This is being used as the compile target for es6 class syntax by the
  // lively.ast capturing / transform logic
  // Example:
  // var Foo = createOrExtend({}, function Foo() {}, "Foo", [{key: "m", value: function m() { return 23 }}]);
  // new Foo().m() // => 23

  // 1. create a new constructor function if necessary, re-use an exisiting if the
  // classHolder object has it
  var klass = name && classHolder.hasOwnProperty(name) && classHolder[name],
      existingSuperclass = klass && klass[superclassSymbol];
  if (!klass || typeof klass !== "function" || !existingSuperclass)
    klass = createClass(name);

  // 2. set the superclass if necessary and set prototype
  var superclass = setSuperclass(klass, superclassSpec);

  // 3. Install methods
  addMethods(klass, instanceMethods, classMethods)

  // 4. If we have a `currentModule` instance (from lively.modules/src/module.js)
  // then we also store some meta data about the module. This allows us to
  // (de)serialize class instances in lively.serializer
  if (currentModule) {
    var p  = currentModule.package()
    klass[moduleMetaSymbol] = {
      package: p ? {name: p.name, version: p.version} : {},
      pathInPackage: currentModule.pathInPackage()
    }

    // if we have a module, we can listen to toplevel changes of it in case the
    // superclass binding changes. With that we can keep our class up-to-date
    // even if the superclass binding changes. This is especially useful for
    // situations where modules have a circular dependency and classes in modules
    // won't get defined correctly when loaded first. See
    // https://github.com/LivelyKernel/lively.modules/issues/27 for more details
    if (superclassSpec && superclassSpec.referencedAs) {
      if (klass[moduleSubscribeToToplevelChangesSym]) {
        currentModule.unsubscribeFromToplevelDefinitionChanges(klass[moduleSubscribeToToplevelChangesSym])
      }
      klass[moduleSubscribeToToplevelChangesSym] = currentModule.subscribeToToplevelDefinitionChanges((name, val) => {
        if (name === superclassSpec.referencedAs) {
          setSuperclass(klass, val);
          addMethods(klass, instanceMethods, classMethods);
        }
      });
    }
  }

  // 6. Add a toString method for the class to allows us to see its constructor arguments
  var init = klass.prototype[initializeSymbol],
      constructorArgs = String(klass.prototype[initializeSymbol]).match(constructorArgMatcher),
      string = `class ${name} ${superclass ? `extends ${superclass.name}` : ""} {\n`
             + `  constructor${constructorArgs ? constructorArgs[0] : "()"} { /*...*/ }`
             + `\n}`;
  klass.toString = () => string;

  return klass;
}
