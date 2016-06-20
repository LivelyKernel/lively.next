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
             moduleMetaSymbol = Symbol.for("lively-instance-module-meta");

const defaultPropertyDescriptorForClass = {
  enumerable: false,
  configurable: true
}

function createClass(name) {
  if (!name) name = "anonymous_class";
  var constructor = eval(initializerTemplate.replace(/CLASS/, name));
  constructor.displayName = "class " + name;
  return constructor;
}

export function createOrExtend(
  name, superclass,
  instanceMethods = [],
  staticMethods = [],
  classHolder,
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
  if (!superclass) superclass = Object;
  if (!existingSuperclass || existingSuperclass !== superclass) {
    if (existingSuperclass) {
      console.warn(
        `Changing superclass of class ${name} from `
      + `${existingSuperclass.name} to ${superclass.name}: This will leave `
      + `existing instances of ${name} orphaned, i.e. ${name} is practically not `
      + `their class anymore and they will not get new behaviors when ${name} is `
      + `changed!!!`);
    }
    klass[superclassSymbol] = superclass;
    klass.prototype = Object.create(superclass.prototype);
    klass.prototype.constructor = klass;
  }

  // 3. define methods
  staticMethods && staticMethods.forEach(ea =>
    Object.defineProperty(klass, ea.key, Object.assign(ea, defaultPropertyDescriptorForClass)));

  instanceMethods && instanceMethods.forEach(ea => {
    Object.defineProperty(klass.prototype, ea.key, Object.assign(ea, defaultPropertyDescriptorForClass)); });

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
  }

  // 5. If we have a `currentModule` instance (from lively.modules/src/module.js)
  // then we also store some meta data about the module. This allows us to
  // (de)serialize class instances in lively.serializer
  if (currentModule) {
    var p  = currentModule.package()
    klass[moduleMetaSymbol] = {
      package: p ? {name: p.name, version: p.version} : {},
      pathInPackage: currentModule.pathInPackage()
    }
  }

  return klass;
}
