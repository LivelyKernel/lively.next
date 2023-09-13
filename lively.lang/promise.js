/* global Promise */

/**
 * Methods helping with promises (Promise/A+ model). Not a promise shim.
 * @module lively.lang/promise
 */

/**
 * Promise object / function converter
 * @param { object|function } obj - The value or function to convert into a promise.
 * @returns { Promise } 
 * @example
 * promise("foo");
 *   // => Promise({state: "fullfilled", value: "foo"})
 * lively.lang.promise({then: (resolve, reject) => resolve(23)})
 *   // => Promise({state: "fullfilled", value: 23})
 * lively.lang.promise(function(val, thenDo) { thenDo(null, val + 1) })(3)
 *   // => Promise({state: "fullfilled", value: 4})
 */
function promise (obj) {
  return (typeof obj === 'function')
    ? convertCallbackFun(obj)
    : Promise.resolve(obj);
}

/**
 * Like `Promise.resolve(resolveVal)` but waits for `ms` milliseconds
 * before resolving
 * @async
 * @param { number } ms - The duration to delay the execution in milliseconds.
 * @param { * } resolveVal - The value to resolve to.
 */
function delay (ms, resolveVal) {
  return new Promise(resolve =>
    setTimeout(resolve, ms, resolveVal));
}

/**
 * like `promise.delay` but rejects instead of resolving.
 * @async
 * @param { number } ms - The duration to delay the execution in milliseconds.
 * @param { * } rejectedVal - The value to reject.
 */
function delayReject (ms, rejectVal) {
  return new Promise((_, reject) =>
    setTimeout(reject, ms, rejectVal));
}

/**
 * Takes a promise and either resolves to the value of the original promise
 * when it succeeds before `ms` milliseconds passed or fails with a timeout
 * error.
 * @async
 * @param { number } ms - The duration to wait for the promise to resolve in milliseconds.
 * @param { Promise } promise - The promise to wait for to finish.
 */
function timeout (ms, promise) {
  return new Promise((resolve, reject) => {
    let done = false;
    setTimeout(() => !done && (done = true) && reject(new Error('Promise timed out')), ms);
    promise.then(
      val => !done && (done = true) && resolve(val),
      err => !done && (done = true) && reject(err));
  });
}

/**
 * For a given promise, computes the time it takes to resolve.
 * @async
 * @param { Promise } prom - The promise to time.
 * @returns { number } The time it took the promise to finish in milliseconds.
 */
function timeToRun (prom) {
  const startTime = Date.now();
  return Promise.resolve(prom).then(() => Date.now() - startTime);
}

const waitForClosures = {};

/* 
function clearPendingWaitFors () {
  Object.keys(waitForClosures).forEach(i => {
    delete waitForClosures[i];
    clearInterval(i);
  });
}
*/

/**
 * Tests for a condition calling function `tester` until the result is
 * truthy. Resolves with last return value of `tester`. If `ms` is defined
 * and `ms` milliseconds passed, reject with timeout error
 * if timeoutObj is passed will resolve(!) with this object instead of raise
 * an error
 * *This function has a huge performance impact if used carelessly.
 * Always consider this to be the absolute last resort if a problem
 * can not be solved by promises/events.*
 * @param { number } [ms] - The maximum number of milliseconds to wait for `tester` to become true.
 * @param { function } tester - The function to test for the condition.
 * @param { object } [timeoutObj] - The object to resolve to if the condition was not met and we timed out.
 * @returns { object }
 */
function waitFor (ms, tester, timeoutObj) {
  if (typeof ms === 'function') { tester = ms; ms = undefined; }
  let value;
  if (value = tester()) return Promise.resolve(value);
  return new Promise((resolve, reject) => {
    let stopped = false;
    let timedout = false;
    let error;
    let value;
    const stopWaiting = (i) => {
      clearInterval(i);
      delete waitForClosures[i];
    };
    const i = setInterval(() => {
      if (stopped) return stopWaiting(i);
      try { value = tester(); } catch (e) { error = e; }
      if (!value && !error && !timedout) return;
      stopped = true;
      stopWaiting(i);
      if (error) return reject(error);
      if (timedout) {
        return typeof timeoutObj === 'undefined'
          ? reject(new Error('timeout'))
          : resolve(timeoutObj);
      }
      return resolve(value);
    }, 10);
    waitForClosures[i] = i;
    if (typeof ms === 'number') setTimeout(() => timedout = true, ms);
  });
}

/**
 * Returns an object that conveniently gives access to the promise itself and 
 * its resolution and rejection callback. This separates the resolve/reject handling
 * from the promise itself. Similar to the deprecated `Promise.defer()`.
 * @returns { { resolve: function, reject: function, promise: Promise } }
 */
function deferred () {
  let resolve; let reject;
  const promise = new Promise(function (_resolve, _reject) {
    resolve = _resolve; reject = _reject;
  });
  return { resolve: resolve, reject: reject, promise: promise };
}

