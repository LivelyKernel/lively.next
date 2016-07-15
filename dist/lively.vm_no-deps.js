(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  this.lively = this.lively || {};
(function (exports,lively_lang,lively_ast) {
  'use strict';

  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
    return typeof obj;
  } : function (obj) {
    return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
  };

  var asyncToGenerator = function (fn) {
    return function () {
      var gen = fn.apply(this, arguments);
      return new Promise(function (resolve, reject) {
        function step(key, arg) {
          try {
            var info = gen[key](arg);
            var value = info.value;
          } catch (error) {
            reject(error);
            return;
          }

          if (info.done) {
            resolve(value);
          } else {
            return Promise.resolve(value).then(function (value) {
              return step("next", value);
            }, function (err) {
              return step("throw", err);
            });
          }
        }

        return step("next");
      });
    };
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

  var defineProperty = function (obj, key, value) {
    if (key in obj) {
      Object.defineProperty(obj, key, {
        value: value,
        enumerable: true,
        configurable: true,
        writable: true
      });
    } else {
      obj[key] = value;
    }

    return obj;
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

  // helper
  function signatureOf(name, func) {
    var source = String(func),
        match = source.match(/function\s*[a-zA-Z0-9_$]*\s*\(([^\)]*)\)/),
        params = match && match[1] || '';
    return name + '(' + params + ')';
  }

  function pluck(list, prop) {
    return list.map(function (ea) {
      return ea[prop];
    });
  }

  function getObjectForCompletion(evalFunc, stringToEval) {
    var startLetters = '';
    return Promise.resolve().then(function () {
      // thenDo = function(err, obj, startLetters)
      var idx = stringToEval.lastIndexOf('.');
      if (idx >= 0) {
        startLetters = stringToEval.slice(idx + 1);
        stringToEval = stringToEval.slice(0, idx);
      } else {
        startLetters = stringToEval;
        stringToEval = '(typeof window === "undefined" ? global : window)';
      }
      return evalFunc(stringToEval);
    }).then(function (evalResult) {
      return {
        evalResult: evalResult,
        startLetters: startLetters,
        code: stringToEval
      };
    });
  }

  var knownSymbols = function () {
    return Object.getOwnPropertyNames(Symbol).filter(function (ea) {
      return _typeof(Symbol[ea]) === "symbol";
    }).reduce(function (map, ea) {
      return map.set(Symbol[ea], "Symbol." + ea);
    }, new Map());
  }();

  var symMatcher = /^Symbol\((.*)\)$/;

  function printSymbolForCompletion(sym) {
    if (Symbol.keyFor(sym)) return 'Symbol.for("' + Symbol.keyFor(sym) + '")';
    if (knownSymbols.get(sym)) return knownSymbols.get(sym);
    var matched = String(sym).match(symMatcher);
    return String(sym);
  }
  function propertyExtract(excludes, obj, extractor) {
    return Object.getOwnPropertyNames(obj).concat(Object.getOwnPropertySymbols(obj).map(printSymbolForCompletion)).filter(function (key) {
      return excludes.indexOf(key) === -1;
    }).map(extractor).filter(function (ea) {
      return !!ea;
    }).sort(function (a, b) {
      return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
    });
  }

  function getMethodsOf(excludes, obj) {
    return propertyExtract(excludes, obj, function (key) {
      if (obj.__lookupGetter__ && obj.__lookupGetter__(key) || typeof obj[key] !== 'function') return null;
      return { name: key, completion: signatureOf(key, obj[key]) };
    });
  }

  function getAttributesOf(excludes, obj) {
    return propertyExtract(excludes, obj, function (key) {
      if (obj.__lookupGetter__ && !obj.__lookupGetter__(key) && typeof obj[key] === 'function') return null;
      return { name: key, completion: key };
    });
  }

  function getProtoChain(obj) {
    var protos = [],
        proto = obj;
    while (obj) {
      protos.push(obj);obj = obj.__proto__;
    }
    return protos;
  }

  function getDescriptorOf(originalObj, proto) {
    function shorten(s, len) {
      if (s.length > len) s = s.slice(0, len) + '...';
      return s.replace(/\n/g, '').replace(/\s+/g, ' ');
    }

    if (originalObj === proto) {
      if (typeof originalObj !== 'function') return shorten(originalObj.toString ? originalObj.toString() : "[some object]", 50);
      var funcString = originalObj.toString(),
          body = shorten(funcString.slice(funcString.indexOf('{') + 1, funcString.lastIndexOf('}')), 50);
      return signatureOf(originalObj.displayName || originalObj.name || 'function', originalObj) + ' {' + body + '}';
    }

    var klass = proto.hasOwnProperty('constructor') && proto.constructor;
    if (!klass) return 'prototype';
    if (typeof klass.type === 'string' && klass.type.length) return shorten(klass.type, 50);
    if (typeof klass.name === 'string' && klass.name.length) return shorten(klass.name, 50);
    return "anonymous class";
  }

  function descriptorsOfObjAndProtoProperties(obj) {
    var excludes = [],
        completions = getProtoChain(obj).map(function (proto) {
      var descr = getDescriptorOf(obj, proto),
          methodsAndAttributes = getMethodsOf(excludes, proto).concat(getAttributesOf(excludes, proto));
      excludes = excludes.concat(pluck(methodsAndAttributes, 'name'));
      return [descr, pluck(methodsAndAttributes, 'completion')];
    });
    return completions;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // the main deal
  function getCompletions(evalFunc, string, thenDo) {
    // thendo = function(err, completions/*ARRAY*/)
    // eval string and for the resulting object find attributes and methods,
    // grouped by its prototype / class chain
    // if string is something like "foo().bar.baz" then treat "baz" as start
    // letters = filter for properties of foo().bar
    // ("foo().bar.baz." for props of the result of the complete string)
    var promise = getObjectForCompletion(evalFunc, string).then(function (evalResultAndStartLetters) {
      var evalResult = evalResultAndStartLetters.evalResult,
          value = evalResult && evalResult.isEvalResult ? evalResult.value : evalResult,
          result = {
        completions: descriptorsOfObjAndProtoProperties(value),
        startLetters: evalResultAndStartLetters.startLetters,
        code: evalResultAndStartLetters.code
      };

      if (evalResult && evalResult.isPromise) {
        if (evalResult.promiseStatus === "fulfilled") result.promiseResolvedCompletions = descriptorsOfObjAndProtoProperties(evalResult.promisedValue);else if (evalResult.promiseStatus === "rejected") result.promiseRejectedCompletions = descriptorsOfObjAndProtoProperties(evalResult.promisedValue);
      }
      return result;
    });
    if (typeof thenDo === "function") {
      promise.then(function (result) {
        return thenDo(null, result);
      }).catch(function (err) {
        return thenDo(err);
      });
    }
    return promise;
  }



  var completions = Object.freeze({
    getCompletions: getCompletions
  });

  var initializerTemplate = "(function CLASS(){\n  var firstArg = arguments[0];\n  if (firstArg && firstArg[Symbol.for(\"lively-instance-restorer\")]) {\n    // for deserializing instances just do nothing\n  } else {\n    // automatically call the initialize method\n    this[Symbol.for(\"lively-instance-initialize\")].apply(this, arguments);\n  }\n})";

  var initializeSymbol = Symbol.for("lively-instance-initialize");
  var superclassSymbol = Symbol.for("lively-instance-superclass");
  var moduleMetaSymbol = Symbol.for("lively-instance-module-meta");
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

  function createClass$1(name) {
    if (!name) name = "anonymous_class";
    var constructor = eval(initializerTemplate.replace(/CLASS/, name));
    constructor.displayName = "class " + name;
    return constructor;
  }

  function setSuperclass(klass, superclassOrSpec) {
    // define klass.prototype, klass.prototype[constructor], klass[superclassSymbol]
    var superclass = !superclassOrSpec ? Object : typeof superclassOrSpec === "function" ? superclassOrSpec : superclassOrSpec.value ? superclassOrSpec.value : Object;
    var existingSuperclass = klass && klass[superclassSymbol];
    // set the superclass if necessary and set prototype
    if (!existingSuperclass || existingSuperclass !== superclass) {
      ensureInitializeStub(superclass);
      klass[superclassSymbol] = superclass;
      klass.prototype = Object.create(superclass.prototype);
      klass.prototype.constructor = klass;
    }
    return superclass;
  }

  function addMethods(klass, instanceMethods, classMethods) {
    // install methods from two lists (static + instance) of {key, value} or
    // {key, get/set} descriptors
    classMethods && classMethods.forEach(function (ea) {
      var descr = ea.value ? defaultPropertyDescriptorForValue : defaultPropertyDescriptorForGetterSetter;
      Object.defineProperty(klass, ea.key, Object.assign(ea, descr));
      if (typeof ea.value === "function") klass[ea.key].displayName = ea.key;
    });

    instanceMethods && instanceMethods.forEach(function (ea) {
      var descr = ea.value ? defaultPropertyDescriptorForValue : defaultPropertyDescriptorForGetterSetter;
      Object.defineProperty(klass.prototype, ea.key, Object.assign(ea, descr));
      if (typeof ea.value === "function") klass.prototype[ea.key].displayName = ea.key;
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
        value: function value() {}
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
      value: function value() /*args*/{
        superclass.apply(this, arguments);
      }
    });
    superclass.prototype[initializeSymbol].displayName = "lively-initialize-stub";
  }

  function createOrExtend(name, superclassSpec) {
    var instanceMethods = arguments.length <= 2 || arguments[2] === undefined ? [] : arguments[2];
    var classMethods = arguments.length <= 3 || arguments[3] === undefined ? [] : arguments[3];
    var classHolder = arguments.length <= 4 || arguments[4] === undefined ? {} : arguments[4];
    var currentModule = arguments[5];

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
    if (!klass || typeof klass !== "function" || !existingSuperclass) klass = createClass$1(name);

    // 2. set the superclass if necessary and set prototype
    var superclass = setSuperclass(klass, superclassSpec);

    // 3. Install methods
    addMethods(klass, instanceMethods, classMethods);

    // 4. If we have a `currentModule` instance (from lively.modules/src/module.js)
    // then we also store some meta data about the module. This allows us to
    // (de)serialize class instances in lively.serializer
    if (currentModule) {
      var p = currentModule.package();
      klass[moduleMetaSymbol] = {
        package: p ? { name: p.name, version: p.version } : {},
        pathInPackage: currentModule.pathInPackage()
      };

      // if we have a module, we can listen to toplevel changes of it in case the
      // superclass binding changes. With that we can keep our class up-to-date
      // even if the superclass binding changes. This is especially useful for
      // situations where modules have a circular dependency and classes in modules
      // won't get defined correctly when loaded first. See
      // https://github.com/LivelyKernel/lively.modules/issues/27 for more details
      if (superclassSpec && superclassSpec.referencedAs) {
        if (klass[moduleSubscribeToToplevelChangesSym]) {
          currentModule.unsubscribeFromToplevelDefinitionChanges(klass[moduleSubscribeToToplevelChangesSym]);
        }
        klass[moduleSubscribeToToplevelChangesSym] = currentModule.subscribeToToplevelDefinitionChanges(function (name, val) {
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
        string = "class " + name + " " + (superclass ? "extends " + superclass.name : "") + " {\n" + ("  constructor" + (constructorArgs ? constructorArgs[0] : "()") + " { /*...*/ }") + "\n}";
    klass.toString = function () {
      return string;
    };

    return klass;
  }

  var id = lively_ast.nodes.id;
  var literal = lively_ast.nodes.literal;
  var member = lively_ast.nodes.member;
  var defaultDeclarationWrapperName = "lively.capturing-declaration-wrapper";
  var defaultClassToFunctionConverterName = "createOrExtendES6ClassForLively";
  function evalCodeTransform(code, options) {
    // variable declaration and references in the the source code get
    // transformed so that they are bound to `varRecorderName` aren't local
    // state. THis makes it possible to capture eval results, e.g. for
    // inspection, watching and recording changes, workspace vars, and
    // incrementally evaluating var declarations and having values bound later.

    // 1. Allow evaluation of function expressions and object literals
    code = lively_ast.transform.transformSingleExpression(code);
    var parsed = lively_ast.parse(code);

    // 2. capture top level vars into topLevelVarRecorder "environment"

    if (options.topLevelVarRecorder) {

      // capture and wrap logic
      var blacklist = (options.dontTransform || []).concat(["arguments"]),
          undeclaredToTransform = !!options.recordGlobals ? null /*all*/ : lively_lang.arr.withoutAll(Object.keys(options.topLevelVarRecorder), blacklist),
          varRecorder = id(options.varRecorderName || '__lvVarRecorder'),
          es6ClassToFunctionOptions = undefined,
          declarationWrapperName = options.declarationWrapperName || defaultDeclarationWrapperName;

      if (options.keepPreviouslyDeclaredValues) {
        // 2.1 declare a function that should wrap all definitions, i.e. all var
        // decls, functions, classes etc that get captured will be wrapped in this
        // function. When using this with the option.keepPreviouslyDeclaredValues
        // we will use a wrapping function that keeps the identity of prevously
        // defined objects
        options.declarationWrapper = member(id(options.varRecorderName), literal(declarationWrapperName), true);
        options.topLevelVarRecorder[declarationWrapperName] = declarationWrapperForKeepingValues;

        // Class declarations and expressions are converted into a function call
        // to `createOrExtendClass`, a helper that will produce (or extend an
        // existing) constructor function in a way that allows us to redefine
        // methods and properties of the class while keeping the class object
        // identical
        options.topLevelVarRecorder[defaultClassToFunctionConverterName] = createOrExtend;
        es6ClassToFunctionOptions = {
          currentModuleAccessor: options.currentModuleAccessor,
          classHolder: varRecorder,
          functionNode: member(varRecorder, defaultClassToFunctionConverterName),
          declarationWrapper: options.declarationWrapper
        };
      }

      // 2.2 Here we call out to the actual code transformation that installs the

      parsed = lively_ast.capturing.rewriteToCaptureTopLevelVariables(parsed, varRecorder, {
        es6ImportFuncId: options.es6ImportFuncId,
        es6ExportFuncId: options.es6ExportFuncId,
        ignoreUndeclaredExcept: undeclaredToTransform,
        exclude: blacklist,
        declarationWrapper: options.declarationWrapper || undefined,
        classToFunction: es6ClassToFunctionOptions
      });
    }

    if (options.wrapInStartEndCall) {
      parsed = lively_ast.transform.wrapInStartEndCall(parsed, {
        startFuncNode: options.startFuncNode,
        endFuncNode: options.endFuncNode
      });
    }

    var result = lively_ast.stringify(parsed);

    if (options.sourceURL) result += "\n//# sourceURL=" + options.sourceURL.replace(/\s/g, "_");

    return result;
  }

  function evalCodeTransformOfSystemRegisterSetters(code, options) {
    if (!options.topLevelVarRecorder) return code;

    var parsed = lively_ast.parse(code),
        blacklist = (options.dontTransform || []).concat(["arguments"]),
        undeclaredToTransform = !!options.recordGlobals ? null /*all*/ : lively_lang.arr.withoutAll(Object.keys(options.topLevelVarRecorder), blacklist),
        result = lively_ast.capturing.rewriteToRegisterModuleToCaptureSetters(parsed, id(options.varRecorderName || '__lvVarRecorder'), { exclude: blacklist });

    return lively_ast.stringify(result);
  }

  function declarationWrapperForKeepingValues(name, kind, value, recorder) {
    // show(`declaring ${name}, a ${kind}, value ${value}`);

    if (kind === "function") return value;
    if (kind === "class") {
      recorder[name] = value;
      return value;
    }

    // if (!value || typeof value !== "object" || Array.isArray(value) || value.constructor === RegExp)
    //   return value;

    // if (recorder.hasOwnProperty(name) && typeof recorder[name] === "object") {
    //   if (Object.isFrozen(recorder[name])) return value;
    //   try {
    //     copyProperties(value, recorder[name]);
    //     return recorder[name];
    //   } catch (e) {
    //     console.error(`declarationWrapperForKeepingValues: could not copy properties for object ${name}, won't keep identity of previously defined object!`)
    //     return value;
    //   }
    // }

    return value;
  }

  var defaultTopLevelVarRecorderName = '__lvVarRecorder';
  var startEvalFunctionName = "lively.vm-on-eval-start";
  var endEvalFunctionName = "lively.vm-on-eval-end";
  function _normalizeEvalOptions(opts) {
    if (!opts) opts = {};

    opts = Object.assign({
      targetModule: null,
      sourceURL: opts.targetModule,
      runtime: null,
      context: getGlobal(),
      varRecorderName: defaultTopLevelVarRecorderName,
      dontTransform: [], // blacklist vars
      recordGlobals: null,
      returnPromise: true,
      promiseTimeout: 200,
      waitForPromise: true,
      wrapInStartEndCall: false,
      onStartEval: null,
      onEndEval: null,
      keepPreviouslyDeclaredValues: true
    }, opts);

    if (opts.targetModule) {
      var moduleEnv = opts.runtime && opts.runtime.modules && opts.runtime.modules[opts.targetModule];
      if (moduleEnv) opts = Object.assign(opts, moduleEnv);
    }

    if (opts.wrapInStartEndCall) {
      opts.startFuncNode = {
        type: "MemberExpression",
        object: { type: "Identifier", name: opts.varRecorderName },
        property: { type: "Literal", value: startEvalFunctionName },
        computed: true
      };
      opts.endFuncNode = {
        type: "MemberExpression",
        object: { type: "Identifier", name: opts.varRecorderName },
        property: { type: "Literal", value: endEvalFunctionName },
        computed: true
      };
    }

    return opts;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // eval
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function getGlobal() {
    if (typeof System !== "undefined") return System.global;
    if (typeof window !== "undefined") return window;
    if (typeof global !== "undefined") return global;
    if (typeof Global !== "undefined") return Global;
    return function () {
      return this;
    }();
  }

  function _eval(__lvEvalStatement, __lvVarRecorder /*needed as arg for capturing*/) {
    return eval(__lvEvalStatement);
  }

  function vmRunEval(code, options, thenDo) {
    // The main function where all eval options are configured.
    // options can be: {
    //   runtime: {
    //     modules: {[MODULENAME: PerModuleOptions]}
    //   }
    // }
    // or directly, PerModuleOptions = {
    //   varRecorderName: STRING, // default is '__lvVarRecorder'
    //   topLevelVarRecorder: OBJECT,
    //   context: OBJECT,
    //   sourceURL: STRING,
    //   recordGlobals: BOOLEAN, // also transform free vars? default is false
    //   transpiler: FUNCTION(source, options) // for transforming the source after the lively xfm
    //   wrapInStartEndCall: BOOLEAN
    //   onStartEval: FUNCTION()?,
    //   onEndEval: FUNCTION(err, value)? // note: we pass in the value of last expr, not EvalResult!
    //   keepPreviouslyDeclaredValues: BOOLEAN // maintain the identity of objects that were declared before
    // }

    if (typeof options === 'function' && arguments.length === 2) {
      thenDo = options;options = null;
    }

    var warnings = [],
        result = new EvalResult(),
        returnedError,
        returnedValue,
        onEvalEndError,
        onEvalEndValue,
        onEvalStartCalled = false,
        onEvalEndCalled = false;
    options = _normalizeEvalOptions(options);

    // 1. In case we rewrite the code with on-start and on-end calls we prepare
    // the environment with actual function handlers that will get called once
    // the code is evaluated

    var evalDone = lively_lang.promise.deferred(),
        recorder = options.topLevelVarRecorder || getGlobal();

    if (options.wrapInStartEndCall) {
      if (recorder[startEvalFunctionName]) console.warn("startEvalFunctionName " + startEvalFunctionName + " already exists in recorder!");

      if (recorder[endEvalFunctionName]) console.warn("endEvalFunctionName " + endEvalFunctionName + " already exists in recorder!");

      recorder[startEvalFunctionName] = function () {
        if (onEvalStartCalled) {
          console.warn("onEvalStartCalled multiple times!");return;
        }
        onEvalStartCalled = true;
        if (typeof options.onStartEval === "function") options.onStartEval();
      };

      recorder[endEvalFunctionName] = function (err, value) {
        if (onEvalEndCalled) {
          console.warn("onEvalEndCalled multiple times!");return;
        }
        onEvalEndCalled = true;
        finishEval(err, value, result, options, recorder, evalDone, thenDo);
      };
    }

    // 2. Transform the code to capture top-level variables, inject function calls, ...
    try {
      code = evalCodeTransform(code, options);
      if (options.header) code = options.header + code;
      if (options.footer) code = code + options.footer;
      if (options.transpiler) code = options.transpiler(code, options.transpilerOptions);
      // console.log(code);
    } catch (e) {
      var warning = "lively.vm evalCodeTransform not working: " + (e.stack || e);
      console.warn(warning);
      warnings.push(warning);
    }

    // 3. Now really run eval!
    try {
      typeof $morph !== "undefined" && $morph('log') && ($morph('log').textString = code);
      returnedValue = _eval.call(options.context, code, options.topLevelVarRecorder);
    } catch (e) {
      returnedError = e;
    }

    // 4. Wrapping up: if we inject a on-eval-end call we let it handle the
    // wrap-up, otherwise we firectly call finishEval()
    if (options.wrapInStartEndCall) {
      if (returnedError && !onEvalEndCalled) recorder[endEvalFunctionName](returnedError, undefined);
    } else {
      finishEval(returnedError, returnedError || returnedValue, result, options, recorder, evalDone, thenDo);
    }

    return options.sync ? result : evalDone.promise;
  }

  function finishEval(err, value, result, options, recorder, evalDone, thenDo) {
    // 5. Here we end the evaluation. Note that if we are in sync mode we cannot
    // use any Promise since promises always run on next tick. That's why we have
    // to slightly duplicate the finish logic...

    if (options.wrapInStartEndCall) {
      delete recorder[startEvalFunctionName];
      delete recorder[endEvalFunctionName];
    }

    if (err) {
      result.isError = true;result.value = err;
    } else result.value = value;
    if (result.value instanceof Promise) result.isPromise = true;

    if (options.sync) {
      result.processSync(options);
      if (typeof options.onEndEval === "function") options.onEndEval(err, value);
    } else {
      result.process(options).then(function () {
        typeof thenDo === "function" && thenDo(null, result);
        typeof options.onEndEval === "function" && options.onEndEval(err, value);
        return result;
      }, function (err) {
        typeof thenDo === "function" && thenDo(err, undefined);
        typeof options.onEndEval === "function" && options.onEndEval(err, undefined);
        return result;
      }).then(evalDone.resolve, evalDone.reject);
    }
  }

  function syncEval$1(string, options) {
    // See #runEval for options.
    // Although the defaul eval is synchronous we assume that the general
    // evaluation might not return immediatelly. This makes is possible to
    // change the evaluation backend, e.g. to be a remotely attached runtime
    options = Object.assign(options || {}, { sync: true });
    return vmRunEval(string, options);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // EvalResult
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  var EvalResult = function () {
    function EvalResult() {
      classCallCheck(this, EvalResult);

      this.isEvalResult = true;
      this.value = undefined;
      this.warnings = [];
      this.isError = false;
      this.isPromise = false;
      this.promisedValue = undefined;
      this.promiseStatus = "unknown";
    }

    createClass(EvalResult, [{
      key: "printed",
      value: function printed(options) {
        this.value = print(this.value, Object.assign(options || {}, {
          isError: this.isError,
          isPromise: this.isPromise,
          promisedValue: this.promisedValue,
          promiseStatus: this.promiseStatus
        }));
      }
    }, {
      key: "processSync",
      value: function processSync(options) {
        if (options.inspect || options.asString) this.value = this.print(this.value, options);
        return this;
      }
    }, {
      key: "process",
      value: function process(options) {
        var result = this;
        if (result.isPromise && options.waitForPromise) {
          return tryToWaitForPromise(result, options.promiseTimeout).then(function () {
            if (options.inspect || options.asString) result.printed(options);
            return result;
          });
        }
        if (options.inspect || options.asString) result.printed(options);
        return Promise.resolve(result);
      }
    }]);
    return EvalResult;
  }();

  function tryToWaitForPromise(evalResult, timeoutMs) {
    console.assert(evalResult.isPromise, "no promise in tryToWaitForPromise???");
    var timeout = {},
        timeoutP = new Promise(function (resolve) {
      return setTimeout(resolve, timeoutMs, timeout);
    });
    return Promise.race([timeoutP, evalResult.value]).then(function (resolved) {
      return Object.assign(evalResult, resolved !== timeout ? { promiseStatus: "fulfilled", promisedValue: resolved } : { promiseStatus: "pending" });
    }).catch(function (rejected) {
      return Object.assign(evalResult, { promiseStatus: "rejected", promisedValue: rejected });
    });
  }

  function print(value, options) {
    if (options.isError || value instanceof Error) return String(value.stack || value);

    if (options.isPromise) {
      var status = lively_lang.string.print(options.promiseStatus),
          printed = options.promiseStatus === "pending" ? undefined : print(options.promisedValue, Object.assign(options || {}, { isPromise: false }));
      return "Promise({status: " + status + ", " + (value === undefined ? "" : "value: " + printed) + "})";
    }

    if (value instanceof Promise) return 'Promise({status: "unknown"})';

    if (options.inspect) return printInspect(value, options);

    // options.asString
    return String(value);
  }

  function printInspect(value, options) {
    var printDepth = options.printDepth || 2,
        customPrintInspect = lively_lang.Path("lively.morphic.printInspect").get(getGlobal()),
        customPrinter = customPrintInspect ? function (val, _) {
      return customPrintInspect(val, printDepth);
    } : undefined;
    return lively_lang.obj.inspect(value, { maxDepth: printDepth, customPrinter: customPrinter });
  }

  // import { moduleEnv } from "lively.modules/src/system.js";
  // import { recordDoitRequest, recordDoitResult } from "lively.modules/src/notify.js";

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // load support

  var ensureImportsAreLoaded = function () {
    var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(System, code, parentModule) {
      var body, imports;
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              // FIXME do we have to do a reparse? We should be able to get the ast from
              // the rewriter...
              body = lively_ast.parse(code).body, imports = body.filter(function (node) {
                return node.type === "ImportDeclaration";
              });
              return _context.abrupt("return", Promise.all(imports.map(function (node) {
                return System.normalize(node.source.value, parentModule).then(function (fullName) {
                  return System.get(fullName) || System.import(fullName);
                });
              })).catch(function (err) {
                console.error("Error ensuring imports: " + err.message);throw err;
              }));

            case 2:
            case "end":
              return _context.stop();
          }
        }
      }, _callee, this);
    }));

    return function ensureImportsAreLoaded(_x, _x2, _x3) {
      return _ref.apply(this, arguments);
    };
  }();

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // transpiler to make es next work

  var getEs6Transpiler = function () {
    var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2(System, options, env) {
      var babel, babelPluginPath, babelPath, babelPlugin;
      return regeneratorRuntime.wrap(function _callee2$(_context2) {
        while (1) {
          switch (_context2.prev = _context2.next) {
            case 0:
              if (!options.transpiler) {
                _context2.next = 2;
                break;
              }

              return _context2.abrupt("return", Promise.resolve(options.transpiler));

            case 2:
              if (options.es6Transpile) {
                _context2.next = 4;
                break;
              }

              return _context2.abrupt("return", Promise.resolve(null));

            case 4:
              if (!(System.transpiler === "babel")) {
                _context2.next = 12;
                break;
              }

              _context2.t0 = System.global[System.transpiler];

              if (_context2.t0) {
                _context2.next = 10;
                break;
              }

              _context2.next = 9;
              return System.import(System.transpiler);

            case 9:
              _context2.t0 = _context2.sent;

            case 10:
              babel = _context2.t0;
              return _context2.abrupt("return", babelTranspilerForAsyncAwaitCode(System, babel, options.targetModule, env));

            case 12:
              if (!(System.transpiler === "plugin-babel")) {
                _context2.next = 21;
                break;
              }

              _context2.next = 15;
              return System.normalize("plugin-babel");

            case 15:
              babelPluginPath = _context2.sent;
              babelPath = babelPluginPath.split("/").slice(0, -1).concat("systemjs-babel-browser.js").join("/");
              _context2.next = 19;
              return System.import(babelPath);

            case 19:
              babelPlugin = _context2.sent;
              return _context2.abrupt("return", babelPluginTranspilerForAsyncAwaitCode(System, babelPlugin, options.targetModule, env));

            case 21:
              throw new Error("Sorry, currently only babel is supported as es6 transpiler for runEval!");

            case 22:
            case "end":
              return _context2.stop();
          }
        }
      }, _callee2, this);
    }));

    return function getEs6Transpiler(_x4, _x5, _x6) {
      return _ref2.apply(this, arguments);
    };
  }();

  var funcCall = lively_ast.nodes.funcCall;
  var member$1 = lively_ast.nodes.member;
  var literal$1 = lively_ast.nodes.literal;


  function babelTranspilerForAsyncAwaitCode(System, babel, filename, env) {
    // The function wrapper is needed b/c we need toplevel awaits and babel
    // converts "this" => "undefined" for modules
    return function (source, options) {
      options = Object.assign({
        sourceMap: undefined, // 'inline' || true || false
        inputSourceMap: undefined,
        filename: filename,
        code: true,
        ast: false
      }, options);
      var sourceForBabel = "(async function(__rec) {\n" + source + "\n}).call(this);",
          transpiled = babel.transform(sourceForBabel, options).code;
      transpiled = transpiled.replace(/\}\)\.call\(undefined\);$/, "}).call(this)");
      return transpiled;
    };
  }

  function babelPluginTranspilerForAsyncAwaitCode(System, babelWrapper, filename, env) {

    // The function wrapper is needed b/c we need toplevel awaits and babel
    // converts "this" => "undefined" for modules
    return function (source, options) {
      var babelOptions = System.babelOptions || {},
          presets = [];
      presets.push(babelWrapper.presetES2015);
      if (babelOptions.stage3) presets.push({ plugins: babelWrapper.pluginsStage3 });
      if (babelOptions.stage2) presets.push({ plugins: babelWrapper.pluginsStage2 });
      if (babelOptions.stage1) presets.push({ plugins: babelWrapper.pluginsStage1 });

      options = Object.assign({
        sourceMap: undefined, // 'inline' || true || false
        inputSourceMap: undefined,
        filename: filename,
        babelrc: false,
        // plugins: plugins,
        presets: presets,
        moduleIds: false,
        code: true,
        ast: false
      }, options);
      var sourceForBabel = "(async function(__rec) {\n" + source + "\n}).call(this);",
          transpiled = babelWrapper.babel.transform(sourceForBabel, options).code;
      transpiled = transpiled.replace(/\}\)\.call\(undefined\);$/, "}).call(this)");
      return transpiled;
    };
  }

  var runEval$1 = function () {
    var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3(System, code, options) {
      var originalCode, fullname, env, recorder, recorderName, dontTransform, transpiler, header, result;
      return regeneratorRuntime.wrap(function _callee3$(_context3) {
        while (1) {
          switch (_context3.prev = _context3.next) {
            case 0:
              options = lively_lang.obj.merge({
                targetModule: null, parentModule: null,
                parentAddress: null,
                es6Transpile: true,
                transpiler: null, // function with params: source, options
                transpilerOptions: null
              }, options);
              originalCode = code;


              System.debug && console.log("[lively.module] runEval: " + code.slice(0, 100).replace(/\n/mg, " ") + "...");

              _context3.next = 5;
              return System.normalize(options.targetModule || "*scratch*", options.parentModule, options.parentAddress);

            case 5:
              fullname = _context3.sent;

              options.targetModule = fullname;

              _context3.next = 9;
              return System.import(fullname);

            case 9:
              _context3.next = 11;
              return ensureImportsAreLoaded(System, code, fullname);

            case 11:
              env = System.get("@lively-env").moduleEnv(fullname);
              recorder = env.recorder;
              recorderName = env.recorderName;
              dontTransform = env.dontTransform;
              _context3.next = 17;
              return getEs6Transpiler(System, options, env);

            case 17:
              transpiler = _context3.sent;
              header = "var _moduleExport = " + recorderName + "._moduleExport,\n" + ("    _moduleImport = " + recorderName + "._moduleImport;\n");


              code = header + code;
              options = Object.assign({ waitForPromise: true }, options, {
                recordGlobals: true,
                dontTransform: dontTransform,
                varRecorderName: recorderName,
                topLevelVarRecorder: recorder,
                sourceURL: options.sourceURL || options.targetModule,
                context: options.context || recorder,
                wrapInStartEndCall: true, // for async / await eval support
                es6ExportFuncId: "_moduleExport",
                es6ImportFuncId: "_moduleImport",
                transpiler: transpiler,
                currentModuleAccessor: funcCall(member$1(funcCall(member$1("System", "get"), literal$1("@lively-env")), "moduleEnv"), literal$1(options.targetModule))
              });

              System.debug && console.log("[lively.module] runEval in module " + fullname + " started");

              // console.warn("FIX recordDoitRequest")
              // recordDoitRequest(
              //   System, originalCode,
              //   {waitForPromise: options.waitForPromise, targetModule: options.targetModule},
              //   Date.now());

              _context3.next = 24;
              return vmRunEval(code, options);

            case 24:
              result = _context3.sent;


              System.get("@lively-env").evaluationDone(fullname);
              System.debug && console.log("[lively.module] runEval in module " + fullname + " done");
              // console.warn("FIX recordDoitResult")

              // recordDoitResult(
              //   System, originalCode,
              //   {waitForPromise: options.waitForPromise, targetModule: options.targetModule},
              //   result, Date.now());
              return _context3.abrupt("return", result);

            case 28:
            case "end":
              return _context3.stop();
          }
        }
      }, _callee3, this);
    }));

    return function runEval(_x7, _x8, _x9) {
      return _ref3.apply(this, arguments);
    };
  }();

  var _EvalableTextMorphTra;

  var EvalStrategy = function () {
    function EvalStrategy() {
      classCallCheck(this, EvalStrategy);
    }

    createClass(EvalStrategy, [{
      key: "runEval",
      value: function () {
        var _ref = asyncToGenerator(regeneratorRuntime.mark(function _callee(source, options) {
          return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
              switch (_context.prev = _context.next) {
                case 0:
                  return _context.abrupt("return", Promise.reject("runEval(source, options) not yet implemented for " + this.constructor.name));

                case 1:
                case "end":
                  return _context.stop();
              }
            }
          }, _callee, this);
        }));

        function runEval(_x, _x2) {
          return _ref.apply(this, arguments);
        }

        return runEval;
      }()
    }, {
      key: "keysOfObject",
      value: function () {
        var _ref2 = asyncToGenerator(regeneratorRuntime.mark(function _callee2(prefix, options) {
          return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
              switch (_context2.prev = _context2.next) {
                case 0:
                  return _context2.abrupt("return", Promise.reject("keysOfObject(prefix, options) not yet implemented for " + this.constructor.name));

                case 1:
                case "end":
                  return _context2.stop();
              }
            }
          }, _callee2, this);
        }));

        function keysOfObject(_x3, _x4) {
          return _ref2.apply(this, arguments);
        }

        return keysOfObject;
      }()
    }]);
    return EvalStrategy;
  }();

  var SimpleEvalStrategy = function (_EvalStrategy) {
    inherits(SimpleEvalStrategy, _EvalStrategy);

    function SimpleEvalStrategy() {
      classCallCheck(this, SimpleEvalStrategy);
      return possibleConstructorReturn(this, Object.getPrototypeOf(SimpleEvalStrategy).apply(this, arguments));
    }

    createClass(SimpleEvalStrategy, [{
      key: "runEval",
      value: function () {
        var _ref3 = asyncToGenerator(regeneratorRuntime.mark(function _callee3(source, options) {
          return regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
              switch (_context3.prev = _context3.next) {
                case 0:
                  return _context3.abrupt("return", Promise.resolve().then(function () {
                    try {
                      return Promise.resolve({ value: eval(source) });
                    } catch (err) {
                      return { isError: true, value: err };
                    }
                  }));

                case 1:
                case "end":
                  return _context3.stop();
              }
            }
          }, _callee3, this);
        }));

        function runEval(_x5, _x6) {
          return _ref3.apply(this, arguments);
        }

        return runEval;
      }()
    }, {
      key: "keysOfObject",
      value: function () {
        var _ref4 = asyncToGenerator(regeneratorRuntime.mark(function _callee4(prefix, options) {
          var _this2 = this;

          var result;
          return regeneratorRuntime.wrap(function _callee4$(_context4) {
            while (1) {
              switch (_context4.prev = _context4.next) {
                case 0:
                  _context4.next = 2;
                  return lively.vm.completions.getCompletions(function (code) {
                    return _this2.runEval(code, options);
                  }, prefix);

                case 2:
                  result = _context4.sent;
                  return _context4.abrupt("return", { completions: result.completions, prefix: result.startLetters });

                case 4:
                case "end":
                  return _context4.stop();
              }
            }
          }, _callee4, this);
        }));

        function keysOfObject(_x7, _x8) {
          return _ref4.apply(this, arguments);
        }

        return keysOfObject;
      }()
    }]);
    return SimpleEvalStrategy;
  }(EvalStrategy);

  var LivelyVmEvalStrategy = function (_EvalStrategy2) {
    inherits(LivelyVmEvalStrategy, _EvalStrategy2);

    function LivelyVmEvalStrategy() {
      classCallCheck(this, LivelyVmEvalStrategy);
      return possibleConstructorReturn(this, Object.getPrototypeOf(LivelyVmEvalStrategy).apply(this, arguments));
    }

    createClass(LivelyVmEvalStrategy, [{
      key: "normalizeOptions",
      value: function normalizeOptions(options) {
        if (!options.targetModule) throw new Error("runEval called but options.targetModule not specified!");

        return Object.assign({
          sourceURL: options.targetModule + "_doit_" + Date.now(),
          keepPreviouslyDeclaredValues: true
        }, options);
      }
    }, {
      key: "runEval",
      value: function () {
        var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee5(source, options) {
          var conf;
          return regeneratorRuntime.wrap(function _callee5$(_context5) {
            while (1) {
              switch (_context5.prev = _context5.next) {
                case 0:
                  options = this.normalizeOptions(options);
                  conf = { meta: {} };
                  conf.meta[options.targetModule] = { format: "esm" };
                  lively.modules.System.config(conf);
                  return _context5.abrupt("return", lively.vm.runEval(source, options));

                case 5:
                case "end":
                  return _context5.stop();
              }
            }
          }, _callee5, this);
        }));

        function runEval(_x9, _x10) {
          return _ref5.apply(this, arguments);
        }

        return runEval;
      }()
    }, {
      key: "keysOfObject",
      value: function () {
        var _ref6 = asyncToGenerator(regeneratorRuntime.mark(function _callee6(prefix, options) {
          var result;
          return regeneratorRuntime.wrap(function _callee6$(_context6) {
            while (1) {
              switch (_context6.prev = _context6.next) {
                case 0:
                  _context6.next = 2;
                  return lively.vm.completions.getCompletions(function (code) {
                    return lively.vm.runEval(code, options);
                  }, prefix);

                case 2:
                  result = _context6.sent;
                  return _context6.abrupt("return", { completions: result.completions, prefix: result.startLetters });

                case 4:
                case "end":
                  return _context6.stop();
              }
            }
          }, _callee6, this);
        }));

        function keysOfObject(_x11, _x12) {
          return _ref6.apply(this, arguments);
        }

        return keysOfObject;
      }()
    }]);
    return LivelyVmEvalStrategy;
  }(EvalStrategy);

  var HttpEvalStrategy = function (_LivelyVmEvalStrategy) {
    inherits(HttpEvalStrategy, _LivelyVmEvalStrategy);
    createClass(HttpEvalStrategy, null, [{
      key: "defaultURL",
      get: function get() {
        return "http://localhost:3000/lively";
      }
    }]);

    function HttpEvalStrategy(url) {
      classCallCheck(this, HttpEvalStrategy);

      var _this4 = possibleConstructorReturn(this, Object.getPrototypeOf(HttpEvalStrategy).call(this));

      _this4.url = url || _this4.constructor.defaultURL;
      return _this4;
    }

    createClass(HttpEvalStrategy, [{
      key: "normalizeOptions",
      value: function normalizeOptions(options) {
        options = get(Object.getPrototypeOf(HttpEvalStrategy.prototype), "normalizeOptions", this).call(this, options);
        return Object.assign({ serverEvalURL: this.url }, options, { context: null });
      }
    }, {
      key: "sourceForServer",
      value: function sourceForServer(action, arg, options) {
        return "\n(function() {\n  var arg = " + JSON.stringify(arg) + ",\n      options = " + JSON.stringify(options) + ";\n  options.context = System.global;\n  function evalFunction(source, options) {\n    var conf = {meta: {}}; conf.meta[options.targetModule] = {format: \"esm\"};\n    lively.modules.System.config(conf);\n    return lively.vm.runEval(source, options);\n  }\n  function keysOfObjectFunction(prefix, options) {\n    return lively.vm.completions.getCompletions(code => evalFunction(code, options), prefix)\n      .then(result => ({completions: result.completions, prefix: result.startLetters}));\n  }\n  options.asString = " + (action === "eval" ? "true" : "false") + ";\n  return " + (action === "eval" ? "evalFunction" : "keysOfObjectFunction") + "(arg, options)\n    .catch(err => ({isError: true, value: String(err.stack || err)}));\n})();\n";
      }
    }, {
      key: "sendRequest",
      value: function () {
        var _ref7 = asyncToGenerator(regeneratorRuntime.mark(function _callee7(payload, url) {
          var method, content;
          return regeneratorRuntime.wrap(function _callee7$(_context7) {
            while (1) {
              switch (_context7.prev = _context7.next) {
                case 0:
                  method = "sendRequest" + (System.get("@system-env").node ? "_node" : "_web");
                  _context7.next = 3;
                  return this[method](payload, url);

                case 3:
                  content = _context7.sent;
                  _context7.prev = 4;
                  return _context7.abrupt("return", JSON.parse(content));

                case 8:
                  _context7.prev = 8;
                  _context7.t0 = _context7["catch"](4);
                  return _context7.abrupt("return", { isError: true, value: "Server eval failed: " + content });

                case 11:
                case "end":
                  return _context7.stop();
              }
            }
          }, _callee7, this, [[4, 8]]);
        }));

        function sendRequest(_x13, _x14) {
          return _ref7.apply(this, arguments);
        }

        return sendRequest;
      }()
    }, {
      key: "sendRequest_web",
      value: function () {
        var _ref8 = asyncToGenerator(regeneratorRuntime.mark(function _callee8(payload, url) {
          var res;
          return regeneratorRuntime.wrap(function _callee8$(_context8) {
            while (1) {
              switch (_context8.prev = _context8.next) {
                case 0:
                  _context8.prev = 0;
                  _context8.next = 3;
                  return window.fetch(url, payload);

                case 3:
                  res = _context8.sent;
                  _context8.next = 9;
                  break;

                case 6:
                  _context8.prev = 6;
                  _context8.t0 = _context8["catch"](0);
                  throw new Error("Cannot reach server at " + url + ": " + _context8.t0.message);

                case 9:
                  if (res.ok) {
                    _context8.next = 11;
                    break;
                  }

                  throw new Error("Server at " + url + ": " + res.statusText);

                case 11:
                  return _context8.abrupt("return", res.text());

                case 12:
                case "end":
                  return _context8.stop();
              }
            }
          }, _callee8, this, [[0, 6]]);
        }));

        function sendRequest_web(_x15, _x16) {
          return _ref8.apply(this, arguments);
        }

        return sendRequest_web;
      }()
    }, {
      key: "sendRequest_node",
      value: function () {
        var _ref9 = asyncToGenerator(regeneratorRuntime.mark(function _callee9(payload, url) {
          var urlParse, http, opts;
          return regeneratorRuntime.wrap(function _callee9$(_context9) {
            while (1) {
              switch (_context9.prev = _context9.next) {
                case 0:
                  urlParse = System._nodeRequire("url").parse, http = System._nodeRequire("http"), opts = Object.assign({ method: payload.method || "GET" }, urlParse(url));
                  return _context9.abrupt("return", new Promise(function (resolve, reject) {
                    var request = http.request(opts, function (res) {
                      res.setEncoding('utf8');
                      var data = "";
                      res.on('data', function (chunk) {
                        return data += chunk;
                      });
                      res.on('end', function () {
                        return resolve(data);
                      });
                      res.on('error', function (err) {
                        return reject(err);
                      });
                    });
                    request.on('error', function (err) {
                      return reject(err);
                    });
                    request.end(payload.body);
                  }));

                case 2:
                case "end":
                  return _context9.stop();
              }
            }
          }, _callee9, this);
        }));

        function sendRequest_node(_x17, _x18) {
          return _ref9.apply(this, arguments);
        }

        return sendRequest_node;
      }()
    }, {
      key: "runEval",
      value: function () {
        var _ref10 = asyncToGenerator(regeneratorRuntime.mark(function _callee10(source, options) {
          var payLoad;
          return regeneratorRuntime.wrap(function _callee10$(_context10) {
            while (1) {
              switch (_context10.prev = _context10.next) {
                case 0:
                  options = this.normalizeOptions(options);
                  payLoad = { method: "POST", body: this.sourceForServer("eval", source, options) };
                  return _context10.abrupt("return", this.sendRequest(payLoad, options.serverEvalURL));

                case 3:
                case "end":
                  return _context10.stop();
              }
            }
          }, _callee10, this);
        }));

        function runEval(_x19, _x20) {
          return _ref10.apply(this, arguments);
        }

        return runEval;
      }()
    }, {
      key: "keysOfObject",
      value: function () {
        var _ref11 = asyncToGenerator(regeneratorRuntime.mark(function _callee11(prefix, options) {
          var payLoad, result;
          return regeneratorRuntime.wrap(function _callee11$(_context11) {
            while (1) {
              switch (_context11.prev = _context11.next) {
                case 0:
                  options = this.normalizeOptions(options);
                  payLoad = { method: "POST", body: this.sourceForServer("keysOfObject", prefix, options) };
                  _context11.next = 4;
                  return this.sendRequest(payLoad, options.serverEvalURL);

                case 4:
                  result = _context11.sent;

                  if (!result.isError) {
                    _context11.next = 7;
                    break;
                  }

                  throw new Error(result.value);

                case 7:
                  return _context11.abrupt("return", result);

                case 8:
                case "end":
                  return _context11.stop();
              }
            }
          }, _callee11, this);
        }));

        function keysOfObject(_x21, _x22) {
          return _ref11.apply(this, arguments);
        }

        return keysOfObject;
      }()
    }]);
    return HttpEvalStrategy;
  }(LivelyVmEvalStrategy);

  function evalStrategy(morph) {
    return morph.state && morph.state.evalStrategy || new LivelyVmEvalStrategy();
  }

  var EvalableTextMorphTrait = (_EvalableTextMorphTra = {
    applyTo: function applyTo(obj) {
      var overrides = arguments.length <= 1 || arguments[1] === undefined ? [] : arguments[1];

      var trait = this,
          dontCopy = ["applyTo"].concat(lively.lang.arr.withoutAll(lively.lang.properties.allProperties(obj), overrides));
      Object.keys(trait).filter(function (key) {
        return !dontCopy.includes(key);
      }).forEach(function (key) {
        return Object.defineProperty(obj, key, { configurable: true, get: function get() {
            return trait[key];
          }
        });
      });
      return obj;
    },
    doit: function doit(printResult, editor, options) {
      var _this5 = this;

      return asyncToGenerator(regeneratorRuntime.mark(function _callee12() {
        var result;
        return regeneratorRuntime.wrap(function _callee12$(_context12) {
          while (1) {
            switch (_context12.prev = _context12.next) {
              case 0:
                _context12.prev = 0;

                options = Object.assign({
                  inspect: !printResult,
                  printDepth: _this5.printInspectMaxDepth,
                  targetModule: _this5.moduleId(),
                  context: _this5
                }, options);
                _context12.next = 4;
                return evalStrategy(_this5).runEval(_this5.getCodeForEval(), options);

              case 4:
                result = _context12.sent;

                if (printResult) {
                  _this5.printObject(editor, result.value, false, _this5.getPrintItAsComment());
                } else {
                  _this5.setStatusMessage(result.value);
                }
                _this5.onDoitDone(result);
                return _context12.abrupt("return", result);

              case 10:
                _context12.prev = 10;
                _context12.t0 = _context12["catch"](0);
                _this5.showError(_context12.t0);throw _context12.t0;

              case 14:
              case "end":
                return _context12.stop();
            }
          }
        }, _callee12, _this5, [[0, 10]]);
      }))();
    },
    printInspect: function printInspect(options) {
      var _this6 = this;

      return asyncToGenerator(regeneratorRuntime.mark(function _callee13() {
        var msgMorph, ed;
        return regeneratorRuntime.wrap(function _callee13$(_context13) {
          while (1) {
            switch (_context13.prev = _context13.next) {
              case 0:
                options = options || {};
                msgMorph = _this6._statusMorph;
                _context13.next = 4;
                return new Promise(function (resolve, reject) {
                  return _this6.withAceDo(resolve);
                });

              case 4:
                ed = _context13.sent;

                if (!(msgMorph && msgMorph.world())) {
                  _context13.next = 7;
                  break;
                }

                return _context13.abrupt("return", ed.execCommand('insertEvalResult'));

              case 7:
                return _context13.abrupt("return", _this6.doit(true, ed, { inspect: true, printDepth: options.depth || _this6.printInspectMaxDepth }));

              case 8:
              case "end":
                return _context13.stop();
            }
          }
        }, _callee13, _this6);
      }))();
    },
    evalSelection: function evalSelection(printIt) {
      var _this7 = this;

      return asyncToGenerator(regeneratorRuntime.mark(function _callee14() {
        var options, result;
        return regeneratorRuntime.wrap(function _callee14$(_context14) {
          while (1) {
            switch (_context14.prev = _context14.next) {
              case 0:
                options = { context: _this7, targetModule: _this7.moduleId(), asString: !!printIt };
                _context14.next = 3;
                return evalStrategy(_this7).runEval(_this7.getCodeForEval(), options);

              case 3:
                result = _context14.sent;

                if (printIt) _this7.insertAtCursor(result.value, true);
                return _context14.abrupt("return", result);

              case 6:
              case "end":
                return _context14.stop();
            }
          }
        }, _callee14, _this7);
      }))();
    },
    doListProtocol: function doListProtocol() {
      var _this8 = this;

      return asyncToGenerator(regeneratorRuntime.mark(function _callee15() {
        var m, prefix, completions, lister;
        return regeneratorRuntime.wrap(function _callee15$(_context15) {
          while (1) {
            switch (_context15.prev = _context15.next) {
              case 0:
                _context15.prev = 0;
                m = lively.module("lively.ide.codeeditor.Completions");

                if (m.isLoaded()) {
                  _context15.next = 5;
                  break;
                }

                _context15.next = 5;
                return m.load();

              case 5:
                prefix = _this8.getCodeForCompletions();
                _context15.next = 8;
                return evalStrategy(_this8).keysOfObject(prefix, { context: _this8, targetModule: _this8.moduleId() });

              case 8:
                completions = _context15.sent;
                lister = new lively.ide.codeeditor.Completions.ProtocolLister(_this8);

                lister.openNarrower(completions);
                return _context15.abrupt("return", lister);

              case 14:
                _context15.prev = 14;
                _context15.t0 = _context15["catch"](0);
                _this8.showError(_context15.t0);
              case 17:
              case "end":
                return _context15.stop();
            }
          }
        }, _callee15, _this8, [[0, 14]]);
      }))();
    },
    doSave: function doSave() {
      var _this9 = this;

      return asyncToGenerator(regeneratorRuntime.mark(function _callee16() {
        return regeneratorRuntime.wrap(function _callee16$(_context16) {
          while (1) {
            switch (_context16.prev = _context16.next) {
              case 0:
                _this9.savedTextString = _this9.textString;

                if (!_this9.getEvalOnSave()) {
                  _context16.next = 10;
                  break;
                }

                _context16.prev = 2;
                _context16.next = 5;
                return lively.modules.moduleSourceChange(_this9.moduleId(), _this9.textString);

              case 5:
                _context16.next = 10;
                break;

              case 7:
                _context16.prev = 7;
                _context16.t0 = _context16["catch"](2);
                return _context16.abrupt("return", _this9.showError(_context16.t0));

              case 10:
                _this9.onSaveDone();

              case 11:
              case "end":
                return _context16.stop();
            }
          }
        }, _callee16, _this9, [[2, 7]]);
      }))();
    },
    onDoitDone: function onDoitDone(result) {},
    onSaveDone: function onSaveDone() {},
    getAllCode: function getAllCode() {
      throw new Error("getAllCode() not yet implemented for " + this.constructor.name);
    },
    getCodeForEval: function getCodeForEval() {
      throw new Error("getCodeForEval() not yet implemented for " + this.constructor.name);
    },
    getCodeForCompletions: function getCodeForCompletions() {
      throw new Error("getCodeForCompletions() not yet implemented for " + this.constructor.name);
    },
    moduleId: function moduleId() {
      throw new Error("moduleId() not yet implemented for " + this.constructor.name);
    },
    printObject: function printObject() {
      throw new Error("printObject() not yet implemented for " + this.constructor.name);
    },
    getPrintItAsComment: function getPrintItAsComment() {
      throw new Error("getPrintItAsComment() not yet implemented for " + this.constructor.name);
    },
    insertAtCursor: function insertAtCursor() {
      throw new Error("insertAtCursor() not yet implemented for " + this.constructor.name);
    },
    setStatusMessage: function setStatusMessage() {
      throw new Error("setStatusMessage() not yet implemented for " + this.constructor.name);
    }
  }, defineProperty(_EvalableTextMorphTra, "setStatusMessage", function setStatusMessage() {
    throw new Error("setStatusMessage() not yet implemented for " + this.constructor.name);
  }), defineProperty(_EvalableTextMorphTra, "showError", function showError() {
    throw new Error("showError() not yet implemented for " + this.constructor.name);
  }), _EvalableTextMorphTra);



  var evalStrategies = Object.freeze({
    EvalStrategy: EvalStrategy,
    SimpleEvalStrategy: SimpleEvalStrategy,
    LivelyVmEvalStrategy: LivelyVmEvalStrategy,
    HttpEvalStrategy: HttpEvalStrategy,
    EvalableTextMorphTrait: EvalableTextMorphTrait
  });

  function runEval(code, options) {
    options = Object.assign({
      format: "global",
      System: null,
      targetModule: null
    }, options);

    var S = options.System || typeof System !== "undefined" && System;
    if (!S && options.targetModule) {
      return Promise.reject(new Error("options to runEval have targetModule but cannot find system loader!"));
    }

    return options.targetModule ? runEval$1(options.System || System, code, options) : vmRunEval(code, options);
  }

  function syncEval(code, options) {
    return syncEval$1(code, options);
  }

  exports.completions = completions;
  exports.runEval = runEval;
  exports.syncEval = syncEval;
  exports.evalStrategies = evalStrategies;
  exports.defaultTopLevelVarRecorderName = defaultTopLevelVarRecorderName;
  exports.evalCodeTransform = evalCodeTransform;
  exports.evalCodeTransformOfSystemRegisterSetters = evalCodeTransformOfSystemRegisterSetters;

}((this.lively.vm = this.lively.vm || {}),lively.lang,lively.ast));
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.vm;
})();