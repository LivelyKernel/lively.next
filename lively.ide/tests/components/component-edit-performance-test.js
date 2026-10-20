/* global afterEach, beforeEach, describe, it, System */
import { expect } from 'mocha-es6';
import { createFiles, resource } from 'lively.resources';
import module from 'lively.modules/src/module.js';
import { pt, Color } from 'lively.graphics';
import { part } from 'lively.morphic';
import { InteractiveComponentDescriptor } from '../../components/editor.js';
import { ComponentTransactionConflictError } from '../../components/reconciliation/component-transaction.js';
import { releaseComponentEditingState } from './test-isolation.js';

const directory = 'local://component-edit-performance-test/';
const moduleId = directory + 'fixture.cp.js';
const source = `import { component } from 'lively.morphic/components/core.js';
import { pt, Color } from 'lively.graphics';
import { Text } from 'lively.morphic';
const Example = component({ name: 'example', submorphs: [{
  name: 'box', position: pt(10, 20), fill: Color.red
}, {
  type: Text, name: 'text', position: pt(0, 0), extent: pt(10, 20),
  fixedWidth: true, fixedHeight: true
}] });
export { Example };`;

describe('component edit cost and retained history', () => {
  releaseComponentEditingState();
  let componentModule, descriptor, editable, tracker, manager;
  const instances = [];

  beforeEach(async () => {
    await createFiles(directory, { 'fixture.cp.js': source });
    componentModule = module(System, moduleId);
    ({ Example: descriptor } = await componentModule.load());
    descriptor = InteractiveComponentDescriptor.ensureInteractive(descriptor);
    editable = await descriptor.edit();
    tracker = editable._changeTracker;
    manager = editable.env.undoManager;
    manager.reset();
  });

  afterEach(async () => {
    descriptor?.stopEditSession();
    editable?.remove();
    instances.splice(0).forEach(instance => instance.remove());
    manager?.undoStop();
    manager?.reset();
    await componentModule?.unload();
    await resource(directory).remove();
    await System._livelyModulesTranslationCache.deleteCachedData(moduleId);
  });

  /** Record one real halo-style position event and wait for its projection. */
  async function dragTo (x) {
    editable.withMetaDo({ reconcileChanges: true }, () => {
      editable.get('box').position = pt(x, x * 2);
    });
    await tracker.onceChangesProcessed();
    expect(tracker.lastShadowCommandBatch.projectionalCommit).to.be.ok;
  }

  it('does not schedule diagnostic comparisons or retain diagnostic batches by default', async () => {
    let comparisons = 0;
    tracker.scheduleShadowProjectionComparison = () => { comparisons++; };
    await dragTo(11);
    expect(comparisons).equals(0);
    expect(tracker.shadowCommandBatches).equals(undefined);
    expect(tracker._shadowComparisonPromise).equals(undefined);
  });

  it('allows explicitly enabled diagnostic histories and comparisons', async () => {
    tracker.projectionalDebug = true;
    await dragTo(11);
    const comparison = await tracker._shadowComparisonPromise;
    expect(comparison.matches).equals(true);
    expect(tracker.shadowCommandBatches).deep.equals([tracker.lastShadowCommandBatch]);
  });

  it('retains one component transaction for a hundred-event drag and replays exact endpoints', async () => {
    const before = componentModule._source;
    editable.undoStart('halo drag');
    for (let index = 11; index <= 110; index++) await dragTo(index);
    expect(manager.undoInProgress.joinedTransactions).has.length(1);
    editable.undoStop();
    expect(manager.undos).has.length(1);
    const after = componentModule._source;
    const cold = part(descriptor);
    instances.push(cold);
    expect(cold.get('box').position).deep.equals(editable.get('box').position);
    manager.undo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(before);
    expect(editable.get('box').position).deep.equals(pt(10, 20));
    expect(descriptor.stylePolicy.spec.submorphs[0].position).deep.equals(pt(10, 20));
    manager.redo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(after);
    expect(editable.get('box').position).deep.equals(pt(110, 220));
    expect(descriptor.stylePolicy.spec.submorphs[0].position).deep.equals(pt(110, 220));
  });

  it('keeps separate gestures separate', async () => {
    editable.undoStart('first drag');
    await dragTo(11);
    await dragTo(12);
    editable.undoStop();
    const firstSource = componentModule._source;
    editable.undoStart('second drag');
    await dragTo(13);
    await dragTo(14);
    editable.undoStop();
    expect(manager.undos).has.length(2);
    manager.undo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(firstSource);
    expect(editable.get('box').position).deep.equals(pt(12, 24));
    manager.undo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(source);
  });

  it('keeps scalar writes to different properties in replay order within one gesture', async () => {
    const rootFill = editable.fill;
    editable.undoStart('move and style');
    await dragTo(11);
    editable.withMetaDo({ reconcileChanges: true }, () => {
      editable.get('box').fill = Color.blue;
      editable.fill = Color.green;
    });
    await tracker.onceChangesProcessed();
    await dragTo(12);
    expect(manager.undoInProgress.joinedTransactions).has.length(1);
    editable.undoStop();
    const after = componentModule._source;
    manager.undo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(source);
    expect(editable.get('box').fill).equals(Color.red);
    expect(editable.fill).equals(rootFill);
    expect(editable.get('box').position).deep.equals(pt(10, 20));
    manager.redo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(after);
    expect(editable.get('box').fill).equals(Color.blue);
    expect(editable.fill).equals(Color.green);
    expect(editable.get('box').position).deep.equals(pt(12, 24));
  });

  it('coalesces across derived Text measurements while retaining their legacy undo', async () => {
    const text = editable.get('text');
    const beforeExtent = text.extent;
    editable.undoStart('text halo drag');
    editable.withMetaDo({ reconcileChanges: true }, () => { text.position = pt(1, 2); });
    await tracker.onceChangesProcessed();
    text.withMetaDo({ isLayoutAction: true, metaInteraction: true }, () => { text.extent = pt(30, 40); });
    editable.withMetaDo({ reconcileChanges: true }, () => { text.position = pt(2, 4); });
    await tracker.onceChangesProcessed();
    expect(manager.undoInProgress.joinedTransactions).has.length(1);
    expect(manager.undoInProgress.recorder.changes.some(change =>
      change.target === text && change.prop === 'extent')).equals(true);
    editable.undoStop();
    const after = componentModule._source;
    const afterExtent = text.extent;
    manager.undo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(source);
    expect(text.position).deep.equals(pt(0, 0));
    expect(text.extent).deep.equals(beforeExtent);
    manager.redo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(after);
    expect(text.position).deep.equals(pt(2, 4));
    expect(text.extent).deep.equals(afterExtent);
  });

  it('F6 detects an intervening change that replaces a discarded record at the same count', async () => {
    editable.undoStart('drag with a recorder replacement');
    const text = editable.get('text');
    text.withMetaDo({ isLayoutAction: true }, () => { text.extent = pt(30, 40); });
    await dragTo(11);
    const recorder = manager.undoInProgress.recorder;
    const measurement = recorder.changes.find(change => change.target === text && change.prop === 'extent');
    expect(measurement).to.be.ok;
    const count = recorder.changes.length;
    manager.discardRecordedChanges([measurement]);
    editable.opacity = 0.5;
    expect(recorder.changes).has.length(count);
    await dragTo(12);
    expect(manager.undoInProgress.joinedTransactions).has.length(2);
    editable.undoStop();
    const after = componentModule._source;
    manager.undo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(source);
    expect(editable.get('box').position).deep.equals(pt(10, 20));
    expect(editable.opacity).equals(1);
    manager.redo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(after);
    expect(editable.get('box').position).deep.equals(pt(12, 24));
    expect(editable.opacity).equals(0.5);
  });

  it('F6 resolves all coalesced targets by id in the current editable at replay', async () => {
    editable.undoStart('drag two targets');
    await dragTo(11);
    const text = editable.get('text');
    editable.withMetaDo({ reconcileChanges: true }, () => { text.position = pt(2, 4); });
    await tracker.onceChangesProcessed();
    await dragTo(12);
    expect(manager.undoInProgress.joinedTransactions).has.length(1);
    const joined = manager.undoInProgress.joinedTransactions[0];
    const runtimeContext = (joined.transactions?.[0] || joined).adapters.runtimeContext;
    editable.undoStop();
    const after = componentModule._source;
    const oldBox = editable.get('box');
    const cold = part(descriptor);
    instances.push(cold);
    const currentBox = cold.get('box');
    // Simulate replacing a runtime object while retaining its semantic runtime id.
    currentBox._id = oldBox.id;
    oldBox.remove();
    expect(runtimeContext.resolveMorph(oldBox.id)).equals(undefined);
    editable.addMorphAt(currentBox, 0);
    expect(runtimeContext.resolveMorph(oldBox.id)).equals(currentBox);
    manager.undo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(source);
    expect(currentBox.position).deep.equals(pt(10, 20));
    expect(text.position).deep.equals(pt(0, 0));
    expect(oldBox.position).deep.equals(pt(12, 24));
    manager.redo();
    await tracker.onceChangesProcessed();
    expect(componentModule._source).equals(after);
    expect(currentBox.position).deep.equals(pt(12, 24));
    expect(text.position).deep.equals(pt(2, 4));
    expect(oldBox.position).deep.equals(pt(12, 24));
  });

  it('drops a conflicted coalesced entry and leaves earlier history reachable', async () => {
    const earlier = part(descriptor);
    instances.push(earlier);
    earlier.undoStart('earlier unrelated edit');
    earlier.opacity = 0.5;
    earlier.undoStop();
    editable.undoStart('halo drag');
    await dragTo(11);
    await dragTo(12);
    editable.undoStop();
    componentModule.setSource(componentModule._source + '\n// external edit');
    expect(() => manager.undo()).to.throw(ComponentTransactionConflictError);
    expect(manager.undos).has.length(1);
    manager.undo();
    expect(earlier.opacity).equals(1);
  });

  it('invalidates portable binding lookups after a module save', async () => {
    editable.openInWorld();
    const expression = { expression: 'Color.red', bindings: { 'lively.graphics': ['Color'] } };
    const first = tracker.projectionalExpressionWithPortableBindings(expression);
    const cache = tracker._projectionalBindingLookup;
    expect(cache).to.be.ok;
    tracker.projectionalExpressionWithPortableBindings(expression);
    expect(tracker._projectionalBindingLookup).equals(cache);
    const saved = source.replace("from 'lively.graphics'", "from 'lively.graphics/index.js'");
    await componentModule.changeSource(saved);
    const next = tracker.projectionalExpressionWithPortableBindings(expression);
    expect(tracker._projectionalBindingLookup).not.equals(cache);
    expect(Object.keys(first.bindings)).deep.equals(['lively.graphics']);
    expect(Object.keys(next.bindings)).deep.equals(['lively.graphics/index.js']);
    editable.withMetaDo({ reconcileChanges: true }, () => { editable.get('box').fill = Color.blue; });
    await tracker.onceChangesProcessed();
    expect(componentModule._source).includes("from 'lively.graphics/index.js'");
    expect(tracker.lastShadowCommandBatch.projectionalCommit).to.be.ok;
  });
});
