/* global System, describe, beforeEach, afterEach, it */
import { expect } from 'mocha-es6';
import { resource } from 'lively.resources';
import { prepareSystem } from './helpers.js';
import module from '../src/module.js';
import { removeSystem, prepareSystem as reinitializeSystem } from '../src/system.js';
import { installModuleDebugger } from '../../lively.context/lib/module-debugger.js';
import { runWithCapturedBindings } from '../../lively.context/lib/stackReification.js';
import { getCurrentASTRegistry, setCurrentASTRegistry } from '../../lively.context/lib/rewriter.js';

describe('ordinary module debugger interception', function () {
  this.timeout(10000);
  let S, stops;
  const id = 'local://debugger-interception/task.js';
  const load = async source => {
    await resource(id).write(source);
    return S.import(id);
  };
  const proceed = async () => {
    const stop = stops.shift();
    const result = await stop.continuation.resume();
    if (result?.isContinuation) stops.push({ ...stop, continuation: result });
    else stop.callbacks.onComplete(result);
    return result;
  };
  beforeEach(() => {
    S = prepareSystem('debugger-interception', 'local://debugger-interception/');
    S.debuggerInterception = true;
    stops = [];
    installModuleDebugger(S, { open: (continuation, callbacks) => stops.push({continuation, callbacks}) });
  });
  afterEach(async () => {
    removeSystem('debugger-interception');
    await resource('local://debugger-interception/').remove();
  });

  it('initializes interception without importing its dependencies during module translation', async () => {
    delete S.get('@lively-env').moduleDebugger;
    const systemImport = S.import;
    S.import = function (name, ...args) {
      if (name === 'lively.context/lib/module-debugger.js') throw new Error('Importing the debugger during translation can deadlock its dependencies');
      return systemImport.call(this, name, ...args);
    };
    let task;
    try { ({task} = await load('export function task(pause) { if (pause) debugger; return 3; }')); }
    finally { S.import = systemImport; }
    installModuleDebugger(S, { open: (continuation, callbacks) => stops.push({continuation, callbacks}) });
    expect(task(false)).equals(3);
    const pending = task(true);
    expect(stops).length(1);
    expect(await proceed()).equals(3);
    expect(await pending).equals(3);
  });

  it('opens from a plain method call and resumes its callers without repeating effects', async () => {
    const {Task} = await load('export class Task { constructor() { this.visits = 0; } outer() { this.visits++; const total = this.inner(3); this.result = total + 1; return this.result; } inner(value) { let amount = value * 2; debugger; return amount; } }');
    const task = new Task();
    const pending = task.outer();
    expect(pending).instanceOf(Promise);
    expect(stops).length(1);
    expect(stops[0].continuation.frames()).length(2);
    expect(task.visits).equals(1);
    expect(task.result).equals(undefined);
    stops[0].continuation.currentFrame.getScope().set('amount', 8);
    expect(await proceed()).equals(9);
    expect(await pending).equals(9);
    expect(task.visits).equals(1);
    expect(task.result).equals(9);
  });

  it('keeps ordinary synchronous return values when no stop executes', async () => {
    const {sum} = await load('export function sum(a, b) { if (a < 0) debugger; return a + b; }');
    expect(sum(2, 3)).equals(5);
    expect(stops).length(0);
    expect(sum.name).equals('sum');
    expect(sum.length).equals(2);
  });

  it('explicitly captures an already rewritten closure returned by an intercepted factory', async () => {
    const {make} = await load('export function make(value) { function charge(quantity) { debugger; return value + quantity; } return {charge, read: () => value}; }');
    const account = make(2);
    const stopped = await runWithCapturedBindings(account.charge, null, [3]);
    expect(stopped.currentFrame.lookup('value')).equals(2);
    stopped.currentFrame.getScope().findScope('value').scope.set('value', 7);
    expect(account.read()).equals(7);
    expect(stopped.resume()).equals(10);
  });

  it('keeps Mocha suite registration native when fixtures contain debugger statements', async () => {
    const file = resource('local://debugger-harness/test.js');
    const mod = module(System, file.url), automatic = System.debuggerInterception;
    await file.write("import { expect } from 'mocha-es6'; describe('fixture', function () { const { value } = {value: 3}; it('intentional stop', function () { debugger; expect(value).equals(3); }); });");
    System.debuggerInterception = true;
    try {
      await mod.load();
      expect(mod.debuggingEnabled).equals(false);
      expect(mod.recorder.mocha.suite.suites[0].tests).length(1);
    } finally {
      System.debuggerInterception = automatic;
      await mod.unload();
      await file.remove();
    }
  });

  it('opens on exceptions only after the module toggle is enabled, including after await', async () => {
    const {task, later, failure} = await load('export const failure = new Error("expected failure"); export function task(pause) { if (pause) debugger; throw failure; } export async function later() { await Promise.resolve(); throw failure; }');
    expect(() => task(false)).throws(failure);
    let rejection;
    try { await later(); } catch (error) { rejection = error; }
    expect(rejection).equals(failure);
    expect(stops).length(0);
    await module(S, id).setDebuggingEnabled(true);
    const caller = 'local://debugger-interception/caller.js';
    await resource(caller).write('import {task} from "./task.js"; export function entry(pause) { if (pause) debugger; return task(false); }');
    const {entry} = await S.import(caller);
    const pending = entry(false);
    expect(stops[0].continuation.frames()).length(2);
    expect(stops[0].continuation.reason).equals('exception');
    expect(stops[0].continuation.exception).equals(failure);
    stops.shift().callbacks.onCancel();
    expect(await pending).equals(undefined);
    const awaiting = later();
    for (let i = 0; i < 30 && !stops.length; i++) await Promise.resolve();
    expect(stops[0].continuation.exception).equals(failure);
    stops.shift().callbacks.onCancel();
    expect(await awaiting).equals(undefined);
  });

  it('preserves the installed debugger when the loader adopts source modules', async () => {
    const {task} = await load('export function task(pause) { if (pause) debugger; return 3; }');
    const runtime = S.get('@lively-env').moduleDebugger;
    expect(task(false)).equals(3);
    // A fresh loader has no public fetch hook; translation uses lively.fetch.
    delete S.fetch;
    reinitializeSystem(S);
    expect(installModuleDebugger(S)).equals(runtime);
    const pending = task(true);
    expect(stops).length(1);
    expect(await proceed()).equals(3);
    expect(await pending).equals(3);
  });

  it('recompiles cached functions when the AST registry is replaced', async () => {
    const {task} = await load('export function task(pause) { if (pause) debugger; return 3; }');
    expect(task(false)).equals(3);
    const registry = getCurrentASTRegistry();
    setCurrentASTRegistry({});
    try {
      const pending = task(true);
      expect(stops).length(1);
      expect(await proceed()).equals(3);
      expect(await pending).equals(3);
    } finally { setCurrentASTRegistry(registry); }
  });

  it('does not recursively intercept helpers called while preparing a function', async () => {
    const source = 'function task(pause) { if (pause) debugger; return 3; }';
    const {task} = await load('export ' + source);
    Object.defineProperty(task, Symbol.for('lively-debug-function-source'), {
      configurable: true,
      get() {
        expect(task(false)).equals(3);
        return source;
      }
    });
    const pending = task(true);
    expect(stops).length(1);
    expect(await proceed()).equals(3);
    expect(await pending).equals(3);
  });

  it('returns undefined when a resumed function has no return statement', async () => {
    const {task} = await load('export function task() { debugger; let value = 2; value++; }');
    const pending = task();
    expect(await proceed()).equals(undefined);
    expect(await pending).equals(undefined);
  });

  it('retains functions under numeric property names', async () => {
    const { methods } = await load('export const methods = {0: function () { return 3; }, 1: function () { return 4; }, 2() { return 5; }};');
    expect(methods[0]()).equals(3);
    expect(methods[0].name).equals('0');
    expect(methods[1]()).equals(4);
    expect(methods[2]()).equals(5);
  });

  it('automatically intercepts a stop added through a module edit', async () => {
    await load('export function task() { return 2; }');
    const mod = module(S, id);
    expect(mod.debuggingEnabled).equals(false);
    await mod.changeSource('export function task() { debugger; return 3; }', {doSave: false});
    expect(mod.debuggingEnabled).equals(true);
    const pending = S.get(id).task();
    expect(stops).length(1);
    expect(await proceed()).equals(3);
    expect(await pending).equals(3);
  });

  it('resumes construction on the original instance', async () => {
    const {Task} = await load('export class Task { constructor(value) { this.visits = 1; debugger; this.value = value; } }');
    const pending = new Task(3);
    expect(stops).length(1);
    const instance = stops[0].continuation.currentFrame.getThis();
    expect(instance).instanceOf(Task);
    expect(await proceed()).equals(instance);
    expect(await pending).equals(instance);
    expect(instance.value).equals(3);
    expect(instance.visits).equals(1);
  });

  it('preserves prototypes in constructors that can also be called as factories', async () => {
    const {Task} = await load('export function Task(value, pause) { if (!(this instanceof Task)) return new Task(value, pause); this.initialize(value); if (pause) debugger; } Task.prototype.initialize = function(value) { this.value = value; };');
    expect(Task(3, false)).instanceOf(Task);
    expect(Task(3, false).value).equals(3);
    expect(new Task(4, false).value).equals(4);
    const pending = Task(5, true);
    expect(stops).length(1);
    const instance = stops[0].continuation.currentFrame.getThis();
    await proceed();
    expect(await pending).equals(instance);
    expect(instance).instanceOf(Task);
    expect(instance.value).equals(5);
  });

  it('captures function constructors, including construction inside an intercepted caller', async () => {
    const {Task, make} = await load('export function Task(value) { this.visits = 1; debugger; this.value = value; this.target = new.target; } export function make() { debugger; const task = new Task(3); return task.target === Task ? task.value + 1 : -1; }');
    const pending = new Task(2);
    expect(stops).length(1);
    const instance = stops[0].continuation.currentFrame.getThis();
    expect(await proceed()).equals(instance);
    expect(await pending).equals(instance);
    expect(instance).instanceOf(Task);
    expect(instance.target).equals(Task);
    const caller = make();
    expect(stops).length(1);
    expect((await proceed()).isContinuation).equals(true);
    expect(stops[0].continuation.frames()).length(2);
    expect(await proceed()).equals(4);
    expect(await caller).equals(4);
  });

  it('captures a returned runtime closure and its live binding cells', async () => {
    const {make} = await load('export function make(rate) { function charge(value) { const result = rate + value; debugger; return result; } return {charge, read: () => rate}; }');
    const account = make(2);
    const pending = account.charge(3);
    expect(stops).length(1);
    stops[0].continuation.currentFrame.getScope().findScope('rate').scope.set('rate', 7);
    expect(account.read()).equals(7);
    expect(await proceed()).equals(5);
    expect(await pending).equals(5);
  });

  it('intercepts callbacks created after an await or debugger resume', async () => {
    const {make} = await load('export async function make(rate, pause) { await Promise.resolve(); if (pause) debugger; return value => { debugger; return rate + value; }; }');
    for (const pause of [false, true]) {
      const result = make(2, pause);
      if (pause) {
        for (let i = 0; i < 20 && !stops.length; i++) await Promise.resolve();
        expect(stops).length(1);
        await proceed();
      }
      const charge = await result;
      const pending = charge(3);
      expect(stops).length(1);
      expect(stops[0].continuation.currentFrame.func.runtimeObjectMeta.moduleSource).contains('export async function make');
      expect(await proceed()).equals(5);
      expect(await pending).equals(5);
      await module(S, id).setDebuggingEnabled(false);
      expect(charge(4)).equals(6);
      await module(S, id).setDebuggingEnabled(true);
    }
  });

  it('opens after an await and returns the completed result to an awaiting native caller', async () => {
    const {task} = await load('export async function task() { const value = await Promise.resolve(4); debugger; return value + 1; }');
    const pending = task();
    for (let i = 0; i < 20 && !stops.length; i++) await Promise.resolve();
    expect(stops).length(1);
    expect(await proceed()).equals(5);
    expect(await pending).equals(5);
  });

  it('toggles an existing module without saving its source, keeps instances, and honors the setting after edits', async () => {
    const source = 'export const effects = {initializations: 0}; effects.initializations++; export class Task { value() { return 2; } }';
    const {Task, effects} = await load(source);
    const instance = new Task();
    const mod = module(S, id);
    expect(mod.debuggingEnabled).equals(false);
    // SWC class metadata retains source locations without a declaration kind.
    delete Task[Symbol.for('lively-object-meta')].kind;
    await mod.setDebuggingEnabled(true);
    expect(effects.initializations).equals(1);
    expect(S.get(id).Task).equals(Task);
    await mod.changeSource('export class Task { value() { debugger; return 3; } }', {doSave: false});
    const pending = instance.value();
    expect(stops).length(1);
    expect(await proceed()).equals(3);
    expect(await pending).equals(3);
    await mod.setDebuggingEnabled(false);
    expect(instance.value()).equals(3);
    expect(stops).length(0);
    expect(await resource(id).read()).equals(source);
  });

  it('does not activate for strings and comments or intercept unrelated modules', async () => {
    const {task} = await load('export function task() { /* debugger; */ return "debugger;"; }');
    expect(module(S, id).debuggingEnabled).equals(false);
    expect(task()).equals('debugger;');
  });

  it('intercepts object methods and nested arrows with their retained receiver', async () => {
    const {task} = await load('export const task = {value: 2, run() { const compute = () => { debugger; return this.value; }; return compute() + 1; }, get total() { debugger; return this.value + 3; }};');
    const pending = task.run();
    expect(stops).length(1);
    expect(stops[0].continuation.frames()).length(2);
    expect(await proceed()).equals(3);
    expect(await pending).equals(3);
    const total = task.total;
    expect(stops).length(1);
    expect(await proceed()).equals(5);
    expect(await total).equals(5);
  });

  it('preserves lowered super calls and getters', async () => {
    const {Task} = await load('class Base { value() { return 2; } } export class Task extends Base { get total() { debugger; return super.value() + 1; } }');
    const pending = new Task().total;
    expect(stops).length(1);
    const result = await proceed();
    if (result?.isContinuation) throw result.exception || new Error('Unexpected stop: ' + result.reason);
    expect(result).equals(3);
    expect(await pending).equals(3);
  });

  it('keeps native object super methods valid in an intercepted module', async () => {
    const {task, stop} = await load('export const task = {__proto__: {value: 2}, value() { return super.value + 1; }}; export function stop() { debugger; return task.value(); }');
    expect(task.value()).equals(3);
    const pending = stop();
    expect(await proceed()).equals(3);
    expect(await pending).equals(3);
  });

  it('opens for an async generator next request and preserves the iterator result', async () => {
    const {values} = await load('export async function* values() { await Promise.resolve(); debugger; yield 3; return 4; }');
    const iterator = values();
    const pending = iterator.next();
    for (let i = 0; i < 30 && !stops.length; i++) await Promise.resolve();
    expect(stops).length(1);
    expect(await proceed()).deep.equals({value: 3, done: false});
    expect(await pending).deep.equals({value: 3, done: false});
    expect(await iterator.next()).deep.equals({value: 4, done: true});
  });

  it('keeps a single pending invocation across multiple stops and settles cancellation', async () => {
    const {task} = await load('export function task() { debugger; debugger; return 4; }');
    const pending = task();
    expect(stops).length(1);
    expect((await proceed()).isContinuation).equals(true);
    expect(stops).length(1);
    stops.shift().callbacks.onCancel();
    expect(await pending).equals(undefined);
  });
});
