/* global clearTimeout, setTimeout */

/**
 * Abstractions around first class functions like augmenting and inspecting
 * functions as well as to control function calls like dealing with asynchronous
 * control flows.
 * @module lively.lang/function 
 */

import { merge as objectMerge, safeToString } from './object.js';
import Closure from './closure.js';

// -=-=-=-=-=-=-=-=-
// static functions
// -=-=-=-=-=-=-=-=-

function Empty () { /* `function() {}` */ return function () {}; }
function K () { /* `function(arg) { return arg; }` */ return function (arg) { return arg; }; }
function Null () { /* `function() { return null; }` */ return function () { return null; }; }
function False () { /* `function() { return false; }` */ return function () { return false; }; }
function True () { /* `function() { return true; }` */ return function () { return true; }; }
function notYetImplemented () { return function () { throw new Error('Not yet implemented'); }; }


/**
 * Returns wether or not a given function is a "built in".
 * Built in functions are native to the runtime and their
 * implementation can not be inspected from Javascript.
 * @param { function } fn - The function to check for.
 * @returns { boolean }
 */
function isNativeFunction(fn) {
  return Function.toString.call(fn).indexOf("[native code]") !== -1;
}

// -=-=-=-=-=-
// accessing
// -=-=-=-=-=-

/**
 * Returns all property names of a given object that reference a function.
 * @param { Object } obj - The object to return the property names for.
 * @returns { String[] }
 * @example
 * var obj = {foo: 23, bar: function() { return 42; }};
 * all(obj) // => ["bar"]
 */
function all (object) {
  const a = [];
  for (const name in object) {
    if (!object.__lookupGetter__(name) &&
     typeof object[name] === 'function') a.push(name);
  }
  return a;
}

/**
 * Returns all local (non-prototype) property names of a given object that
 * reference a function.
 * @param { Object } object - The object to return the property names for.
 * @returns { String[] }
 * @example
 * var obj1 = {foo: 23, bar: function() { return 42; }};
 * var obj2 = {baz: function() { return 43; }};
 * obj2.__proto__ = obj1
 * own(obj2) // => ["baz"]
 * all(obj2) // => ["baz","bar"]
 */
function own (object) {
  const a = [];
  for (const name in object) {
    if (!object.__lookupGetter__(name) &&
     object.hasOwnProperty(name) &&
     typeof object[name] === 'function') a.push(name);
  }
  return a;
}

// -=-=-=-=-=-
// inspection
// -=-=-=-=-=-

/**
 * Extract the names of all parameters for a given function object.
 * @param { function } f - The function object to extract the parameter names of.
 * @returns { String[] }
 * @example
 * argumentNames(function(arg1, arg2) {}) // => ["arg1","arg2"]
 * argumentNames(function() {}) // => []
 */
function argumentNames (f) {
  if (f.superclass) return []; // it's a class...
  const src = f.toString(); let names = '';
  const arrowMatch = src.match(/(?:\(([^\)]*)\)|([^\(\)-+!]+))\s*=>/);
  if (arrowMatch) names = arrowMatch[1] || arrowMatch[2] || '';
  else {
    const headerMatch = src.match(/^[\s\(]*function[^(]*\(([^)]*)\)/);
    if (headerMatch && headerMatch[1]) names = headerMatch[1];
  }
  return names.replace(/\/\/.*?[\r\n]|\/\*(?:.|[\r\n])*?\*\//g, '')
    .replace(/\s+/g, '').split(',')
    .map(function (ea) { return ea.trim(); })
    .filter(function (name) { return !!name; });
}

/**
 * Return a qualified name for a given function object.
 * @param { function } f - The function object to determine the name of.
 * @returns { String }
 */
function qualifiedMethodName (f) {
  let objString = '';
  if (f.declaredClass) {
    objString += f.declaredClass + '>>';
  } else if (f.declaredObject) {
    objString += f.declaredObject + '.';
  }
  return objString + (f.methodName || f.displayName || f.name || 'anonymous');
}

/**
 * Useful when you have to stringify code but not want
 * to construct strings by hand.
 * @param { function } func - The function to extract the body from.
 * @returns { String }
 * @example
 * extractBody(function(arg) {
 *   var x = 34;
 *   alert(2 + arg);
 * }) => "var x = 34;\nalert(2 + arg);"
 */
function extractBody (func) {
  const codeString = String(func)
    .replace(/^function[^\{]+\{\s*/, '')
    .replace(/\}$/, '')
    .trim();
  const lines = codeString.split(/\n|\r/); let indent;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s+)[^\s]/);
    if (m && (indent === undefined || m[1].length < indent.length)) indent = m[1];
  }
  return indent ? codeString.replace(new RegExp('^' + indent, 'gm'), '') : codeString;
}

// -=-=-=-
// timing
// -=-=-=-

/**
 * Returns synchronous runtime of calling `func` in ms.
 * @param { function } func - The function to time.
 * @returns { number }
 * @example
 * timeToRun(function() { new WebResource("http://google.de").beSync().get() });
 * // => 278 (or something else...)
 */
