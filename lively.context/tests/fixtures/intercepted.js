// Scenarios that run both in an intercepted module and in a native copy of this module.
// The debugger statements below enable automatic interception; ordinary scenarios never execute one.

const tick = () => Promise.resolve();
async function nestedG (log) { log.push('g1'); await null; log.push('g2'); await tick(); log.push('g3'); return 1; }
async function nestedF (log) { log.push('f1'); const x = await nestedG(log); log.push('f2'); return x + 1; }
async function * agen (log) {
  try { log.push('gen start'); yield 1; await null; yield 2; log.push('gen after 2'); yield 3; } finally { log.push('gen finally'); }
}
async function * agenThrow () { yield 1; await null; throw new TypeError('gen boom'); }
async function * agenDelegate (log) { yield 0; yield * agen(log); yield 4; }
async function fact (n) { if (n <= 1) return 1; return n * await fact(n - 1); }

/** Runs the async scenario `name` with an effect log; '*names*' lists the scenarios. */
export function runAsync (name, log) {
  const asyncScenarios = {
    nestedAwaits: async log => {
      const p = nestedF(log); log.push('caller after call');
      let t = Promise.resolve(); for (let i = 0; i < 6; i++) t = t.then(() => log.push('tick' + i));
      const r = await p; await t; return r;
    },
    microtaskOrder: async log => {
      const p = (async () => { log.push('a1'); await null; log.push('a2'); await null; log.push('a3'); })();
      Promise.resolve().then(() => log.push('m1')).then(() => log.push('m2')).then(() => log.push('m3')).then(() => log.push('m4'));
      log.push('sync end'); await p; await new Promise(r => setTimeout(r, 0)); return 'done';
    },
    finallyAfterAwait: async log => {
      const f = async () => {
        try { log.push('try'); await tick(); log.push('after await'); return 'r'; } finally { log.push('finally'); }
      };
      const p = f(); log.push('caller'); return await p;
    },
    finallyOverride: async log => { const f = async () => { try { await null; return 1; } finally { log.push('fin'); } }; return f(); },
    finallyReturnOverride: async log => { const f = async () => { try { await null; return 1; } finally { return 2; } }; return f(); },
    catchRejectedAwait: async log => {
      try { await Promise.reject(new Error('x')); } catch (e) { log.push('caught ' + e.message); return 'ok'; }
    },
    catchRejectedNonError: async log => {
      try { await Promise.reject(42); } catch (e) { log.push('caught ' + typeof e + ' ' + e); return e; }
    },
    throwAfterAwaitNonError: async log => { await null; throw 'str-reason'; },
    throwAfterAwaitError: async log => { await null; throw new RangeError('after'); },
    throwNullAfterAwait: async log => { await null; throw null; },
    rejectReturnPromise: async log => Promise.reject(new TypeError('returned')),
    returnAwaitInTry: async log => { try { return await Promise.reject(new Error('inner')); } catch (e) { return 'caught ' + e.message; } },
    awaitInCatchAndFinally: async log => {
      try { throw new Error('e1'); } catch (e) { await null; log.push('catch ' + e.message); } finally { await null; log.push('finally'); }
      return log.length;
    },
    finallyThrowsAfterAwait: async log => { try { await null; return 1; } finally { await null; throw new EvalError('fin'); } },
    forAwaitGen: async log => { let s = 0; for await (const x of agen(log)) { s += x; log.push('got ' + x); } return s; },
    forAwaitBreak: async log => { for await (const x of agen(log)) { log.push('got ' + x); if (x === 2) break; } return 'broke'; },
    forAwaitThrow: async log => {
      const seen = []; try { for await (const x of agenThrow()) seen.push(x); } catch (e) { return [seen, e.name, e.message]; }
    },
    agenManual: async log => {
      const g = agen(log); const a = await g.next(); const b = await g.return(9); const c = await g.next(); return [a, b, c];
    },
    agenThrowInto: async log => {
      const g = agen(log); await g.next();
      try { await g.throw(new Error('into')); } catch (e) { return ['threw', e.message]; } return 'no throw';
    },
    agenDelegate: async log => { const out = []; for await (const x of agenDelegate(log)) out.push(x); return out; },
    awaitThenable: async log => await { then (r) { log.push('then called'); r(5); } },
    awaitThenableThrowing: async log => { try { await { then () { throw new URIError('then'); } }; } catch (e) { return e.name; } },
    asyncMethodThis: async log => { const o = { v: 3, async m () { await null; return this.v; } }; return o.m(); },
    asyncArrowLexical: async log => {
      function outer () { return (async () => { await null; return [this.v, arguments[0], arguments.length]; })(); }
      return outer.call({ v: 1 }, 'arg', 'b');
    },
    concurrentAll: async log => {
      const f = async (i) => { log.push('s' + i); await tick(); log.push('m' + i); await tick(); log.push('e' + i); return i; };
      return Promise.all([f(1), f(2), f(3)]);
    },
    recursion: async log => fact(6),
    loopClosures: async log => { const fns = []; for (let i = 0; i < 3; i++) { await null; fns.push(() => i); } return fns.map(f => f()); },
    defaultsAndDestructuring: async log => {
      const f = async function ({ a = 1, b: [c] = [2] } = {}, d = a + c) { await null; return [a, c, d, arguments.length]; };
      return [await f(), await f({ a: 5, b: [6] }, 0)];
    },
    asyncInArrayCallback: async log => Promise.all([1, 2, 3].map(async x => { await null; return x * 2; })),
    syncThrowInAsyncNotSync: async log => {
      const f = async () => { throw new Error('sync part'); }; let sync = 'no sync throw'; let p;
      try { p = f(); } catch (e) { sync = 'threw synchronously'; }
      try { await p; } catch (e) { return [sync, e.message]; }
    },
    awaitTimeout: async log => { const v = await new Promise(r => setTimeout(() => r('late'), 20)); log.push(v); return v; },
    sequentialAwaitsInLoop: async log => { let s = 0; for (const x of [1, 2, 3]) s += await Promise.resolve(x); return s; },
    whileAwait: async log => { let i = 0; while (await Promise.resolve(i < 3)) i++; return i; },
    awaitInCondition: async log => { const r = (await Promise.resolve(true)) ? await Promise.resolve('y') : 'n'; return r; },
    awaitInTemplateAndCall: async log => {
      const join = (...xs) => xs.join('-'); return `${await 1}:${join(await 2, await Promise.resolve(3))}`;
    },
    promiseIdentity: async log => {
      const f = async () => 1; const p = f(); return [p instanceof Promise, Object.getPrototypeOf(p) === Promise.prototype, typeof p.then];
    },
    asyncFnMeta: async log => {
      const f = async function named (a, b) {}; return [f.name, f.length, Object.prototype.toString.call(f), f.constructor.name];
    },
    nestedTryFinallyUnwind: async log => {
      const g = async () => {
        try { try { await tick(); log.push('inner after'); } finally { log.push('inner finally'); } log.push('between'); await tick(); }
        finally { log.push('outer finally'); }
        return 'g';
      };
      return g();
    },
    syncFinallyCountWithAsyncCallee: async log => {
      const child = async () => { await null; return 1; };
      function caller () { try { return child(); } finally { log.push('sync finally'); } }
      const p = caller(); log.push('after caller'); return p;
    }
  };
  return name === '*names*' ? Object.keys(asyncScenarios) : asyncScenarios[name](log);
}

