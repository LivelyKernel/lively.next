/* global System, describe, before, after, it */
import { expect } from 'mocha-es6';
import { installModuleDebugger } from '../lib/module-debugger.js';

const nativeMethods = Object.fromEntries(['sort', 'filter', 'forEach', 'some', 'every', 'map', 'reduce', 'reduceRight'].map(name => [name, Array.prototype[name]]));

describe('intercepted language semantics', function () {
  this.timeout(30000);
  let fixture, runtime, open, mod, automatic, stops;
  before(async () => {
    automatic = System.debuggerInterception;
    System.debuggerInterception = true;
    runtime = installModuleDebugger(System);
    open = runtime.open;
    stops = [];
    runtime.open = (continuation, callbacks) => { stops.push({continuation, callbacks}); };
    const id = System.decanonicalize('lively.context/tests/fixtures/intercepted-language.js');
    fixture = await System.import(id);
    mod = System.get('@lively-env').moduleEnv(id);
    expect(mod.debuggingEnabled, 'fixture must really be intercepted').equals(true);
  });
  after(async () => {
    runtime.open = open;
    System.debuggerInterception = automatic;
    if (mod) await mod.unload();
  });

  for (const method of Object.keys(nativeMethods)) {
    it(`preserves native ${method} semantics in an intercepted module`, () => {
      const scenarios = ['ordinary', 'inherited', 'empty', 'null', 'invalid', 'mutating', 'no-initial', 'species'];
      if (method === 'sort') scenarios.push('stable', 'default');
      for (const scenario of scenarios) {
        const expected = fixture.exerciseArray(method, scenario, nativeMethods[method]);
        const actual = fixture.exerciseArray(method, scenario);
        expect(actual, `${method}/${scenario}: return, holes, callback arguments and mutations must match native`).deep.equals(expected);
      }
    });
  }

  for (const method of Object.keys(nativeMethods)) {
    it(`resumes an intercepted ${method} callback without repeating effects`, async () => {
      const expected = fixture.pauseInArray(method, false);
      const pending = fixture.pauseInArray(method, true);
      expect(stops, `${method} callback must capture a stop`).length(1);
      const {continuation, callbacks} = stops.shift();
      let result = continuation, pauses = 0;
      while (result?.isContinuation && pauses < 20) { pauses++; result = await result.resume(); }
      expect(result?.isContinuation, `${method} must finish after resuming every callback`).not.equals(true);
      expect(pauses, `${method} must pause in its callback`).greaterThan(0);
      callbacks.onComplete(result);
      expect(await pending, `${method} must preserve its result across pause/resume`).deep.equals(expected);
    });
  }

  it('keeps async boundaries when resuming a synchronous caller', async () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; }), log = [];
    const pendingCaller = fixture.resumedSyncCaller(promise, log);
    expect(stops).length(1);
    const {continuation, callbacks} = stops.shift();
    const result = continuation.resume();
    expect(result instanceof Promise, 'resumed synchronous caller must finish before its child await').equals(false);
    callbacks.onComplete(result);
    const completed = await pendingCaller;
    expect(completed.caught, 'resumed caller must never catch an await marker').equals(undefined);
    expect(completed.pending).instanceOf(Promise);
    expect(log).deep.equals(['start', 'caller returned']);
    resolve(2);
    expect(await completed.pending).equals(3);
  });

  it('returns a Promise from an async function with no await', async () => {
    const pending = fixture.cached();
    expect(pending, 'async return must be a Promise').instanceOf(Promise);
    expect(await pending).equals(1);
  });

  it('rejects a Promise instead of throwing from an async function', async () => {
    const failure = new Error('async failure');
    let pending;
    try { pending = fixture.fails(failure); } catch (error) { throw new Error('async throw escaped synchronously: ' + error.message); }
    expect(pending, 'async throw must return a Promise').instanceOf(Promise);
    let rejected;
    try { await pending; } catch (error) { rejected = error; }
    expect(rejected, 'async rejection must preserve the original error').equals(failure);
  });

  it('keeps a synchronous caller running while its async callee awaits', async () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; }), log = [];
    const result = fixture.syncCaller(promise, log);
    expect(result instanceof Promise, 'sync caller must not suspend at a callee await').equals(false);
    expect(result.caught, 'caller catch must never receive an internal await marker').equals(undefined);
    expect(result.pending, 'callee result must be a Promise').instanceOf(Promise);
    expect(log, 'caller must continue before the await settles').deep.equals(['start', 'caller returned']);
    resolve(4);
    expect(await result.pending).equals(5);
    expect(log).deep.equals(['start', 'caller returned', 'awaited']);
  });

  it('preserves async arrow and expression return values', async () => {
    const {arrow, expression} = fixture.asyncClosures();
    const a = arrow(), b = expression();
    expect(a, 'async arrow must return a Promise').instanceOf(Promise);
    expect(b, 'async expression must return a Promise').instanceOf(Promise);
    expect(await a).equals(2);
    expect(await b).equals(3);
  });

  it('pauses and resumes inside async functions after await', async () => {
    const log = [];
    const pending = fixture.later(Promise.resolve(7), log, true);
    expect(pending, 'paused async function must retain its Promise').instanceOf(Promise);
    for (let i = 0; i < 50 && !stops.length; i++) await Promise.resolve();
    expect(stops, 'debugger after await must open once').length(1);
    const {continuation, callbacks} = stops.shift();
    expect(continuation.frames(), 'async stop must not capture a completed synchronous caller').length(1);
    const value = await continuation.resume();
    callbacks.onComplete(value);
    expect(await pending).equals(8);
    expect(log).deep.equals(['start', 'awaited']);
  });
});