function timeToRun (func) {
  const startTime = Date.now();
  func();
  return Date.now() - startTime;
}

/**
 * Like `timeToRun` but calls function `n` times instead of once. Returns
 * the average runtime of a call in ms.
 * @see timeToRun
 * @param { function } func - The function to time.
 * @param { number } n - The number of times to run the function.
 * @returns { number }
 */
function timeToRunN (func, n) {
  const startTime = Date.now();
  for (let i = 0; i < n; i++) func();
  return (Date.now() - startTime) / n;
}

/**
 * Delays calling `func` for `timeout` seconds(!).
 * @param { function } func - Function object to delay execution for.
 * @param { number } timeout - The duration in milliseconds to delay the execution for.
 * @example
 * (function() { alert("Run in the future!"); }).delay(1);
 */
function delay (func, timeout/*, arg1...argN */) {
  const args = Array.prototype.slice.call(arguments);
  const __method = args.shift();
  timeout = args.shift() * 1000;
  return setTimeout(function delayed () {
    return __method.apply(__method, args);
  }, timeout);
}

// these last two methods are Underscore.js 1.3.3 and are slightly adapted
// Underscore.js license:
// (c) 2009-2012 Jeremy Ashkenas, DocumentCloud Inc.
// Underscore is distributed under the MIT license.

/**
 * Exec func at most once every wait ms even when called more often
 * useful to calm down eagerly running updaters and such.
 * This may very likely drop the last couple of calls so if
 * you need a guarantee for the last call to "complete successfully"
 * throttle is not the right choice.
 * @param { function } func - The function to be wrapped.
 * @param { number } wait - The duration of time in milliseconds to wait until the throttle is suspended.
 * @example
 * var i = 0;
 * var throttled = throttle(function() { alert(++i + '-' + Date.now()) }, 500);
 * Array.range(0,100).forEach(function(n) { throttled() });
 */
function throttle (func, wait) {
  let context; let args; let timeout; let throttling; let more; let result;
  const whenDone = debounce(wait, function () { more = throttling = false; });
  return function () {
    context = this; args = arguments;
    const later = function () {
      timeout = null;
      if (more) func.apply(context, args);
      whenDone();
    };
    if (!timeout) timeout = setTimeout(later, wait);
    if (throttling) {
      more = true;
    } else {
      result = func.apply(context, args);
    }
    whenDone();
    throttling = true;
    return result;
  };
}

/**
 * Call `func` after `wait` milliseconds elapsed since the last invocation.
 * Unlike `throttle` an invocation will restart the wait period. This is
 * useful if you have a stream of events that you want to wait for to finish
 * and run a subsequent function afterwards. When you pass arguments to the
 * debounced functions then the arguments from the last call will be use for
 * the invocation.
 * @param { number } wait - The duration in milliseconds to wait until the next invocation.
 * @param { function } func - The founction to be wrapped.
 * @param { Boolean } immediate - When set to true, immediately call `func` but when called again during `wait` before wait ms are done nothing happens. E.g. to not exec a user invoked action twice accidentally.
 * @example
 * var start = Date.now();
 * var f = debounce(200, function(arg1) {
 *   alert("running after " + (Date.now()-start) + "ms with arg " + arg1);
 * });
 * f("call1");
 * delay(curry(f, "call2"), 0.1);
 * delay(curry(f, "call3"), 0.15);
 * // => Will eventually output: "running after 352ms with arg call3"
 */
