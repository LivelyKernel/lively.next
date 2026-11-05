/* global afterEach, beforeEach, describe, it, System */
import { expect } from 'mocha-es6';
import { createFiles, resource } from 'lively.resources';
import module from 'lively.modules/src/module.js';
import { subscribe, unsubscribe } from 'lively.notifications';
import { morph, part } from 'lively.morphic';
import { Color, pt } from 'lively.graphics';
import { InteractiveComponentDescriptor } from '../../components/editor.js';
import { releaseComponentEditingState } from './test-isolation.js';

const directory = 'local://component-session-lifecycle-test/';
const moduleId = directory + 'fixture.cp.js';
const source = `import { component } from 'lively.morphic/components/core.js';
import { Color, pt } from 'lively.graphics';
const Example = component({ name: 'example', submorphs: [{
  name: 'box', fill: Color.red, position: pt(10, 20)
}] });
export { Example };`;

describe('component session source and undo lifecycle', () => {
  releaseComponentEditingState();
  let componentModule, descriptor, editable, tracker, manager, lateEviction;
  let showError, logError, errors;
  const instances = [];

  beforeEach(async () => {
    errors = [];
    showError = $world.showError;
    logError = $world.logError;
    $world.showError = error => errors.push(error);
    $world.logError = error => errors.push(error);
    await createFiles(directory, { 'fixture.cp.js': source });
    componentModule = module(System, moduleId);
    ({ Example: descriptor } = await componentModule.load());
    descriptor = InteractiveComponentDescriptor.ensureInteractive(descriptor);
    editable = await descriptor.edit();
    editable.openInWorld();
    tracker = editable._changeTracker;
    manager = editable.env.undoManager;
    manager.reset();
  });

  afterEach(async () => {
    if (lateEviction) unsubscribe('lively.modules/modulechanged', lateEviction, System);
    lateEviction = null;
    descriptor?.stopEditSession();
    editable?.remove();
    instances.splice(0).forEach(instance => instance.remove());
    manager?.undoStop();
    manager?.reset();
    await componentModule?.unload();
    await resource(directory).remove();
    await System._livelyModulesTranslationCache.deleteCachedData(moduleId);
    $world.showError = showError;
    $world.logError = logError;
  });

  /** Apply an adopted halo-style write through the real committed-change listener. */
  async function dragTo (x) {
    editable.withMetaDo({ reconcileChanges: true }, () => {
      editable.get('box').position = pt(x, x * 2);
    });
    await tracker.onceChangesProcessed();
    expect(tracker.lastShadowCommandBatch.projectionalCommit).to.be.ok;
    expect(errors).to.be.empty;
  }

  /** Record earlier history outside this editing session. */
  function unrelatedEdit () {
    const other = morph({ fill: Color.red });
    instances.push(other);
    other.undoStart('unrelated fill');
    other.fill = Color.green;
    const entry = other.undoStop();
    return { other, entry };
  }

  /** Assert both the current policy cache and a cold instance agree with the editable. */
  function expectPosition (x) {
    const cold = part(descriptor);
    instances.push(cold);
    expect(editable.get('box').position).deep.equals(pt(x, x * 2));
    expect(cold.get('box').position).deep.equals(editable.get('box').position);
  }

  it('projects against the saved text when cache eviction runs after the tracker listener', async () => {
    // Simulate the Module subscriber being registered after the session subscriber.
    lateEviction = subscribe('lively.modules/modulechanged', change => {
      if (change.module === moduleId) componentModule.reset();
    }, System);
    const saved = '// saved with a later cache-eviction listener\n' + source;
    await componentModule.changeSource(saved);
    editable.undoStart('edit after reversed save notification');
    await dragTo(11);
    editable.undoStop();
    const after = componentModule._source;
    expect(after).includes('// saved with a later cache-eviction listener');
    expectPosition(11);
    manager.undo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(saved);
    expectPosition(10);
    manager.redo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(after);
    expectPosition(11);
    expect(errors).to.be.empty;
  });

  it('recovers the saved payload on a synchronous read after a late eviction', () => {
    const saved = '// saved payload\n' + source;
    tracker._moduleChangedListener({ module: moduleId, newSource: saved });
    componentModule.reset();
    expect(tracker.currentModuleSource).equals(saved);
  });

  it('prunes coalesced session entries so undo reaches earlier unrelated history', async () => {
    const { other, entry } = unrelatedEdit();
    editable.undoStart('coalesced component drag');
    await dragTo(11);
    await dragTo(12);
    editable.undoStop();
    const after = componentModule._source;
    descriptor.stopEditSession();
    expect(manager.undos).deep.equals([entry]);
    expect(manager.grouping.current).deep.equals([entry]);
    manager.undo();
    expect(other.fill).equals(Color.red);
    expect(componentModule._source).equals(after);
    manager.redo();
    expect(other.fill).equals(Color.green);
    expect(componentModule._source).equals(after);
  });

  it('prunes session redos without removing unrelated redo history', async () => {
    const { other, entry } = unrelatedEdit();
    editable.undoStart('component drag');
    await dragTo(11);
    editable.undoStop();
    manager.undo();
    await tracker.onceChangesProcessed();
    manager.undo();
    descriptor.stopEditSession();
    expect(manager.redos).deep.equals([entry]);
    manager.redo();
    expect(other.fill).equals(Color.green);
    expect(componentModule._source).equals(source);
  });

  it('preserves unrelated entries inside a composite group when a session ends', async () => {
    const { other } = unrelatedEdit();
    editable.undoStart('first component drag');
    await dragTo(11);
    editable.undoStop();
    editable.undoStart('second component drag');
    await dragTo(12);
    editable.undoStop();
    manager.group();
    const after = componentModule._source;
    descriptor.stopEditSession();
    expect(manager.undos).has.length(1);
    manager.undo();
    expect(other.fill).equals(Color.red);
    expect(componentModule._source).equals(after);
    manager.redo();
    expect(other.fill).equals(Color.green);
    expect(componentModule._source).equals(after);
  });

  it('removes joined session entries and cancels their emptied active recorder on dispose', async () => {
    const { other, entry } = unrelatedEdit();
    editable.undoStart('aborted component drag');
    await dragTo(11);
    await dragTo(12);
    descriptor.stopEditSession();
    expect(manager.undoInProgress).equals(null);
    expect(manager.undos).deep.equals([entry]);
    manager.undo();
    expect(other.fill).equals(Color.red);
  });

  it('closes an aborted joined gesture on the next undoStart and replays both exact endpoints', async () => {
    editable.undoStart('aborted drag');
    await dragTo(11);
    await dragTo(12);
    const aborted = manager.undoInProgress;
    const firstSource = componentModule._source;
    // An exception or missing mouseup prevented the first gesture's undoStop.
    const next = editable.undoStart('next drag');
    expect(next).not.equals(aborted);
    expect(manager.undos).has.length(1);
    await dragTo(13);
    await dragTo(14);
    expect(manager.undoInProgress.joinedTransactions).has.length(1);
    editable.undoStop();
    const lastSource = componentModule._source;
    expect(manager.undos).has.length(2);
    manager.undo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(firstSource);
    expectPosition(12);
    manager.undo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(source);
    expectPosition(10);
    manager.redo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(firstSource);
    expectPosition(12);
    manager.redo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(lastSource);
    expectPosition(14);
  });

  it('keeps normally closed gestures separate and replays each once', async () => {
    editable.undoStart('first drag');
    await dragTo(11);
    await dragTo(12);
    editable.undoStop();
    const firstSource = componentModule._source;
    editable.undoStart('second drag');
    await dragTo(13);
    editable.undoStop();
    expect(manager.undos).has.length(2);
    manager.undo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(firstSource);
    expectPosition(12);
    manager.undo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(source);
    expectPosition(10);
  });
});
