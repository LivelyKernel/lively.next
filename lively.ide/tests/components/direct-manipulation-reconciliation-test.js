/* global after, afterEach, beforeEach, describe, it, System */
import { expect } from 'mocha-es6';
import { createFiles, resource } from 'lively.resources';
import module from 'lively.modules/src/module.js';
import { Color, pt, rect } from 'lively.graphics';
import { morph, part, Text } from 'lively.morphic';
import { MoveMorph, MorphicChangeSet, attachedMorph, detachedMorph } from 'lively.morphic/changes/index.js';
import { FillControlModel } from '../../studio/controls/fill.cp.js';
import { ResponsiveControlModel } from '../../studio/controls/responsive.cp.js';
import { ResponsiveLayoutHaloModel } from 'lively.components/responsive.cp.js';
import { parseComponentSource } from '../../components/reconciliation/source-adapter.js';
import { releaseComponentEditingState } from './test-isolation.js';

const testDir = 'local://projectional-direct-manipulation-test/';
const moduleId = `${testDir}project/component.cp.js`;
const inheritedMoveBaseModuleId = `${testDir}project/inherited-move-base.cp.js`;
const inheritedMoveModuleId = `${testDir}project/inherited-move.cp.js`;
const editSessions = [];
let releasedSessions = 0;

/** Retain each session, including editables replaced during a test. */
function trackEditable (descriptor, editable) {
  editSessions.push({ descriptor, editable, tracker: editable._changeTracker });
  return editable;
}

/** Open real sessions through one teardown-aware entry point. */
async function editComponent (descriptor) {
  return trackEditable(descriptor, await descriptor.edit());
}

/** Stop sessions before unloading their modules, including detached editables. */
function releaseEditSessions () {
  for (const { descriptor, editable } of editSessions.slice(releasedSessions)) {
    descriptor.stopEditSession();
    editable._changeTracker?.dispose();
    editable.remove();
  }
  releasedSessions = editSessions.length;
}

const initialSource = `
"format esm";
import { component, ComponentDescriptor } from 'lively.morphic/components/core.js';
import { InteractiveComponentDescriptor } from 'lively.ide/components/editor.js';
import { Color, pt, rect } from 'lively.graphics';
import { morph, Text, TilingLayout } from 'lively.morphic';

component.DescriptorClass = InteractiveComponentDescriptor;

const Example = component({
  name: 'example',
  extent: pt(100, 100),
  fill: Color.red,
  submorphs: [{
    type: Text,
    name: 'label',
    fill: Color.yellow,
    textAndAttributes: ['before', null, morph({
      name: 'embedded badge',
      fill: Color.blue
    }), null]
  }, {
    name: 'container',
    submorphs: [{
      name: 'nested',
      fill: Color.green
    }]
  }, {
    name: 'date array',
    layout: new TilingLayout({
      orderByIndex: true,
      padding: rect(3, 0, 0, 0),
      spacing: 2
    }),
    submorphs: [1, 2].map(i => ({ name: 'day ' + i }))
  }]
});

component.DescriptorClass = ComponentDescriptor;

export { Example };
`;

