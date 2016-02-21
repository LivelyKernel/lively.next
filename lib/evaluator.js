/*global module,exports,require*/

var lang = typeof window !== "undefined" ? lively.lang : require("lively.lang"),
    ast = typeof window !== "undefined" ? lively.ast : require("lively.ast");

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helper

function _normalizeEvalOptions(opts) {
  if (!opts) opts = {};
  opts = lang.obj.merge({
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
    if (moduleEnv) opts = lang.obj.merge(opts, moduleEnv);
  }

  return opts;
}

function _eval(__lvEvalStatement, __lvVarRecorder/*needed as arg for capturing*/) {
  return eval(__lvEvalStatement);
}

function tryToWaitForPromise(evalResult, timeoutMs) {
  console.assert(evalResult.isPromise, "no promise in tryToWaitForPromise???");
  var timeout = {},
      timeoutP = new Promise(resolve => setTimeout(resolve, timeoutMs, timeout));
  return Promise.race([timeoutP, evalResult.value])
    .then(resolved => lang.obj.extend(evalResult, resolved !== timeout ?
            {promiseStatus: "fulfilled", promisedValue: resolved} :
            {promiseStatus: "pending"}))
    .catch(rejected => lang.obj.extend(evalResult,
            {promiseStatus: "rejected", promisedValue: rejected}))
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// evaluator interface

function EvalResult() {}
EvalResult.prototype.isEvalResult = true;
EvalResult.prototype.value = undefined;
EvalResult.prototype.warnings = [];
EvalResult.prototype.isError = false;
EvalResult.prototype.isPromise = false;
EvalResult.prototype.promisedValue = undefined;
EvalResult.prototype.promiseStatus = "unknown";

function print(value, options) {
  if (options.isError || value instanceof Error) return value.stack || String(value);

  if (options.isPromise) {
    var status = lang.string.print(options.promiseStatus),
        value = options.promiseStatus === "pending" ?
          undefined : print(options.promisedValue, lang.obj.merge(options, {isPromise: false}));
    return `Promise({status: ${status}, ${(value === undefined ? "" : "value: " + value)}})`;
  }
  
  if (value instanceof Promise)
    return 'Promise({status: "unknown"})';
  if (options.inspect) {
    var printDepth = options.printDepth || 2;
    return lang.obj.inspect(value, {maxDepth: printDepth})
  }

  // options.asString
  return String(value);
}

EvalResult.prototype.printed = function(options) {
  this.value = print(this.value, lang.obj.merge(options, {
    isError: this.isError,
    isPromise: this.isPromise,
    promisedValue: this.promisedValue,
    promiseStatus: this.promiseStatus,
  }));
}

EvalResult.prototype.processSync = function(options) {
  if (options.inspect || options.asString) this.value = this.print(this.value, options);
  return this;
}

EvalResult.prototype.process = function(options) {
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

function transformForVarRecord(code, varRecorder, varRecorderName, blacklist, defRangeRecorder, recordGlobals, es6ExportFuncId, es6ImportFuncId) {
  // variable declaration and references in the the source code get
  // transformed so that they are bound to `varRecorderName` aren't local
  // state. THis makes it possible to capture eval results, e.g. for
  // inspection, watching and recording changes, workspace vars, and
  // incrementally evaluating var declarations and having values bound later.
  blacklist = blacklist || [];
  blacklist.push("arguments");
  var undeclaredToTransform = recordGlobals ?
        null/*all*/ : lang.arr.withoutAll(Object.keys(varRecorder), blacklist),
      transformed = ast.capturing.rewriteToCaptureTopLevelVariables(
        code, {name: varRecorderName, type: "Identifier"},
        {es6ImportFuncId: es6ImportFuncId,
         es6ExportFuncId: es6ExportFuncId,
         ignoreUndeclaredExcept: undeclaredToTransform,
         exclude: blacklist, recordDefRanges: !!defRangeRecorder});
  code = transformed.source;
  if (defRangeRecorder) lang.obj.extend(defRangeRecorder, transformed.defRanges);
  return code;
}

function transformSingleExpression(code) {
  // evaling certain expressions such as single functions or object
  // literals will fail or not work as intended. When the code being
  // evaluated consists just out of a single expression we will wrap it in
  // parens to allow for those cases
  try {
    var parsed = ast.fuzzyParse(code);
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

function getGlobal() {
  if (typeof window !== "undefined") return window;
  if (typeof global !== "undefined") return global;
  if (typeof Global !== "undefined") return Global;
  return (function() { return this; })();
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
  //   recordGlobals: BOOLEAN // also transform free vars? default is false
  // }

  if (typeof options === 'function' && arguments.length === 2) {
    thenDo = options; options = null;
  }

  options = _normalizeEvalOptions(options);

  var warnings = [];

  try {
    code = evalCodeTransform(code, options);
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
  options = lang.obj.merge(options, {sync: true});
  return runEval(string, options);
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

exports.transformForVarRecord     = transformForVarRecord;
exports.transformSingleExpression = transformSingleExpression;
exports.evalCodeTransform         = evalCodeTransform;
exports.getGlobal                 = getGlobal;
exports.runEval                   = runEval;
exports.syncEval                  = syncEval;