/**
 * Takes a function that accepts a nodejs-style callback function as a last
 * parameter and converts it to a function *not* taking the callback but
 * producing a promise instead. The promise will be resolved with the
 * *first* non-error argument.
 * nodejs callback convention: a function that takes as first parameter an
 * error arg and second+ parameters are the result(s).
 * @param { function } func - The callback function to convert.
 * @returns { function } The converted asyncronous function. 
 * @example
 * var fs = require("fs"),
 *     readFile = promise.convertCallbackFun(fs.readFile);
 * readFile("./some-file.txt")
 *   .then(content => console.log(String(content)))
 *   .catch(err => console.error("Could not read file!", err));
 */
function convertCallbackFun (func) {
  return function promiseGenerator (/* args */) {
    const args = Array.from(arguments); const self = this;
    return new Promise(function (resolve, reject) {
      args.push(function (err, result) { return err ? reject(err) : resolve(result); });
      func.apply(self, args);
    });
  };
}

/**
 * Like convertCallbackFun but the promise will be resolved with the
 * all non-error arguments wrapped in an array.
 * @param { function } func - The callback function to convert.
 * @returns { function } The converted asyncronous function. 
 */
function convertCallbackFunWithManyArgs (func) {
  return function promiseGenerator (/* args */) {
    const args = Array.from(arguments); const self = this;
    return new Promise(function (resolve, reject) {
      args.push(function (/* err + args */) {
        const args = Array.from(arguments);
        const err = args.shift();
        return err ? reject(err) : resolve(args);
      });
      func.apply(self, args);
    });
  };
}

function _chainResolveNext (promiseFuncs, prevResult, akku, resolve, reject) {
  const next = promiseFuncs.shift();
  if (!next) resolve(prevResult);
  else {
    try {
      Promise.resolve(next(prevResult, akku))
        .then(result => _chainResolveNext(promiseFuncs, result, akku, resolve, reject))
        .catch(function (err) { reject(err); });
    } catch (err) { reject(err); }
  }
}

/**
 * Similar to Promise.all but takes a list of promise-producing functions
 * (instead of Promises directly) that are run sequentially. Each function
 * gets the result of the previous promise and a shared "state" object passed
 * in. The function should return either a value or a promise. The result of
 * the entire chain call is a promise itself that either resolves to the last
 * returned value or rejects with an error that appeared somewhere in the
 * promise chain. In case of an error the chain stops at that point.
 * @async
 * @param { functions[] } promiseFuncs - The list of functions that each return a promise.
 * @returns { * } The result the last promise resolves to.
 * @example
 * lively.lang.promise.chain([
 *   () => Promise.resolve(23),
 *   (prevVal, state) => { state.first = prevVal; return prevVal + 2 },
 *   (prevVal, state) => { state.second = prevVal; return state }
 * ]).then(result => console.log(result));
 * // => prints {first: 23,second: 25}
 */
function chain (promiseFuncs) {
  return new Promise((resolve, reject) =>
    _chainResolveNext(
      promiseFuncs.slice(), undefined, {},
      resolve, reject));
}

/**
 * Converts a given promise to one that executes the `finallyFn` regardless of wether it
 * resolved successfully or failed during execution.
 * @param { Promise } promise - The promise to convert.
 * @param { function } finallyFn - The callback to run after either resolve or reject has been run.
 * @returns { Promise } The converted promise.
 */
function promise_finally (promise, finallyFn) {
  return Promise.resolve(promise)
    .then(result => { try { finallyFn(); } catch (err) { console.error('Error in promise finally: ' + err.stack || err); } return result; })
    .catch(err => { try { finallyFn(); } catch (err) { console.error('Error in promise finally: ' + err.stack || err); } throw err; });
}

/**
 * Starts functions from `promiseGenFns` that are expected to return a promise
 * Once `parallelLimit` promises are unresolved at the same time, stops
 * spawning further promises until a running promise resolves.
 * @param { function[] } promiseGenFns - A list of functions that each return a promise.
 * @param { number } parallelLimit - The maximum number of promises to process at the same time. 
 */
function parallel (promiseGenFns, parallelLimit = Infinity) {
  if (!promiseGenFns.length) return Promise.resolve([]);

  const results = [];
  let error = null;
  let index = 0;
  let left = promiseGenFns.length;
  let resolve; let reject;

  return new Promise((res, rej) => {
    resolve = () => res(results);
    reject = err => rej(error = err);
    spawnMore();
  });

  function spawn () {
    parallelLimit--;
    try {
      const i = index++; const prom = promiseGenFns[i]();
      prom.then(result => {
        parallelLimit++;
        results[i] = result;
        if (--left === 0) resolve();
        else spawnMore();
      }).catch(err => reject(err));
    } catch (err) { reject(err); }
  }

  function spawnMore () {
    while (!error && left > 0 && index < promiseGenFns.length && parallelLimit > 0) { spawn(); }
  }
}

export default promise;

export {
  promise,
  delay,
  delayReject,
  timeout,
  timeToRun,
  waitFor,
  deferred,
  convertCallbackFun,
  convertCallbackFunWithManyArgs,
  chain,
  promise_finally as finally,
  parallel
};
