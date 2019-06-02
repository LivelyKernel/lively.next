/*global: global, System*/

import { arr, obj, string, Path, promise } from "lively.lang";
import { evalCodeTransform } from "./eval-support.js";
import { printEvalResult, getGlobal } from "./util.js";

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// options
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

const defaultTopLevelVarRecorderName = '__lvVarRecorder',
      startEvalFunctionName = "lively.vm-on-eval-start",
      endEvalFunctionName = "lively.vm-on-eval-end"

function _normalizeEvalOptions(opts) {
  if (!opts) opts = {};

  opts = {
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
    ...opts
  };

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

function _eval(__lvEvalStatement, __lvVarRecorder/*needed as arg for capturing*/, __lvOriginalCode) {
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

  var result = new EvalResult(),
      returnedError, returnedValue,
      onEvalEndError, onEvalEndValue,
      onEvalStartCalled = false, onEvalEndCalled = false;
  options = _normalizeEvalOptions(options);

  // 1. In case we rewrite the code with on-start and on-end calls we prepare
  // the environment with actual function handlers that will get called once
  // the code is evaluated

  var evalDone = promise.deferred(),
      recorder = options.topLevelVarRecorder || getGlobal(),
      originalSource = code;

  if (options.wrapInStartEndCall) {
    if (recorder[startEvalFunctionName])
      console.warn(result.addWarning(`startEvalFunctionName ${startEvalFunctionName} already exists in recorder!`));

    if (recorder[endEvalFunctionName])
      console.warn(result.addWarning(`endEvalFunctionName ${endEvalFunctionName} already exists in recorder!`))

    recorder[startEvalFunctionName] = function() {
      if (onEvalStartCalled) { console.warn(result.addWarning("onEvalStartCalled multiple times!")); return; }
      onEvalStartCalled = true;
      if (typeof options.onStartEval === "function") options.onStartEval();
    }

    recorder[endEvalFunctionName] = function(err, value) {
      if (onEvalEndCalled) { console.warn(result.addWarning("onEvalEndCalled multiple times!")); return; }
      onEvalEndCalled = true;
      finishEval(err, value, result, options, recorder, evalDone, thenDo);
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
    console.warn(result.addWarning("lively.vm evalCodeTransform not working: " + e));
  }

  // 3. Now really run eval!
  try {
    typeof $world !== "undefined" && $world.get('log') && ($world.get('log').textString = code);
    returnedValue = _eval.call(options.context, code, options.topLevelVarRecorder, options.originalSource || originalSource);
  } catch (e) { returnedError = e; }

  // 4. Wrapping up: if we inject a on-eval-end call we let it handle the
  // wrap-up, otherwise we firectly call finishEval()
  if (options.wrapInStartEndCall) {
    if (returnedError && !onEvalEndCalled)
      recorder[endEvalFunctionName](returnedError, undefined);
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

  addWarning(warn) { this.warnings.push(warn); return warn; }

  printed(options = {}) {
    this.value = printEvalResult(this, options);
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


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// export
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export {
  defaultTopLevelVarRecorderName,
  getGlobal,
  runEval,
  syncEval
}