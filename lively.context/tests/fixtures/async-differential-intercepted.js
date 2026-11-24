/** Enable actual module interception without executing a stop. */
export function stop () { debugger; }
/** Async scenarios; each receives a log and returns a Promise for a final value. */
const tick = () => Promise.resolve();
/** Run nested await effects. */
async function nestedG (log) { log.push('g1'); await null; log.push('g2'); await tick(); log.push('g3'); return 1; }
/** Await a nested async call. */
async function nestedF (log) { log.push('f1'); const x = await nestedG(log); log.push('f2'); return x + 1; }
/** Yield values with async cleanup. */
async function * agen (log) { try { log.push('gen start'); yield 1; await null; yield 2; log.push('gen after 2'); yield 3; } finally { log.push('gen finally'); } }
/** Reject an iterator request after an await. */
async function * agenThrow () { yield 1; await null; throw new TypeError('gen boom'); }
/** Delegate to an async iterator. */
async function * agenDelegate (log) { yield 0; yield * agen(log); yield 4; }
/** Recurse through awaited calls. */
async function fact (n) { if (n <= 1) return 1; return n * await fact(n - 1); }

/** Dispatch the native/intercepted differential scenario. */
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
    const f = async () => { try { log.push('try'); await tick(); log.push('after await'); return 'r'; } finally { log.push('finally'); } };
    const p = f(); log.push('caller'); return await p;
  },
  finallyOverride: async log => { const f = async () => { try { await null; return 1; } finally { log.push('fin'); } }; return f(); },
  finallyReturnOverride: async log => { const f = async () => { try { await null; return 1; } finally { return 2; } }; return f(); },
  catchRejectedAwait: async log => { try { await Promise.reject(new Error('x')); } catch (e) { log.push('caught ' + e.message); return 'ok'; } },
  catchRejectedNonError: async log => { try { await Promise.reject(42); } catch (e) { log.push('caught ' + typeof e + ' ' + e); return e; } },
  throwAfterAwaitNonError: async log => { await null; throw 'str-reason'; },
  throwAfterAwaitError: async log => { await null; throw new RangeError('after'); },
  throwNullAfterAwait: async log => { await null; throw null; },
  rejectReturnPromise: async log => Promise.reject(new TypeError('returned')),
  returnAwaitInTry: async log => { try { return await Promise.reject(new Error('inner')); } catch (e) { return 'caught ' + e.message; } },
  awaitInCatchAndFinally: async log => { try { throw new Error('e1'); } catch (e) { await null; log.push('catch ' + e.message); } finally { await null; log.push('finally'); } return log.length; },
  finallyThrowsAfterAwait: async log => { try { await null; return 1; } finally { await null; throw new EvalError('fin'); } },
  forAwaitGen: async log => { let s = 0; for await (const x of agen(log)) { s += x; log.push('got ' + x); } return s; },
  forAwaitBreak: async log => { for await (const x of agen(log)) { log.push('got ' + x); if (x === 2) break; } return 'broke'; },
  forAwaitThrow: async log => { const seen = []; try { for await (const x of agenThrow()) seen.push(x); } catch (e) { return [seen, e.name, e.message]; } },
  agenManual: async log => { const g = agen(log); const a = await g.next(); const b = await g.return(9); const c = await g.next(); return [a, b, c]; },
  agenThrowInto: async log => { const g = agen(log); await g.next(); try { await g.throw(new Error('into')); } catch (e) { return ['threw', e.message]; } return 'no throw'; },
  agenDelegate: async log => { const out = []; for await (const x of agenDelegate(log)) out.push(x); return out; },
  awaitThenable: async log => await { then (r) { log.push('then called'); r(5); } },
  awaitThenableThrowing: async log => { try { await { then () { throw new URIError('then'); } }; } catch (e) { return e.name; } },
  asyncMethodThis: async log => { const o = { v: 3, async m () { await null; return this.v; } }; return o.m(); },
  asyncArrowLexical: async log => { /** Capture receiver and arguments for the async arrow. */ function outer () { return (async () => { await null; return [this.v, arguments[0], arguments.length]; })(); } return outer.call({ v: 1 }, 'arg', 'b'); },
  concurrentAll: async log => { const f = async (i) => { log.push('s' + i); await tick(); log.push('m' + i); await tick(); log.push('e' + i); return i; }; return Promise.all([f(1), f(2), f(3)]); },
  recursion: async log => fact(6),
  loopClosures: async log => { const fns = []; for (let i = 0; i < 3; i++) { await null; fns.push(() => i); } return fns.map(f => f()); },
  defaultsAndDestructuring: async log => { const f = async function ({ a = 1, b: [c] = [2] } = {}, d = a + c) { await null; return [a, c, d, arguments.length]; }; return [await f(), await f({ a: 5, b: [6] }, 0)]; },
  asyncInArrayCallback: async log => Promise.all([1, 2, 3].map(async x => { await null; return x * 2; })),
  syncThrowInAsyncNotSync: async log => { const f = async () => { throw new Error('sync part'); }; let sync = 'no sync throw'; let p; try { p = f(); } catch (e) { sync = 'threw synchronously'; } try { await p; } catch (e) { return [sync, e.message]; } },
  awaitTimeout: async log => { const v = await new Promise(r => setTimeout(() => r('late'), 20)); log.push(v); return v; },
  sequentialAwaitsInLoop: async log => { let s = 0; for (const x of [1, 2, 3]) s += await Promise.resolve(x); return s; },
  whileAwait: async log => { let i = 0; while (await Promise.resolve(i < 3)) i++; return i; },
  awaitInCondition: async log => { const r = (await Promise.resolve(true)) ? await Promise.resolve('y') : 'n'; return r; },
  awaitInTemplateAndCall: async log => { const join = (...xs) => xs.join('-'); return `${await 1}:${join(await 2, await Promise.resolve(3))}`; },
  promiseIdentity: async log => { const f = async () => 1; const p = f(); return [p instanceof Promise, Object.getPrototypeOf(p) === Promise.prototype, typeof p.then]; },
  asyncFnMeta: async log => { const f = async function named (a, b) {}; return [f.name, f.length, Object.prototype.toString.call(f), f.constructor.name]; },
  nestedTryFinallyUnwind: async log => { const g = async () => { try { try { await tick(); log.push('inner after'); } finally { log.push('inner finally'); } log.push('between'); await tick(); } finally { log.push('outer finally'); } return 'g'; }; return g(); },
  syncFinallyCountWithAsyncCallee: async log => { const child = async () => { await null; return 1; }; /** Keep synchronous finally effects outside the child await. */ function caller () { try { return child(); } finally { log.push('sync finally'); } } const p = caller(); log.push('after caller'); return p; }
  };
  return name === '*names*' ? Object.keys(asyncScenarios) : asyncScenarios[name](log);
}