export function sibA () {
  const s = { a: async () => { const v = await new Promise(r => setTimeout(() => r('late'), 5)); return v; },
    b: () => { for (const x of [1]) ; } };
  return s.a();
}
export function sibB () {
  const s = { a: async () => { const v = await new Promise(r => setTimeout(() => r('late'), 5)); return v; },
    b: async () => { for (const x of [1]) await x; } };
  return s.a();
}
export function sibE () {
  const a = async () => { await null; return 'v'; }; const b = async () => { for await (const x of [1]) {} }; return a();
}
export function sibF () { const a = async () => { await null; return 'v'; }; const b = () => { for (const x of [1]) {} }; return a(); }
export function sibG () { const a = async () => 'noawait'; const b = () => { for (const x of [1]) {} }; return a(); }
export function sibSync () { const a = () => 'sync'; const b = () => { for (const x of [1]) {} }; return a(); }
export async function forOfThenReturn () {
  const v = await new Promise(r => setTimeout(() => r('late'), 5)); for (const x of [1]) {} return v;
}
export async function forOfBeforeAwait () { for (const x of [1]) {} const v = await Promise.resolve('v2'); return v; }
async function * g1 () { yield 1; throw new TypeError('t'); }
export async function forAwaitCatchNoAwait () {
  try { for await (const x of g1()) ; } catch (e) { return 'caught ' + e.message; } return 'none';
}
function * sg () { yield 1; throw new TypeError('s'); }
export function forOfCatch () { try { for (const x of sg()) ; } catch (e) { return 'caught ' + e.message; } return 'none'; }
export async function asyncMethodNoAwait () { const o = { async m () { return 1; } }; return o.m(); }
export function asyncMethodFromSync () { const o = { async m () { await null; return 2; } }; return o.m(); }
export async function getterAfterAwait () { await null; const o = { get x () { return 7; } }; return o.x; }
export async function methodInClassAfterAwait () { await null; class Q { m () { return 8; } } return new Q().m(); }
export function nativeValueOf () { return +{ valueOf () { throw new SyntaxError('valueOf failure'); } }; }
export function nativeGetter () { return Object.assign({}, { get value () { throw new RangeError('getter failure'); } }); }
export function nativeLength () {
  return Array.prototype.forEach.call({length: {valueOf () { throw new TypeError('length failure'); }}}, () => {});
}
export async function methodAfterAwait () {
  await null; const object = { value: 3, method () { return this.value; } }; return object.method();
}
export function delayedForAwaitSibling () {
  const a = async () => { const value = await new Promise(resolve => setTimeout(() => resolve('sibling'), 5)); return value; };
  const b = async () => { for await (const value of [1]) {} };
  return a();
}
export async function compoundAwaitInLoop () {
  let sum = 0; for (const value of [1, 2, 3]) sum += await Promise.resolve(value); return sum;
}

