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
  // code transform / capturing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function transformForVarRecord(
    code,
    varRecorder,
    varRecorderName,
    blacklist,
    defRangeRecorder,
    recordGlobals,
    es6ExportFuncId,
    es6ImportFuncId) {
    // variable declaration and references in the the source code get
    // transformed so that they are bound to `varRecorderName` aren't local
    // state. THis makes it possible to capture eval results, e.g. for
    // inspection, watching and recording changes, workspace vars, and
    // incrementally evaluating var declarations and having values bound later.
    blacklist = blacklist || [];
    blacklist.push("arguments");
    var undeclaredToTransform = recordGlobals ?
          null/*all*/ : lively_lang.arr.withoutAll(Object.keys(varRecorder), blacklist),
        transformed = lively_ast.capturing.rewriteToCaptureTopLevelVariables(
          code, {name: varRecorderName, type: "Identifier"},
          {es6ImportFuncId: es6ImportFuncId,
           es6ExportFuncId: es6ExportFuncId,
           ignoreUndeclaredExcept: undeclaredToTransform,
           exclude: blacklist, recordDefRanges: !!defRangeRecorder});
    code = transformed.source;
    if (defRangeRecorder) lively_lang.obj.extend(defRangeRecorder, transformed.defRanges);
    return code;
  }

  function transformSingleExpression(code) {
    // evaling certain expressions such as single functions or object
    // literals will fail or not work as intended. When the code being
    // evaluated consists just out of a single expression we will wrap it in
    // parens to allow for those cases
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

  function evalCodeTransform(code, options) {
    if (options.topLevelVarRecorder)
      code = transformForVarRecord(
        code,
        options.topLevelVarRecorder,
        options.varRecorderName || '__lvVarRecorder',
        options.dontTransform,
        options.topLevelDefRangeRecorder,
        !!options.recordGlobals,
        options.es6ExportFuncId,
        options.es6ImportFuncId);
    code = transformSingleExpression(code);

    if (options.sourceURL) code += "\n//# sourceURL=" + options.sourceURL.replace(/\s/g, "_");

    return code;
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // options
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function _normalizeEvalOptions(opts) {
    if (!opts) opts = {};
    opts = lively_lang.obj.merge({
      targetModule: null,
      sourceURL: opts.targetModule,
      runtime: null,
      context: getGlobal(),
      varRecorderName: '__lvVarRecorder',
      dontTransform: [], // blacklist vars
      topLevelDefRangeRecorder: null, // object for var ranges
      recordGlobals: null,
      returnPromise: true,
      promiseTimeout: 200,
      waitForPromise: true
    }, opts);

    if (opts.targetModule) {
      var moduleEnv = opts.runtime
                   && opts.runtime.modules
                   && opts.runtime.modules[opts.targetModule];
      if (moduleEnv) opts = lively_lang.obj.merge(opts, moduleEnv);
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
    // }

    if (typeof options === 'function' && arguments.length === 2) {
      thenDo = options; options = null;
    }

    options = _normalizeEvalOptions(options);

    var warnings = [];

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

    var result = new EvalResult();
    try {
      typeof $morph !== "undefined" && $morph('log') && ($morph('log').textString = code);
      result.value = _eval.call(options.context, code, options.topLevelVarRecorder);
      if (result.value instanceof Promise) result.isPromise = true;
    } catch (e) { result.isError = true; result.value = e; }

    if (options.sync) return result.processSync(options);
    else {
      return (typeof thenDo === "function") ? 
        new Promise((resolve, reject) =>
          result.process(options)
            .then(() => { thenDo(null, result); resolve(result); })
            .catch(err => { thenDo(err); reject(err); })) :
        result.process(options);
    }

    // // tries to return as value
    // try {
    //   JSON.stringify(value);
    //   return value;
    // } catch (e) {
    //   try {
    //     var printDepth = options.printDepth || 2;
    //     return lang.obj.inspect(value, {maxDepth: printDepth})
    //   } catch (e) { return String(value); }
    // }

  }

  function syncEval(string, options) {
    // See #runEval for options.
    // Although the defaul eval is synchronous we assume that the general
    // evaluation might not return immediatelly. This makes is possible to
    // change the evaluation backend, e.g. to be a remotely attached runtime
    options = lively_lang.obj.merge(options, {sync: true});
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
      this.value = print(this.value, lively_lang.obj.merge(options, {
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
      .then(resolved => lively_lang.obj.extend(evalResult, resolved !== timeout ?
              {promiseStatus: "fulfilled", promisedValue: resolved} :
              {promiseStatus: "pending"}))
      .catch(rejected => lively_lang.obj.extend(evalResult,
              {promiseStatus: "rejected", promisedValue: rejected}))
  }

  function print(value, options) {
    if (options.isError || value instanceof Error) return String(value.stack || value);

    if (options.isPromise) {
      var status = lively_lang.string.print(options.promiseStatus),
          printed = options.promiseStatus === "pending" ?
            undefined : print(options.promisedValue, lively_lang.obj.merge(options, {isPromise: false}));
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
  exports.transformForVarRecord = transformForVarRecord;
  exports.transformSingleExpression = transformSingleExpression;
  exports.evalCodeTransform = evalCodeTransform;
  exports.getGlobal = getGlobal;
  exports.runEval = runEval;
  exports.syncEval = syncEval;

}((this.lively.vm = this.lively.vm || {}),lively.lang,lively.ast));
  if (typeof module !== "undefined" && module.exports) module.exports = GLOBAL.lively.vm;
})();