// The dormant stop enables the real module interception path.
/** Enable automatic module interception with a dormant debugger statement. */
export function stop () { debugger; }

/** Compare one real intercepted array operation with its native counterpart. */
export function exerciseArray (method, scenario, nativeMethod) {
  const implementation = nativeMethod || Array.prototype[method];
  let input = [3, , 1, undefined, 2];
  if (scenario === 'inherited') input = Object.assign(Object.create({1: 4}), {0: 3, 2: 1, length: 3});
  if (scenario === 'empty') input = [];
  if (scenario === 'null') input = null;
  if (scenario === 'species') {
    input = [1, , 3];
    input.constructor = {[Symbol.species]: function Result (length) { this.length = length; }};
  }
  const calls = [], context = {tag: 'receiver'};
  const callback = function (value, index, array) {
    if (scenario === 'mutating' && index === 0) { array.push(99); delete array[2]; }
    calls.push([value, index, array === input, this === context]);
    return method === 'map' ? value * 2 : value === 1;
  };
  let args = [scenario === 'invalid' || scenario === 'empty' ? null : callback, context];
  if (method === 'reduce' || method === 'reduceRight') {
    args = [function (memo, value, index, array) {
      if (scenario === 'mutating') array.push(99);
      calls.push([value, index, array === input, this === undefined]);
      return memo + (value || 0);
    }];
    if (scenario !== 'no-initial' && scenario !== 'empty') args.push(0);
    if (scenario === 'invalid') args[0] = null;
  }
  if (method === 'sort') {
    if (scenario === 'stable') input = [{key: 2, id: 'a'}, {key: 1, id: 'b'}, {key: 2, id: 'c'}];
    if (scenario === 'default') { input = [20, 1, 10, undefined, , 2]; args = []; }
    else args = [scenario === 'invalid' ? null : function (a, b) {
      return scenario === 'stable' ? (a.key - b.key) * 10 : (a - b) * 10;
    }];
  }
  try {
    const result = implementation.apply(input, args);
    const summarize = value => {
      if (!value || typeof value !== 'object') return value;
      const entries = [], keys = Object.keys(value);
      for (let i = 0; i < keys.length; i++) if (keys[i] !== 'constructor') entries.push([keys[i], value[keys[i]]]);
      return {array: Array.isArray(value), length: value.length, entries};
    };
    return {same: result === input, result: summarize(result), input: summarize(input), calls};
  } catch (error) { return {error: error.name, calls}; }
}

/** Exercise the Promise contract of an async function without await. */
export async function cached () { return 1; }
/** Exercise rejection without a synchronous throw. */
export async function fails (error) { throw error; }
/** Pause after an externally supplied asynchronous result. */
export async function later (promise, log, pause) {
  log.push('start');
  const value = await promise;
  log.push('awaited');
  if (pause) debugger;
  return value + 1;
}
/** Keep a synchronous caller running while its child awaits. */
export function syncCaller (promise, log) {
  try {
    const pending = later(promise, log, false);
    log.push('caller returned');
    return {pending};
  } catch (error) { return {caught: error}; }
}
/** Exercise both async closure syntaxes after rewriting. */
export function asyncClosures () {
  return {arrow: async () => 2, expression: async function () { return 3; }};
}

/** Suspend every callback in a real intercepted array method. */
export function pauseInArray (method, pause) {
  const log = [], input = [3, 1, 2];
  const callback = function (a, b) {
    if (pause) debugger;
    if (method === 'sort') return (a - b) * 10;
    if (method === 'reduce' || method === 'reduceRight') { log.push(b); return a + b; }
    log.push(a);
    return method === 'map' ? a * 2 : a === 2;
  };
  const args = method === 'reduce' || method === 'reduceRight' ? [callback, 0] : [callback];
  return {result: Array.prototype[method].apply(input, args), input, log};
}

/** Exercise the async boundary after the caller switches to the interpreter. */
export function resumedSyncCaller (promise, log) {
  debugger;
  return syncCaller(promise, log);
}
