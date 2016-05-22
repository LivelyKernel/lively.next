(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  this.lively = this.lively || {};
(function (exports,lively_lang,ast) {
  'use strict';

  var babelHelpers = {};

  babelHelpers.classCallCheck = function (instance, Constructor) {
    if (!(instance instanceof Constructor)) {
      throw new TypeError("Cannot call a class as a function");
    }
  };

  babelHelpers.createClass = function () {
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

  babelHelpers;

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

  function propertyExtract(excludes, obj, extractor) {
    return Object.getOwnPropertyNames(obj).filter(function (key) {
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

  var evalCodeTransform = ast.evalSupport.evalCodeTransform;

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // options
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

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

    var onEvalFunctionHolder,
        evalDone = lively_lang.promise.deferred();
    if (options.wrapInStartEndCall) {
      onEvalFunctionHolder = options.topLevelVarRecorder || getGlobal();

      if (onEvalFunctionHolder[startEvalFunctionName]) console.warn("startEvalFunctionName " + startEvalFunctionName + " already exists in recorder!");

      if (onEvalFunctionHolder[endEvalFunctionName]) console.warn("endEvalFunctionName " + endEvalFunctionName + " already exists in recorder!");

      onEvalFunctionHolder[startEvalFunctionName] = function () {
        if (onEvalStartCalled) {
          console.warn("onEvalStartCalled multiple times!");return;
        }
        onEvalStartCalled = true;
        if (typeof options.onStartEval === "function") options.onStartEval();
      };

      onEvalFunctionHolder[endEvalFunctionName] = function (err, value) {
        if (onEvalEndCalled) {
          console.warn("onEvalEndCalled multiple times!");return;
        }
        onEvalEndCalled = true;
        finishEval(err, value, result, options, onEvalFunctionHolder, evalDone, thenDo);
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
      if (returnedError && !onEvalEndCalled) onEvalFunctionHolder[endEvalFunctionName](returnedError, undefined);
    } else {
      finishEval(returnedError, returnedError || returnedValue, result, options, onEvalFunctionHolder, evalDone, thenDo);
    }

    return options.sync ? result : evalDone.promise;
  }

  function finishEval(err, value, result, options, onEvalFunctionHolder, evalDone, thenDo) {
    // 5. Here we end the evaluation. Note that if we are in sync mode we cannot
    // use any Promise since promises always run on next tick. That's why we have
    // to slightly duplicate the finish logic...

    if (options.wrapInStartEndCall) {
      delete onEvalFunctionHolder[startEvalFunctionName];
      delete onEvalFunctionHolder[endEvalFunctionName];
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

  function syncEval(string, options) {
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
      babelHelpers.classCallCheck(this, EvalResult);

      this.isEvalResult = true;
      this.value = undefined;
      this.warnings = [];
      this.isError = false;
      this.isPromise = false;
      this.promisedValue = undefined;
      this.promiseStatus = "unknown";
    }

    babelHelpers.createClass(EvalResult, [{
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

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // load support

  function ensureImportsAreLoaded(System, code, parentModule) {
    // FIXME do we have to do a reparse? We should be able to get the ast from
    // the rewriter...
    var body = ast.parse(code).body,
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

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // transpiler to make es next work

  function babelTranspilerForAsyncAwaitCode(System, babel, filename, env) {
    // The function wrapper is needed b/c we need toplevel awaits and babel
    // converts "this" => "undefined" for modules
    return function (source, options) {
      options = Object.assign({
        modules: 'ignore',
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

  function getEs6Transpiler(System, options, env) {
    if (options.transpiler) return Promise.resolve(options.transpiler);
    if (!options.es6Transpile) return Promise.resolve(null);

    if (System.transpiler !== "babel") return Promise.reject(new Error("Sorry, currently only babel is supported as es6 transpiler for runEval!"));

    return Promise.resolve(System.global[System.transpiler] || System.import(System.transpiler)).then(function (babel) {
      return babelTranspilerForAsyncAwaitCode(System, babel, options.targetModule, env);
    });
  }

  function runEval(System, code, options) {
    options = lively_lang.obj.merge({
      targetModule: null, parentModule: null,
      parentAddress: null,
      es6Transpile: true,
      transpiler: null, // function with params: source, options
      transpilerOptions: null
    }, options);

    var originalCode = code;

    System.debug && console.log("[lively.module] runEval: " + code.slice(0, 100).replace(/\n/mg, " ") + "...");

    return Promise.resolve().then(function () {
      var targetModule = options.targetModule || "*scratch*";
      return System.normalize(targetModule, options.parentModule, options.parentAddress);
    }).then(function (targetModule) {
      var fullname = options.targetModule = targetModule;
      var env = System["__lively.modules__"].moduleEnv(fullname);
      var recorder = env.recorder;
      var recorderName = env.recorderName;
      var dontTransform = env.dontTransform;


      return System.import(fullname).then(function () {
        return ensureImportsAreLoaded(System, code, fullname);
      }).then(function () {
        return getEs6Transpiler(System, options, env);
      }).then(function (transpiler) {
        var header = "var _moduleExport = " + recorderName + "._moduleExport,\n" + ("    _moduleImport = " + recorderName + "._moduleImport;\n");

        code = header + code;
        options = lively_lang.obj.merge({ waitForPromise: true }, options, {
          recordGlobals: true,
          dontTransform: dontTransform,
          varRecorderName: recorderName,
          topLevelVarRecorder: recorder,
          sourceURL: options.sourceURL || options.targetModule,
          context: options.context || recorder,
          wrapInStartEndCall: true, // for async / await eval support
          es6ExportFuncId: "_moduleExport",
          es6ImportFuncId: "_moduleImport",
          transpiler: transpiler
        });

        System.debug && console.log("[lively.module] runEval in module " + fullname + " started");

        console.warn("FIX recordDoitRequest");
        // recordDoitRequest(
        //   System, originalCode,
        //   {waitForPromise: options.waitForPromise, targetModule: options.targetModule},
        //   Date.now());

        return vmRunEval(code, options).then(function (result) {
          System["__lively.modules__"].evaluationDone(fullname);
          System.debug && console.log("[lively.module] runEval in module " + targetModule + " done");
          console.warn("FIX recordDoitResult");
          // recordDoitResult(
          //   System, originalCode,
          //   {waitForPromise: options.waitForPromise, targetModule: options.targetModule},
          //   result, Date.now());
          return result;
        });
      }).catch(function (err) {
        console.error("Error in runEval: " + err.stack);
        throw err;
      });
    });
  }

var esm = Object.freeze({
    runEval: runEval
  });

  exports.completions = completions;
  exports.esm = esm;
  exports.defaultTopLevelVarRecorderName = defaultTopLevelVarRecorderName;
  exports.getGlobal = getGlobal;
  exports.runEval = vmRunEval;
  exports.syncEval = syncEval;

}((this.lively.vm = this.lively.vm || {}),lively.lang,lively.ast));
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.vm;
})();