describe('projectional component direct manipulation', function () {
  releaseComponentEditingState();

  let descriptor;
  let editable;
  let componentModule;
  let inheritedMoveBaseModule;
  let inheritedMoveModule;
  let inheritedMoveEditable;
  let sourceEditor;
  let relativeMasterModule;
  let relativeMasterBaseModule;
  let relativeMasterEditable;

  beforeEach(async () => {
    await createFiles(testDir, {
      project: {
        'component.cp.js': initialSource,
        'package.json': '{"name":"projectional-direct-manipulation-test","main":"component.cp.js"}'
      }
    });
    componentModule = module(System, moduleId);
    ({ Example: descriptor } = await componentModule.load());
    editable = await editComponent(descriptor);
  });

  afterEach(async () => {
    sourceEditor?.remove();
    sourceEditor = null;
    releaseEditSessions();
    editable = inheritedMoveEditable = relativeMasterEditable = null;
    await relativeMasterModule?.unload();
    await relativeMasterBaseModule?.unload();
    relativeMasterModule = relativeMasterBaseModule = relativeMasterEditable = null;
    await inheritedMoveModule?.unload();
    await inheritedMoveBaseModule?.unload();
    await componentModule?.unload();
    await resource(testDir).remove();
    await System._livelyModulesTranslationCache.deleteCachedData(moduleId);
  });

  function detailedReconciliationError (error) {
    const change = error.change;
    const meta = Object.fromEntries(Object.entries(change?.meta || {}).map(
      ([key, value]) => [key, value && typeof value === 'object'
        ? value.constructor?.name || 'object'
        : value]
    ));
    return new Error(`${error.message}; rejected change: ${JSON.stringify({
      prop: change?.prop,
      selector: change?.selector,
      target: change?.target?.name,
      meta
    })}`);
  }

  async function finishDirectManipulation () {
    try {
      await editable._changeTracker.onceChangesProcessed();
    } catch (error) {
      throw detailedReconciliationError(error);
    }
    await editable._changeTracker._shadowComparisonPromise;
  }

  async function undo () {
    try {
      editable.env.undoManager.undo();
      await editable._changeTracker.onceChangesProcessed();
    } catch (error) {
      throw detailedReconciliationError(error);
    }
  }

  async function redo () {
    try {
      editable.env.undoManager.redo();
      await editable._changeTracker.onceChangesProcessed();
    } catch (error) {
      throw detailedReconciliationError(error);
    }
  }

  function currentDocument () {
    const parsed = parseComponentSource({
      source: componentModule._source,
      moduleId,
      exportName: 'Example'
    });
    expect(parsed.supported, JSON.stringify(parsed.diagnostics)).to.be.true;
    return parsed.document;
  }

  it('keeps policy application and component positioning out of source', async () => {
    editable.withMetaDo({ reconcileChanges: false, metaInteraction: true }, () => {
      editable.fill = Color.blue;
    });
    editable.withMetaDo({ reconcileChanges: true }, () => {
      editable.position = pt(90, 80);
    });
    await editable._changeTracker.onceChangesProcessed();

    expect(componentModule._source).equals(initialSource);
    expect(descriptor.stylePolicy.spec.fill).equals(Color.red);
  });

  it('keeps a properties-panel fill edit and its policy consistent through replay', async () => {
    FillControlModel.prototype.confirm.call({
      targetMorph: editable,
      ui: { fillColorInput: { colorValue: Color.orange } },
      update: () => {}
    });
    await editable._changeTracker.onceChangesProcessed();

    expect(editable.fill).equals(Color.orange);
    expect(descriptor.stylePolicy.spec.fill).equals(Color.orange);
    expect(componentModule._source).includes('fill: Color.orange');
    await undo();
    expect(editable.fill).equals(Color.red);
    expect(descriptor.stylePolicy.spec.fill).equals(Color.red);
    expect(componentModule._source).equals(initialSource);
    await redo();
    expect(editable.fill).equals(Color.orange);
    expect(descriptor.stylePolicy.spec.fill).equals(Color.orange);
  });

  it('reports a repeated unsupported source edit once until the source changes', async () => {
    const warnings = [];
    const world = editable.world;
    editable.world = () => ({ showError: message => warnings.push(message) });
    const change = { target: editable, prop: 'fill', prevValue: Color.red,
      value: Color.orange, meta: { reconcileChanges: true } };
    try {
      for (let index = 0; index < 2; index++) {
        await editable._changeTracker.processChangeInComponent(change).catch(() => {});
      }
      expect(warnings).has.length(1);
      componentModule.setSource(initialSource + '\n');
      await editable._changeTracker.processChangeInComponent(change).catch(() => {});
      expect(warnings).has.length(2);
    } finally { editable.world = world; }
  });

  it('reports a rejected explicit command without changing source or runtime', () => {
    const warnings = [];
    const world = editable.world;
    editable.world = () => ({ showError: message => warnings.push(message) });
    editable._changeTracker.canRecordProjectionalEdit = () => false;
    try {
      const result = editable._changeTracker.setProperty({
        target: editable, property: 'fill', value: Color.orange
      });
      expect(result.committed).equals(false);
      expect(warnings).has.length(1);
      expect(warnings[0]).includes('undo transaction');
      expect(editable.fill).equals(Color.red);
      expect(componentModule._source).equals(initialSource);
    } finally { editable.world = world; }
  });

  it('reports a commit-time failure and commits the next direct edit', async () => {
    const tracker = editable._changeTracker;
    tracker.projectionalDebug = true;
    editable.withMetaDo({ reconcileChanges: true }, () => { editable.fill = Color.orange; });
    await finishDirectManipulation();
    const sourceBeforeFailure = componentModule._source;
    const previousBatch = tracker.lastShadowCommandBatch;
    const batchCount = tracker.shadowCommandBatches.length;
    const injectedError = new Error('injected projectional source write failure');
    const warnings = [];
    const world = editable.world;
    const setSource = componentModule.setSource;
    let failOnce = true;
    editable.world = () => ({ showError: message => warnings.push(message) });
    componentModule.setSource = source => {
      if (failOnce) {
        failOnce = false;
        throw injectedError;
      }
      return setSource.call(componentModule, source);
    };
    try {
      editable.withMetaDo({ reconcileChanges: true }, () => { editable.fill = Color.blue; });
      const error = await tracker.onceChangesProcessed().catch(error => error);
      expect(warnings).has.length(1);
      expect(warnings[0]).includes(injectedError.message);
      expect(warnings[0]).not.includes('No projectional command committed');
      expect(error.message).equals(warnings[0]);
      expect(tracker.lastShadowCommandBatch).not.equals(previousBatch);
      expect(tracker.shadowCommandBatches).has.length(batchCount + 1);
      expect(tracker.lastShadowCommandBatch.commitDiagnostic.error).equals(injectedError);
      expect(componentModule._source).equals(sourceBeforeFailure);
      expect(editable.fill).equals(Color.orange);
      expect(descriptor.stylePolicy.spec.fill).equals(Color.orange);

      editable.withMetaDo({ reconcileChanges: true }, () => { editable.fill = Color.green; });
      await finishDirectManipulation();
      expect(warnings).has.length(1);
      expect(componentModule._source).includes('fill: Color.green');
      expect(editable.fill).equals(Color.green);
      expect(part(descriptor).fill).equals(Color.green);
      await undo();
      expect(componentModule._source).equals(sourceBeforeFailure);
      expect(editable.fill).equals(Color.orange);
      await redo();
      expect(editable.fill).equals(Color.green);
    } finally {
      componentModule.setSource = setSource;
      editable.world = world;
    }
  });

  it('reports a rejected plain group whose leaves request reconciliation', async () => {
    const warnings = [];
    const world = editable.world;
    editable.world = () => ({ showError: message => warnings.push(message) });
    try {
      const group = editable.groupChangesWhile(undefined, () => {
        editable.withMetaDo({ reconcileChanges: true }, () => {
          editable.get('day 1').fill = Color.orange;
        });
      });
      const tracker = editable._changeTracker;
      const error = await tracker.onceChangesProcessed().catch(error => error);
      expect(group.meta).equals(undefined);
      expect(group.changes.some(change => change.meta?.reconcileChanges)).to.be.true;
      expect(tracker.lastShadowCommandBatch.projectionalCommit).equals(undefined);
      expect(tracker.lastShadowCommandBatch.shadowProjection.supported).to.be.false;
      expect(warnings).has.length(1);
      expect(error.change).equals(group);
      expect(error.message).equals(warnings[0]);
      expect(error.batch).equals(tracker.lastShadowCommandBatch);
      expect(error.diagnostics).not.to.be.empty;
      expect(componentModule._source).equals(initialSource);
    } finally { editable.world = world; }
  });

  it('commits a supported plain group whose leaves request reconciliation', async () => {
    const warnings = [];
    const world = editable.world;
    editable.world = () => ({ showError: message => warnings.push(message) });
    try {
      editable.groupChangesWhile(undefined, () => {
        editable.withMetaDo({ reconcileChanges: true }, () => { editable.fill = Color.orange; });
      });
      await finishDirectManipulation();
      expect(warnings).to.be.empty;
      expect(componentModule._source).includes('fill: Color.orange');
      expect(editable.fill).equals(Color.orange);
      expect(part(descriptor).fill).equals(Color.orange);
      await undo();
      expect(componentModule._source).equals(initialSource);
      expect(editable.fill).equals(Color.red);
      await redo();
      expect(editable.fill).equals(Color.orange);
    } finally { editable.world = world; }
  });

  it('updates eligible source editors during direct edits, undo, and redo', async () => {
    sourceEditor = new Text({ readOnly: false, textString: initialSource });
    sourceEditor.addPlugin({ isEditorPlugin: true, evalEnvironment: { targetModule: componentModule.id } });
    sourceEditor.openInWorld();
    const document = sourceEditor.document;
    const cursor = { row: 2, column: 4 };
    sourceEditor.cursorPosition = cursor;
    const replace = sourceEditor.replace;
    const replacedRanges = [];
    sourceEditor.replace = function (range, ...args) {
      replacedRanges.push(range);
      return replace.call(this, range, ...args);
    };
    editable.withMetaDo({ reconcileChanges: true }, () => { editable.fill = Color.orange; });
    await finishDirectManipulation();
    expect(sourceEditor.textString).equals(componentModule._source);
    expect(sourceEditor.document).equals(document);
    expect(sourceEditor.cursorPosition).to.eql(cursor);
    expect(replacedRanges).has.length(1);
    expect(replacedRanges[0].start.row).equals(replacedRanges[0].end.row);

    await undo();
    expect(sourceEditor.textString).equals(initialSource);
    await redo();
    expect(sourceEditor.textString).equals(componentModule._source);
  });

  it('T11 leaves partial Object Editor source views unchanged while syncing full-module editors', async () => {
    const classSource = 'class FixtureModel { onRefresh () {} }';
    const source = initialSource.replace('const Example =', classSource + '\nconst Example =');
    componentModule.setSource(source);
    sourceEditor = new Text({ textString: source });
    sourceEditor.addPlugin({ isEditorPlugin: true, evalEnvironment: { targetModule: componentModule.id } });
    sourceEditor.openInWorld();
    const partialEditor = new Text({ readOnly: false, textString: classSource });
    partialEditor.addPlugin({ isEditorPlugin: true, evalEnvironment: { targetModule: componentModule.id } });
    const objectEditor = morph({ submorphs: [partialEditor] }).openInWorld();
    const partialDocument = partialEditor.document;
    const cursor = { row: 0, column: 7 };
    partialEditor.cursorPosition = cursor;
    try {
      editable.withMetaDo({ reconcileChanges: true }, () => { editable.fill = Color.orange; });
      await finishDirectManipulation();
      for (const replay of [null, undo, redo]) {
        if (replay) await replay();
        expect(partialEditor.textString).equals(classSource);
        expect(partialEditor.document).equals(partialDocument);
        expect(partialEditor.cursorPosition).deep.equals(cursor);
        expect(sourceEditor.textString).equals(componentModule._source);
      }
    } finally { objectEditor.remove(); }
  });

  for (const removal of ['remove', 'owner removal', 'ancestor removal', 'ancestor owner removal']) {
    it(`T11 releases a detached tracker after ${removal} and reopens through edit`, async () => {
      const holder = morph({ submorphs: [editable] }).openInWorld();
      const tracker = editable._changeTracker;
      const manager = editable.env.changeManager;
      expect(manager.committedChangeListeners).includes(tracker._committedChangeListener);
      try {
        if (removal === 'remove') editable.remove();
        else if (removal === 'owner removal') holder.removeMorph(editable);
        else if (removal === 'ancestor removal') holder.remove();
        else holder.owner.removeMorph(holder);
        await Promise.resolve();
        expect(manager.committedChangeListeners).not.includes(tracker._committedChangeListener);
        expect(editable._changeTracker).equals(undefined);
        expect(descriptor._cachedComponent).equals(null);
        editable = await editComponent(descriptor);
        editable.openInWorld();
        expect(editable._changeTracker).not.equals(tracker);
        editable.withMetaDo({ reconcileChanges: true }, () => { editable.fill = Color.orange; });
        await finishDirectManipulation();
        expect(componentModule._source).includes('fill: Color.orange');
      } finally { holder.remove(); }
    });
  }

  it('T11 releases the tracker when the close active window or morph command removes it', async () => {
    editable.openInWorld();
    const tracker = editable._changeTracker;
    const manager = editable.env.changeManager;
    const label = editable.get('label');
    label.focus();
    expect(editable.world().focusedMorph).equals(label);
    await editable.world().execCommand('close active window or morph');
    await Promise.resolve();
    expect(editable.world()).equals(null);
    expect(manager.committedChangeListeners).not.includes(tracker._committedChangeListener);
    expect(descriptor._cachedComponent).equals(null);
  });

  it('T11 reopens immediately after removal without reviving the detached tracker', async () => {
    editable.openInWorld();
    const previous = editable;
    const tracker = previous._changeTracker;
    previous.remove();
    editable = await editComponent(descriptor);
    expect(editable).not.equals(previous);
    expect(editable._changeTracker).not.equals(tracker);
    expect(previous.env.changeManager.committedChangeListeners).not.includes(tracker._committedChangeListener);
    editable.withMetaDo({ reconcileChanges: true }, () => { editable.fill = Color.orange; });
    await finishDirectManipulation();
    expect(componentModule._source).includes('fill: Color.orange');
  });

  it('T11 reopens an editable tracker after the browser live preview', async () => {
    await System.import('lively.ide/js/browser/ui.cp.js');
    const { ComponentEditControlModel } = module(System, 'lively.ide/js/browser/ui.cp.js').recorder;
    editable.openInWorld();
    const tracker = editable._changeTracker;
    const world = editable.world();
    const backup = descriptor._backupComponentDef;
    const controls = {
      componentDescriptor: descriptor,
      componentMorph: editable,
      world: () => world,
      view: { getWindow: () => world },
      updateControlButtons: () => {},
      terminateEditSession: () => {},
      cleanupInstance: ComponentEditControlModel.prototype.cleanupInstance
    };
    try {
      await ComponentEditControlModel.prototype.toggleDerivedInstance.call(controls, true);
      await Promise.resolve();
      expect(editable.env.changeManager.committedChangeListeners).not.includes(tracker._committedChangeListener);
      expect(descriptor._cachedComponent).equals(null);
      await ComponentEditControlModel.prototype.toggleDerivedInstance.call(controls, false);
      editable = trackEditable(descriptor, controls.componentMorph);
      expect(editable.world()).equals(world);
      expect(editable._changeTracker).not.equals(tracker);
      expect(descriptor._backupComponentDef).equals(backup);
      editable.withMetaDo({ reconcileChanges: true }, () => { editable.fill = Color.orange; });
      await finishDirectManipulation();
      expect(componentModule._source).includes('fill: Color.orange');
    } finally { controls.cleanupInstance(); }
  });

  it('T11 keeps a tracker on moves within the world and on synchronous remove/reinsert', async () => {
    const first = morph({ submorphs: [editable] }).openInWorld();
    const second = morph().openInWorld();
    const tracker = editable._changeTracker;
    try {
      second.addMorph(editable);
      await Promise.resolve();
      expect(editable._changeTracker).equals(tracker);
      editable.remove();
      first.addMorph(editable);
      await Promise.resolve();
      expect(editable._changeTracker).equals(tracker);
      expect(editable.env.changeManager.committedChangeListeners).includes(tracker._committedChangeListener);
      expect(componentModule._source).equals(initialSource);
      editable.withMetaDo({ reconcileChanges: true }, () => { editable.fill = Color.orange; });
      await finishDirectManipulation();
      expect(componentModule._source).includes('fill: Color.orange');
    } finally { first.remove(); second.remove(); }
  });

  it('T11 logs a missing source module as an internal bug and compensates the adopted edit', async () => {
    editable.openInWorld();
    const world = editable.world();
    const showError = world.showError;
    const logError = world.logError;
    const shown = [];
    const logged = [];
    world.logError = error => { logged.push(error); shown.push(error?.message || String(error)); };
    world.showError = error => world.logError(error);
    const tracker = editable._changeTracker;
    try {
      editable.withMetaDo({ reconcileChanges: true }, () => { editable.fill = Color.orange; });
      await finishDirectManipulation();
      const source = componentModule._source;
      const manager = editable.env.undoManager;
      const undos = manager.undos.slice();
      tracker.componentModule = null;
      editable.undoStart('missing source edit');
      editable.withMetaDo({ reconcileChanges: true }, () => { editable.fill = Color.blue; });
      const error = await tracker.onceChangesProcessed().catch(error => error);
      editable.undoStop();
      expect(error?.message).matches(/internal.*component.*error/i);
      expect(error.message).includes('bug');
      expect(shown).deep.equals([error.message]);
      expect(logged).deep.equals([error]);
      expect(error.stack).includes(error.message);
      expect(editable.fill).equals(Color.orange);
      expect(descriptor.stylePolicy.spec.fill).equals(Color.orange);
      expect(componentModule._source).equals(source);
      expect(manager.undos).deep.equals(undos);
      const result = tracker.setProperty({ target: editable, property: 'fill', value: Color.blue });
      expect(result.committed).equals(false);
      expect(shown).has.length(1);
      expect(logged).has.length(1);
      tracker.componentModule = componentModule;
      await undo();
      expect(componentModule._source).equals(initialSource);
      expect(editable.fill).equals(Color.red);
    } finally {
      tracker.componentModule = componentModule;
      world.showError = showError;
      world.logError = logError;
    }
  });

  it('keeps earlier component undo available after a rejected structural batch', async () => {
    editable.withMetaDo({ reconcileChanges: true }, () => { editable.fill = Color.orange; });
    await finishDirectManipulation();
    const rejected = editable._changeTracker.processCommittedChangeSet(new MorphicChangeSet({
      id: 'unresolved-insertion', operations: [new MoveMorph({
        morphId: 'unknown', from: detachedMorph(),
        to: attachedMorph({ ownerId: editable.id, index: 0 })
      })]
    }), { resolveMorph: id => id === editable.id ? editable : null });
    expect(rejected.projectionalCommit).equals(null);

    await undo();
    expect(componentModule._source).equals(initialSource);
    expect(editable.fill).equals(Color.red);
  });

  it('drops an externally conflicted component undo and reaches earlier history', async () => {
    const undoManager = editable.env.undoManager;
    const previousUndos = undoManager.undos.slice();
    const target = morph({ fill: Color.red });
    target.undoStart('earlier ordinary fill');
    target.fill = Color.orange;
    const earlier = target.undoStop();
    editable.withMetaDo({ reconcileChanges: true }, () => { editable.fill = Color.green; });
    await finishDirectManipulation();
    const externalSource = componentModule._source + '\n// externally saved source\n';
    componentModule.setSource(externalSource);
    let conflict;
    try { undoManager.undo(); } catch (error) { conflict = error; }

    expect(conflict.name).equals('ComponentTransactionConflictError');
    expect(conflict.transaction)
      .equals(editable._changeTracker.lastShadowCommandBatch.projectionalCommit.transaction);
    expect(undoManager.undos).deep.equals([...previousUndos, earlier]);
    expect(undoManager.redos).to.be.empty;
    expect(undoManager.applyCount).equals(0);
    expect(editable.fill).equals(Color.green);
    expect(descriptor.stylePolicy.spec.fill).equals(Color.green);
    expect(componentModule._source).equals(externalSource);
    expect(undoManager.undo()).equals(earlier);
    expect(target.fill).equals(Color.red);
    expect(componentModule._source).equals(externalSource);
  });

  it('reuses an HTTP module relative import for master and responsive breakpoint edits', async () => {
    relativeMasterModule = module(System, System.decanonicalize(
      './fixtures/relative-master.cp.js', import.meta.url));
    relativeMasterBaseModule = module(System, System.decanonicalize(
      './fixtures/relative-master-base.cp.js', import.meta.url));
    const { Base } = await relativeMasterBaseModule.load();
    const { RelativeMaster, LocalBase } = await relativeMasterModule.load();
    relativeMasterEditable = await editComponent(RelativeMaster);
    const tracker = relativeMasterEditable._changeTracker;
    expect(relativeMasterBaseModule.id).matches(/^http/);
    relativeMasterEditable.withMetaDo({ reconcileChanges: false }, () => {
      relativeMasterEditable.master = LocalBase;
    });
    const localResult = tracker.setProperty({
      target: relativeMasterEditable, property: 'master', value: relativeMasterEditable.master
    });
    expect(localResult.committed).to.be.true;
    expect(relativeMasterModule._source).matches(/master:\s*LocalBase/);
    expect(relativeMasterModule._source).not.matches(/from ['"]\.\/relative-master.cp.js['"]/);
    relativeMasterEditable.withMetaDo({ reconcileChanges: false }, () => {
      relativeMasterEditable.master = Base;
    });
    const master = relativeMasterEditable.master;
    const result = tracker.setProperty({ target: relativeMasterEditable, property: 'master', value: master });
    expect(result.committed).to.be.true;
    expect(relativeMasterModule._source).matches(/master:\s*Base/);
    expect(relativeMasterModule._source).not.includes('http:');

    master.setBreakpoints([[pt(0, 0), Base], [pt(120, 0), Base]]);
    const controlResult = ResponsiveControlModel.prototype.refreshChangeTrackers.call({
      targetMorph: relativeMasterEditable, targetStylePolicy: master
    });
    expect(controlResult.committed).to.be.true;
    expect(relativeMasterModule._source).includes('breakpoints:');
    expect(relativeMasterModule._source).matches(/pt\(120,\s*0\)/);

    master.setBreakpoints([[pt(0, 0), Base], [pt(240, 0), Base]]);
    const haloResult = ResponsiveLayoutHaloModel.prototype.refreshChangeTrackers.call({
      target: relativeMasterEditable, targetStylePolicy: master
    });
    expect(haloResult.committed).to.be.true;
    expect(relativeMasterModule._source).matches(/pt\(240,\s*0\)/);
    expect(relativeMasterModule._source).not.includes('http:');
    expect(relativeMasterModule._source.match(/from ['"]\.\/relative-master-base.cp.js['"]/g)).to.have.length(1);
    expect(part(RelativeMaster).master.getBreakpointStore()._horizontalBreakpoints).deep.equals([0, 240]);
    relativeMasterEditable.env.undoManager.undo();
    await tracker.onceChangesProcessed();
    expect(relativeMasterModule._source).matches(/pt\(120,\s*0\)/);
    expect(part(RelativeMaster).master.getBreakpointStore()._horizontalBreakpoints).deep.equals([0, 120]);
    expect(relativeMasterEditable.master.getBreakpointStore()._horizontalBreakpoints).deep.equals([0, 120]);
    relativeMasterEditable.env.undoManager.undo();
    await tracker.onceChangesProcessed();
    expect(relativeMasterModule._source).matches(/master:\s*Base/);
    expect(relativeMasterEditable.master.getBreakpointStore()).equals(undefined);
    relativeMasterEditable.env.undoManager.redo();
    await tracker.onceChangesProcessed();
    expect(relativeMasterEditable.master.getBreakpointStore()._horizontalBreakpoints).deep.equals([0, 120]);
    relativeMasterEditable.env.undoManager.redo();
    await tracker.onceChangesProcessed();
    expect(relativeMasterEditable.master.getBreakpointStore()._horizontalBreakpoints).deep.equals([0, 240]);
  });

  it('mirrors introductions and removals into new parts and restores the cache on undo', async () => {
    const added = morph({ name: 'added', fill: Color.orange });
    editable.withMetaDo({ reconcileChanges: true }, () => { editable.addMorph(added); });
    await finishDirectManipulation();
    expect(part(descriptor).get('added').fill).equals(Color.orange);
    editable.withMetaDo({ reconcileChanges: true }, () => { added.remove(); });
    await finishDirectManipulation();
    expect(part(descriptor).get('added')).equals(null);

    await undo();
    expect(part(descriptor).get('added').fill).equals(Color.orange);
    await undo();
    expect(part(descriptor).get('added')).equals(null);
    expect(componentModule._source).equals(initialSource);
  });

  it('keeps a derived descriptor structural cache consistent through undo and redo', async () => {
    await resource(inheritedMoveModuleId).write(`
      import { component, ComponentDescriptor } from 'lively.morphic/components/core.js';
      import { InteractiveComponentDescriptor } from 'lively.ide/components/editor.js';
      import { Example } from './component.cp.js';
      component.DescriptorClass = InteractiveComponentDescriptor;
      const Derived = component(Example, { name: 'derived example' });
      component.DescriptorClass = ComponentDescriptor;
      export { Derived };
    `);
    inheritedMoveModule = module(System, inheritedMoveModuleId);
    const { Derived } = await inheritedMoveModule.load();
    inheritedMoveEditable = await editComponent(Derived);
    const added = morph({ name: 'derived addition', fill: Color.orange });
    editable.withMetaDo({ reconcileChanges: true }, () => { editable.addMorph(added); });
    await finishDirectManipulation();
    expect(part(Derived).get('derived addition').fill).equals(Color.orange);
    expect(inheritedMoveEditable.get('derived addition').fill).equals(Color.orange);

    await undo();
    expect(part(Derived).get('derived addition')).equals(null);
    expect(inheritedMoveEditable.get('derived addition')).equals(null);
    await redo();
    expect(part(Derived).get('derived addition').fill).equals(Color.orange);
    expect(inheritedMoveEditable.get('derived addition').fill).equals(Color.orange);
  });

  it('persists introduced rich text with Color attributes', async () => {
    const added = new Text({ name: 'colored text', textAndAttributes: ['colored', { fontColor: Color.orange }] });
    editable.withMetaDo({ reconcileChanges: true }, () => { editable.addMorph(added); });
    await finishDirectManipulation();
    expect(componentModule._source).includes('fontColor: Color.orange');
    expect(currentDocument().root.children.find(child => child.name === 'colored text')).not.equals(undefined);
    expect(part(descriptor).get('colored text').textAndAttributes[1].fontColor).equals(Color.orange);
  });

  it('inserts generated names before editing a component with anonymous children', async () => {
    await componentModule.changeSource(initialSource.replace("name: 'nested',", ''));
    descriptor = componentModule.recorder.Example;
    editable = await editComponent(descriptor);
    const generatedName = editable.get('container').submorphs[0].name;
    expect(componentModule._source).includes(JSON.stringify(generatedName));

    editable.withMetaDo({ reconcileChanges: true }, () => { editable.get('label').fill = Color.orange; });
    await finishDirectManipulation();
    expect(componentModule._source).includes('fill: Color.orange');
    expect(currentDocument().root.children.find(child => child.name === 'container').children[0].name)
      .equals(generatedName);
  });

  it('T9 names an anonymous addition anchored on an inherited node without a spec', async () => {
    await componentModule.changeSource(`
      import { component, add, ComponentDescriptor } from 'lively.morphic';
      import { InteractiveComponentDescriptor } from 'lively.ide/components/editor.js';
      import { Color } from 'lively.graphics';
      component.DescriptorClass = InteractiveComponentDescriptor;
      const Base = component({ name: 'base', submorphs: [{ name: 'button' }] });
      const Example = component(Base, { name: 'example', submorphs: [add({ fill: Color.red }, 'button')] });
      component.DescriptorClass = ComponentDescriptor;
      export { Example };
    `);
    descriptor = componentModule.recorder.Example;
    editable = await editComponent(descriptor);
    editable.master.applyIfNeeded(true);
    const addition = editable.submorphs.find(child => child.fill.equals(Color.red));
    const namedSource = componentModule._source;
    expect(namedSource).includes(`name: ${JSON.stringify(addition.name)}`);
    editable.undoStart('edit named anchored addition');
    editable.withMetaDo({ reconcileChanges: true }, () => { addition.fill = Color.orange; });
    await finishDirectManipulation();
    editable.undoStop();
    const sourceAfter = componentModule._source;
    expect(sourceAfter).includes('fill: Color.orange');
    expect(part(descriptor).get(addition.name).fill).equals(Color.orange);
    await undo();
    expect(componentModule._source).equals(namedSource);
    expect(addition.fill).equals(Color.red);
    await redo();
    expect(componentModule._source).equals(sourceAfter);
    expect(addition.fill).equals(Color.orange);
  });

  it('preserves inferred anonymous part names while naming derived additions', async () => {
    const source = `
      import { component, part, add, ComponentDescriptor } from 'lively.morphic';
      import { InteractiveComponentDescriptor } from 'lively.ide/components/editor.js';
      import { Color } from 'lively.graphics';
      component.DescriptorClass = InteractiveComponentDescriptor;
      const Base = component({ name: 'base', submorphs: [
        { name: 'inherited sibling' },
        { name: 'container', submorphs: [{ name: 'untouched' }, { name: 'override' }] }
      ] });
      const Wrapper = component({ name: 'wrapper', submorphs: [{ name: 'part sibling' }] });
      const NestedWrapper = component({ name: 'nested wrapper', submorphs: [
        { name: 'unmentioned part child' }, { name: 'overridden part child' }
      ] });
      const Example = component(Base, { name: 'example', submorphs: [
        { name: 'container', submorphs: [{ name: 'override', fill: Color.blue }, add({ fill: Color.green })] },
        add(part(Wrapper)),
        add({ fill: Color.red }),
        add(part(NestedWrapper, { submorphs: [
          { name: 'overridden part child', fill: Color.blue }, add({ fill: Color.orange })
        ] }))
      ] });
      component.DescriptorClass = ComponentDescriptor;
      export { Example };
    `;
    await componentModule.changeSource(source);
    descriptor = componentModule.recorder.Example;
    editable = await editComponent(descriptor);
    editable.master.applyIfNeeded(true);
    const sourceAfter = componentModule._source;
    const addition = editable.submorphs.find(child => child.fill.equals(Color.red));
    const nestedAddition = editable.get('container').submorphs.find(child => child.fill.equals(Color.green));
    const partAddition = editable.get('nested wrapper').submorphs.find(child => child.fill.equals(Color.orange));
    expect(sourceAfter).includes('add(part(Wrapper))');
    expect(sourceAfter).includes(`add({ name: ${JSON.stringify(addition.name)}, fill: Color.red })`);
    expect(sourceAfter).includes(`add({ name: ${JSON.stringify(nestedAddition.name)}, fill: Color.green })`);
    expect(sourceAfter).includes(`add({ name: ${JSON.stringify(partAddition.name)}, fill: Color.orange })`);
    expect(addition.name).not.equals('inherited sibling');
    expect(nestedAddition.name).not.equals('untouched');
    expect(sourceAfter).includes("{ name: 'override', fill: Color.blue }");
    descriptor.stopEditSession();
    editable = await editComponent(descriptor);
    expect(componentModule._source).equals(sourceAfter);
  });

  it('names generated anonymous parts across containers and descriptor aliases', async () => {
    const source = `
      import { component, part, ComponentDescriptor } from 'lively.morphic';
      import { InteractiveComponentDescriptor } from 'lively.ide/components/editor.js';
      component.DescriptorClass = InteractiveComponentDescriptor;
      const Wrapper = component({ name: 'wrapper' });
      const Alias = Wrapper;
      const Example = component({ name: 'example', submorphs: [
        { name: 'a', submorphs: [part(Wrapper)] },
        { name: 'b', submorphs: [part(Alias)] }
      ] });
      component.DescriptorClass = ComponentDescriptor;
      export { Example };
    `;
    await componentModule.changeSource(source);
    descriptor = componentModule.recorder.Example;
    const generatedPart = descriptor.stylePolicy.spec.submorphs[1].submorphs[0];
    const generatedName = generatedPart.name;
    expect(generatedPart.parent).equals(componentModule.recorder.Alias.stylePolicy);
    expect(generatedPart.parent.name).equals('wrapper');
    expect(generatedName).not.equals('wrapper');
    const before = parseComponentSource({
      source, moduleId, exportName: 'Example',
      resolveComponentDocument: editable._changeTracker.projectionalComponentDocumentResolver(componentModule)
    });
    expect(before.supported, JSON.stringify(before.diagnostics)).equals(true);

    editable = await editComponent(descriptor);
    expect(componentModule._source).equals(source.replace('part(Alias)]',
      `part(Alias, { name: ${JSON.stringify(generatedName)} })]`));
    const parsed = editable._changeTracker.projectionalDocumentForCurrentSource();
    expect(parsed.supported, JSON.stringify(parsed.diagnostics)).equals(true);
    expect(parsed.document.root.children[1].children[0].name).equals(generatedName);
    expect(editable.get('b').submorphs[0].name).equals(generatedName);
    const namedSource = componentModule._source;
    descriptor.stopEditSession();
    editable = await editComponent(descriptor);
    expect(componentModule._source).equals(namedSource);
  });

  it('names generated sibling parts and supports their source after opening an editor', async () => {
    const source = `
      import { component, part, ComponentDescriptor } from 'lively.morphic';
      import { InteractiveComponentDescriptor } from 'lively.ide/components/editor.js';
      component.DescriptorClass = InteractiveComponentDescriptor;
      const Wrapper = component({ name: 'wrapper' });
      const Example = component({ name: 'example', submorphs: [part(Wrapper), part(Wrapper)] });
      component.DescriptorClass = ComponentDescriptor;
      export { Example };
    `;
    await componentModule.changeSource(source);
    descriptor = componentModule.recorder.Example;
    const generatedName = descriptor.stylePolicy.spec.submorphs[1].name;
    expect(generatedName).not.equals('wrapper');
    editable = await editComponent(descriptor);
    expect(componentModule._source).equals(source.replace('part(Wrapper), part(Wrapper)]',
      `part(Wrapper), part(Wrapper, { name: ${JSON.stringify(generatedName)} })]`));
    const parsed = editable._changeTracker.projectionalDocumentForCurrentSource();
    expect(parsed.supported, JSON.stringify(parsed.diagnostics)).equals(true);
    expect(parsed.document.root.children.map(child => child.name))
      .deep.equals(editable.submorphs.map(child => child.name));
  });

  it('names generated sibling parts with unnamed override objects and preserves their properties', async () => {
    const source = `
      import { component, part, ComponentDescriptor } from 'lively.morphic';
      import { InteractiveComponentDescriptor } from 'lively.ide/components/editor.js';
      import { Color } from 'lively.graphics';
      component.DescriptorClass = InteractiveComponentDescriptor;
      const Wrapper = component({ name: 'wrapper' });
      const Example = component({ name: 'example', submorphs: [
        part(Wrapper, {}),
        part(Wrapper, {}),
        part(Wrapper, { fill: Color.red })
      ] });
      component.DescriptorClass = ComponentDescriptor;
      export { Example };
    `;
    await componentModule.changeSource(source);
    descriptor = componentModule.recorder.Example;
    const generatedParts = descriptor.stylePolicy.spec.submorphs.slice(1);
    const generatedNames = generatedParts.map(child => child.name);
    expect(generatedParts.every(child => child.parent.name === 'wrapper' && child.name !== 'wrapper')).equals(true);
    editable = await editComponent(descriptor);
    editable.master.applyIfNeeded(true);
    expect(componentModule._source).equals(source
      .replace('part(Wrapper, {}),\n        part(Wrapper, { fill: Color.red })',
        `part(Wrapper, { name: ${JSON.stringify(generatedNames[0])}}),\n        part(Wrapper, { name: ${JSON.stringify(generatedNames[1])}, fill: Color.red })`));
    const parsed = editable._changeTracker.projectionalDocumentForCurrentSource();
    expect(parsed.supported, JSON.stringify(parsed.diagnostics)).equals(true);
    expect(parsed.document.root.children.map(child => child.name))
      .deep.equals(editable.submorphs.map(child => child.name));
    expect(editable.submorphs[2].fill).equals(Color.red);
    const namedSource = componentModule._source;
    descriptor.stopEditSession();
    editable = await editComponent(descriptor);
    expect(componentModule._source).equals(namedSource);
  });

  it('names generated parts inside inherited additions without rewriting patches or ordering anchors', async () => {
    const source = `
      import { component, part, add, ComponentDescriptor } from 'lively.morphic';
      import { InteractiveComponentDescriptor } from 'lively.ide/components/editor.js';
      import { Color } from 'lively.graphics';
      component.DescriptorClass = InteractiveComponentDescriptor;
      const Base = component({ name: 'base', submorphs: [
        { name: 'inherited sibling' },
        { name: 'container', submorphs: [{ name: 'untouched' }, { name: 'override' }] }
      ] });
      const Wrapper = component({ name: 'wrapper' });
      const Example = component(Base, { name: 'example', submorphs: [
        { name: 'container', submorphs: [
          { name: 'override', fill: Color.blue },
          add(part(Wrapper)), add(part(Wrapper), 'untouched'), add(part(Wrapper), 'override')
        ] }
      ] });
      component.DescriptorClass = ComponentDescriptor;
      export { Example };
    `;
    await componentModule.changeSource(source);
    descriptor = componentModule.recorder.Example;
    const additions = descriptor.stylePolicy.getSubSpecFor('container').submorphs
      .filter(child => child.COMMAND === 'add');
    const generatedParts = additions.filter(child => child.props.name !== 'wrapper').map(child => child.props);
    expect(generatedParts).length(2);
    const generatedNames = generatedParts.map(child => child.name);
    expect(generatedParts.every(child => child.parent.name === 'wrapper')).equals(true);
    editable = await editComponent(descriptor);
    expect(componentModule._source).equals(source
      .replace("part(Wrapper), 'untouched'", `part(Wrapper, { name: ${JSON.stringify(generatedNames[0])} }), 'untouched'`)
      .replace("part(Wrapper), 'override'", `part(Wrapper, { name: ${JSON.stringify(generatedNames[1])} }), 'override'`));
    const parsed = editable._changeTracker.projectionalDocumentForCurrentSource();
    expect(parsed.supported, JSON.stringify(parsed.diagnostics)).equals(true);
    expect(editable.get('untouched').name).equals('untouched');
    expect(generatedNames.every(name => editable.get(name))).equals(true);
    const namedSource = componentModule._source;
    descriptor.stopEditSession();
    editable = await editComponent(descriptor);
    expect(componentModule._source).equals(namedSource);
  });

  it('preserves unsupported call children and subsequent anonymous specs with mixed explicit names', async () => {
    const source = `
      import { component, Text, ComponentDescriptor } from 'lively.morphic';
      import { InteractiveComponentDescriptor } from 'lively.ide/components/editor.js';
      component.DescriptorClass = InteractiveComponentDescriptor;
      function makeFoo() { return { name: 'foo' }; }
      const Example = component({ name: 'example', submorphs: [
        { name: 'named before' }, makeFoo(), { type: Text },
        { name: 'named after' }, { type: Text }
      ] });
      component.DescriptorClass = ComponentDescriptor;
      export { Example };
    `;
    await componentModule.changeSource(source);
    descriptor = componentModule.recorder.Example;
    editable = await editComponent(descriptor);
    expect(componentModule._source).equals(source);
    const parsed = editable._changeTracker.projectionalDocumentForCurrentSource();
    expect(parsed.supported).equals(false);
    expect(parsed.diagnostics.some(diagnostic => diagnostic.kind === 'unsupported-submorph-structure')).equals(true);
    expect(editable.submorphs[1].name).equals('foo');
    expect(editable.submorphs[2].name).not.equals('foo');
  });

  it('reconciles a real resize and style edit with exact undo and redo', async () => {
    const label = editable.get('label');

    editable.undoStart('resize and style component');
    editable.withMetaDo({ reconcileChanges: true }, () => {
      editable.extent = pt(160, 120);
      label.fill = Color.orange;
    });
    await finishDirectManipulation();
    editable.undoStop();

    expect(componentModule._source).matches(/extent:\s*pt\(160,\s*120\)/);
    expect(componentModule._source).includes('fill: Color.orange');
    expect(editable.extent).equals(pt(160, 120));
    expect(label.fill).equals(Color.orange);
    expect(descriptor.stylePolicy.spec.extent).equals(pt(160, 120));
    expect(descriptor.stylePolicy.getSubSpecFor('label').fill).equals(Color.orange);

    await undo();
    expect(componentModule._source).equals(initialSource);
    expect(editable.extent).equals(pt(100, 100));
    expect(label.fill).equals(Color.yellow);
    expect(descriptor.stylePolicy.spec.extent).equals(pt(100, 100));
    expect(descriptor.stylePolicy.getSubSpecFor('label').fill).equals(Color.yellow);

    await redo();
    expect(componentModule._source).matches(/extent:\s*pt\(160,\s*120\)/);
    expect(componentModule._source).includes('fill: Color.orange');
    expect(editable.extent).equals(pt(160, 120));
    expect(label.fill).equals(Color.orange);
  });

  it('persists explicit selection mode changes while ignoring transient changes', async () => {
    // The label embeds a morph and needs a document, so its selection mode is 'lively'.
    const label = editable.get('label');
    label.selectionMode = 'lively';
    await finishDirectManipulation();
    expect(componentModule._source).equals(initialSource);
    label.selectionMode = 'none';
    label.withMetaDo({ reconcileChanges: true }, () => { label.selectionMode = 'lively'; });
    await finishDirectManipulation();
    expect(componentModule._source).matches(/selectionMode:\s*["']lively["']/);
    const instance = part(descriptor).openInWorld();
    try {
      await instance.whenRendered();
      instance.master.applyIfNeeded(true);
      instance.env.forceUpdate();
      expect(instance.get('label').selectionMode).equals('lively');
    } finally { instance.remove(); }
    label.withMetaDo({ reconcileChanges: true }, () => { label.selectionMode = 'none'; });
    await finishDirectManipulation();
    expect(part(descriptor).get('label').selectionMode).equals('none');
  });

  it('reconciles a real cross-parent move with exact undo and redo', async () => {
    const container = editable.get('container');
    const nested = editable.get('nested');

    editable.undoStart('reparent component morph');
    editable.withMetaDo({ reconcileChanges: true }, () => {
      editable.addMorph(nested);
    });
    await finishDirectManipulation();
    editable.undoStop();

    expect(nested.owner).equals(editable);
    expect(currentDocument().root.children.map(({ name }) => name))
      .deep.equals(['label', 'container', 'date array', 'nested']);
    expect(currentDocument().root.children[1].children).deep.equals([]);

    await undo();
    expect(componentModule._source).equals(initialSource);
    expect(nested.owner).equals(container);
    expect(container.submorphs).includes(nested);

    await redo();
    expect(nested.owner).equals(editable);
    expect(editable.submorphs).includes(nested);
    expect(container.submorphs).not.includes(nested);
    expect(currentDocument().root.children.map(({ name }) => name))
      .deep.equals(['label', 'container', 'date array', 'nested']);
  });

  it('restyles a materialized inherited part after move undo and redo', async () => {
    await resource(inheritedMoveBaseModuleId).write(`
      "format esm";
      import { component, ComponentDescriptor, part } from 'lively.morphic/components/core.js';
      import { Color } from 'lively.graphics';

      component.DescriptorClass = ComponentDescriptor;

      const Leaf = component({
        name: 'Leaf',
        fill: Color.purple,
        submorphs: [{ name: 'leaf child', fill: Color.orange }]
      });
      const Base = component({
        name: 'Base',
        submorphs: [part(Leaf, { name: 'movable leaf' })]
      });

      export { Base, Leaf };
    `);
    await resource(inheritedMoveModuleId).write(`
      "format esm";
      import {
        add, component, ComponentDescriptor
      } from 'lively.morphic/components/core.js';
      import {
        InteractiveComponentDescriptor
      } from 'lively.ide/components/editor.js';
      import { Base, Leaf } from '${inheritedMoveBaseModuleId}';

      component.DescriptorClass = InteractiveComponentDescriptor;

      const Subject = component(Base, {
        name: 'Subject',
        submorphs: [{
          name: 'movable leaf',
          submorphs: [{
            name: 'leaf child',
            borderWidth: 2
          }]
        }, add({ name: 'destination' })]
      });

      component.DescriptorClass = ComponentDescriptor;

      export { Subject };
    `);
    inheritedMoveBaseModule = module(System, inheritedMoveBaseModuleId);
    await inheritedMoveBaseModule.load();
    inheritedMoveModule = module(System, inheritedMoveModuleId);
    const { Subject } = await inheritedMoveModule.load();
    inheritedMoveEditable = await editComponent(Subject);
    const destination = inheritedMoveEditable.get('destination');
    const movableLeaf = inheritedMoveEditable.get('movable leaf');
    const tracker = inheritedMoveEditable._changeTracker;

    inheritedMoveEditable.undoStart('reparent inherited component part');
    try {
      inheritedMoveEditable.withMetaDo({ reconcileChanges: true }, () => {
        destination.addMorph(movableLeaf);
      });
      await tracker.onceChangesProcessed();
    } finally {
      inheritedMoveEditable.undoStop();
    }

    expect(movableLeaf.owner).equals(destination);
    expect(movableLeaf.fill).equals(Color.purple);
    expect(inheritedMoveModule._source).matches(/without\(["']movable leaf["']\)/);
    expect(inheritedMoveModule._source).includes('destination');

    inheritedMoveEditable.env.undoManager.undo();
    await tracker.onceChangesProcessed();
    expect(movableLeaf.owner).equals(inheritedMoveEditable);
    expect(movableLeaf.fill).equals(Color.purple);

    inheritedMoveEditable.env.undoManager.redo();
    await tracker.onceChangesProcessed();
    expect(movableLeaf.owner).equals(destination);
    expect(movableLeaf.fill).equals(Color.purple);
    expect(Subject.derive().get('movable leaf').fill).equals(Color.purple);

    const leafChild = movableLeaf.get('leaf child');
    inheritedMoveEditable.undoStart('materialize nested inherited override');
    try {
      inheritedMoveEditable.withMetaDo({ reconcileChanges: true }, () => {
        inheritedMoveEditable.addMorph(leafChild);
      });
      await tracker.onceChangesProcessed();
    } finally {
      inheritedMoveEditable.undoStop();
    }

    expect(leafChild.owner).equals(inheritedMoveEditable);
    expect(leafChild.borderWidth.top).equals(2);

    inheritedMoveEditable.env.undoManager.undo();
    await tracker.onceChangesProcessed();
    expect(leafChild.owner).equals(movableLeaf);
    expect(leafChild.borderWidth.top).equals(2);

    inheritedMoveEditable.env.undoManager.redo();
    await tracker.onceChangesProcessed();
    expect(leafChild.owner).equals(inheritedMoveEditable);
    expect(leafChild.borderWidth.top).equals(2);
    expect(Subject.derive().get('leaf child').borderWidth.top).equals(2);
  });

  it('reconciles rich text with an embedded morph through undo and redo', async () => {
    const label = editable.get('label');
    const replacement = morph({
      name: 'replacement badge',
      fill: Color.orange
    });

    editable.undoStart('replace component rich text');
    label.withMetaDo({ reconcileChanges: true }, () => {
      label.textAndAttributes = [
        'after', { fontWeight: 'bold' },
        replacement, null
      ];
    });
    await finishDirectManipulation();
    editable.undoStop();

    expect(label.textString.startsWith('after')).to.be.true;
    expect(label.textAndAttributes).includes(replacement);
    expect(componentModule._source).matches(/["']after["']/);
    expect(componentModule._source).matches(/name:\s*["']replacement badge["']/);
    expect(componentModule._source).includes('fill: Color.orange');
    expect(descriptor.derive().get('replacement badge').fill).equals(Color.orange);

    await undo();
    expect(componentModule._source).equals(initialSource);
    expect(label.textString.startsWith('before')).to.be.true;
    expect(label.textAndAttributes.find(value => value?.isMorph)?.name)
      .equals('embedded badge');

    await redo();
    expect(label.textString.startsWith('after')).to.be.true;
    expect(label.textAndAttributes.find(value => value?.isMorph)?.name)
      .equals('replacement badge');
    expect(componentModule._source).matches(/name:\s*["']replacement badge["']/);
  });

  it('reconciles an interactive text replacement through its native undo group', async () => {
    const label = editable.get('label');

    label.withMetaDo({ reconcileChanges: true }, () => {
      label.replace({
        start: { row: 0, column: 1 },
        end: { row: 0, column: 5 }
      }, ['interactive', { fontWeight: 'bold' }]);
    });
    await finishDirectManipulation();

    expect(label.textString.startsWith('binteractive')).to.be.true;
    expect(componentModule._source).matches(/["']interactive["']/);
    expect(componentModule._source).includes('fontWeight');

    await undo();
    expect(componentModule._source).equals(initialSource);
    expect(label.textString.startsWith('before')).to.be.true;

    await redo();
    expect(label.textString.startsWith('binteractive')).to.be.true;
    expect(componentModule._source).matches(/["']interactive["']/);
  });

  it('renames a nested introduction that collides across component scopes', async () => {
    const container = editable.get('container');
    const introduced = morph({
      name: 'label',
      fill: Color.orange
    });

    editable.undoStart('introduce nested component morph');
    container.withMetaDo({ reconcileChanges: true }, () => {
      container.addMorph(introduced);
    });
    await finishDirectManipulation();
    editable.undoStop();

    expect(introduced.name).equals('label_1');
    expect(componentModule._source).matches(/name:\s*["']label_1["']/);

    await undo();
    expect(componentModule._source).equals(initialSource);
    expect(introduced.owner).equals(null);

    await redo();
    expect(introduced.owner).equals(container);
    expect(introduced.name).equals('label_1');
    expect(componentModule._source).matches(/name:\s*["']label_1["']/);

    const validationModuleId = `${testDir}project/validation.cp.js`;
    const validationResource = resource(validationModuleId);
    const validationModule = module(System, validationModuleId);
    await validationResource.write(componentModule._source);
    const { Example: validationDescriptor } = await validationModule.load();
    const cold = validationDescriptor.derive();
    expect(cold.get('label').fill).equals(Color.yellow);
    expect(cold.get('container').get('label_1').fill).equals(Color.orange);
    await validationModule.unload();
    await validationResource.remove();
  });

  it('reconciles changes to a nested tiling layout through undo and redo', async () => {
    const container = editable.get('date array');

    editable.undoStart('change component tiling layout');
    container.withMetaDo({ reconcileChanges: true }, () => {
      container.layout = container.layout.with({
        spacing: 7,
        padding: rect(8, 4, 6, 2),
        wrapSubmorphs: true
      });
    });
    await finishDirectManipulation();
    editable.undoStop();

    expect(container.layout.spacing).equals(7);
    expect(container.layout.padding).equals(rect(8, 4, 6, 2));
    expect(container.layout.wrapSubmorphs).to.be.true;
    expect(componentModule._source).matches(/spacing:\s*7/);
    expect(componentModule._source).matches(/padding:\s*rect\(8,\s*4,\s*6,\s*2\)/);
    expect(componentModule._source).matches(/wrapSubmorphs:\s*true/);

    await undo();
    expect(componentModule._source).equals(initialSource);
    expect(container.layout.spacing).equals(2);
    expect(container.layout.padding).equals(rect(3, 0, 0, 0));
    expect(container.layout.wrapSubmorphs).to.be.false;

    await redo();
    expect(container.layout.spacing).equals(7);
    expect(container.layout.padding).equals(rect(8, 4, 6, 2));
    expect(container.layout.wrapSubmorphs).to.be.true;
  });
});

describe('projectional components sharing a module', function () {
  releaseComponentEditingState();

  const source = `
"format esm";
import { component, ComponentDescriptor } from 'lively.morphic/components/core.js';
import { InteractiveComponentDescriptor } from 'lively.ide/components/editor.js';
import { Color } from 'lively.graphics';

component.DescriptorClass = InteractiveComponentDescriptor;

const A = component({
  name: 'a',
  fill: Color.red,
  submorphs: [{ name: 'before', fill: Color.yellow }]
});
const B = component({ name: 'b', fill: Color.blue });
const Derived = component(A, {
  name: 'derived',
  submorphs: [{ name: 'before', fill: Color.green }]
});

component.DescriptorClass = ComponentDescriptor;
export { A, B, Derived };
`;
  let componentModule, descriptors, editable, otherEditable;

  beforeEach(async () => {
    await createFiles(testDir, { project: { 'component.cp.js': source } });
    componentModule = module(System, moduleId);
    descriptors = await componentModule.load();
    editable = await editComponent(descriptors.A);
  });

  afterEach(async () => {
    releaseEditSessions();
    editable = otherEditable = null;
    await componentModule?.unload();
    await resource(testDir).remove();
    await System._livelyModulesTranslationCache.deleteCachedData(moduleId);
  });

  /** Wait for all open components to finish reconciliation and shadow comparison. */
  async function processed () {
    for (const morph of [editable, otherEditable].filter(Boolean)) {
      await morph._changeTracker.onceChangesProcessed();
      await morph._changeTracker._shadowComparisonPromise;
    }
  }

  it('commits a fill edit after renaming a base child with a same-module derivation', async () => {
    const child = editable.get('before');
    editable.withMetaDo({ reconcileChanges: true }, () => { child.name = 'after'; });
    await processed();

    expect(child.name).equals('after');
    expect(componentModule._source.match(/name:\s*['"]after['"]/g)).has.length(2);
    expect(descriptors.Derived.derive().get('after').fill).equals(Color.green);

    editable.withMetaDo({ reconcileChanges: true }, () => { editable.fill = Color.orange; });
    await processed();
    const finalSource = componentModule._source;
    expect(finalSource).includes('fill: Color.orange');
    expect(editable.fill).equals(Color.orange);
    expect(descriptors.A.derive().fill).equals(Color.orange);

    for (let index = 0; index < 2; index++) {
      editable.env.undoManager.undo();
      await processed();
    }
    expect(componentModule._source).equals(source);
    expect(editable.get('before')).equals(child);
    expect(editable.fill).equals(Color.red);
    for (let index = 0; index < 2; index++) {
      editable.env.undoManager.redo();
      await processed();
    }
    expect(componentModule._source).equals(finalSource);
    expect(child.name).equals('after');
    expect(editable.fill).equals(Color.orange);
  });

  it('commits interleaved tracker edits with exact undo and redo of shared source', async () => {
    otherEditable = await editComponent(descriptors.B);
    const undoManager = editable.env.undoManager;
    const undoCount = undoManager.undos.length;
    const sources = [componentModule._source];
    for (const [target, fill] of [
      [editable, Color.orange],
      [otherEditable, Color.purple],
      [editable, Color.green],
      [editable, Color.black]
    ]) {
      target.withMetaDo({ reconcileChanges: true }, () => { target.fill = fill; });
      await processed();
      expect(target.fill).equals(fill);
      sources.push(componentModule._source);
    }
    expect(undoManager.undos.length).equals(undoCount + 4);
    expect(descriptors.A.derive().fill).equals(Color.black);
    expect(descriptors.B.derive().fill).equals(Color.purple);

    for (let index = sources.length - 2; index >= 0; index--) {
      undoManager.undo();
      await processed();
      expect(componentModule._source).equals(sources[index]);
    }
    expect(componentModule._source).equals(source);
    expect(editable.fill).equals(Color.red);
    expect(otherEditable.fill).equals(Color.blue);
    for (let index = 1; index < sources.length; index++) {
      undoManager.redo();
      await processed();
      expect(componentModule._source).equals(sources[index]);
    }
    expect(editable.fill).equals(Color.black);
    expect(otherEditable.fill).equals(Color.purple);
  });
});

describe('direct manipulation test lifecycle', () => {
  after(() => {
    releaseEditSessions();
    editSessions.length = 0;
    releasedSessions = 0;
  });

  it('leaves zero live trackers or cached editables after both suites', () => {
    const active = editSessions.filter(({ descriptor, editable, tracker }) =>
      editable._changeTracker || descriptor._cachedComponent || editable.owner ||
      editable.env.changeManager.committedChangeListeners.includes(tracker._committedChangeListener));
    expect(active.map(({ editable }) => editable.name)).deep.equals([]);
  });
});
