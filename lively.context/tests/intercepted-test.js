/* global System, describe, before, after, afterEach, it */
import { expect } from 'mocha-es6';
import { resource } from 'lively.resources';
import { installModuleDebugger } from '../lib/module-debugger.js';

const nativeMethods = Object.fromEntries(['sort', 'filter', 'forEach', 'some', 'every', 'map', 'reduce', 'reduceRight']
  .map(name => [name, Array.prototype[name]]));
const asyncScenarios = ['nestedAwaits', 'microtaskOrder', 'finallyAfterAwait', 'finallyOverride', 'finallyReturnOverride',
  'catchRejectedAwait', 'catchRejectedNonError', 'throwAfterAwaitNonError', 'throwAfterAwaitError', 'throwNullAfterAwait',
  'rejectReturnPromise', 'returnAwaitInTry',
  'awaitInCatchAndFinally', 'finallyThrowsAfterAwait', 'forAwaitGen', 'forAwaitBreak', 'forAwaitThrow', 'agenManual', 'agenThrowInto',
  'agenDelegate', 'awaitThenable', 'awaitThenableThrowing', 'asyncMethodThis', 'asyncArrowLexical', 'concurrentAll', 'recursion',
  'loopClosures', 'defaultsAndDestructuring', 'asyncInArrayCallback', 'syncThrowInAsyncNotSync', 'awaitTimeout', 'sequentialAwaitsInLoop',
  'whileAwait', 'awaitInCondition', 'awaitInTemplateAndCall', 'promiseIdentity', 'asyncFnMeta', 'nestedTryFinallyUnwind',
  'syncFinallyCountWithAsyncCallee'];
const exportedScenarios = ['sibA', 'sibB', 'sibE', 'sibF', 'sibG', 'sibSync', 'forOfThenReturn', 'forOfBeforeAwait', 'forAwaitCatchNoAwait',
  'forOfCatch', 'asyncMethodNoAwait', 'asyncMethodFromSync', 'getterAfterAwait', 'methodInClassAfterAwait', 'nativeValueOf', 'nativeGetter',
  'nativeLength', 'methodAfterAwait', 'delayedForAwaitSibling', 'compoundAwaitInLoop'];
const limits = ['nestedAwaits', 'microtaskOrder', 'asyncFnMeta'];

/** Records Promise shape, effects, value and rejection; leaked unwind markers stay observable. */
function outcome (fn) {
  const log = [], errorValue = error => error instanceof Error ? {name: error.name, message: error.message}
    : error?.isUnwindException ? {unwind: true} : error;
  let value;
  try { value = fn(log); } catch (error) { return {synchronous: true, error: errorValue(error), log}; }
  const promise = value instanceof Promise;
  return Promise.resolve(value).then(value => ({promise, value, log}), error => ({promise, error: errorValue(error), log}));
}

/** Compares outcomes; unrelated microtasks of `limits` keep their own order, and async reflection keeps name and arity. */
function assertOutcome (name, actual, expected) {
  if (name === 'asyncFnMeta') {
    expect(actual.promise, 'async reflection still returns a Promise').equals(true);
    expect(actual.value.slice(0, 2), 'async closure name and arity are retained').deep.equals(expected.value.slice(0, 2));
    expect(actual.value.slice(2), 'rewritten async closures retain ordinary Function reflection')
      .deep.equals(['[object Function]', 'Function']);
    return;
  }
  if (limits.includes(name)) {
    const unrelated = entry => /^(tick\d+|m\d+)$/.test(entry);
    expect(actual.log.filter(unrelated), `${name}: unrelated microtasks retain their order`).deep.equals(expected.log.filter(unrelated));
    expect(actual.log.filter(entry => !unrelated(entry)), `${name}: owned effects retain their order`)
      .deep.equals(expected.log.filter(entry => !unrelated(entry)));
    [actual, expected] = [{...actual, log: []}, {...expected, log: []}];
  }
  expect(actual, `${name}: expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}`).deep.equals(expected);
}

