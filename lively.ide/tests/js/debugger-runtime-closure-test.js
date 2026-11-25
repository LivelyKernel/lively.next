/* global describe, it, $world, System */
import { expect } from 'mocha-es6';
import { resource } from 'lively.resources';
import * as modules from 'lively.modules';
import { serialize, deserialize } from 'lively.serializer2';
import { runWithCapturedBindings } from 'lively.context/lib/stackReification.js';
import { serializeMorph, loadMorphFromSnapshot } from 'lively.morphic/serialization.js';
import { Project } from 'lively.project';
import { localInterface } from 'lively-system-interface';
import browserCommands from '../../js/browser/commands.js';
import { LivelyWorld } from '../../world.js';
import { readFrameSource, moduleUrlForFrame, lineRangeForFrame } from '../../js/debugger/source.js';
import { RuntimeClosureLesson } from '../../js/debugger/examples/runtime-closure.js';
import { debuggerFor, closeDebuggers, withModule } from './debugger-helpers.js';

const { module } = modules;
const studio = () => ({ metadata: {}, initializeTopBar: async () => {}, initializeStudioUI: async () => {} });

describe('debugger interception and runtime closures', function () {
  this.timeout(20000);

  it('enables interception before the studio loads unless it was disabled', async () => {
    const automatic = System.debuggerInterception, settings = [];
    const world = { ...studio(), initializeTopBar: async () => { settings.push(System.debuggerInterception); } };
    try {
      delete System.debuggerInterception;
      await LivelyWorld.prototype.initializeStudio.call(world);
      System.debuggerInterception = false;
      await LivelyWorld.prototype.initializeStudio.call(world);
      expect(settings).deep.equals([true, false]);
    } finally { System.debuggerInterception = automatic; }
  });

  it('intercepts project modules opened during studio initialization unless disabled', async () => {
    const automatic = System.debuggerInterception, loadProject = Project.loadProject, pushState = history.pushState;
    history.pushState = () => {};
    try {
      for (const enabled of [undefined, false]) {
        const file = resource(`local://debugger-project-open/${String(enabled)}.js`), mod = module(file.url);
        await file.write('export function inspect() { debugger; return 3; }');
        if (enabled === undefined) delete System.debuggerInterception;
        else System.debuggerInterception = enabled;
        Project.loadProject = async name => { expect(name).equals('debugger-project'); await mod.load(); };
        try {
          await LivelyWorld.prototype.initializeStudio.call({ ...studio(), metadata: undefined, projectToBeOpened: 'debugger-project' });
          expect(mod.debuggingEnabled).equals(enabled !== false);
        } finally { await mod.unload(); await file.remove(); }
      }
    } finally {
      Project.loadProject = loadProject;
      history.pushState = pushState;
      System.debuggerInterception = automatic;
    }
    expect(module('lively.morphic/text/document.js').debuggingEnabled, 'core modules stay native').equals(false);
    expect(module('lively.lang/Path.js').debuggingEnabled).equals(false);
  });

  it('toggles the interception of the module selected in the System Browser', () => withModule('plain.js', 'export function plain() { return 1; }', async (exports, { mod }) => {
    const messages = [], browser = {
      world: () => $world, selectedModule: { url: mod.id }, systemInterface: localInterface,
      reviveFrozenModuleIfNeeded: async () => {}, setStatusMessage: message => messages.push(message)
    };
    const toggle = browserCommands(browser).find(command => command.name === 'toggle module debugger interception');
    expect([await toggle.exec(browser), mod.debuggingEnabled, await toggle.exec(browser), mod.debuggingEnabled]).deep.equals([true, true, true, false]);
    expect(messages).deep.equals(['Debugger interception enabled', 'Debugger interception disabled']);
    expect(await toggle.exec({ ...browser, selectedModule: null })).equals(false);
  }));

  it('repairs native retained cells shared with sibling closures and restores them with a saved debugger', () => withModule('factory.js',
    'export function make(value) {\n const ledger = {total: 0};\n function charge(quantity) {\n  let amount = value + quantity;\n  debugger;\n  ledger.total += amount;\n  return ledger.total;\n }\n return {charge, ledger, read: () => value, scaled: () => scale(value)};\n}\nexport function scale(value) { return value * 2; }',
    async ({ make }, { mod, file }) => {
      const source = await file.read(), account = make('2'), bindings = account.charge[Symbol.for('lively-debug-bindings')];
      expect(bindings.ledger).equals(account.ledger);
      const meta = account.charge[Symbol.for('lively-object-meta')];
      expect(source.slice(meta.start, meta.end)).contains('function charge(quantity)');
      const stopped = await runWithCapturedBindings(account.charge, null, [3]);
      expect([readFrameSource(stopped.currentFrame), moduleUrlForFrame(stopped.currentFrame)]).deep.equals([source, mod.id]);
      expect(lineRangeForFrame(stopped.currentFrame, source).start.row).equals(4);
      const model = await debuggerFor(stopped);
      expect(model.ui.sourcePane.textString).equals(source);
      model.ui.workspaceInput.textString = '[1, 2, [3]]';
      model.ui.workspaceInput.selectAll();
      expect(await model.evaluateWorkspace()).deep.equals([1, 2, [3]]);
      await model.ui.workspaceInput.execCommand('printit');
      expect(model.ui.workspaceInput.selection.text, 'Print it shows String(value)').equals('1,2,3');
      const scope = stopped.currentFrame.getScope().findScope('value').scope;
      scope.set('value', 7);
      expect(account.read()).equals(7);
      expect(() => scope.set('ledger', {})).to.throw(TypeError);
      stopped.currentFrame.getScope().findScope('amount').scope.set('amount', 10);
      Object.assign(model.workspaceBindings, { account, scratch: 13 });
      const draft = source + '\n// unsaved debugger draft';
      model.ui.sourcePane.textString = draft;
      model.rememberSourceEdits();
      // The saved world reopens on another origin of the desktop server.
      const buffer = model.sourceBuffers.get(mod.id);
      model.sourceBuffers.delete(mod.id);
      model.sourceBuffers.set('http://old-desktop.invalid/factory.js', buffer);
      stopped.currentFrame.func.debuggerSource.url = 'http://old-desktop.invalid/factory.js';
      const restoredWindow = await loadMorphFromSnapshot(serializeMorph(model.view.getWindow()), { moduleManager: modules });
      expect(!!restoredWindow.master, 'the restored window keeps its master').equals(true);
      $world.addMorph(restoredWindow);
      const restored = restoredWindow.targetMorph.viewModel;
      try {
        await restored.selectFrame(restored.continuation.currentFrame);
        expect([restored.currentModuleUrl, restored.ui.sourcePane.textString, restored.workspaceBindings.scratch]).deep.equals([mod.id, draft, 13]);
        restored.ui.workspaceInput.textString = 'value = 12';
        expect(await restored.evaluateWorkspace()).equals(12);
        expect(restored.workspaceBindings.account.read()).equals(12);
        restored.sourceBuffers.clear();
        expect(await restored.proceed()).equals(10);
        expect(restored.workspaceBindings.account.ledger.total).equals(10);
      } finally { if (restoredWindow.owner) { restored.sourceBuffers.clear(); await restored.closeDebugger(); } }
      await closeDebuggers();
      const copy = deserialize(serialize({ account, stopped }));
      expect(readFrameSource(copy.stopped.currentFrame)).equals(source);
      copy.stopped.currentFrame.getScope().findScope('value').scope.set('value', 8);
      expect([copy.account.read(), copy.account.scaled(), copy.stopped.resume(), copy.account.ledger.total]).deep.equals([8, 16, 10, 10]);
      expect(account.read[Symbol.for('lively-debug-bindings')][Symbol.for('lively-debug-binding-cells')].value)
        .equals(bindings[Symbol.for('lively-debug-binding-cells')].value);
    }, async mod => {
      // Native retained cells without interception are captured by runWithCapturedBindings.
      await mod.setDebuggingEnabled(false);
      mod.retainRuntimeClosures = true;
    }));

  it('saves the runtime closure tutorial while the caller with an uninitialized constant is selected and resumes it', async () => {
    const lesson = new RuntimeClosureLesson();
    const model = await debuggerFor(await runWithCapturedBindings(lesson.checkout, null, [3], { this: lesson }));
    try {
      for (const action of ['stepOver', 'stepInto', 'proceed']) {
        await model[action]();
        await model.selectFrame(model.continuation.currentFrame);
      }
      for (const source of ['rate = 2', 'amount = rate + quantity']) await model.evaluateWorkspaceSource(source);
      await model.selectFrame(model.continuation.frames()[1]);
      const snapshot = serializeMorph(model.view.getWindow());
      const declaring = model.ui.scopeList.items.find(item => item.value.bindingNames().includes('total'));
      await model.selectScope(declaring.value);
      const lines = model.ui.valueTree.treeData.asListWithIndexAndDepth().map(({ node }) => node.keyString + ': ' + node.valueString);
      expect(lines.find(line => line.startsWith('total'))).contains("Cannot access 'total' before initialization");
      const restoredWindow = await loadMorphFromSnapshot(snapshot, { moduleManager: modules });
      $world.addMorph(restoredWindow);
      const restored = restoredWindow.targetMorph.viewModel, [charge, checkout] = restored.continuation.frames();
      try {
        expect(() => checkout.lookup('total')).to.throw(ReferenceError);
        const ledger = charge.lookup('ledger');
        expect(await restored.proceed()).equals(6);
        expect([ledger.total, ledger.visits]).deep.equals([5, 1]);
      } finally { if (restoredWindow.owner) { restored.sourceBuffers.clear(); await restored.closeDebugger(); } }
    } finally { await closeDebuggers(); }
  });
});
