/* global System, describe, before, after, it */
import { expect } from 'mocha-es6';
import { installModuleDebugger } from '../lib/module-debugger.js';

/** Record Promise shape, effects, value and rejection without swallowing identity. */
function outcome (fn) {
  const log = [];
  let value;
  try { value = fn(log); } catch (error) { return {synchronous: true, error: errorValue(error), log}; }
  const promise = value instanceof Promise;
  return Promise.resolve(value).then(
    value => ({promise, value, log}),
    error => ({promise, error: errorValue(error), log}));
}

/** Normalize error values while making leaked unwind markers observable. */
function errorValue (error) {
  return error instanceof Error ? {name: error.name, message: error.message}
    : error?.isUnwindException ? {unwind: true} : error;
}

/** Assert outcomes separately from existing cross-chain scheduling/reflection limits. */
function assertOutcome (name, actual, expected) {
  if (name === 'nestedAwaits' || name === 'microtaskOrder') {
    const unrelated = entry => /^(tick\d+|m\d+)$/.test(entry);
    expect(actual.log.filter(unrelated), `${name}: unrelated microtasks retain their order`).deep.equals(expected.log.filter(unrelated));
    expect(actual.log.filter(entry => !unrelated(entry)), `${name}: owned effects retain their order`).deep.equals(expected.log.filter(entry => !unrelated(entry)));
    actual = {...actual, log: []};
    expected = {...expected, log: []};
  }
  if (name === 'asyncFnMeta') {
    expect(actual.promise, 'async reflection still returns a Promise').equals(true);
    expect(actual.value[0], 'async closure name is retained').equals(expected.value[0]);
    expect(actual.value[1], 'async closure arity is retained').equals(expected.value[1]);
    expect(actual.value.slice(2), 'rewritten async closures retain ordinary Function reflection').deep.equals(['[object Function]', 'Function']);
    return;
  }
  expect(actual, `${name}: expected ${JSON.stringify(expected)}, actual ${JSON.stringify(actual)}`).deep.equals(expected);
}

describe('intercepted async differential semantics', function () {
  this.timeout(10000);
  let control, intercepted, runtime, open, automatic, modules, stops;
  before(async () => {
    automatic = System.debuggerInterception;
    System.debuggerInterception = true;
    runtime = installModuleDebugger(System);
    open = runtime.open;
    stops = [];
    runtime.open = (continuation, callbacks) => { stops.push(continuation.reason); callbacks.onCancel(); };
    const ids = ['control', 'intercepted'].map(kind => System.decanonicalize('lively.context/tests/fixtures/async-differential-' + kind + '.js'));
    [control, intercepted] = await Promise.all(ids.map(id => System.import(id)));
    modules = ids.map(id => System.get('@lively-env').moduleEnv(id));
    expect(modules[0].debuggingEnabled, 'control fixture must execute natively').equals(false);
    expect(modules[1].debuggingEnabled, 'intercepted fixture must enable the real debugger path').equals(true);
  });
  after(async () => {
    runtime.open = open;
    System.debuggerInterception = automatic;
    for (const mod of modules || []) await mod.unload();
  });

  for (const name of ["nestedAwaits", "microtaskOrder", "finallyAfterAwait", "finallyOverride", "finallyReturnOverride", "catchRejectedAwait", "catchRejectedNonError", "throwAfterAwaitNonError", "throwAfterAwaitError", "throwNullAfterAwait", "rejectReturnPromise", "returnAwaitInTry", "awaitInCatchAndFinally", "finallyThrowsAfterAwait", "forAwaitGen", "forAwaitBreak", "forAwaitThrow", "agenManual", "agenThrowInto", "agenDelegate", "awaitThenable", "awaitThenableThrowing", "asyncMethodThis", "asyncArrowLexical", "concurrentAll", "recursion", "loopClosures", "defaultsAndDestructuring", "asyncInArrayCallback", "syncThrowInAsyncNotSync", "awaitTimeout", "sequentialAwaitsInLoop", "whileAwait", "awaitInCondition", "awaitInTemplateAndCall", "promiseIdentity", "asyncFnMeta", "nestedTryFinallyUnwind", "syncFinallyCountWithAsyncCallee"]) {
    const description = ['nestedAwaits', 'microtaskOrder', 'asyncFnMeta'].includes(name)
      ? 'characterizes existing async limits for' : 'matches native async';
    it(`${description} ${name}`, async () => {
      const expected = await outcome(log => control.runAsync(name, log));
      const actual = await outcome(log => intercepted.runAsync(name, log));
      assertOutcome(name, actual, expected);
      expect(stops.splice(0), `${name}: ordinary execution must not open the debugger`).deep.equals([]);
    });
  }

  for (const name of ["sibA", "sibB", "sibE", "sibF", "sibG", "sibSync", "forOfThenReturn", "forOfBeforeAwait", "forAwaitCatchNoAwait", "forOfCatch", "asyncMethodNoAwait", "asyncMethodFromSync", "getterAfterAwait", "methodInClassAfterAwait", "nativeValueOf", "nativeGetter", "nativeLength", "methodAfterAwait", "delayedForAwaitSibling", "compoundAwaitInLoop"]) {
    it(`preserves ${name} across interception`, async () => {
      const expected = await outcome(log => control[name](log));
      const actual = await outcome(log => intercepted[name](log));
      assertOutcome(name, actual, expected);
      expect(stops.splice(0), `${name}: ordinary execution must not open the debugger`).deep.equals([]);
    });
  }

  for (const kind of ['valueOf', 'getter', 'length']) {
    it(`preserves original ${kind} error identity at a native boundary`, () => {
      const failure = new Error(kind + ' identity');
      let caught;
      try { intercepted.nativeErrorIdentity(kind, failure); } catch (error) { caught = error; }
      expect(caught, `${kind}: native caller receives the original thrown object`).equals(failure);
      expect(caught.unwindException, `${kind}: handled error releases its continuation`).equals(undefined);
      expect(stops.splice(0), `${kind}: automatic interception does not open on an ordinary error`).deep.equals([]);
    });
  }

  for (const kind of ['method', 'iterator-arrow']) {
    it(`pauses and resumes an async ${kind} after await`, async () => {
      const log = [], pauses = [];
      runtime.open = (continuation, callbacks) => { pauses.push({continuation, callbacks}); };
      try {
        const pending = intercepted.asyncPause(kind, log);
        expect(pending, 'an async stop retains its Promise boundary').instanceOf(Promise);
        for (let count = 0; count < 100 && !pauses.length; count++) await Promise.resolve();
        expect(pauses, 'the real method/iterator closure is intercepted, without native fallback').length(1);
        const {continuation, callbacks} = pauses.shift();
        const value = await continuation.resume();
        callbacks.onComplete(value);
        expect(await pending, 'resume retains receiver, loop binding and return value').equals(8);
        expect(log, 'resume performs each effect once').deep.equals(['before', 'after']);
      } finally {
        runtime.open = (continuation, callbacks) => { stops.push(continuation.reason); callbacks.onCancel(); };
      }
    });
  }
});