/** Throws `failure` from a native coercion or getter. */
export function nativeErrorIdentity (kind, failure) {
  if (kind === 'valueOf') return +{ valueOf () { throw failure; } };
  if (kind === 'getter') return Object.assign({}, { get value () { throw failure; } });
  return Array.prototype.forEach.call({length: {valueOf () { throw failure; }}}, () => {});
}
/** Pauses after awaiting in a method or an iterator arrow. */
export function asyncPause (kind, log) {
  const object = {value: 7, async method () { log.push('before'); await null; debugger; log.push('after'); return this.value + 1; }};
  if (kind === 'method') return object.method();
  const arrow = async () => {
    for (const value of [object.value]) { log.push('before'); await null; debugger; log.push('after'); return value + 1; }
  };
  return arrow();
}

/** Applies an array method (the current one, or `nativeMethod`) and summarizes result, holes, callback calls and mutations. */
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
    else args = [scenario === 'invalid' ? null : function (a, b) { return scenario === 'stable' ? (a.key - b.key) * 10 : (a - b) * 10; }];
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

/** Suspends every callback of a real array method call. */
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

export async function cached () { return 1; }
export async function fails (error) { throw error; }
export async function later (promise, log, pause) {
  log.push('start');
  const value = await promise;
  log.push('awaited');
  if (pause) debugger;
  return value + 1;
}
/** Keeps a synchronous caller running while its child awaits. */
export function syncCaller (promise, log) {
  try {
    const pending = later(promise, log, false);
    log.push('caller returned');
    return {pending};
  } catch (error) { return {caught: error}; }
}
export function asyncClosures () { return {arrow: async () => 2, expression: async function () { return 3; }}; }
/** Reaches the async boundary after the caller switches to the interpreter. */
export function resumedSyncCaller (promise, log) {
  debugger;
  return syncCaller(promise, log);
}
