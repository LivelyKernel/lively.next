/* global describe, it */
import { expect } from 'mocha-es6';
import { resource } from 'lively.resources';
import { module } from 'lively.modules';
import { runWithCapturedBindings } from 'lively.context/lib/stackReification.js';
import { resumeInspectorContinuation } from 'lively.context/lib/inspector-interpreter.js';
import { serialize, deserialize } from 'lively.serializer2';
import { openForContinuation } from '../../js/debugger/ui.cp.js';
import { readFrameSource, moduleUrlForFrame, lineRangeForFrame, sourceNameForFrame } from '../../js/debugger/source.js';
import { serializeMorph, loadMorphFromSnapshot } from 'lively.morphic/serialization.js';
import * as modules from 'lively.modules';
import { LivelyWorld } from '../../world.js';
import { localInterface } from 'lively-system-interface';

describe('runtime closure bindings', function () {
  it('shows an async generator in its class module and applies saved future edits', async function () {
    this.timeout(10000);
    const file = resource('local://debugger-generator/lesson.js');
    const source = 'export class Lesson {\n constructor() { this.rate = "2"; this.visits = 0; this.cleanups = 0; }\n async *values() {\n  try {\n   for (const quantity of [2, 3]) {\n    this.visits++;\n    let amount = this.rate + quantity;\n    await Promise.resolve();\n    debugger;\n    yield amount;\n   }\n  } finally { this.cleanups++; }\n }\n async checkout() { let total = 0; for await (const value of this.values()) total += value; return total; }\n}';
    await file.write(source);
    const mod = module(file.url);
    let view;
    try {
      const {Lesson} = await mod.load();
      const lesson = new Lesson();
      const stopped = await runWithCapturedBindings(lesson.checkout, null, [], {this: lesson});
      expect(stopped.exception).equals(undefined);
      expect(sourceNameForFrame(stopped.currentFrame)).contains('values');
      view = openForContinuation(stopped, $world);
      const model = view.viewModel;
      await model.selectFrame(stopped.currentFrame);
      expect(model.ui.sourcePane.textString).equals(source);
      expect(lineRangeForFrame(stopped.currentFrame, source).start.row).equals(8);
      expect((await model.evaluateWorkspaceSource('this.rate = 2; amount = this.rate * quantity')).value).equals(4);
      model.ui.sourcePane.textString = source.replace('yield amount;', 'yield amount * 2;');
      expect(await model.saveModule()).equals(true);
      expect((await model.applySavedMethod()).isContinuation).equals(true);
      await model.selectFrame(model.continuation.currentFrame);
      const saved = model.ui.sourcePane.textString, originalRead = localInterface.moduleRead;
      let entered, release;
      const started = new Promise(resolve => { entered = resolve; });
      const pending = new Promise(resolve => { release = resolve; });
      localInterface.moduleRead = () => { entered(); return pending; };
      try {
        const selection = model.selectFrame(model.continuation.currentFrame);
        await started;
        model.ui.sourcePane.textString = saved + '\n// next repair draft';
        model.rememberSourceEdits();
        release(saved);
        await selection;
        expect(model.ui.sourcePane.textString).equals(saved + '\n// next repair draft');
      } finally { localInterface.moduleRead = originalRead; release(saved); }
      model.sourceBuffers.clear();
      expect((await model.proceed()).isContinuation).equals(true);
      expect(lesson.visits).equals(2);
      expect(lesson.cleanups).equals(0);
      await model.evaluateWorkspaceSource('amount = this.rate * quantity');
      expect(await model.proceed()).equals(20);
      expect(lesson.visits).equals(2);
      expect(lesson.cleanups).equals(1);
    } finally {
      if (view) { view.viewModel.sourceBuffers.clear(); await view.viewModel.closeDebugger(); }
      await mod.unload(); await file.remove();
    }
  });

  it('keeps a restored world name when no creation or project prompt is requested', async function () {
    const world = {name: 'restored-debugger-world', initializeTopBar: async () => {}, initializeStudioUI: async () => {}};
    const push = history.pushState;
    history.pushState = () => {};
    try {
      await LivelyWorld.prototype.initializeStudio.call(world);
      expect(world.name).equals('restored-debugger-world');
    } finally { history.pushState = push; }
  });
  it('repairs native retained cells shared with sibling closures and enforces constants', async function () {
    this.timeout(10000);
    const file = resource('local://debugger-runtime-closures/factory.js');
    const source = 'export function make(value) {\n const ledger = {total: 0};\n function charge(quantity) {\n  let amount = value + quantity;\n  debugger;\n  ledger.total += amount;\n  return ledger.total;\n }\n return {charge, ledger, read: () => value, scaled: () => scale(value)};\n}\nexport function scale(value) { return value * 2; }';
    await file.write(source);
    const mod = module(file.url);
    let view, restoredWindow;
    try {
      const {make} = await mod.load();
      const account = make('2');
      const bindings = account.charge[Symbol.for('lively-debug-bindings')];
      expect(!!bindings).equals(true);
      expect(bindings.ledger).equals(account.ledger);
      const meta = account.charge[Symbol.for('lively-object-meta')];
      expect(source.slice(meta.start, meta.end)).contains('function charge(quantity)');
      const stopped = await runWithCapturedBindings(account.charge, null, [3]);
      expect(await readFrameSource(stopped.currentFrame)).equals(source);
      expect(moduleUrlForFrame(stopped.currentFrame)).equals(mod.id);
      expect(lineRangeForFrame(stopped.currentFrame, source).start.row).equals(4);
      view = openForContinuation(stopped, $world);
      const model = view.viewModel;
      await model.selectFrame(stopped.currentFrame);
      expect(model.ui.sourcePane.textString).equals(source);
      model.ui.workspaceInput.textString = '[1, 2, [3]]';
      model.ui.workspaceInput.selectAll();
      await model.ui.workspaceInput.execCommand('printit');
      expect(JSON.parse(model.ui.workspaceInput.selection.text)).deep.equals([1, 2, [3]]);
      const scope = stopped.currentFrame.getScope().findScope('value').scope;
      scope.set('value', 7);
      expect(account.read()).equals(7);
      expect(() => scope.set('ledger', {})).to.throw(TypeError);
      stopped.currentFrame.getScope().findScope('amount').scope.set('amount', 10);
      model.workspaceBindings.account = account;
      model.workspaceBindings.scratch = 13;
      const draft = source + '\n// unsaved debugger draft';
      model.ui.sourcePane.textString = draft;
      model.rememberSourceEdits();
      // A saved image can reopen on a different desktop server origin.
      const buffer = model.sourceBuffers.get(mod.id);
      model.sourceBuffers.delete(mod.id);
      model.sourceBuffers.set('http://old-desktop.invalid/factory.js', buffer);
      stopped.currentFrame.func.debuggerSource.url = 'http://old-desktop.invalid/factory.js';
      restoredWindow = await loadMorphFromSnapshot(serializeMorph(view.getWindow()), {moduleManager: modules});
      expect(!!restoredWindow.master).equals(true);
      $world.addMorph(restoredWindow);
      const restoredModel = restoredWindow.targetMorph.viewModel;
      await restoredModel.selectFrame(restoredModel.continuation.currentFrame);
      expect(restoredModel.currentModuleUrl).equals(mod.id);
      expect(restoredModel.ui.sourcePane.textString).equals(draft);
      expect(restoredModel.workspaceBindings.scratch).equals(13);
      restoredModel.ui.workspaceInput.textString = 'value = 12';
      expect(await restoredModel.evaluateWorkspace()).equals(12);
      expect(restoredModel.workspaceBindings.account.read()).equals(12);
      restoredModel.sourceBuffers.clear();
      expect(await restoredModel.proceed()).equals(10);
      expect(restoredModel.workspaceBindings.account.ledger.total).equals(10);
      const restored = deserialize(serialize({account, stopped}));
      expect(await readFrameSource(restored.stopped.currentFrame)).equals(source);
      const restoredScope = restored.stopped.currentFrame.getScope().findScope('value').scope;
      restoredScope.set('value', 8);
      expect(restored.account.read()).equals(8);
      expect(restored.account.scaled()).equals(16);
      expect(resumeInspectorContinuation(restored.stopped)).equals(10);
      expect(restored.account.ledger.total).equals(10);
      expect(account.read[Symbol.for('lively-debug-bindings')][Symbol.for('lively-debug-binding-cells')].value)
        .equals(bindings[Symbol.for('lively-debug-binding-cells')].value);
    } finally {
      if (view) { view.viewModel.sourceBuffers.clear(); await view.viewModel.closeDebugger(); }
      if (restoredWindow?.owner) { restoredWindow.targetMorph.viewModel.sourceBuffers.clear(); await restoredWindow.targetMorph.viewModel.closeDebugger(); }
      await mod.unload(); await file.remove();
    }
  });
});