function debounce (wait, func, immediate) {
  let timeout;
  return function () {
    const context = this; const args = arguments;
    const later = function () {
      timeout = null;
      if (!immediate) func.apply(context, args);
    };
    if (immediate && !timeout) func.apply(context, args);
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

const _throttledByName = {};
/**
 * Like `throttle` but remembers the throttled function once created and
 * repeated calls to `throttleNamed` with the identical name will use the same
 * throttled function. This allows to throttle functions in a central place
 * that might be called various times in different contexts without having to
 * manually store the throttled function.
 * @param { String } name - The identifier for the throttled closure.
 * @see throttle.
 */
function throttleNamed (name, wait, func) {
  const store = _throttledByName;
  if (store[name]) return store[name];
  function throttleNamedWrapper () {
    // ignore-in-doc, cleaning up
    debounceNamed(name, wait, function () { delete store[name]; })();
    return func.apply(this, arguments);
  }
  return store[name] = throttle(throttleNamedWrapper, wait);
}

const _debouncedByName = {};
/**
 * Like `debounce` but remembers the debounced function once created and
 * repeated calls to `debounceNamed` with the identical name will use the same
 * debounced function. This allows to debounce functions in a central place
 * that might be called various times in different contexts without having to
 * manually store the debounced function.
 * @param { String } name - The identifier for the debounced closure.
 * @see debounce
 */
function debounceNamed (name, wait, func, immediate) {
  const store = _debouncedByName;
  if (store[name]) return store[name];
  function debounceNamedWrapper () {
    // ignore-in-doc, cleaning up
    delete store[name];
    return func.apply(this, arguments);
  }
  return store[name] = debounce(wait, debounceNamedWrapper, immediate);
}

const _queues = {};

/**
 * @typedef { Object } WorkerQueue
 * @property { function } push - Handles the addition of a single task to the queue.
 * @property { function } pushAll - Handles the addition of multiple tasks to the queue.
 * @property { function } handleError - Callback to handle errors that appear in a task.
  * @property { function } drain - Callback that is run once the queue empties.
 */

/**
 * Creates and initializes a worker queue.
 * @param { string } id - The identifier for the worker queue.
 * @param { function } workerFunc - Asynchronous function to process queued tasks.
 * @returns { WorkerQueue }
 * @example
 * var sum = 0;
 * var q = createQueue("example-queue", function(arg, thenDo) { sum += arg; thenDo(); });
 * q.pushAll([1,2,3]);
 * queues will be remembered by their name
 * createQueue("example-queue").push(4);
 * sum // => 6
 */
function createQueue (id, workerFunc) {
  const store = _queues;

  let queue = store[id] || (store[id] = {
    _workerActive: false,
    worker: workerFunc,
    tasks: [],
    drain: null, // can be overwritten by a function
    push: function (task) {
      queue.tasks.push(task);
      if (!queue._workerActive) queue.activateWorker();
    },
    pushAll: function (tasks) {
      tasks.forEach(function (ea) { queue.tasks.push(ea); });
      if (!queue._workerActive) queue.activateWorker();
    },
    pushNoActivate: function (task) {
      queue.tasks.push(task);
    },
    handleError: function (err) {
      // can be overwritten
      err && console.error('Error in queue: ' + err);
    },
    activateWorker: function () {
      function callback (err) { queue.handleError(err); queue.activateWorker(); }
      const tasks = queue.tasks; const active = queue._workerActive;
      if (tasks.length === 0) {
        if (active) {
          queue._workerActive = false;
          if (typeof queue.drain === 'function') queue.drain();
        }
        delete store[id];
      } else {
        if (!active) queue._workerActive = true;
        try {
          queue.worker(tasks.shift(), callback);
        } catch (err) { callback(err); }
      }
    }
  });

  return queue;
}

const _queueUntilCallbacks = {};
/**
 * This functions helps when you have a long running computation that
 * multiple call sites (independent from each other) depend on. This
 * function does the housekeeping to start the long running computation
 * just once and returns an object that allows to schedule callbacks
 * once the workerFunc is done.
 * This is how it works:
 * If `id` does not exist, workerFunc is called, otherwise ignored.
 * workerFunc is expected to call thenDoFunc with arguments: error, arg1, ..., argN
 * if called subsequently before workerFunc is done, the other thenDoFunc
 * will "pile up" and called with the same arguments as the first
 * thenDoFunc once workerFunc is done.
 * @see createQueue
 * @param { number } optTimeout - The timeout for slow running tasks in milliseconds.
 * @example
 * var worker = workerWithCallbackQueue("example",
 *   function slowFunction(thenDo) {
 *     var theAnswer = 42;
 *     setTimeout(function() { thenDo(null, theAnswer); });
 *   });
 * // all "call sites" depend on `slowFunction` but don't have to know about
 * // each other
 * worker.whenDone(function callsite1(err, theAnswer) { alert("callback1: " + theAnswer); })
 * worker.whenDone(function callsite2(err, theAnswer) { alert("callback2: " + theAnswer); })
 * workerWithCallbackQueue("example").whenDone(function callsite3(err, theAnswer) { alert("callback3: " + theAnswer); })
 * // => Will eventually show: callback1: 42, callback2: 42 and callback3: 42
 */
function workerWithCallbackQueue (id, workerFunc, optTimeout) {
  const store = _queueUntilCallbacks;
  let queueCallbacks = store[id];
  const isRunning = !!queueCallbacks;

  if (isRunning) return queueCallbacks;

  let callbacksRun = false; let canceled = false;

  function cleanup () {
    if (timeoutProc) clearTimeout(timeoutProc);
    callbacksRun = true;
    delete store[id];
  }

  function runCallbacks (args) {
    if (callbacksRun) return;
    cleanup();
    queueCallbacks.callbacks.forEach(function (cb) {
      try { cb.apply(null, args); } catch (e) {
        console.error(
          'Error when invoking callbacks in queueUntil [' +
          id + ']:\n' +
          (String(e.stack || e)));
      }
    });
  }

  // timeout
  let timeoutProc;
  if (optTimeout) {
    timeoutProc = setTimeout(function () {
      if (callbacksRun) return;
      runCallbacks([new Error('timeout')]);
    }, optTimeout);
  }

  // init the store
  queueCallbacks = store[id] = {
    callbacks: [],
    cancel: function () {
      canceled = true;
      cleanup();
    },
    whenDone: function (cb) {
      queueCallbacks.callbacks.push(cb);
      return queueCallbacks;
    }
  };

  // call worker, but delay so we can immediately return
  setTimeout(function () {
    if (canceled) return;
    try {
      workerFunc(function (/* args */) { runCallbacks(arguments); });
    } catch (e) { runCallbacks([e]); }
  }, 0);

  return queueCallbacks;
}

function _composeAsyncDefaultEndCallback (err, arg1/* err + args */) {
  if (err) console.error('lively.lang.composeAsync error', err);
}

/**
 * Composes functions that are asynchronous and expecting continuations to
 * be called in node.js callback style (error is first argument, real
 * arguments follow).
 * A call like `composeAsync(f,g,h)(arg1, arg2)` has a flow of control like:
 *  `f(arg1, arg2, thenDo1)` -> `thenDo1(err, fResult)`
 * -> `g(fResult, thenDo2)` -> `thenDo2(err, gResult)` ->
 * -> `h(fResult, thenDo3)` -> `thenDo2(err, hResult)`
 * @param { ...function } functions - The collections of asynchronous functions to compose.
 * @return { function }
 * @example
 * composeAsync(
 *   function(a,b, thenDo) { thenDo(null, a+b); },
 *   function(x, thenDo) { thenDo(x*4); }
 *  )(3,2, function(err, result) { alert(result); });
 */
function composeAsync (/* functions */) {
  const toArray = Array.prototype.slice;
  const functions = toArray.call(arguments);
  const defaultEndCb = _composeAsyncDefaultEndCallback;
  let endCallback = defaultEndCb;
  let endSuccess; let endFailure;
  const endPromise = new Promise(function (resolve, reject) {
    endSuccess = resolve; endFailure = reject;
  });

  return functions.reverse().reduce(function (prevFunc, funcOrPromise, i) {
    let nextActivated = false;
    return function () {
      const args = toArray.call(arguments);

      // the last arg needs to be function, discard all non-args
      // following it. This allows to have an optional callback func that can
      // even be `undefined`, e.g. when calling this func from a callsite
      // using var args;
      if (endCallback === defaultEndCb && i === functions.length - 1/* first function */) {
        while (args.length && typeof args[args.length - 1] !== 'function') args.pop();
        if (typeof args[args.length - 1] === 'function') endCallback = args.pop();
      }

      function next (/* err and args */) {
        nextActivated = true;
        const args = toArray.call(arguments);
        const err = args.shift();
        if (err) { endCallback(err); endFailure(err); } else prevFunc.apply(null, args);
      }

      if (typeof funcOrPromise === 'function') {
        try {
          const result = funcOrPromise.apply(this, args.concat([next]));
          if (result && typeof result.then === 'function' && typeof result.catch === 'function') {
            result
              .then(function (value) { return next(null, value); })
              .catch(function (err) { return next(err); });
          }
        } catch (e) {
          console.error('composeAsync: ', e.stack || e);
          if (!nextActivated) { endCallback(e); endFailure(e); }
        }
      } else if (funcOrPromise && typeof funcOrPromise.then === 'function' && typeof funcOrPromise.catch === 'function') {
        funcOrPromise
          .then(function (value) { next(null, value); })
          .catch(function (err) { next(err); });
      } else {
        const err = new Error('Invalid argument to composeAsync: ' + funcOrPromise);
        endCallback(err);
        endFailure(err);
      }

      return endPromise;
    };
  }, function () {
    const args = toArray.call(arguments);
    endCallback.apply(null, [null].concat(args));
    endSuccess(args[0]);
  });
}

/**
 * Composes a set of synchronous functions:
 * `compose(f,g,h)(arg1, arg2)` = `h(g(f(arg1, arg2)))`
 * @param { ...function } functions - The collections of functions to compose.
 * @returns { function }
 * @example
 * compose(
 *   function(a,b) { return a+b; },
 *   function(x) {return x*4}
 * )(3,2) // => 20
 */
function compose (/* functions */) {
  const functions = Array.prototype.slice.call(arguments);
  return functions.reverse().reduce(
    function (prevFunc, func) {
      return function () {
        return prevFunc(func.apply(this, arguments));
      };
    }, function (x) { return x; });
}
/**
 * Swaps the first two args
 * @param { function } f - Function to flip the arguments for.
 * @returns { function }
 * @example
 * flip(function(a, b, c) {
 *   return a + b + c; })(' World', 'Hello', '!') // => "Hello World!"
 */
function flip (f) {
  return function flipped (/* args */) {
    const args = Array.prototype.slice.call(arguments);
    const flippedArgs = [args[1], args[0]].concat(args.slice(2));
    return f.apply(null, flippedArgs);
  };
}

/**
 * Returns a modified version of func that will have `null` always curried
 * as first arg. Usful e.g. to make a nodejs-style callback work with a
 * then-able.
 * @param { function } func - The function to modify.
 * @returns { function }
 * @example
 * promise.then(withNull(cb)).catch(cb);
 */
function withNull (func) {
  func = func || function () {};
  return function (/* args */) {
    const args = Array.from(arguments);
    func.apply(null, [null].concat(args));
  };
}

/**
 * Wait for waitTesterFunc to return true, then run thenDo, passing
 * failure/timout err as first parameter. A timout occurs after
 * timeoutMs. During the wait period waitTesterFunc might be called
 * multiple times.
 * @param { number } timeoutMs - The milliseconds to wait for at max.
 * @param { function } waitTesterFunc - The testing function.
 * @param { function } thenDo - Callback that is invoked once the condition is met.
 */
function waitFor (timeoutMs, waitTesterFunc, thenDo) {
  const start = Date.now();
  let timeStep = 50;
  if (!thenDo) {
    thenDo = waitTesterFunc;
    waitTesterFunc = timeoutMs;
    timeoutMs = undefined;
  }
  (function test () {
    if (waitTesterFunc()) return thenDo();
    if (timeoutMs) {
      const duration = Date.now() - start;
      const timeLeft = timeoutMs - duration;
      if (timeLeft <= 0) return thenDo(new Error('timeout'));
      if (timeLeft < timeStep) timeStep = timeLeft;
    }
    setTimeout(test, timeStep);
  })();
}

/**
 * Wait for multiple asynchronous functions. Once all have called the
 * continuation, call `thenDo`.
 * @param { Object } [options] - A set of configuration options.
 * @param { number } options.timeout - How long to wait in milliseconds.
 * @param { function[] } funcs - The set of functions ot wait for.
 * @param { function } thenDo - The callback to invoke after the wait finishes.
 */
function waitForAll (options, funcs, thenDo) {
  if (!thenDo) { thenDo = funcs; funcs = options; options = null; }
  options = options || {};

  const results = funcs.map(function () { return null; });
  if (!funcs.length) { thenDo(null, results); return; }

  const leftFuncs = Array.prototype.slice.call(funcs);

  funcs.forEach(function (f, i) {
    try {
      f(function (/* err and args */) {
        const args = Array.prototype.slice.call(arguments);
        const err = args.shift();
        markAsDone(f, i, err, args);
      });
    } catch (e) { markAsDone(f, i, e, null); }
  });

  if (options.timeout) {
    setTimeout(function () {
      if (!leftFuncs.length) return;
      const missing = results
        .map(function (ea, i) { return ea === null && i; })
        .filter(function (ea) { return typeof ea === 'number'; })
        .join(', ');
      const err = new Error('waitForAll timed out, functions at ' + missing + ' not done');
      markAsDone(null, null, err, null);
    }, options.timeout);
  }

  function markAsDone (f, i, err, result) {
    if (!leftFuncs.length) return;

    let waitForAllErr = null;
    const fidx = leftFuncs.indexOf(f);
    (fidx > -1) && leftFuncs.splice(fidx, 1);
    if (err) {
      leftFuncs.length = 0;
      waitForAllErr = new Error('in waitForAll at' +
        (typeof i === 'number' ? ' ' + i : '') +
        ': \n' + (err.stack || String(err)));
    } else if (result) results[i] = result;
    if (!leftFuncs.length) {
      setTimeout(function () {
        thenDo(waitForAllErr, results);
      }, 0);
    }
  }
}

// -=-=-=-=-
// wrapping
// -=-=-=-=-

/**
 * Return a version of `func` with args applied.
 * @param { function } func - The function to curry.
 * @example
 * var add1 = (function(a, b) { return a + b; }).curry(1);
 * add1(3) // => 4
 */
function curry (func, ...curryArgs) {
  if (arguments.length <= 1) return arguments[0];
  const args = Array.prototype.slice.call(arguments);
  func = args.shift();
  function wrappedFunc () {
    return func.apply(this, args.concat(Array.prototype.slice.call(arguments)));
  }
  wrappedFunc.isWrapper = true;
  wrappedFunc.originalFunction = func;
  return wrappedFunc;
}

/**
 * A `wrapper` is another function that is being called with the arguments
 * of `func` and a proceed function that, when called, runs the originally
 * wrapped function.
 * @param { function } func - The function to wrap.
 * @param { function } wrapper - The function to wrap the other one.
 * @returns { function }
 * @example
 * function original(a, b) { return a+b }
 * var wrapped = wrap(original, function logWrapper(proceed, a, b) {
 *   alert("original called with " + a + "and " + b);
 *   return proceed(a, b);
 * })
 * wrapped(3,4) // => 7 and a message will pop up
 */
function wrap (func, wrapper) {
  const __method = func;
  const wrappedFunc = function wrapped () {
    const args = Array.prototype.slice.call(arguments);
    const wrapperArgs = wrapper.isWrapper
      ? args
      : [__method.bind(this)].concat(args);
    return wrapper.apply(this, wrapperArgs);
  };
  wrappedFunc.isWrapper = true;
  wrappedFunc.originalFunction = __method;
  return wrappedFunc;
}

/**
 * Get the original function that was augmented by `wrap`. `getOriginal`
 * will traversed as many wrappers as necessary.
 * @param { function } wrappedFunc - The wrapped function to retrieve the original from.
 * @returns { function }
 */
function getOriginal (wrappedFunc) {
  while (wrappedFunc.originalFunction) wrappedFunc = wrappedFunc.originalFunction;
  return wrappedFunc;
}

/**
 * Function wrappers used for wrapping, cop, and other method
 * manipulations attach a property "originalFunction" to the wrapper. By
 * convention this property references the wrapped method like wrapper
 * -> cop wrapper -> real method.
 * tThis method gives access to the linked list starting with the outmost
 * wrapper.
 * @param { function } method - A function that has been wrapped potentially multiple times.
 * @returns { function[] }
 */
function wrapperChain (method) {
  const result = [];
  do {
    result.push(method);
    method = method.originalFunction;
  } while (method);
  return result;
}

/**
 * Change an objects method for a single invocation.
 * @param { object } obj - 
 * @param { string } methodName - 
 * @param { function } replacement - 
 * @returns { object }
 * @example
 * var obj = {foo: function() { return "foo"}};
 * lively.lang.replaceMethodForOneCall(obj, "foo", function() { return "bar"; });
 * obj.foo(); // => "bar"
 * obj.foo(); // => "foo"
 */
function replaceMethodForOneCall (obj, methodName, replacement) {
  replacement.originalFunction = obj[methodName];
  const reinstall = obj.hasOwnProperty(methodName);
  obj[methodName] = function () {
    if (reinstall) obj[methodName] = replacement.originalFunction;
    else delete obj[methodName];
    return replacement.apply(this, arguments);
  };
  return obj;
}

/**
 * Ensure that `func` is only executed once. Multiple calls will not call
 * `func` again but will return the original result.
 * @param { function } func - The function to be wrapped to only execute once.
 * @returns { function }
 */
function once (func) {
  if (!func) return undefined;
  if (typeof func !== 'function') { throw new Error('once() expecting a function'); }
  let invoked = false; let result;
  return function () {
    if (invoked) return result;
    invoked = true;
    return result = func.apply(this, arguments);
  };
}

/**
 * Accepts multiple functions and returns an array of wrapped
 * functions. Those wrapped functions ensure that only one of the original
 * function is run (the first on to be invoked).
 * 
 * This is useful if you have multiple asynchronous choices of how the
 * control flow might continue but want to ensure that a continuation
 * is  only triggered once, like in a timeout situation:
 * 
 * ```js
 * function outerFunction(callback) {
 *   function timeoutAction() { callback(new Error('timeout!')); }
 *   function otherAction() { callback(null, "All OK"); }
 *   setTimeout(timeoutAction, 200);
 *   doSomethingAsync(otherAction);
 * }
 * ```
 * 
 * To ensure that `callback` only runs once you would normally have to write boilerplate like this:
 * 
 * ```js
 * var ran = false;
 * function timeoutAction() { if (ran) return; ran = true; callback(new Error('timeout!')); }
 * function otherAction() { if (ran) return; ran = true; callback(null, "All OK"); }
 * ```
 * 
 * Since this can get tedious an error prone, especially if more than two choices are involved, `either` can be used like this:
 * @example
 * function outerFunction(callback) {
 *   var actions = either(
 *     function() { callback(new Error('timeout!')); },
 *     function() { callback(null, "All OK"); });
 *   setTimeout(actions[0], 200);
 *   doSomethingAsync(actions[1]);
 * }
 */
function either (/* funcs */) {
  const funcs = Array.prototype.slice.call(arguments); let wasCalled = false;
  return funcs.map(function (func) {
    return function () {
      if (wasCalled) return undefined;
      wasCalled = true;
      return func.apply(this, arguments);
    };
  });
}

const _eitherNameRegistry = {};

/**
 * Works like [`either`](#) but usage does not require to wrap all
 * functions at once.
 * @see either
 * @param { string } name - 
 * @param { function } func - The function to wrap.
 * @return { function } 
 * @example
 * var log = "", name = "either-example-" + Date.now();
 * function a() { log += "aRun"; };
 * function b() { log += "bRun"; };
 * function c() { log += "cRun"; };
 * setTimeout(eitherNamed(name, a), 100);
 * setTimeout(eitherNamed(name, b), 40);
 * setTimeout(eitherNamed(name, c), 80);
 * setTimeout(function() { alert(log); /\* => "bRun" *\/ }, 150);
 */
function eitherNamed (name, func) {
  const funcs = Array.prototype.slice.call(arguments);
  const registry = _eitherNameRegistry;
  name = funcs.shift();
  const eitherCall = registry[name] || (registry[name] = { wasCalled: false, callsLeft: 0 });
  eitherCall.callsLeft++;
  return function () {
    eitherCall.callsLeft--;
    // cleanup the storage if all registered functions fired
    if (eitherCall.callsLeft <= 0) delete registry[name];
    if (eitherCall.wasCalled) return undefined;
    eitherCall.wasCalled = true;
    return func.apply(this, arguments);
  };
}

// -=-=-=-=-
// creation
// -=-=-=-=-
function evalJS (src) { return eval(src); }

/**
 * Creates a function from a string.
 * @param { string|function } funcOrString - A function or string to create a function from.
 * @returns { function }
 * @example
 * fromString("function() { return 3; }")() // => 3
 */
function fromString (funcOrString) {
  return evalJS('(' + funcOrString.toString() + ');');
}

/**
 * Lifts `func` to become a `Closure`, that is that free variables referenced
 * in `func` will be bound to the values of an object that can be passed in as
 * the second parameter. Keys of this object are mapped to the free variables.
 * 
 * Please see [`Closure`](#) for a more detailed explanation and examples.
 * @param { function } func - The function to create a closure from.
 * @param { object } [optVarMapping] - The var mapping that defines how the free variables inside the closure are to be bound.
 * @returns { function }
 */
function asScript (func, optVarMapping) {
  return Closure.fromFunction(func, optVarMapping).recreateFunc();
}

const binds = asScript;

/**
 * Like `asScript` but makes `f` a method of `obj` as `optName` or the name
 * of the function.
 * @param { function } f - The function to create a method from.
 * @param { object } obj - The object to attach the method to.
 * @param { string } [optName] - The name of the method once attached to the object.
 * @param { object } [optMapping] - The var mapping that defines how the free variables inside the method are to be bound.
 * @returns { function }
 */
function asScriptOf (f, obj, optName, optMapping) {
  const name = optName || f.name;
  if (!name) {
    throw Error('Function that wants to be a script needs a name: ' + this);
  }
  const proto = Object.getPrototypeOf(obj);
  let mapping = { this: obj };
  if (optMapping) mapping = objectMerge([mapping, optMapping]);
  if (proto && proto[name]) {
    const superFunc = function () {
      try {
        // FIXME super is supposed to be static
        return Object.getPrototypeOf(obj)[name].apply(obj, arguments);
      } catch (e) {
        if (typeof $world !== 'undefined') $world.logError(e, 'Error in $super call');
        else console.error('Error in $super call: ' + e + '\n' + e.stack);
        return null;
      }
    };
    mapping.$super = Closure.fromFunction(superFunc, { obj, name }).recreateFunc();
  }
  return addToObject(asScript(f, mapping), obj, name);
}

// -=-=-=-=-=-=-=-=-
// closure related
// -=-=-=-=-=-=-=-=-

/**
 * Attaches a given function to an object as a method.
 * @param { function } f - The function to create a method from.
 * @param { object } obj - The object to attach the method to.
 * @param { string } name - The name of the method once attached to the object.
 * @returns { function }
 */
function addToObject (f, obj, name) {
  f.displayName = name;

  const methodConnections = obj.attributeConnections
    ? obj.attributeConnections.filter(function (con) {
      return con.getSourceAttrName() === 'update';
    })
    : [];

  if (methodConnections) { methodConnections.forEach(function (ea) { ea.disconnect(); }); }

  obj[name] = f;

  if (typeof obj) f.declaredObject = safeToString(obj);

  // suppport for tracing
  if (typeof lively !== 'undefined' && obj && lively.Tracing && lively.Tracing.stackTracingEnabled) {
    lively.Tracing.instrumentMethod(obj, name, {
      declaredObject: safeToString(obj)
    });
  }

  if (methodConnections) { methodConnections.forEach(function (ea) { ea.connect(); }); }

  return f;
}

/**
 * Given a lively closure, modifies the var binding.
 * @param { function } f - A lively closure whos binding has been instrumented beforehand.
 * @param { string } name - The name of the local variable to adjust.
 * @param { * } value - The value to adjust the local variable in the closure to.
 */
function setLocalVarValue (f, name, value) {
  if (f.hasLivelyClosure) f.livelyClosure.funcProperties[name] = value;
}

/**
 * Returns the var mapping for a given lively closure.
 */
function getVarMapping (f) {
  if (f.hasLivelyClosure) return f.livelyClosure.varMapping;
  if (f.isWrapper) return f.originalFunction.varMapping;
  if (f.varMapping) return f.varMapping;
  return {};
}

/**
 * @see setLocalVarValue
 */
function setProperty (func, name, value) {
  func[name] = value;
  if (func.hasLivelyClosure) func.livelyClosure.funcProperties[name] = value;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-
// class-related functions
// -=-=-=-=-=-=-=-=-=-=-=-=-

/**
 * Treats passed function as class (constructor).
 * @param { function } klass - The function to check for as a class.
 * @returns { string[] }
 * @example
 * var Klass1 = function() {}
 * Klass1.prototype.foo = function(a, b) { return a + b; };
 * Klass1.prototype.bar = function(a) { return this.foo(a, 3); };
 * Klass1.prototype.baz = 23;
 * functionNames(Klass1); // => ["bar","foo"]
 */
function functionNames (klass) {
  let result = []; let lookupObj = klass.prototype;
  while (lookupObj) {
    result = Object.keys(lookupObj).reduce(function (result, name) {
      if (typeof lookupObj[name] === 'function' && result.indexOf(name) === -1) { result.push(name); }
      return result;
    }, result);
    lookupObj = Object.getPrototypeOf(lookupObj);
  }
  return result;
}

/**
 * Return the names of the functions defined on the prototype.
 * @param { function } func - The function whos prototype to check.
 * @return { string[] }
 */
function localFunctionNames (func) {
  return Object.keys(func.prototype)
    .filter(function (name) { return typeof func.prototype[name] === 'function'; });
}

// -=-=-=-=-=-=-=-=-=-=-
// tracing and logging
// -=-=-=-=-=-=-=-=-=-=-

/**
 * Wraps a given function to automatically log all the errors encountered to the console.
 * @param { function } func - The function to wrap.
 * @param { string } prefix - The log prefix to pass to the console.warn() call.
 * @returns { function }
 */
function logErrors (func, prefix) {
  const advice = function logErrorsAdvice (proceed /*, args */) {
    const args = Array.prototype.slice.call(arguments);
    args.shift();
    try {
      return proceed.apply(func, args);
    } catch (er) {
      if (typeof lively !== 'undefined' && lively.morphic && lively.morphic.World && lively.morphic.World.current()) {
        lively.morphic.World.current().logError(er);
        throw er;
      }

      if (prefix) console.warn('ERROR: %s.%s(%s): err: %s %s', func, prefix, args, er, er.stack || '');
      else console.warn('ERROR: %s %s', er, er.stack || '');
      throw er;
    }
  };

  advice.methodName = '$logErrorsAdvice';
  const result = wrap(func, advice);
  result.originalFunction = func;
  result.methodName = '$logErrorsWrapper';
  return result;
}

/**
 * Wrap a function to log to console once it succesfully completes.
 * @params { function } func - The function to wrap.
 * @params { string } module - The message to log once the call completes.
 * @returns { function }
 */
function logCompletion (func, module) {
  const advice = function logCompletionAdvice (proceed) {
    const args = Array.prototype.slice.call(arguments);
    args.shift();
    let result;
    try {
      result = proceed.apply(func, args);
    } catch (er) {
      console.warn('failed to load ' + module + ': ' + er);
      if (typeof lively !== 'undefined' && lively.lang.Execution) { lively.lang.Execution.showStack(); }
      throw er;
    }
    console.log('completed ' + module);
    return result;
  };

  advice.methodName = '$logCompletionAdvice::' + module;

  const result = wrap(func, advice);
  result.methodName = '$logCompletionWrapper::' + module;
  result.originalFunction = func;
  return result;
}

/**
 * Wraps a function to log to the console every time it is applied.
 * @param { function } func - The function to wrap.
 * @param { boolean } isUrgent - Wether or not the applications should logged as warnings or plain logs.
 * @returns { function }
 */
function logCalls (func, isUrgent) {
  const original = func;
  let result;
  const advice = function logCallsAdvice (proceed) {
    const args = Array.prototype.slice.call(arguments);
    args.shift(), result = proceed.apply(func, args);
    if (isUrgent) {
      console.warn('%s(%s) -> %s', qualifiedMethodName(original), args, result);
    } else {
      console.log('%s(%s) -> %s', qualifiedMethodName(original), args, result);
    }
    return result;
  };

  advice.methodName = '$logCallsAdvice::' + qualifiedMethodName(func);

  result = wrap(func, advice);
  result.originalFunction = func;
  result.methodName = '$logCallsWrapper::' + qualifiedMethodName(func);
  return result;
}

/**
 * Wraps a function such that it traces all subsequent function calls to a stack object.
 * @param { function } func - The function to wrap.
 * @param { List } stack - The stack to trace the occuring calls to.
 * @returns { function }
 */
function traceCalls (func, stack) {
  const advice = function traceCallsAdvice (proceed) {
    const args = Array.prototype.slice.call(arguments);
    args.shift();
    stack.push(args);
    const result = proceed.apply(func, args);
    stack.pop();
    return result;
  };
  return wrap(func, advice);
}

/**
 * Returns the current stackframes of the execution as a string.
 * @returns { string }
 */
function webkitStack () {
  // this won't work in every browser
  try {
    throw new Error();
  } catch (e) {
    // remove "Error" and this function from stack, rewrite it nicely
    return String(e.stack)
      .split(/\n/)
      .slice(2)
      .map(function (line) { return line.replace(/^\s*at\s*([^\s]+).*/, '$1'); })
      .join('\n');
  }
}

export {
  isNativeFunction,

  Empty, K, Null, False, True, notYetImplemented, withNull,

  all, own,

  argumentNames, qualifiedMethodName, extractBody,

  timeToRun, timeToRunN,

  delay, throttle, debounce, throttleNamed, debounceNamed,

  createQueue, workerWithCallbackQueue,

  composeAsync, compose,

  waitFor, waitForAll,

  flip, curry, wrap, binds,
  getOriginal, wrapperChain,

  replaceMethodForOneCall,
  once, either, eitherNamed,

  evalJS,

  fromString,

  asScript, asScriptOf, addToObject,
  setLocalVarValue, getVarMapping, setProperty,

  functionNames, localFunctionNames,

  logErrors, logCompletion, logCalls, traceCalls, webkitStack
};