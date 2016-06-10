(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  this.lively = this.lively || {};
(function (exports,lively_lang,ast) {
  'use strict';

  var babelHelpers = {};

  babelHelpers.asyncToGenerator = function (fn) {
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

  babelHelpers.defineProperty = function (obj, key, value) {
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

  babelHelpers.inherits = function (subClass, superClass) {
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

  babelHelpers.possibleConstructorReturn = function (self, call) {
    if (!self) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return call && (typeof call === "object" || typeof call === "function") ? call : self;
  };

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

  // import { moduleEnv } from "lively.modules/src/system.js";
  // import { recordDoitRequest, recordDoitResult } from "lively.modules/src/notify.js";

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // load support

  var ensureImportsAreLoaded = function () {
    var ref = babelHelpers.asyncToGenerator(regeneratorRuntime.mark(function _callee(System, code, parentModule) {
      var body, imports;
      return regeneratorRuntime.wrap(function _callee$(_context) {
        while (1) {
          switch (_context.prev = _context.next) {
            case 0:
              // FIXME do we have to do a reparse? We should be able to get the ast from
              // the rewriter...
              body = ast.parse(code).body, imports = body.filter(function (node) {
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
      return ref.apply(this, arguments);
    };
  }();

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // transpiler to make es next work

  var getEs6Transpiler = function () {
    var ref = babelHelpers.asyncToGenerator(regeneratorRuntime.mark(function _callee2(System, options, env) {
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
      return ref.apply(this, arguments);
    };
  }();

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
    var ref = babelHelpers.asyncToGenerator(regeneratorRuntime.mark(function _callee3(System, code, options) {
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

              _context3.next = 25;
              return vmRunEval(code, options);

            case 25:
              result = _context3.sent;


              System.get("@lively-env").evaluationDone(fullname);
              System.debug && console.log("[lively.module] runEval in module " + fullname + " done");
              console.warn("FIX recordDoitResult");

              // recordDoitResult(
              //   System, originalCode,
              //   {waitForPromise: options.waitForPromise, targetModule: options.targetModule},
              //   result, Date.now());
              return _context3.abrupt("return", result);

            case 30:
            case "end":
              return _context3.stop();
          }
        }
      }, _callee3, this);
    }));
    return function runEval(_x7, _x8, _x9) {
      return ref.apply(this, arguments);
    };
  }();

  var _EvalableTextMorphTra;

  var EvalStrategy = function () {
    function EvalStrategy() {
      babelHelpers.classCallCheck(this, EvalStrategy);
    }

    babelHelpers.createClass(EvalStrategy, [{
      key: "runEval",
      value: function runEval(source, options) {
        return Promise.reject("runEval(source, options) not yet implemented for " + this.constructor.name);
      }
    }, {
      key: "keysOfObject",
      value: function keysOfObject(prefix, options) {
        return Promise.reject("keysOfObject(prefix, options) not yet implemented for " + this.constructor.name);
      }
    }]);
    return EvalStrategy;
  }();

  var SimpleEvalStrategy = function (_EvalStrategy) {
    babelHelpers.inherits(SimpleEvalStrategy, _EvalStrategy);

    function SimpleEvalStrategy() {
      babelHelpers.classCallCheck(this, SimpleEvalStrategy);
      return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(SimpleEvalStrategy).apply(this, arguments));
    }

    babelHelpers.createClass(SimpleEvalStrategy, [{
      key: "runEval",
      value: function runEval(source, options) {
        return Promise.resolve().then(function () {
          try {
            return { value: eval(source) };
          } catch (err) {
            return { isError: true, value: err };
          }
        });
      }
    }, {
      key: "keysOfObject",
      value: function () {
        var ref = babelHelpers.asyncToGenerator(regeneratorRuntime.mark(function _callee(prefix, options) {
          var _this2 = this;

          var result;
          return regeneratorRuntime.wrap(function _callee$(_context) {
            while (1) {
              switch (_context.prev = _context.next) {
                case 0:
                  _context.next = 2;
                  return lively.vm.completions.getCompletions(function (code) {
                    return _this2.runEval(code, options);
                  }, prefix);

                case 2:
                  result = _context.sent;
                  return _context.abrupt("return", { completions: result.completions, prefix: result.startLetters });

                case 4:
                case "end":
                  return _context.stop();
              }
            }
          }, _callee, this);
        }));

        function keysOfObject(_x, _x2) {
          return ref.apply(this, arguments);
        }

        return keysOfObject;
      }()
    }]);
    return SimpleEvalStrategy;
  }(EvalStrategy);

  var LivelyVmEvalStrategy = function (_EvalStrategy2) {
    babelHelpers.inherits(LivelyVmEvalStrategy, _EvalStrategy2);

    function LivelyVmEvalStrategy() {
      babelHelpers.classCallCheck(this, LivelyVmEvalStrategy);
      return babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(LivelyVmEvalStrategy).apply(this, arguments));
    }

    babelHelpers.createClass(LivelyVmEvalStrategy, [{
      key: "runEval",
      value: function runEval(source, options) {
        // lively.modules.System.config({meta: {[options.targetModule]: {format: "esm"}}});
        var conf = { meta: {} };conf.meta[options.targetModule] = { format: "esm" };
        lively.modules.System.config(conf);

        options = lively.lang.obj.merge({
          sourceURL: options.targetModule + "_doit_" + Date.now()
        }, options);

        return lively.vm.runEval(source, options);
      }
    }, {
      key: "keysOfObject",
      value: function () {
        var ref = babelHelpers.asyncToGenerator(regeneratorRuntime.mark(function _callee2(prefix, options) {
          var result;
          return regeneratorRuntime.wrap(function _callee2$(_context2) {
            while (1) {
              switch (_context2.prev = _context2.next) {
                case 0:
                  _context2.next = 2;
                  return lively.vm.completions.getCompletions(function (code) {
                    return lively.vm.runEval(code, options);
                  }, prefix);

                case 2:
                  result = _context2.sent;
                  return _context2.abrupt("return", { completions: result.completions, prefix: result.startLetters });

                case 4:
                case "end":
                  return _context2.stop();
              }
            }
          }, _callee2, this);
        }));

        function keysOfObject(_x3, _x4) {
          return ref.apply(this, arguments);
        }

        return keysOfObject;
      }()
    }]);
    return LivelyVmEvalStrategy;
  }(EvalStrategy);

  var HttpEvalStrategy = function (_EvalStrategy3) {
    babelHelpers.inherits(HttpEvalStrategy, _EvalStrategy3);
    babelHelpers.createClass(HttpEvalStrategy, null, [{
      key: "defaultURL",
      get: function get() {
        return "https://localhost:3000/eval";
      }
    }]);

    function HttpEvalStrategy(url) {
      babelHelpers.classCallCheck(this, HttpEvalStrategy);

      var _this4 = babelHelpers.possibleConstructorReturn(this, Object.getPrototypeOf(HttpEvalStrategy).call(this));

      _this4.url = url;
      return _this4;
    }

    babelHelpers.createClass(HttpEvalStrategy, [{
      key: "runEval",
      value: function () {
        var ref = babelHelpers.asyncToGenerator(regeneratorRuntime.mark(function _callee3(source, options) {
          var url, sourceForServer, stringValue;
          return regeneratorRuntime.wrap(function _callee3$(_context3) {
            while (1) {
              switch (_context3.prev = _context3.next) {
                case 0:
                  _context3.prev = 0;

                  options = Object.assign({ serverEvalURL: this.url || this.constructor.defaultURL }, options);
                  url = options.serverEvalURL;
                  sourceForServer = "var source = " + JSON.stringify(source) + "\n" + ("var options = " + JSON.stringify(options) + "\n") + (LivelyVmEvalStrategy.prototype.runEval + "\n") + "runEval(source, options)\n";
                  _context3.next = 6;
                  return window.fetch(url, { method: "POST", body: sourceForServer });

                case 6:
                  _context3.next = 8;
                  return _context3.sent.text();

                case 8:
                  stringValue = _context3.sent;
                  return _context3.abrupt("return", JSON.parse(stringValue));

                case 12:
                  _context3.prev = 12;
                  _context3.t0 = _context3["catch"](0);
                  return _context3.abrupt("return", { isError: true, value: String(_context3.t0.stack || _context3.t0) });

                case 15:
                case "end":
                  return _context3.stop();
              }
            }
          }, _callee3, this, [[0, 12]]);
        }));

        function runEval(_x5, _x6) {
          return ref.apply(this, arguments);
        }

        return runEval;
      }()
    }, {
      key: "keysOfObject",
      value: function () {
        var ref = babelHelpers.asyncToGenerator(regeneratorRuntime.mark(function _callee4(prefix, options) {
          var url, sourceForServer, stringValue, result;
          return regeneratorRuntime.wrap(function _callee4$(_context4) {
            while (1) {
              switch (_context4.prev = _context4.next) {
                case 0:
                  options = Object.assign({ serverEvalURL: this.url || this.constructor.defaultURL }, options);
                  url = options.serverEvalURL;
                  sourceForServer = "var prefix = " + JSON.stringify(prefix) + ";\n" + ("var options = " + JSON.stringify(options) + ";\n") + (LivelyVmEvalStrategy.prototype.keysOfObject + "\n") + "vmCompletions(prefix, options);\n";
                  _context4.next = 5;
                  return window.fetch(url, { method: "POST", body: sourceForServer });

                case 5:
                  _context4.next = 7;
                  return _context4.sent.text();

                case 7:
                  stringValue = _context4.sent;
                  result = JSON.parse(stringValue);

                  if (!result.isError) {
                    _context4.next = 11;
                    break;
                  }

                  throw new Error(result.value);

                case 11:
                  return _context4.abrupt("return", result);

                case 12:
                case "end":
                  return _context4.stop();
              }
            }
          }, _callee4, this);
        }));

        function keysOfObject(_x7, _x8) {
          return ref.apply(this, arguments);
        }

        return keysOfObject;
      }()
    }]);
    return HttpEvalStrategy;
  }(EvalStrategy);

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

      return babelHelpers.asyncToGenerator(regeneratorRuntime.mark(function _callee5() {
        var result;
        return regeneratorRuntime.wrap(function _callee5$(_context5) {
          while (1) {
            switch (_context5.prev = _context5.next) {
              case 0:
                _context5.prev = 0;

                options = Object.assign({
                  inspect: !printResult,
                  printDepth: _this5.printInspectMaxDepth,
                  targetModule: _this5.moduleId(),
                  context: _this5
                }, options);
                _context5.next = 4;
                return evalStrategy(_this5).runEval(_this5.getCodeForEval(), options);

              case 4:
                result = _context5.sent;

                if (printResult) {
                  _this5.printObject(editor, result.value, false, _this5.getPrintItAsComment());
                } else {
                  _this5.setStatusMessage(result.value);
                }
                _this5.onDoitDone(result);
                return _context5.abrupt("return", result);

              case 10:
                _context5.prev = 10;
                _context5.t0 = _context5["catch"](0);
                _this5.showError(_context5.t0);throw _context5.t0;

              case 14:
              case "end":
                return _context5.stop();
            }
          }
        }, _callee5, _this5, [[0, 10]]);
      }))();
    },
    evalSelection: function evalSelection(printIt) {
      var _this6 = this;

      return babelHelpers.asyncToGenerator(regeneratorRuntime.mark(function _callee6() {
        var options, result;
        return regeneratorRuntime.wrap(function _callee6$(_context6) {
          while (1) {
            switch (_context6.prev = _context6.next) {
              case 0:
                options = { context: _this6, targetModule: _this6.moduleId(), asString: !!printIt };
                _context6.next = 3;
                return evalStrategy(_this6).runEval(_this6.getCodeForEval(), options);

              case 3:
                result = _context6.sent;

                if (printIt) _this6.insertAtCursor(result.value, true);
                return _context6.abrupt("return", result);

              case 6:
              case "end":
                return _context6.stop();
            }
          }
        }, _callee6, _this6);
      }))();
    },
    doListProtocol: function doListProtocol() {
      var _this7 = this;

      return babelHelpers.asyncToGenerator(regeneratorRuntime.mark(function _callee7() {
        var m, prefix, completions, lister;
        return regeneratorRuntime.wrap(function _callee7$(_context7) {
          while (1) {
            switch (_context7.prev = _context7.next) {
              case 0:
                _context7.prev = 0;
                m = lively.module("lively.ide.codeeditor.Completions");

                if (m.isLoaded()) {
                  _context7.next = 5;
                  break;
                }

                _context7.next = 5;
                return m.load();

              case 5:
                prefix = _this7.getCodeForCompletions();
                _context7.next = 8;
                return evalStrategy(_this7).keysOfObject(prefix, { context: _this7, targetModule: _this7.moduleId() });

              case 8:
                completions = _context7.sent;
                lister = new lively.ide.codeeditor.Completions.ProtocolLister(_this7);

                lister.openNarrower(completions);
                return _context7.abrupt("return", lister);

              case 14:
                _context7.prev = 14;
                _context7.t0 = _context7["catch"](0);
                _this7.showError(_context7.t0);
              case 17:
              case "end":
                return _context7.stop();
            }
          }
        }, _callee7, _this7, [[0, 14]]);
      }))();
    },
    doSave: function doSave() {
      var _this8 = this;

      return babelHelpers.asyncToGenerator(regeneratorRuntime.mark(function _callee8() {
        return regeneratorRuntime.wrap(function _callee8$(_context8) {
          while (1) {
            switch (_context8.prev = _context8.next) {
              case 0:
                _this8.savedTextString = _this8.textString;

                if (!_this8.getEvalOnSave()) {
                  _context8.next = 10;
                  break;
                }

                _context8.prev = 2;
                _context8.next = 5;
                return lively.modules.moduleSourceChange(_this8.moduleId(), _this8.textString);

              case 5:
                _context8.next = 10;
                break;

              case 7:
                _context8.prev = 7;
                _context8.t0 = _context8["catch"](2);
                return _context8.abrupt("return", _this8.showError(_context8.t0));

              case 10:
                _this8.onSaveDone();

              case 11:
              case "end":
                return _context8.stop();
            }
          }
        }, _callee8, _this8, [[2, 7]]);
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
  }, babelHelpers.defineProperty(_EvalableTextMorphTra, "setStatusMessage", function setStatusMessage() {
    throw new Error("setStatusMessage() not yet implemented for " + this.constructor.name);
  }), babelHelpers.defineProperty(_EvalableTextMorphTra, "showError", function showError() {
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

}((this.lively.vm = this.lively.vm || {}),lively.lang,lively.ast));
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.vm;
})();