/* global describe, beforeEach, afterEach, it */
import { expect } from 'mocha-es6';
import { resource } from 'lively.resources';
import { prepareSystem } from './helpers.js';
import module from '../src/module.js';
import { removeSystem } from '../src/system.js';
import { installModuleDebugger } from '../../lively.context/lib/module-debugger.js';
import { getCurrentASTRegistry, setCurrentASTRegistry } from '../../lively.context/lib/rewriter.js';
import { serialize, deserialize } from '../../lively.serializer2/index.js';

describe('module debugger native boundaries', function () {
  this.timeout(10000);
  const id = 'local://debugger-native-boundary/task.js';
  let S, warnings, warn;
  const load = async source => {
    await resource(id).write(source);
    return S.import(id);
  };
  beforeEach(() => {
    S = prepareSystem('debugger-native-boundary', 'local://debugger-native-boundary/');
    S.debuggerInterception = true;
    installModuleDebugger(S, {open() { throw new Error('Unexpected debugger stop'); }});
    warnings = [];
    warn = console.warn;
    console.warn = (...args) => warnings.push(args);
  });
  afterEach(async () => {
    console.warn = warn;
    removeSystem('debugger-native-boundary');
    await resource('local://debugger-native-boundary/').remove();
  });

  for (const debugging of [false, true]) {
    it(`keeps object-super arrows native and drops them from snapshots with debugging ${debugging}`, async () => {
      S.debuggerInterception = debugging;
      module(S, id).retainRuntimeClosures = true;
      const {task} = await load('export const task = {__proto__: {value() { return 3; }}, arrow(offset) { return () => super.value() + offset; }}; export function stop() { debugger; }');
      expect(module(S, id).debuggingEnabled).equals(debugging);
      const callback = task.arrow(4);
      expect(callback()).equals(7);
      expect(callback[Symbol.for('lively-serialize-closure')]).equals(undefined);
      const restored = deserialize(serialize({callback}));
      expect(restored.callback).equals(undefined);
      expect(warnings).length(0);
    });
  }

  it('runs a native mixin and warns once even when the AST registry changes', async () => {
    const {Base, mixin} = await load('export class Base { value() { return 2; } } export const mixin = B => class extends B { value() { return super.value() + 1; } }; export function stop() { debugger; }');
    expect(module(S, id).debuggingEnabled).equals(true);
    const registry = getCurrentASTRegistry();
    try {
      expect(new (mixin(Base))().value()).equals(3);
      expect(new (mixin(Base))().value()).equals(3);
      setCurrentASTRegistry({});
      expect(new (mixin(Base))().value()).equals(3);
      expect(warnings).length(1);
      expect(warnings[0][0]).includes('mixin');
      expect(warnings[0][0]).includes(id);
      expect(warnings[0][1]).instanceOf(Error);
    } finally { setCurrentASTRegistry(registry); }
  });

  it('runs functions containing local class declarations natively', async () => {
    const {task} = await load('export function task(value) { class Local { constructor(value) { this.value = value; } } return new Local(value).value; } export function stop() { debugger; }');
    expect(task(4)).equals(4);
    expect(task(5)).equals(5);
    expect(warnings).length(1);
    expect(warnings[0][0]).includes('task');
    expect(warnings[0][0]).includes(id);
  });

  it('runs object methods returning a class natively', async () => {
    const {task} = await load('export const task = {make() { return class Local { value() { return 5; } }; }}; export function stop() { debugger; }');
    expect(new (task.make())().value()).equals(5);
    expect(new (task.make())().value()).equals(5);
    expect(warnings).length(1);
    expect(warnings[0][0]).includes('Local');
    expect(warnings[0][0]).includes(id);
  });

  it('preserves native constructor targets and runtime errors after compilation fails', async () => {
    const {Task, fails, failure} = await load('export const failure = new Error("expected failure"); export function Task(value) { class Local { value() { return 1; } } this.value = value; this.target = new.target; this.local = Local; } export function fails() { class Local { value() { return 1; } } throw failure; } export function stop() { debugger; }');
    function Derived() {}
    Derived.prototype = Object.create(Task.prototype);
    const instance = Reflect.construct(Task, [7], Derived);
    expect(instance).instanceOf(Derived);
    expect(instance.value).equals(7);
    expect(instance.target).equals(Derived);
    expect(typeof instance.local).equals('function');
    let thrown;
    try { fails(); } catch (error) { thrown = error; }
    expect(thrown).equals(failure);
    expect(warnings).length(2);
  });
});