/** Keep a delayed async return separate from a sync iterator sibling. */
export function sibA () { const s = { a: async () => { const v = await new Promise(r => setTimeout(() => r('late'), 5)); return v; }, b: () => { for (const x of [1]) ; } }; return s.a(); }
/** Keep a delayed async return separate from an async iterator sibling. */
export function sibB () { const s = { a: async () => { const v = await new Promise(r => setTimeout(() => r('late'), 5)); return v; }, b: async () => { for (const x of [1]) await x; } }; return s.a(); }
/** Keep an awaited return separate from a for-await sibling. */
export function sibE () { const a = async () => { await null; return 'v'; }; const b = async () => { for await (const x of [1]) {} }; return a(); }
/** Keep an awaited return separate from a for-of sibling. */
export function sibF () { const a = async () => { await null; return 'v'; }; const b = () => { for (const x of [1]) {} }; return a(); }
/** Keep a no-await async return separate from an iterator sibling. */
export function sibG () { const a = async () => 'noawait'; const b = () => { for (const x of [1]) {} }; return a(); }
/** Keep synchronous siblings independent. */
export function sibSync () { const a = () => 'sync'; const b = () => { for (const x of [1]) {} }; return a(); }
/** Retain an awaited value across a later iterator loop. */
export async function forOfThenReturn () { const v = await new Promise(r => setTimeout(() => r('late'), 5)); for (const x of [1]) {} return v; }
/** Retain the return value after an earlier iterator loop. */
export async function forOfBeforeAwait () { for (const x of [1]) {} const v = await Promise.resolve('v2'); return v; }
/** Throw from an async generator without an await. */
async function * g1 () { yield 1; throw new TypeError('t'); }
/** Catch an async iterator failure before its first await. */
export async function forAwaitCatchNoAwait () { try { for await (const x of g1()) ; } catch (e) { return 'caught ' + e.message; } return 'none'; }
/** Throw from a synchronous generator. */
function * sg () { yield 1; throw new TypeError('s'); }
/** Catch a synchronous iterator failure. */
export function forOfCatch () { try { for (const x of sg()) ; } catch (e) { return 'caught ' + e.message; } return 'none'; }
/** Return a Promise from an async object method without await. */
export async function asyncMethodNoAwait () { const o = { async m () { return 1; } }; return o.m(); }
/** Call an awaiting object method from a synchronous function. */
export function asyncMethodFromSync () { const o = { async m () { await null; return 2; } }; return o.m(); }
/** Create and invoke a getter after resumption. */
export async function getterAfterAwait () { await null; const o = { get x () { return 7; } }; return o.x; }
/** Characterize the existing native class fallback. */
export async function methodInClassAfterAwait () { await null; class Q { m () { return 8; } } return new Q().m(); }

/** Propagate a numeric coercion error through a native boundary. */
export function nativeValueOf () { return +{ valueOf () { throw new SyntaxError("valueOf failure"); } }; }
/** Propagate a getter error through Object.assign. */
export function nativeGetter () { return Object.assign({}, { get value () { throw new RangeError("getter failure"); } }); }
/** Propagate array-like length coercion failure. */
export function nativeLength () { return Array.prototype.forEach.call({length: {valueOf () { throw new TypeError("length failure"); }}}, () => {}); }

/** Create a receiver-dependent method after resumption. */
export async function methodAfterAwait () { await null; const object = { value: 3, method () { return this.value; } }; return object.method(); }
/** Keep a delayed async return separate from a for-await sibling. */
export function delayedForAwaitSibling () { const a = async () => { const value = await new Promise(resolve => setTimeout(() => resolve('sibling'), 5)); return value; }; const b = async () => { for await (const value of [1]) {} }; return a(); }
/** Accumulate awaited values inside an iterator loop. */
export async function compoundAwaitInLoop () { let sum = 0; for (const value of [1, 2, 3]) sum += await Promise.resolve(value); return sum; }
/** Throw the supplied object from a native coercion or getter. */
export function nativeErrorIdentity (kind, failure) {
  if (kind === 'valueOf') return +{ valueOf () { throw failure; } };
  if (kind === 'getter') return Object.assign({}, { get value () { throw failure; } });
  return Array.prototype.forEach.call({length: {valueOf () { throw failure; }}}, () => {});
}
/** Pause after awaiting in a method or iterator arrow. */
export function asyncPause (kind, log) {
  const object = {value: 7, async method () { log.push('before'); await null; debugger; log.push('after'); return this.value + 1; }};
  if (kind === 'method') return object.method();
  const arrow = async () => { for (const value of [object.value]) { log.push('before'); await null; debugger; log.push('after'); return value + 1; } };
  return arrow();
}