describe('intercepted module semantics', function () {
  this.timeout(30000);
  const id = System.decanonicalize('lively.context/tests/fixtures/intercepted.js'), controlId = 'local://intercepted-control/fixture.js';
  const moduleEnv = name => System.get('@lively-env').moduleEnv(name), stops = [];
  let control, fixture, runtime, open, automatic;
  /** Resumes until the computation completes and hands the result to the native caller. */
  const finish = async ({continuation, callbacks}) => {
    let result = continuation, pauses = 0;
    while (result?.isContinuation && pauses < 20) { pauses++; result = await result.resume(); }
    expect(result?.isContinuation, 'finishes after resuming every stop').not.equals(true);
    callbacks.onComplete(result);
    return pauses;
  };
  const nextStop = async () => {
    for (let i = 0; i < 100 && !stops.length; i++) await Promise.resolve();
    expect(stops, 'the stop opens once').length(1);
    return stops.shift();
  };

  before(async () => {
    automatic = System.debuggerInterception;
    System.debuggerInterception = true;
    runtime = installModuleDebugger(System);
    open = runtime.open;
    runtime.open = (continuation, callbacks) => { stops.push({continuation, callbacks}); };
    await resource(controlId).write(await resource(id).read());
    await moduleEnv(controlId).setDebuggingEnabled(false);
    [control, fixture] = await Promise.all([controlId, id].map(name => System.import(name)));
    expect(moduleEnv(controlId).debuggingEnabled, 'the control copy executes natively').equals(false);
    expect(moduleEnv(id).debuggingEnabled, 'the fixture takes the real interception path').equals(true);
  });
  afterEach(() => {
    for (const stop of stops.splice(0)) stop.callbacks.onCancel();
  });
  after(async () => {
    runtime.open = open;
    System.debuggerInterception = automatic;
    for (const name of [controlId, id]) await moduleEnv(name).unload();
    await resource(controlId).remove();
  });

  for (const name of [...asyncScenarios, ...exportedScenarios]) {
    const exported = exportedScenarios.includes(name);
    it(exported ? `preserves ${name} across interception`
      : `${limits.includes(name) ? 'characterizes existing async limits for' : 'matches native async'} ${name}`, async () => {
      const call = module => log => exported ? module[name](log) : module.runAsync(name, log);
      assertOutcome(name, await outcome(call(fixture)), await outcome(call(control)));
      expect(stops, `${name}: ordinary execution does not open the debugger`).length(0);
    });
  }

  for (const kind of ['valueOf', 'getter', 'length']) {
    it(`preserves original ${kind} error identity at a native boundary`, () => {
      const failure = new Error(kind + ' identity');
      let caught;
      try { fixture.nativeErrorIdentity(kind, failure); } catch (error) { caught = error; }
      expect(caught, `${kind}: native caller receives the original thrown object`).equals(failure);
      expect(caught.unwindException, `${kind}: handled error releases its continuation`).equals(undefined);
      expect(stops, `${kind}: automatic interception does not open on an ordinary error`).length(0);
    });
  }

  for (const kind of ['method', 'iterator-arrow']) {
    it(`pauses and resumes an async ${kind} after await`, async () => {
      const log = [], pending = fixture.asyncPause(kind, log);
      expect(pending, 'an async stop retains its Promise boundary').instanceOf(Promise);
      await finish(await nextStop());
      expect(await pending, 'resume retains receiver, loop binding and return value').equals(8);
      expect(log, 'resume performs each effect once').deep.equals(['before', 'after']);
    });
  }

  for (const method of Object.keys(nativeMethods)) {
    it(`preserves native ${method} semantics in an intercepted module`, () => {
      const scenarios = ['ordinary', 'inherited', 'empty', 'null', 'invalid', 'mutating', 'no-initial', 'species'];
      for (const scenario of method === 'sort' ? [...scenarios, 'stable', 'default'] : scenarios) {
        expect(fixture.exerciseArray(method, scenario), `${method}/${scenario}: result, holes, callback arguments and mutations`)
          .deep.equals(fixture.exerciseArray(method, scenario, nativeMethods[method]));
      }
    });

    it(`resumes an intercepted ${method} callback without repeating effects`, async () => {
      const expected = fixture.pauseInArray(method, false), pending = fixture.pauseInArray(method, true);
      expect(stops, `${method} callback captures a stop`).length(1);
      expect(await finish(stops.shift()), `${method} pauses in its callback`).greaterThan(0);
      expect(await pending, `${method} preserves its result across pause/resume`).deep.equals(expected);
    });
  }

  it('keeps async boundaries when resuming a synchronous caller', async () => {
    let resolve;
    const log = [], pendingCaller = fixture.resumedSyncCaller(new Promise(done => { resolve = done; }), log);
    expect(stops).length(1);
    const {continuation, callbacks} = stops.shift(), result = continuation.resume();
    expect(result instanceof Promise, 'resumed synchronous caller finishes before its child await').equals(false);
    callbacks.onComplete(result);
    const completed = await pendingCaller;
    expect(completed.caught, 'resumed caller never catches an await marker').equals(undefined);
    expect(completed.pending).instanceOf(Promise);
    expect(log).deep.equals(['start', 'caller returned']);
    resolve(2);
    expect(await completed.pending).equals(3);
  });

  it('returns and rejects Promises from async functions without await, including arrows and expressions', async () => {
    const failure = new Error('async failure'), {arrow, expression} = fixture.asyncClosures();
    let rejection, pending;
    try { pending = fixture.fails(failure); } catch (error) { throw new Error('async throw escaped synchronously: ' + error.message); }
    for (const [value, expected] of [[fixture.cached(), 1], [arrow(), 2], [expression(), 3], [pending]]) {
      expect(value, 'async return is a Promise').instanceOf(Promise);
      if (expected) expect(await value).equals(expected);
    }
    try { await pending; } catch (error) { rejection = error; }
    expect(rejection, 'async rejection preserves the original error').equals(failure);
  });

  it('keeps a synchronous caller running while its async callee awaits', async () => {
    let resolve;
    const log = [], result = fixture.syncCaller(new Promise(done => { resolve = done; }), log);
    expect(result instanceof Promise, 'sync caller does not suspend at a callee await').equals(false);
    expect(result.caught, 'caller catch never receives an internal await marker').equals(undefined);
    expect(result.pending, 'callee result is a Promise').instanceOf(Promise);
    expect(log, 'caller continues before the await settles').deep.equals(['start', 'caller returned']);
    resolve(4);
    expect(await result.pending).equals(5);
    expect(log).deep.equals(['start', 'caller returned', 'awaited']);
  });

  it('pauses and resumes inside async functions after await', async () => {
    const log = [], pending = fixture.later(Promise.resolve(7), log, true);
    expect(pending, 'paused async function retains its Promise').instanceOf(Promise);
    const stop = await nextStop();
    expect(stop.continuation.frames(), 'async stop does not capture a completed synchronous caller').length(1);
    await finish(stop);
    expect(await pending).equals(8);
    expect(log).deep.equals(['start', 'awaited']);
  });
});
