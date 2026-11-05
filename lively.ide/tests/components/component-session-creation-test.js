/* global afterEach, beforeEach, describe, it, System */
import { expect } from 'mocha-es6';
import { createFiles, resource } from 'lively.resources';
import module from 'lively.modules/src/module.js';
import { localInterface } from 'lively-system-interface';
import { MorphicEnv, part } from 'lively.morphic';
import { Color } from 'lively.graphics';
import { InteractiveComponentDescriptor } from '../../components/editor.js';
import { releaseComponentEditingState } from './test-isolation.js';

const directory = 'local://component-session-creation-test/';
const moduleId = directory + 'fixture.cp.js';
const source = `import { component, ComponentDescriptor, part } from 'lively.morphic/components/core.js';
import { Color } from 'lively.graphics';
component.DescriptorClass = ComponentDescriptor;
const Saved = component({ name: 'saved', fill: Color.red, submorphs: [{ name: 'child' }] });
const Derived = component(Saved, { name: 'derived' });
const Host = component({ name: 'host', submorphs: [part(Saved, { name: 'instance' })] });
export { Saved, Derived, Host };`;

describe('component editing session creation', () => {
  releaseComponentEditingState();
  let componentModule, exports, workspace, logError, logged, unhandled, onRejection;
  let descriptors, morphs;

  beforeEach(async () => {
    descriptors = [];
    morphs = [];
    logged = [];
    unhandled = [];
    logError = $world.logError;
    $world.logError = error => logged.push(error);
    onRejection = event => {
      unhandled.push(event.reason);
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', onRejection);
    await createFiles(directory, { 'fixture.cp.js': source });
    componentModule = module(System, moduleId);
    exports = await componentModule.load();
  });

  afterEach(async () => {
    for (const descriptor of descriptors) {
      const cached = descriptor._cachedComponent;
      descriptor.stopEditSession();
      cached?.remove();
    }
    morphs.forEach(morph => morph.remove());
    workspace?.remove();
    workspace = null;
    await componentModule?.unload();
    await resource(directory).remove();
    await System._livelyModulesTranslationCache.deleteCachedData(moduleId);
    window.removeEventListener('unhandledrejection', onRejection);
    $world.logError = logError;
  });

  /** Promote a real evaluated descriptor without supplying or inventing source. */
  function interactive (descriptor) {
    const result = InteractiveComponentDescriptor.ensureInteractive(descriptor);
    descriptors.push(result);
    return result;
  }

  /** Evaluate a declaration without inserting it into the fixture module's source. */
  async function evalOnly () {
    const result = await localInterface.runEval(
      "const EvalOnly = component({ name: 'eval only' }); EvalOnly;", { targetModule: moduleId });
    expect(result.isError).not.equals(true);
    return interactive(result.value);
  }

  /** Require a bug-grade refusal before any editable or global listener is retained. */
  async function assertRefused (descriptor, open = () => descriptor.edit()) {
    const manager = MorphicEnv.default().changeManager;
    const listeners = [...manager.committedChangeListeners];
    let error;
    try { await open(); } catch (err) { error = err; }
    // Allow an independently started backup promise to reject on the old implementation.
    await new Promise(resolve => setTimeout(resolve, 200));
    expect(error).to.be.instanceOf(Error);
    expect(error.message).includes('Internal component editing error:');
    expect(error.message).includes('has no backing source declaration. This is a bug.');
    expect(error.stack).includes(error.message);
    expect(logged).deep.equals([error]);
    expect(descriptor._cachedComponent).not.to.be.ok;
    expect(descriptor._backupComponentDef).not.to.be.ok;
    expect(manager.committedChangeListeners).deep.equals(listeners);
    expect(unhandled).to.be.empty;
  }

  /** Commit a real fill gesture and replay it against the exact current module text. */
  async function editFillAndReplay (descriptor, beforeSource) {
    const editable = descriptor._cachedComponent;
    const tracker = editable._changeTracker;
    const beforeFill = editable.fill;
    morphs.push(editable);
    editable.undoStart('edit after module source cache eviction');
    try {
      editable.withMetaDo({ reconcileChanges: true }, () => { editable.fill = Color.green; });
      await tracker.onceChangesProcessed();
    } finally { editable.undoStop(); }
    expect(tracker.lastShadowCommandBatch.projectionalCommit).to.be.ok;
    const finalSource = componentModule._source;
    expect(finalSource).includes('fill: Color.green');
    expect(editable.fill).equals(Color.green);
    editable.env.undoManager.undo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(beforeSource);
    expect(editable.fill).equals(beforeFill);
    editable.env.undoManager.redo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(finalSource);
    expect(editable.fill).equals(Color.green);
    expect(logged).to.be.empty;
    expect(unhandled).to.be.empty;
  }

  it('commits after saving the open component module without losing the saved text', async () => {
    const descriptor = interactive(exports.Saved);
    const editable = await descriptor.edit();
    morphs.push(editable);
    editable.openInWorld();
    const savedSource = '// a later module save\n' + source;
    await componentModule.changeSource(savedSource);
    expect(await resource(moduleId).read()).equals(savedSource);
    await editFillAndReplay(descriptor, savedSource);
  });

  it('commits after reset and re-establishes the original declaration backup', async () => {
    const descriptor = interactive(exports.Saved);
    const editable = await descriptor.edit();
    morphs.push(editable);
    editable.openInWorld();
    const backup = descriptor._backupComponentDef;
    await descriptor.reset();
    // Reading the resource must not warm the module's evicted source cache.
    const resetSource = await resource(moduleId).read();
    await editFillAndReplay(descriptor, resetSource);
    expect(descriptor._backupComponentDef).equals(backup);
  });

  it('keeps the session when makeDirty has no backup and the source cache is evicted', async () => {
    const descriptor = interactive(exports.Saved);
    const editable = await descriptor.edit();
    morphs.push(editable);
    editable.openInWorld();
    const tracker = editable._changeTracker;
    const listeners = [...editable.env.changeManager.committedChangeListeners];
    delete descriptor._backupComponentDef;
    componentModule.reset();
    expect(componentModule._source).equals(null);
    descriptor.makeDirty();
    expect(descriptor._cachedComponent).equals(editable);
    expect(editable._changeTracker).equals(tracker);
    expect(editable.env.changeManager.committedChangeListeners).deep.equals(listeners);
    expect(logged).to.be.empty;
    await tracker.whenReady();
    await editFillAndReplay(descriptor, source);
  });

  it('releases source refresh on disposal and keeps the module cache reset semantics', async () => {
    const descriptor = interactive(exports.Saved);
    const editable = await descriptor.edit();
    morphs.push(editable);
    descriptor.stopEditSession();
    await componentModule.changeSource('// saved after disposal\n' + source);
    expect(componentModule._source).equals(null);
    expect(logged).to.be.empty;
    expect(unhandled).to.be.empty;
  });

  it('refuses A1 Workspace declarations before creating an editable session', async () => {
    workspace = await $world.execCommand('open javascript workspace', { systemInterface: 'local' });
    workspace.content = `import { component } from 'lively.morphic/components/core.js';
const WorkspaceComponent = component({ name: 'workspace component' });
WorkspaceComponent;`;
    const result = await workspace.jsPlugin.runEval(workspace.content);
    expect(result.isError).not.equals(true);
    await assertRefused(interactive(result.value));
  });

  it('refuses A2 eval-only declarations before creating an editable session', async () => {
    await assertRefused(await evalOnly());
    expect(componentModule._source).equals(source);
  });

  it('guards synchronous editable refresh before replacing a visible preview', async () => {
    const descriptor = await evalOnly();
    const preview = descriptor.getComponentMorph();
    morphs.push(preview);
    preview.openInWorld();
    delete descriptor._cachedComponent; // The hot-replacement caller clears this first.
    await assertRefused(descriptor, () => descriptor.ensureComponentMorphUpToDate(preview));
    expect(preview.world()).equals($world);
    expect(preview._changeTracker).not.to.be.ok;
  });

  it('refuses a source-less dirty backup without an unhandled rejection', async () => {
    const descriptor = await evalOnly();
    await assertRefused(descriptor, () => descriptor.makeDirty());
    expect(descriptor.isDirty()).not.equals(true);
  });

  for (const name of ['Saved', 'Derived', 'Host']) {
    it(`opens and edits the source-backed ${name} control`, async () => {
      const descriptor = interactive(exports[name]);
      const editable = await descriptor.edit();
      morphs.push(editable);
      const tracker = editable._changeTracker;
      expect(tracker.projectionalDocumentForCurrentSource().supported).equals(true);
      editable.undoStart('source-backed creation control');
      editable.withMetaDo({ reconcileChanges: true }, () => { editable.opacity = 0.4; });
      await tracker.onceChangesProcessed();
      editable.undoStop();
      expect(tracker.lastShadowCommandBatch.projectionalCommit).to.be.ok;
      const finalSource = componentModule._source;
      const instance = part(descriptor);
      morphs.push(instance);
      instance.master.applyIfNeeded(true);
      expect(instance.opacity).equals(editable.opacity);
      editable.env.undoManager.undo();
      await tracker.onceChangesProcessed();
      expect(componentModule._source).equals(source);
      editable.env.undoManager.redo();
      await tracker.onceChangesProcessed();
      expect(componentModule._source).equals(finalSource);
      expect(logged).to.be.empty;
      expect(unhandled).to.be.empty;
    });
  }

  it('refreshes an active source-backed editable synchronously', async () => {
    const descriptor = interactive(exports.Saved);
    const previous = await descriptor.edit();
    morphs.push(previous);
    previous.openInWorld();
    const oldTracker = previous._changeTracker;
    const listenerCount = previous.env.changeManager.committedChangeListeners.length;
    delete descriptor._cachedComponent; // The hot-replacement caller clears this first.
    descriptor.ensureComponentMorphUpToDate(previous);
    const current = descriptor._cachedComponent;
    morphs.push(current);
    expect(current).not.equals(previous);
    expect(current.world()).equals($world);
    expect(current._changeTracker).to.be.ok;
    await current._changeTracker.whenReady();
    expect(current._changeTracker.projectionalDocumentForCurrentSource().supported).equals(true);
    expect(current.env.changeManager.committedChangeListeners).not.includes(oldTracker._committedChangeListener);
    expect(current.env.changeManager.committedChangeListeners).has.length(listenerCount);
    expect(componentModule._source).equals(source);
    expect(logged).to.be.empty;
    expect(unhandled).to.be.empty;
  });
});
