(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  this.lively = this.lively || {};
(function (exports,lively_lang,lively_ast,lively_sourceTransform,lively_classes,lively_notifications) {
'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj$$1) {
  return typeof obj$$1;
} : function (obj$$1) {
  return obj$$1 && typeof Symbol === "function" && obj$$1.constructor === Symbol && obj$$1 !== Symbol.prototype ? "symbol" : typeof obj$$1;
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
            step("next", value);
          }, function (err) {
            step("throw", err);
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















var toConsumableArray = function (arr$$1) {
  if (Array.isArray(arr$$1)) {
    for (var i = 0, arr2 = Array(arr$$1.length); i < arr$$1.length; i++) arr2[i] = arr$$1[i];

    return arr2;
  } else {
    return Array.from(arr$$1);
  }
};

/*global require, __dirname*/

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

function safeToString(value) {
  if (!value) return String(value);
  if (Array.isArray(value)) return '[' + value.map(safeToString).join(",") + ']';
  if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) === "symbol") return printSymbolForCompletion(value);
  try {
    return String(value);
  } catch (e) {
    throw new Error('Cannot print object: ' + e.stack);
  }
}

function propertyExtract(excludes, obj$$1, extractor) {
  return Object.getOwnPropertyNames(obj$$1).concat(Object.getOwnPropertySymbols(obj$$1).map(printSymbolForCompletion)).filter(function (key) {
    return excludes.indexOf(key) === -1;
  }).map(extractor).filter(function (ea) {
    return !!ea;
  }).sort(function (a, b) {
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
}

function getMethodsOf(excludes, obj$$1) {
  return propertyExtract(excludes, obj$$1, function (key) {
    if (obj$$1.__lookupGetter__ && obj$$1.__lookupGetter__(key) || typeof obj$$1[key] !== 'function') return null;
    return { name: key, completion: signatureOf(key, obj$$1[key]) };
  });
}

function getAttributesOf(excludes, obj$$1) {
  return propertyExtract(excludes, obj$$1, function (key) {
    if (obj$$1.__lookupGetter__ && !obj$$1.__lookupGetter__(key) && typeof obj$$1[key] === 'function') return null;
    return { name: key, completion: key };
  });
}

function getProtoChain(obj$$1) {
  var protos = [],
      proto = obj$$1;
  while (obj$$1) {
    protos.push(obj$$1);obj$$1 = obj$$1.__proto__;
  }
  return protos;
}

function getDescriptorOf(originalObj, proto) {
  function shorten(s, len) {
    if (s.length > len) s = s.slice(0, len) + '...';
    return s.replace(/\n/g, '').replace(/\s+/g, ' ');
  }

  if (originalObj === proto) {
    if (typeof originalObj !== 'function') return shorten(safeToString(originalObj), 50);
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

function descriptorsOfObjAndProtoProperties(obj$$1) {
  var excludes = [],
      completions = getProtoChain(obj$$1).map(function (proto) {
    var descr = getDescriptorOf(obj$$1, proto),
        methodsAndAttributes = getMethodsOf(excludes, proto).concat(getAttributesOf(excludes, proto));
    excludes = excludes.concat(pluck(methodsAndAttributes, 'name'));
    return [descr, pluck(methodsAndAttributes, 'completion')];
  });
  return completions;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// the main deal
function getCompletions(evalFunc, string$$1, thenDo) {
  // thendo = function(err, completions/*ARRAY*/)
  // eval string and for the resulting object find attributes and methods,
  // grouped by its prototype / class chain
  // if string is something like "foo().bar.baz" then treat "baz" as start
  // letters = filter for properties of foo().bar
  // ("foo().bar.baz." for props of the result of the complete string)
  var promise$$1 = getObjectForCompletion(evalFunc, string$$1).then(function (evalResultAndStartLetters) {
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
    promise$$1.then(function (result) {
      return thenDo(null, result);
    }).catch(function (err) {
      return thenDo(err);
    });
  }
  return promise$$1;
}



var completions = Object.freeze({
	getCompletions: getCompletions
});

var id = lively_ast.nodes.id;
var literal = lively_ast.nodes.literal;
var member = lively_ast.nodes.member;


var defaultDeclarationWrapperName = "lively.capturing-declaration-wrapper";
var defaultClassToFunctionConverterName = "initializeES6ClassForLively";

function evalCodeTransform(code, options) {
  // variable declaration and references in the the source code get
  // transformed so that they are bound to `varRecorderName` aren't local
  // state. THis makes it possible to capture eval results, e.g. for
  // inspection, watching and recording changes, workspace vars, and
  // incrementally evaluating var declarations and having values bound later.

  // 1. Allow evaluation of function expressions and object literals
  code = lively_ast.transform.transformSingleExpression(code);
  var parsed = lively_ast.parse(code);

  // 2. Annotate definitions with code location. This is being used by the
  // function-wrapper-source transform.

  var _query$topLevelDeclsA = lively_ast.query.topLevelDeclsAndRefs(parsed),
      classDecls = _query$topLevelDeclsA.classDecls,
      funcDecls = _query$topLevelDeclsA.funcDecls,
      varDecls = _query$topLevelDeclsA.varDecls,
      annotation = {};

  if (options.hasOwnProperty("evalId")) annotation.evalId = options.evalId;
  if (options.sourceAccessorName) annotation.sourceAccessorName = options.sourceAccessorName;
  [].concat(toConsumableArray(classDecls), toConsumableArray(funcDecls)).forEach(function (node) {
    return node["x-lively-object-meta"] = _extends({}, annotation, { start: node.start, end: node.end });
  });
  varDecls.forEach(function (node) {
    return node.declarations.forEach(function (decl) {
      return decl["x-lively-object-meta"] = _extends({}, annotation, { start: decl.start, end: decl.end });
    });
  });

  // transforming experimental ES features into accepted es6 form...
  parsed = lively_ast.transform.objectSpreadTransform(parsed);

  // 3. capture top level vars into topLevelVarRecorder "environment"

  if (options.topLevelVarRecorder) {

    // capture and wrap logic
    var blacklist = (options.dontTransform || []).concat(["arguments"]),
        undeclaredToTransform = !!options.recordGlobals ? null /*all*/ : lively_lang.arr.withoutAll(Object.keys(options.topLevelVarRecorder), blacklist),
        varRecorder = id(options.varRecorderName || '__lvVarRecorder'),
        es6ClassToFunctionOptions = undefined;

    if (options.declarationWrapperName || typeof options.declarationCallback === "function") {
      // 2.1 declare a function that wraps all definitions, i.e. all var
      // decls, functions, classes etc that get captured will be wrapped in this
      // function. This allows to define some behavior that is run whenever
      // variables get initialized or changed as well as transform values.
      // The parameters passed are:
      //   name, kind, value, recorder
      // Note that the return value of declarationCallback is used as the
      // actual value in the code being executed. This allows to transform the
      // value as necessary but also means that declarationCallback needs to
      // return sth meaningful!
      var declarationWrapperName = options.declarationWrapperName || defaultDeclarationWrapperName;

      options.declarationWrapper = member(id(options.varRecorderName || '__lvVarRecorder'), literal(declarationWrapperName), true);

      if (options.declarationCallback) options.topLevelVarRecorder[declarationWrapperName] = options.declarationCallback;
    }

    var transformES6Classes = options.hasOwnProperty("transformES6Classes") ? options.transformES6Classes : true;
    if (transformES6Classes) {
      // Class declarations and expressions are converted into a function call
      // to `createOrExtendClass`, a helper that will produce (or extend an
      // existing) constructor function in a way that allows us to redefine
      // methods and properties of the class while keeping the class object
      // identical
      if (!(defaultClassToFunctionConverterName in options.topLevelVarRecorder)) options.topLevelVarRecorder[defaultClassToFunctionConverterName] = lively_classes.runtime.initializeClass;
      es6ClassToFunctionOptions = {
        currentModuleAccessor: options.currentModuleAccessor,
        classHolder: varRecorder,
        functionNode: member(varRecorder, defaultClassToFunctionConverterName),
        declarationWrapper: options.declarationWrapper,
        evalId: options.evalId,
        sourceAccessorName: options.sourceAccessorName
      };
    }

    // 3.2 Here we call out to the actual code transformation that installs the
    parsed = lively_sourceTransform.capturing.rewriteToCaptureTopLevelVariables(parsed, varRecorder, {
      es6ImportFuncId: options.es6ImportFuncId,
      es6ExportFuncId: options.es6ExportFuncId,
      ignoreUndeclaredExcept: undeclaredToTransform,
      exclude: blacklist,
      declarationWrapper: options.declarationWrapper || undefined,
      classToFunction: es6ClassToFunctionOptions,
      evalId: options.evalId,
      sourceAccessorName: options.sourceAccessorName
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

function evalCodeTransformOfSystemRegisterSetters(code) {
  var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

  if (!options.topLevelVarRecorder) return code;

  if (typeof options.declarationCallback === "function" || options.declarationWrapperName) {
    var declarationWrapperName = options.declarationWrapperName || defaultDeclarationWrapperName;
    options.declarationWrapper = member(id(options.varRecorderName), literal(declarationWrapperName), true);
    if (options.declarationCallback) options.topLevelVarRecorder[declarationWrapperName] = options.declarationCallback;
  }

  var parsed = lively_ast.parse(code),
      blacklist = (options.dontTransform || []).concat(["arguments"]),
      undeclaredToTransform = !!options.recordGlobals ? null /*all*/ : lively_lang.arr.withoutAll(Object.keys(options.topLevelVarRecorder), blacklist),
      result = lively_sourceTransform.capturing.rewriteToRegisterModuleToCaptureSetters(parsed, id(options.varRecorderName || '__lvVarRecorder'), _extends({ exclude: blacklist }, options));
  return lively_ast.stringify(result);
}

/*global: global, System*/

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// options
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var defaultTopLevelVarRecorderName = '__lvVarRecorder';
var startEvalFunctionName = "lively.vm-on-eval-start";
var endEvalFunctionName = "lively.vm-on-eval-end";

function _normalizeEvalOptions(opts) {
  if (!opts) opts = {};

  opts = _extends({
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
    onEndEval: null
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

function _eval(__lvEvalStatement, __lvVarRecorder /*needed as arg for capturing*/, __lvOriginalCode) {
  return eval(__lvEvalStatement);
}

function runEval$1(code, options, thenDo) {
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
  // }

  if (typeof options === 'function' && arguments.length === 2) {
    thenDo = options;options = null;
  }

  var result = new EvalResult(),
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
      recorder = options.topLevelVarRecorder || getGlobal(),
      originalSource = code;

  if (options.wrapInStartEndCall) {
    if (recorder[startEvalFunctionName]) console.warn(result.addWarning("startEvalFunctionName " + startEvalFunctionName + " already exists in recorder!"));

    if (recorder[endEvalFunctionName]) console.warn(result.addWarning("endEvalFunctionName " + endEvalFunctionName + " already exists in recorder!"));

    recorder[startEvalFunctionName] = function () {
      if (onEvalStartCalled) {
        console.warn(result.addWarning("onEvalStartCalled multiple times!"));return;
      }
      onEvalStartCalled = true;
      if (typeof options.onStartEval === "function") options.onStartEval();
    };

    recorder[endEvalFunctionName] = function (err, value) {
      if (onEvalEndCalled) {
        console.warn(result.addWarning("onEvalEndCalled multiple times!"));return;
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
    console.warn(result.addWarning("lively.vm evalCodeTransform not working: " + (e.stack || e)));
  }

  // 3. Now really run eval!
  try {
    typeof $world !== "undefined" && $world.get('log') && ($world.get('log').textString = code);
    returnedValue = _eval.call(options.context, code, options.topLevelVarRecorder, options.originalSource || originalSource);
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

function syncEval$1(string$$1, options) {
  // See #runEval for options.
  // Although the defaul eval is synchronous we assume that the general
  // evaluation might not return immediatelly. This makes is possible to
  // change the evaluation backend, e.g. to be a remotely attached runtime
  options = Object.assign(options || {}, { sync: true });
  return runEval$1(string$$1, options);
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
    key: "addWarning",
    value: function addWarning(warn) {
      this.warnings.push(warn);return warn;
    }
  }, {
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

  if (options.inspect) return printInspect$1(value, options);

  // options.asString
  return String(value);
}

function printInspect$1(value, options) {
  var printDepth = options.printDepth || 2,
      customPrintInspect = lively_lang.Path("lively.morphic.printInspect").get(getGlobal()),
      customPrinter = customPrintInspect ? function (val, _) {
    return customPrintInspect(val, printDepth);
  } : undefined;
  return lively_lang.obj.inspect(value, { maxDepth: printDepth, customPrinter: customPrinter });
}

var funcCall = lively_ast.nodes.funcCall;
var member$1 = lively_ast.nodes.member;
var literal$1 = lively_ast.nodes.literal;


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// load support

function ensureImportsAreImported(System, code, parentModule) {
  // FIXME do we have to do a reparse? We should be able to get the ast from
  // the rewriter...
  var body = lively_ast.parse(code).body,
      imports = body.filter(function (node) {
    return node.type === "ImportDeclaration";
  });
  return Promise.all(imports.map(function (node) {
    return System.normalize(node.source.value, parentModule).then(function (fullName) {
      return System.get(fullName) || System.import(fullName);
    });
  })).catch(function (err) {
    console.error("Error ensuring imports: " + err.message);throw err;
  });
}

function hasUnimportedImports(System, code, parentModule) {
  var body = lively.ast.parse(code).body,
      imports = body.filter(function (node) {
    return node.type === "ImportDeclaration";
  }),
      importedModules = lively.lang.arr.uniq(imports.map(function (_ref) {
    var value = _ref.source.value;
    return value;
  })),
      unloadedImports = importedModules.filter(function (ea) {
    return !System.get(System.decanonicalize(ea, parentModule));
  });
  return unloadedImports.length > 0;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// transpiler to make es next work

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

function getEs6Transpiler(System, options, env) {
  if (options.transpiler) return options.transpiler;
  if (!options.es6Transpile) return null;

  if (System.transpiler === "babel") {
    var babel = System.global[System.transpiler] || System.get(System.decanonicalize(System.transpiler));

    return babel ? babelTranspilerForAsyncAwaitCode(System, babel, options.targetModule, env) : System.import(System.transpiler).then(function (babel) {
      return babelTranspilerForAsyncAwaitCode(System, babel, options.targetModule, env);
    });
  }

  if (System.transpiler === "plugin-babel") {
    var babelPluginPath = System.decanonicalize("plugin-babel"),
        babelPath = babelPluginPath.split("/").slice(0, -1).concat("systemjs-babel-browser.js").join("/"),
        babelPlugin = System.get(babelPath);

    return babelPlugin ? babelPluginTranspilerForAsyncAwaitCode(System, babelPlugin, options.targetModule, env) : System.import(babelPath).then(function (babelPlugin) {
      return babelPluginTranspilerForAsyncAwaitCode(System, babelPlugin, options.targetModule, env);
    });
  }

  if (System.transpiler === "lively.transpiler") {
    var Transpiler = System.get(System.decanonicalize("lively.transpiler")).default,
        transpiler = new Transpiler(System, options.targetModule, env);
    return function (source, options) {
      return transpiler.transpileDoit(source, options);
    };
  }

  throw new Error("Sorry, currently only babel is supported as es6 transpiler for runEval!");
}

function runEval$2(System, code, options) {
  options = _extends({
    targetModule: null, parentModule: null,
    es6Transpile: true,
    transpiler: null, // function with params: source, options
    transpilerOptions: null,
    format: "esm"
  }, options);
  var defaultSourceAccessorName = "__lvOriginalCode";
  var originalSource = code;

  System.debug && console.log("[lively.module] runEval: " + code.slice(0, 100).replace(/\n/mg, " ") + "...");

  var _options = options,
      format = _options.format,
      targetModule = _options.targetModule,
      parentModule = _options.parentModule;

  targetModule = System.decanonicalize(targetModule || "*scratch*", parentModule);
  options.targetModule = targetModule;

  if (format) {
    var meta = System.getConfig().meta[targetModule];
    if (!meta) meta = {};
    if (!meta[targetModule]) meta[targetModule] = {};
    if (!meta[targetModule].format) {
      meta[targetModule].format = format;
      System.config(meta);
    }
  }

  var module = System.get("@lively-env").moduleEnv(targetModule),
      recorder = module.recorder,
      recorderName = module.recorderName,
      dontTransform = module.dontTransform,
      transpiler = getEs6Transpiler(System, options, module),
      header = "var _moduleExport = " + recorderName + "._moduleExport,\n" + ("    _moduleImport = " + recorderName + "._moduleImport;\n");


  options = _extends({
    waitForPromise: true,
    sync: false,
    evalId: options.evalId || module.nextEvalId(),
    sourceAccessorName: (options.hasOwnProperty("embedOriginalCode") ? options.embedOriginalCode : true) ? defaultSourceAccessorName : undefined,
    originalSource: originalSource
  }, options, {
    header: header,
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
    declarationWrapperName: module.varDefinitionCallbackName,
    currentModuleAccessor: funcCall(member$1(funcCall(member$1(member$1("__lvVarRecorder", "System"), "get"), literal$1("@lively-env")), "moduleEnv"), literal$1(options.targetModule))
  });

  // delay eval to ensure imports
  if (!options.sync && !options.importsEnsured && hasUnimportedImports(System, code, targetModule)) {
    return ensureImportsAreImported(System, code, targetModule).then(function () {
      return runEval$2(System, originalSource, _extends({}, options, { importsEnsured: true }));
    });
  }

  // delay eval to ensure SystemJS module record
  if (!module.record()) {
    if (!options.sync && !options._moduleImported) return System.import(targetModule).catch(function (err) {
      return null;
    }).then(function () {
      return runEval$2(System, originalSource, _extends({}, options, { _moduleImported: true }));
    });

    module.ensureRecord(); // so we can record dependent modules
  }

  // delay eval to ensure transpiler is loaded
  if (options.es6Transpile && options.transpiler instanceof Promise) {
    if (!options.sync && !options._transpilerLoaded) {
      return options.transpiler.catch(function (err) {
        return console.error(err);
      }).then(function (transpiler) {
        return runEval$2(System, originalSource, _extends({}, options, { transpiler: transpiler, _transpilerLoaded: true }));
      });
    } else {
      console.warn("[lively.vm] sync eval requested but transpiler is not yet loaded, will continue without transpilation!");
      options.transpiler = null;
    }
  }

  System.debug && console.log("[lively.module] runEval in module " + targetModule + " started");

  lively_notifications.emit("lively.vm/doitrequest", {
    code: originalSource,
    waitForPromise: options.waitForPromise,
    targetModule: options.targetModule
  }, Date.now(), System);

  System.get("@lively-env").evaluationStart(targetModule);

  var result = runEval$1(code, options);

  return options.sync ? evalEnd(System, originalSource, options, result) : Promise.resolve(result).then(function (result) {
    return evalEnd(System, originalSource, options, result);
  });
}

function evalEnd(System, code, options, result) {

  System.get("@lively-env").evaluationEnd(options.targetModule);
  System.debug && console.log("[lively.module] runEval in module " + options.targetModule + " done");

  lively_notifications.emit("lively.vm/doitresult", {
    code: code, result: result,
    waitForPromise: options.waitForPromise,
    targetModule: options.targetModule
  }, Date.now(), System);

  return result;
}

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
    return possibleConstructorReturn(this, (SimpleEvalStrategy.__proto__ || Object.getPrototypeOf(SimpleEvalStrategy)).apply(this, arguments));
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
    return possibleConstructorReturn(this, (LivelyVmEvalStrategy.__proto__ || Object.getPrototypeOf(LivelyVmEvalStrategy)).apply(this, arguments));
  }

  createClass(LivelyVmEvalStrategy, [{
    key: "normalizeOptions",
    value: function normalizeOptions(options) {
      if (!options.targetModule) throw new Error("runEval called but options.targetModule not specified!");

      return Object.assign({
        sourceURL: options.targetModule + "_doit_" + Date.now()
      }, options);
    }
  }, {
    key: "runEval",
    value: function () {
      var _ref5 = asyncToGenerator(regeneratorRuntime.mark(function _callee5(source, options) {
        var System;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                options = this.normalizeOptions(options);
                System = options.System || lively.modules.System;

                System.config({ meta: defineProperty({}, options.targetModule, { format: "esm" }) });
                return _context5.abrupt("return", lively.vm.runEval(source, options));

              case 4:
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

    var _this4 = possibleConstructorReturn(this, (HttpEvalStrategy.__proto__ || Object.getPrototypeOf(HttpEvalStrategy)).call(this));

    _this4.url = url || _this4.constructor.defaultURL;
    return _this4;
  }

  createClass(HttpEvalStrategy, [{
    key: "normalizeOptions",
    value: function normalizeOptions(options) {
      options = get$1(HttpEvalStrategy.prototype.__proto__ || Object.getPrototypeOf(HttpEvalStrategy.prototype), "normalizeOptions", this).call(this, options);
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

function processEvalError(evalResult) {
  // produce a hopefully helpful string out of an error
  var isError = evalResult.isError,
      value = evalResult.value,
      warnings = evalResult.warnings;

  console.assert(evalResult.isError, "processEvalError called with non-error eval result");
  var error = String(value),
      stack = value.stack,
      warning = warnings ? warnings.join("\n") : "";
  if (error.match(/syntaxerror/i) && warning.match(/syntaxerror/i)) {
    return warning + "\n\n" + error;
  }
  return stack || error;
}

var EvalableTextMorphTrait = (_EvalableTextMorphTra = {
  applyTo: function applyTo(obj$$1) {
    var overrides = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

    var trait = this,
        dontCopy = ["applyTo"].concat(lively.lang.arr.withoutAll(lively.lang.properties.allProperties(obj$$1), overrides));
    Object.keys(trait).filter(function (key) {
      return !dontCopy.includes(key);
    }).forEach(function (key) {
      return Object.defineProperty(obj$$1, key, { configurable: true, get: function get() {
          return trait[key];
        }
      });
    });
    return obj$$1;
  },
  doit: function doit(printResult, editor, options) {
    var _this5 = this;

    return asyncToGenerator(regeneratorRuntime.mark(function _callee12() {
      var result, val;
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
              val = result.isError ? processEvalError(result) : result.value;

              if (printResult) {
                _this5.printObject(editor, val, false, _this5.getPrintItAsComment());
              } else {
                _this5[result.isError ? "showError" : "setStatusMessage"](val);
              }
              _this5.onDoitDone(result);
              return _context12.abrupt("return", result);

            case 11:
              _context12.prev = 11;
              _context12.t0 = _context12["catch"](0);
              _this5.showError(_context12.t0);throw _context12.t0;

            case 15:
            case "end":
              return _context12.stop();
          }
        }
      }, _callee12, _this5, [[0, 11]]);
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

function runEval$$1(code, options) {
  var _options = options = _extends({
    format: "esm",
    System: null,
    targetModule: null
  }, options),
      format = _options.format,
      S = _options.System,
      targetModule = _options.targetModule;

  if (!S && typeof System !== "undefined") S = System;
  if (!S && targetModule) {
    return Promise.reject(new Error("options to runEval have targetModule but cannot find system loader!"));
  }

  return targetModule && ["esm", "es6", "register"].includes(format) ? runEval$2(S, code, options) : runEval$1(code, options);
}

function syncEval$$1(code, options) {
  return syncEval$1(code, options);
}

exports.completions = completions;
exports.runEval = runEval$$1;
exports.syncEval = syncEval$$1;
exports.evalStrategies = evalStrategies;
exports.defaultTopLevelVarRecorderName = defaultTopLevelVarRecorderName;
exports.defaultClassToFunctionConverterName = defaultClassToFunctionConverterName;
exports.evalCodeTransform = evalCodeTransform;
exports.evalCodeTransformOfSystemRegisterSetters = evalCodeTransformOfSystemRegisterSetters;

}((this.lively.vm = this.lively.vm || {}),lively.lang,lively.ast,lively.sourceTransform,lively.classes,lively.notifications));

  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.vm;
})();