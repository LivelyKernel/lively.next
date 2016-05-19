(function() {
  var GLOBAL = typeof window !== "undefined" ? window :
      typeof global!=="undefined" ? global :
        typeof self!=="undefined" ? self : this;
  this.lively = this.lively || {};
(function (exports,lively_lang,lively_ast) {
  'use strict';

  // helper
  function signatureOf(name, func) {
    var source = String(func),
        match = source.match(/function\s*[a-zA-Z0-9_$]*\s*\(([^\)]*)\)/),
        params = (match && match[1]) || '';
    return name + '(' + params + ')';
  }

  function pluck(list, prop) { return list.map(function(ea) { return ea[prop]; }); }

  function getObjectForCompletion(evalFunc, stringToEval) {
    var startLetters = '';
    return Promise.resolve().then(() => {
      // thenDo = function(err, obj, startLetters)
      var idx = stringToEval.lastIndexOf('.');
      if (idx >= 0) {
        startLetters = stringToEval.slice(idx+1);
        stringToEval = stringToEval.slice(0,idx);
      } else {
        startLetters = stringToEval;
        stringToEval = '(typeof window === "undefined" ? global : window)';
      }
      return evalFunc(stringToEval);
    })
    .then(evalResult => ({
      evalResult: evalResult,
      startLetters: startLetters,
      code: stringToEval
    }));
  }

  function propertyExtract(excludes, obj, extractor) {
    return Object.getOwnPropertyNames(obj)
      .filter(key => excludes.indexOf(key) === -1)
      .map(extractor)
      .filter(ea => !!ea)
      .sort((a,b) => a.name < b.name ? -1 : (a.name > b.name ? 1 : 0));
  }

  function getMethodsOf(excludes, obj) {
    return propertyExtract(excludes, obj, function(key) {
      if ((obj.__lookupGetter__ && obj.__lookupGetter__(key)) || typeof obj[key] !== 'function') return null;
      return {name: key, completion: signatureOf(key, obj[key])}; })
  }

  function getAttributesOf(excludes, obj) {
    return propertyExtract(excludes, obj, function(key) {
      if ((obj.__lookupGetter__ && !obj.__lookupGetter__(key)) && typeof obj[key] === 'function') return null;
      return {name: key, completion: key}; })
  }

  function getProtoChain(obj) {
    var protos = [], proto = obj;
    while (obj) { protos.push(obj); obj = obj.__proto__ }
    return protos;
  }

  function getDescriptorOf(originalObj, proto) {
    function shorten(s, len) {
      if (s.length > len) s = s.slice(0,len) + '...';
      return s.replace(/\n/g, '').replace(/\s+/g, ' ');
    }

    if (originalObj === proto) {
      if (typeof originalObj !== 'function') return shorten(originalObj.toString ? originalObj.toString() : "[some object]", 50);
      var funcString = originalObj.toString(),
          body = shorten(funcString.slice(funcString.indexOf('{')+1, funcString.lastIndexOf('}')), 50);
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
        completions = getProtoChain(obj)
          .map(function(proto) {
            var descr = getDescriptorOf(obj, proto),
                methodsAndAttributes = getMethodsOf(excludes, proto)
                  .concat(getAttributesOf(excludes, proto));
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
    var promise = getObjectForCompletion(evalFunc, string)
      .then(evalResultAndStartLetters => {
        var evalResult = evalResultAndStartLetters.evalResult,
            value = evalResult && evalResult.isEvalResult ? evalResult.value : evalResult,
            result = {
              completions: descriptorsOfObjAndProtoProperties(value),
              startLetters: evalResultAndStartLetters.startLetters,
              code: evalResultAndStartLetters.code
            };

        if (evalResult && evalResult.isPromise) {
          if (evalResult.promiseStatus === "fulfilled")
            result.promiseResolvedCompletions = descriptorsOfObjAndProtoProperties(evalResult.promisedValue)
          else if (evalResult.promiseStatus === "rejected")
            result.promiseRejectedCompletions = descriptorsOfObjAndProtoProperties(evalResult.promisedValue)
        }
        return result;
    });
    if (typeof thenDo === "function") {
      promise.then(result => thenDo(null, result)).catch(err => thenDo(err));
    }
    return promise;
  }



  var completions = Object.freeze({
    getCompletions: getCompletions
  });

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // using code transformers
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function evalCodeTransform(code, options) {
    // variable declaration and references in the the source code get
    // transformed so that they are bound to `varRecorderName` aren't local
    // state. THis makes it possible to capture eval results, e.g. for
    // inspection, watching and recording changes, workspace vars, and
    // incrementally evaluating var declarations and having values bound later.


    // 1. Allow evaluation of function expressions and object literals
    code = transformSingleExpression(code);

    var parsed = lively_ast.parse(code);

    // 2. capture top level vars into topLevelVarRecorder "environment"
    if (options.topLevelVarRecorder) {

      var blacklist = (options.dontTransform || []).concat(["arguments"]),
          undeclaredToTransform = !!options.recordGlobals ?
            null/*all*/ : lively_lang.arr.withoutAll(Object.keys(options.topLevelVarRecorder), blacklist);

      parsed = lively_ast.capturing.rewriteToCaptureTopLevelVariables(
        parsed,
        {name: options.varRecorderName || '__lvVarRecorder', type: "Identifier"},
        {
          es6ImportFuncId: options.es6ImportFuncId,
          es6ExportFuncId: options.es6ExportFuncId,
          ignoreUndeclaredExcept: undeclaredToTransform,
          exclude: blacklist
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

  const isProbablySingleExpressionRe = /^\s*(\{|function\s*\()/;

  function transformSingleExpression(code) {
    // evaling certain expressions such as single functions or object
    // literals will fail or not work as intended. When the code being
    // evaluated consists just out of a single expression we will wrap it in
    // parens to allow for those cases
    // Example:
    // transformSingleExpression("{foo: 23}") // => "({foo: 23})"

    if (!isProbablySingleExpressionRe.test(code) || code.split("\n").length > 30) return code;

    try {
      var parsed = lively_ast.fuzzyParse(code);
      if (parsed.body.length === 1 &&
        (parsed.body[0].type === 'FunctionDeclaration'
      || (parsed.body[0].type === 'BlockStatement'
      && parsed.body[0].body[0].type === 'LabeledStatement'))) {
        code = '(' + code.replace(/;\s*$/, '') + ')';
      }
    } catch(e) {
      if (typeof lively && lively.Config && lively.Config.showImprovedJavaScriptEvalErrors) $world.logError(e)
      else console.error("Eval preprocess error: %s", e.stack || e);
    }
    return code;
  }



  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // options
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  const defaultTopLevelVarRecorderName = '__lvVarRecorder';
  const startEvalFunctionName = "lively.vm-on-eval-start";
  const endEvalFunctionName = "lively.vm-on-eval-end";
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
      var moduleEnv = opts.runtime
                   && opts.runtime.modules
                   && opts.runtime.modules[opts.targetModule];
      if (moduleEnv) opts = Object.assign(opts, moduleEnv);
    }

    if (opts.wrapInStartEndCall) {
      opts.startFuncNode = {
        type: "MemberExpression",
        object: {type: "Identifier", name: opts.varRecorderName},
        property: {type: "Literal", value: startEvalFunctionName},
        computed: true
      }
      opts.endFuncNode = {
        type: "MemberExpression",
        object: {type: "Identifier", name: opts.varRecorderName},
        property: {type: "Literal", value: endEvalFunctionName},
        computed: true
      }
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
    return (function() { return this; })();
  }

  function _eval(__lvEvalStatement, __lvVarRecorder/*needed as arg for capturing*/) {
    return eval(__lvEvalStatement);
  }

  function runEval(code, options, thenDo) {
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
      thenDo = options; options = null;
    }

    var warnings = [],
        result = new EvalResult(),
        returnedError, returnedValue,
        onEvalEndError, onEvalEndValue,
        onEvalStartCalled = false, onEvalEndCalled = false;
    options = _normalizeEvalOptions(options);

    // 1. In case we rewrite the code with on-start and on-end calls we prepare
    // the environment with actual function handlers that will get called once
    // the code is evaluated

    var onEvalFunctionHolder, evalDone = lively_lang.promise.deferred();
    if (options.wrapInStartEndCall) {
      onEvalFunctionHolder = options.topLevelVarRecorder || getGlobal();

      if (onEvalFunctionHolder[startEvalFunctionName])
        console.warn(`startEvalFunctionName ${startEvalFunctionName} already exists in recorder!`)

      if (onEvalFunctionHolder[endEvalFunctionName])
        console.warn(`endEvalFunctionName ${endEvalFunctionName} already exists in recorder!`)

      onEvalFunctionHolder[startEvalFunctionName] = function() {
        if (onEvalStartCalled) { console.warn("onEvalStartCalled multiple times!"); return; }
        onEvalStartCalled = true;
        if (typeof options.onStartEval === "function") options.onStartEval();
      }

      onEvalFunctionHolder[endEvalFunctionName] = function(err, value) {
        if (onEvalEndCalled) { console.warn("onEvalEndCalled multiple times!"); return; }
        onEvalEndCalled = true;
        finishEval(err, value, result, options, onEvalFunctionHolder, evalDone, thenDo);
      }
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
    } catch (e) { returnedError = e; }

    // 4. Wrapping up: if we inject a on-eval-end call we let it handle the
    // wrap-up, otherwise we firectly call finishEval()
    if (options.wrapInStartEndCall) {
      if (returnedError && !onEvalEndCalled)
        onEvalFunctionHolder[endEvalFunctionName](returnedError, undefined);
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

    if (err) { result.isError = true; result.value = err; }
    else result.value = value;
    if (result.value instanceof Promise) result.isPromise = true;

    if (options.sync) {
      result.processSync(options);
      if (typeof options.onEndEval === "function") options.onEndEval(err, value);
    } else {
      result.process(options)
        .then(() => {
          typeof thenDo === "function" && thenDo(null, result);
          typeof options.onEndEval === "function" && options.onEndEval(err, value);
          return result;
        },
        (err) => {
          typeof thenDo === "function" && thenDo(err, undefined);
          typeof options.onEndEval === "function" && options.onEndEval(err, undefined);
          return result;
        })
        .then(evalDone.resolve, evalDone.reject)
    }
  }


  function syncEval(string, options) {
    // See #runEval for options.
    // Although the defaul eval is synchronous we assume that the general
    // evaluation might not return immediatelly. This makes is possible to
    // change the evaluation backend, e.g. to be a remotely attached runtime
    options = Object.assign(options || {}, {sync: true});
    return runEval(string, options);
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // EvalResult
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  class EvalResult {

    constructor() {
      this.isEvalResult = true;
      this.value = undefined;
      this.warnings = [];
      this.isError = false;
      this.isPromise = false;
      this.promisedValue = undefined;
      this.promiseStatus = "unknown";
    }

    printed(options) {
      this.value = print(this.value, Object.assign(options || {}, {
        isError: this.isError,
        isPromise: this.isPromise,
        promisedValue: this.promisedValue,
        promiseStatus: this.promiseStatus,
      }));
    }

    processSync(options) {
      if (options.inspect || options.asString)
        this.value = this.print(this.value, options);
      return this;
    }

    process(options) {
      var result = this;
      if (result.isPromise && options.waitForPromise) {
        return tryToWaitForPromise(result, options.promiseTimeout)
          .then(() => {
            if (options.inspect || options.asString) result.printed(options);
            return result;
          });
      }
      if (options.inspect || options.asString) result.printed(options);
      return Promise.resolve(result);
    }

  }

  function tryToWaitForPromise(evalResult, timeoutMs) {
    console.assert(evalResult.isPromise, "no promise in tryToWaitForPromise???");
    var timeout = {},
        timeoutP = new Promise(resolve => setTimeout(resolve, timeoutMs, timeout));
    return Promise.race([timeoutP, evalResult.value])
      .then(resolved => Object.assign(evalResult, resolved !== timeout ?
              {promiseStatus: "fulfilled", promisedValue: resolved} :
              {promiseStatus: "pending"}))
      .catch(rejected => Object.assign(evalResult,
              {promiseStatus: "rejected", promisedValue: rejected}))
  }

  function print(value, options) {
    if (options.isError || value instanceof Error) return String(value.stack || value);

    if (options.isPromise) {
      var status = lively_lang.string.print(options.promiseStatus),
          printed = options.promiseStatus === "pending" ?
            undefined : print(options.promisedValue, Object.assign(options || {}, {isPromise: false}));
      return `Promise({status: ${status}, ${(value === undefined ? "" : "value: " + printed)}})`;
    }

    if (value instanceof Promise)
      return 'Promise({status: "unknown"})';

    if (options.inspect) return printInspect(value, options);

    // options.asString
    return String(value);
  }

  function printInspect(value, options) {
    var printDepth = options.printDepth || 2,
        customPrintInspect = lively_lang.Path("lively.morphic.printInspect").get(getGlobal()),
        customPrinter = customPrintInspect ? (val, _) =>
          customPrintInspect(val, printDepth): undefined;
    return lively_lang.obj.inspect(value, {maxDepth: printDepth, customPrinter: customPrinter})
  }

  exports.completions = completions;
  exports.EvalResult = EvalResult;
  exports.defaultTopLevelVarRecorderName = defaultTopLevelVarRecorderName;
  exports.evalCodeTransform = evalCodeTransform;
  exports.getGlobal = getGlobal;
  exports.runEval = runEval;
  exports.syncEval = syncEval;

}((this.lively.vm = this.lively.vm || {}),lively.lang,lively.ast));
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.vm;
})();