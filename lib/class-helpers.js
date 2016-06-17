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
             superclassSymbol = Symbol.for("lively-instance-superclass");

const defaultPropertyDescriptorForClass = {
  enumerable: false,
  configurable: true
}

function createClass(name) {
  var constructor = eval(initializerTemplate.replace(/CLASS/, name));
  constructor.displayName = "class " + name;
  return constructor;
}

export function createOrExtend(classHolder, superclass, name, instanceMethods, staticMethods) {
  // Given a `classHolder` object as "environment", will try to find a "class"
  // (JS constructor function) inside it. If no class is found it will create a
  // new costructor function object and will attach the methods to it. If a class
  // is found it will be modified.
  // This is being used as the compile target for es6 class syntax by the
  // lively.ast capturing / transform logic
  // Example:
  // var Foo = createOrExtend({}, function Foo() {}, "Foo", [{key: "m", value: function m() { return 23 }}]);
  // new Foo().m() // => 23

  var klass = classHolder.hasOwnProperty(name) && classHolder[name],
      existingSuperclass = klass && klass[superclassSymbol];

  if (!klass || typeof klass !== "function" || !existingSuperclass)
    klass = createClass(name);

  if (!existingSuperclass || existingSuperclass !== superclass) {
    klass[superclassSymbol] = superclass = superclass || Object;
    klass.prototype = Object.create(superclass.prototype);
    klass.prototype.constructor = klass;
  }

  staticMethods && staticMethods.forEach(ea =>
    Object.defineProperty(klass, ea.key, Object.assign(ea, defaultPropertyDescriptorForClass)));

  instanceMethods && instanceMethods.forEach(ea => {
    Object.defineProperty(klass.prototype, ea.key, Object.assign(ea, defaultPropertyDescriptorForClass)); });

  // initializer method
  if (!klass.prototype[initializeSymbol]) {
    Object.defineProperty(klass.prototype, initializeSymbol, {
      enumerable: false,
      configurable: true,
      writable: true,
      value: function() {}
    });
  }

  return klass;
}
