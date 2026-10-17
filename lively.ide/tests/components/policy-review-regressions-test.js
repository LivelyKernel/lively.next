/* global describe, it, beforeEach, afterEach, System */
import { expect } from 'mocha-es6';
import { createFiles, resource } from 'lively.resources';
import module from 'lively.modules/src/module.js';
import { add, morph, part, Text, TilingLayout } from 'lively.morphic';
import { Color, pt } from 'lively.graphics';
import { FillControlModel } from '../../studio/controls/fill.cp.js';
import { ResponsiveControlModel } from '../../studio/controls/responsive.cp.js';
import { ComponentControl } from '../../studio/controls/component.cp.js';
import { PolicyApplicator, StylePolicy } from 'lively.morphic/components/policy.js';
import { SetMorphProperty } from 'lively.morphic/changes/operations.js';
import { releaseComponentEditingState } from './test-isolation.js';

const directory = 'local://policy-review-regressions/';
const moduleId = directory + 'component.cp.js';
const source = `
import { component, ComponentDescriptor } from 'lively.morphic/components/core.js';
import { InteractiveComponentDescriptor } from 'lively.ide/components/editor.js';
import { part, add, without, morph, ConstraintLayout, Text, TilingLayout } from 'lively.morphic';
import { Color, pt } from 'lively.graphics';
component.DescriptorClass = InteractiveComponentDescriptor;
const Button = component({ name: 'button', extent: pt(40, 40), fill: Color.red });
const Rotary = component({ name: 'rotary', submorphs: [{ name: 'rotated', rotation: 0 }] });
const Base = component({ name: 'base', extent: pt(200, 80), fill: Color.gray });
const TwinA = component(Base, { name: 'twin' });
const TwinB = component(Base, { name: 'twin' });
const Wrapper = component({ name: 'wrapper', submorphs: [{ name: 'wrapper child', fill: Color.blue }] });
const AnonymousDerived = component(Base, { name: 'anonymous derived', submorphs: [add(part(Wrapper))] });
const FirstMasterBase = component({ name: 'first master base', fill: Color.red,
  submorphs: [{ name: 'grandchild', fill: Color.green }] });
const FirstMaster = component({ name: 'first master', submorphs: [{ name: 'plain child', extent: pt(80, 80),
  submorphs: [{ name: 'grandchild', fill: Color.cyan }] }] });
const Example = component({
  name: 'example', extent: pt(200, 80),
  layout: new TilingLayout({ resizePolicies: [['button', { width: 'fill', height: 'fixed' }]] }),
  submorphs: [part(Button, { name: 'button' }), { name: 'sibling', extent: pt(20, 20) }]
});
const Derived = component(Example, { name: 'derived', master: { hover: Example } });
const MovedDerived = component(Example, { name: 'moved derived',
  submorphs: [{ name: 'button', layout: new ConstraintLayout({ renderViaCSS: false }) }] });
const TextScopeBase = component({ name: 'text scope base', submorphs: [
  { type: Text, name: 'scoped text', fixedWidth: true, fixedHeight: true, extent: pt(100, 40) },
  part(Button, { name: 'scoped part', submorphs: [add({ name: 'container' })] })
] });
const TextScope = component(TextScopeBase, { name: 'text scope', submorphs: [
  without('scoped text'),
  { name: 'scoped part', submorphs: [{ name: 'container', submorphs: [
    add({ type: Text, name: 'scoped text', fixedWidth: true, fixedHeight: true, extent: pt(100, 40) })
  ] }] }
] });
const AddedDerived = component(Base, { name: 'added derived',
  submorphs: [add(part(Button, { name: 'added button' }))] });
const UndoDerived = component(Base, { name: 'undo derived', submorphs: [
  add({ type: Text, name: 'rich text', fixedWidth: true, fixedHeight: true,
    extent: pt(100, 40), textAndAttributes: [morph({ name: 'embedded', fill: Color.cyan }), null] }),
  add(part(Button, { name: 'left', submorphs: [add({ name: 'moving', fill: Color.cyan })] })),
  add(part(Button, { name: 'right' })),
  add({ name: 'rotated', rotation: 0 })
] });
component.DescriptorClass = ComponentDescriptor;
export { Button, Rotary, Base, TwinA, TwinB, Wrapper, AnonymousDerived, FirstMasterBase, FirstMaster,
  Example, Derived, MovedDerived,
  TextScopeBase, TextScope, AddedDerived, UndoDerived };
`;

describe('reviewed projectional policy regressions', function () {
  releaseComponentEditingState();

  this.timeout(30000);
  let componentModule, exports, editable, tracker, extraEditables, instances;
  beforeEach(async () => {
    await createFiles(directory, { 'component.cp.js': source });
    componentModule = module(System, moduleId);
    exports = await componentModule.load();
    editable = await exports.Example.edit();
    tracker = editable._changeTracker;
    extraEditables = [];
    instances = [];
  });
  afterEach(async () => {
    [editable, ...extraEditables].forEach(morph => { morph?._changeTracker?.dispose(); morph?.remove(); });
    instances.forEach(morph => morph.remove());
    await componentModule?.unload();
    await resource(directory).remove();
    await System._livelyModulesTranslationCache.deleteCachedData(moduleId);
  });

  async function processed (activeTracker = tracker) {
    await activeTracker.onceChangesProcessed();
    await activeTracker._shadowComparisonPromise;
  }
  async function replay (direction) {
    editable.env.undoManager[direction]();
    await processed();
  }
  function responsiveCommit () {
    const result = ResponsiveControlModel.prototype.refreshChangeTrackers.call({
      targetMorph: editable, targetStylePolicy: editable.master
    });
    expect(result.committed, JSON.stringify(result.diagnostics)).equals(true);
    return result;
  }
  function fill (target, color) {
    FillControlModel.prototype.confirm.call({ targetMorph: target,
      ui: { fillColorInput: { colorValue: color } }, update: () => {} });
  }

  it('preserves anonymous added part names through responsive and repeated structural commits', async () => {
    const derived = await exports.AnonymousDerived.edit();
    extraEditables.push(derived);
    const activeTracker = derived._changeTracker;
    const wrapperPolicy = exports.AnonymousDerived.stylePolicy.getSubSpecAt(['wrapper']);
    const wrapper = derived.get('wrapper');
    expect(wrapper).not.equals(null);
    const usedNames = StylePolicy.usedNames;
    const namesBefore = [...usedNames];
    const assertWrapper = () => {
      expect(exports.AnonymousDerived.stylePolicy.getSubSpecAt(['wrapper'])).equals(wrapperPolicy);
      expect(derived.get('wrapper')).equals(wrapper);
      const cold = part(exports.AnonymousDerived);
      instances.push(cold);
      expect(cold.get('wrapper')).not.equals(null);
      expect(cold.get('wrapper').get('wrapper child').fill).equals(Color.blue);
      expect(StylePolicy.usedNames).equals(usedNames);
      expect([...usedNames]).deep.equals(namesBefore);
    };
    derived.master.setBreakpoints([[pt(0, 0), exports.Base], [pt(120, 0), exports.Base]]);
    const result = ResponsiveControlModel.prototype.refreshChangeTrackers.call({
      targetMorph: derived, targetStylePolicy: derived.master
    });
    expect(result.committed, JSON.stringify(result.diagnostics)).equals(true);
    await processed(activeTracker);
    assertWrapper();
    for (const name of ['first addition', 'second addition']) {
      derived.withMetaDo({ reconcileChanges: true }, () => derived.addMorph(morph({ name })));
      await processed(activeTracker);
      assertWrapper();
    }
    expect(componentModule._source).includes('add(part(Wrapper))');
    for (const direction of ['undo', 'redo']) {
      derived.env.undoManager[direction]();
      await processed(activeTracker);
      assertWrapper();
    }
  });

  it('preserves the global name set when source policy evaluation throws', () => {
    const expression = "component(Base, { name: 'failed evaluation', submorphs: [add(part(Wrapper)), (() => { throw new Error('evaluation failed'); })()] })";
    const document = tracker.projectionalDocumentForCurrentSource().document;
    const usedNames = StylePolicy.usedNames;
    const namesBefore = [...usedNames];
    expect(() => tracker.evaluateProjectionalPolicy({
      descriptor: exports.AnonymousDerived, componentModule, source: expression,
      document: { ...document, sourceMetadata: { ...document.sourceMetadata,
        componentRange: { start: 0, end: expression.length } } }
    })).to.throw(/evaluation failed/);
    expect(StylePolicy.usedNames).equals(usedNames);
    expect([...usedNames]).deep.equals(namesBefore);
  });

  it('keeps a first nested master from the component control connected through replay and later fills', async () => {
    const subject = await exports.FirstMaster.edit();
    extraEditables.push(subject);
    const activeTracker = subject._changeTracker;
    const child = subject.get('plain child');
    const cachedChild = () => exports.FirstMaster.stylePolicy.getSubSpecAt(['plain child']);
    expect(child.master).equals(null);
    expect(cachedChild().isPolicy).not.equals(true);
    const controlView = part(ComponentControl).openInWorld();
    instances.push(controlView);
    const control = controlView.viewModel;
    control.targetMorph = child;
    control.activate();
    control.ui.autoComponentSelection.component = exports.FirstMasterBase;
    control.ui.hoverComponentSelection.component = null;
    control.ui.clickComponentSelection.component = null;
    control.confirm();
    await processed(activeTracker);
    expect(child.master).equals(cachedChild());
    subject.env.undoManager.undo();
    await processed(activeTracker);
    expect(child.master).equals(null);
    expect(cachedChild().isPolicy).not.equals(true);
    subject.env.undoManager.redo();
    await processed(activeTracker);
    expect(child.master).equals(cachedChild());
    child.master.applyIfNeeded(true);
    const fillBeforeEdit = child.get('grandchild').fill;
    fill(child.get('grandchild'), Color.orange);
    await processed(activeTracker);
    child.master.applyIfNeeded(true);
    expect(child.get('grandchild').fill).equals(Color.orange);
    const cold = part(exports.FirstMaster);
    instances.push(cold);
    expect(cold.get('grandchild').fill).equals(Color.orange);
    subject.env.undoManager.undo();
    await processed(activeTracker);
    expect(child.get('grandchild').fill).equals(fillBeforeEdit);
    expect(child.master).equals(cachedChild());
    subject.env.undoManager.redo();
    await processed(activeTracker);
    child.master.applyIfNeeded(true);
    expect(child.get('grandchild').fill).equals(Color.orange);
    expect(child.master).equals(cachedChild());
  });

  it('uses the assigned policy in the cache for an explicit first nested master command', async () => {
    const subject = await exports.FirstMaster.edit();
    extraEditables.push(subject);
    const activeTracker = subject._changeTracker;
    const child = subject.get('plain child');
    const assignedPolicy = new PolicyApplicator({});
    assignedPolicy.applyConfiguration({ auto: exports.FirstMasterBase });
    assignedPolicy.attach(child);
    const result = activeTracker.setProperty({ target: child, property: 'master', value: assignedPolicy });
    expect(result.committed, JSON.stringify(result.diagnostics)).equals(true);
    await processed(activeTracker);
    const cachedChild = () => exports.FirstMaster.stylePolicy.getSubSpecAt(['plain child']);
    expect(child.master).equals(cachedChild());
    expect(child.master).equals(assignedPolicy);
    subject.env.undoManager.undo();
    await processed(activeTracker);
    expect(child.master).equals(null);
    expect(cachedChild().isPolicy).not.equals(true);
    subject.env.undoManager.redo();
    await processed(activeTracker);
    expect(child.master).equals(cachedChild());
    fill(child.get('grandchild'), Color.orange);
    await processed(activeTracker);
    child.master.applyIfNeeded(true);
    expect(child.get('grandchild').fill).equals(Color.orange);
    const cold = part(exports.FirstMaster);
    instances.push(cold);
    expect(cold.get('grandchild').fill).equals(Color.orange);
  });

  it('undoes and redoes breakpoint creation and removal on the real cached master identity', async () => {
    const policy = exports.Example.stylePolicy;
    expect(editable.master).equals(policy);
    editable.master.setBreakpoints([[pt(0, 0), exports.Base], [pt(120, 0), exports.Base]]);
    responsiveCommit();
    await processed();
    expect(editable.master).equals(policy);
    expect(policy._breakpointStore._horizontalBreakpoints).deep.equals([0, 120]);
    editable.master.setBreakpoints([[pt(0, 0), exports.Base], [pt(240, 0), exports.Base]]);
    responsiveCommit();
    await processed();
    expect(policy._breakpointStore._horizontalBreakpoints).deep.equals([0, 240]);
    await replay('undo');
    expect(policy._breakpointStore._horizontalBreakpoints).deep.equals([0, 120]);
    await replay('undo');
    expect(policy._breakpointStore).equals(undefined);
    expect(editable.master.getBreakpointStore()).equals(undefined);
    expect(part(exports.Example).master.getBreakpointStore()).equals(undefined);
    expect(componentModule._source).equals(source);
    await replay('redo');
    expect(editable.master).equals(policy);
    expect(policy._breakpointStore._horizontalBreakpoints).deep.equals([0, 120]);
    await replay('redo');
    expect(policy._breakpointStore._horizontalBreakpoints).deep.equals([0, 240]);
    editable.master.clearBreakpoints();
    responsiveCommit();
    await processed();
    expect(policy._breakpointStore).equals(undefined);
    await replay('undo');
    expect(policy._breakpointStore._horizontalBreakpoints).deep.equals([0, 240]);
    await replay('redo');
    expect(editable.master.getBreakpointStore()).equals(undefined);
  });

  it('retains later child fills when the root master is reapplied across a breakpoint', async () => {
    editable.master.setBreakpoints([[pt(0, 0), exports.Base], [pt(120, 0), exports.Base]]);
    responsiveCommit();
    await processed();
    fill(editable.get('button'), Color.orange);
    await processed();
    editable.withMetaDo({ reconcileChanges: false }, () => { editable.width = 300; });
    editable.master.applyIfNeeded(true);
    expect(editable.master).equals(exports.Example.stylePolicy);
    expect(editable.get('button').fill).equals(Color.orange);
    expect(part(exports.Example).get('button').fill).equals(Color.orange);
  });

  it('undoes and redoes a direct master configuration on the cached policy identity', async () => {
    const policy = exports.Example.stylePolicy;
    const replacement = editable.master.copy();
    replacement.applyConfiguration({ hover: exports.Base });
    replacement.attach(editable);
    editable.withMetaDo({ reconcileChanges: true }, () => editable.setProperty('master', replacement));
    await processed();
    expect(editable.master).equals(policy);
    expect(policy.getConfig().hover).equals(exports.Base.stylePolicy);
    await replay('undo');
    expect(editable.master).equals(policy);
    expect(policy.getConfig()?.hover).equals(undefined);
    expect(componentModule._source).equals(source);
    await replay('redo');
    expect(editable.master).equals(policy);
    expect(policy.getConfig().hover).equals(exports.Base.stylePolicy);
  });

  it('updates an added part policy in a derived component through the actual fill control', async () => {
    const derived = await exports.AddedDerived.edit();
    extraEditables.push(derived);
    const child = derived.get('added button');
    const setProperty = derived._changeTracker.setProperty;
    let fillResult;
    derived._changeTracker.setProperty = function (options) {
      fillResult = setProperty.call(this, options);
      return fillResult;
    };
    fill(child, Color.orange);
    expect(fillResult?.committed, JSON.stringify(fillResult?.diagnostics)).equals(true);
    await processed(derived._changeTracker);
    expect(derived.get('added button').fill).equals(Color.orange);
    expect(exports.AddedDerived.stylePolicy.getSubSpecAt(['added button']).spec.fill).equals(Color.orange);
    expect(part(exports.AddedDerived).get('added button').fill).equals(Color.orange);
    derived.env.undoManager.undo();
    await processed(derived._changeTracker);
    expect(part(exports.AddedDerived).get('added button').fill).equals(Color.red);
    derived.env.undoManager.redo();
    await processed(derived._changeTracker);
    expect(part(exports.AddedDerived).get('added button').fill).equals(Color.orange);
  });

  it('preserves nested policies for existing parts and derived instances through regeneration and replay', async () => {
    const instance = part(exports.Example).openInWorld();
    const derivedInstance = part(exports.Derived).openInWorld();
    instances.push(instance, derivedInstance);
    const nested = exports.Example.stylePolicy.getSubSpecAt(['button']);
    const derivedNested = exports.Derived.stylePolicy.getSubSpecAt(['button']);
    const editedMaster = editable.get('button').master;
    const added = morph({ name: 'addition', fill: Color.blue });
    editable.withMetaDo({ reconcileChanges: true }, () => editable.addMorph(added));
    await processed();
    expect(exports.Example.stylePolicy.getSubSpecAt(['button'])).equals(nested);
    expect(exports.Derived.stylePolicy.getSubSpecAt(['button'])).equals(derivedNested);
    expect(editable.get('button').master).equals(editedMaster);
    expect(exports.Derived.stylePolicy._hoverMaster).equals(exports.Example.stylePolicy);
    fill(editable.get('button'), Color.orange);
    await processed();
    for (const root of [editable, instance, derivedInstance]) {
      root.master.applyIfNeeded(true);
      root.get('button').master?.applyIfNeeded(true);
      expect(root.get('button').fill).equals(Color.orange);
    }
    await replay('undo');
    await replay('undo');
    expect(exports.Example.stylePolicy.getSubSpecAt(['button'])).equals(nested);
    expect(exports.Derived.stylePolicy.getSubSpecAt(['button'])).equals(derivedNested);
    expect(exports.Derived.stylePolicy._hoverMaster).equals(exports.Example.stylePolicy);
    await replay('redo');
    await replay('redo');
    expect(instance.get('button').fill).equals(Color.orange);
    expect(derivedInstance.get('button').fill).equals(Color.orange);
  });

  it('retains unrelated rich text and scalar edits when undoing and redoing a move across part scopes', async () => {
    const derived = await exports.UndoDerived.edit();
    extraEditables.push(derived);
    const activeTracker = derived._changeTracker;
    const richText = derived.get('rich text');
    await richText.whenFontLoaded();
    const replacementPolicy = derived.master.copy();
    replacementPolicy.applyConfiguration({ hover: exports.Button });
    replacementPolicy.attach(derived);
    derived.withMetaDo({ reconcileChanges: true }, () => derived.setProperty('master', replacementPolicy));
    await processed(activeTracker);
    expect(derived.master).equals(exports.UndoDerived.stylePolicy);
    derived.withMetaDo({ reconcileChanges: true }, () => {
      richText.textAndAttributes = [morph({ name: 'embedded', fill: Color.orange }), null];
      derived.get('rotated').rotation = 0.75;
    });
    await processed(activeTracker);
    const moving = derived.get('moving');
    derived.withMetaDo({ reconcileChanges: true }, () => derived.get('right').addMorph(moving));
    await processed(activeTracker);
    for (const direction of ['undo', 'redo', 'undo']) {
      derived.env.undoManager[direction]();
      await processed(activeTracker);
      expect(moving.owner).equals(derived.get(direction === 'redo' ? 'right' : 'left'));
      expect(derived.get('rich text').textAndAttributes[0].fill).equals(Color.orange);
      expect(derived.get('rotated').rotation).equals(0.75);
      const cold = part(exports.UndoDerived);
      expect(cold.get('rich text').textAndAttributes[0].fill).equals(Color.orange);
      expect(cold.get('rotated').rotation).equals(0.75);
    }
  });

  it('keeps introduced part policies connected to later edits and scalar replay', async () => {
    const introduced = part(exports.Rotary, { name: 'introduced part',
      submorphs: [add({ name: 'nested addition', fill: Color.cyan })] });
    const livePolicy = introduced.master;
    editable.withMetaDo({ reconcileChanges: true }, () => editable.addMorph(introduced));
    await processed();
    expect(exports.Example.stylePolicy.getSubSpecAt(['introduced part'])).equals(livePolicy);
    expect(introduced.master).equals(livePolicy);
    editable.withMetaDo({ reconcileChanges: true }, () => { introduced.get('rotated').rotation = 0.75; });
    await processed();
    editable.master.applyIfNeeded(true);
    expect(introduced.get('rotated').rotation).equals(0.75);
    expect(part(exports.Example).get('rotated').rotation).equals(0.75);
    await replay('undo');
    expect(introduced.get('rotated').rotation).equals(0);
    await replay('redo');
    editable.master.applyIfNeeded(true);
    expect(introduced.get('rotated').rotation).equals(0.75);
    expect(exports.Example.stylePolicy.getSubSpecAt(['introduced part'])).equals(livePolicy);
  });

  it('keeps a moved inherited part connected after component-scope introduction allocation', async () => {
    const derived = await exports.MovedDerived.edit();
    extraEditables.push(derived);
    const activeTracker = derived._changeTracker;
    const inherited = derived.get('button');
    const livePolicy = inherited.master;
    const destination = morph({ name: 'destination', submorphs: [{ name: 'button' }] });
    derived.withMetaDo({ reconcileChanges: true }, () => derived.addMorph(destination));
    await processed(activeTracker);
    expect(destination.submorphs[0].name).equals('button_1');
    const beforeMove = componentModule._source;
    derived.withMetaDo({ reconcileChanges: true }, () => destination.addMorph(inherited));
    await processed(activeTracker);
    const afterMove = componentModule._source;
    expect(inherited.name).equals('button');
    const cachedMovedPolicy = () => exports.MovedDerived.stylePolicy.getSubSpecFor(inherited.name);
    const checkConnection = () => {
      expect(cachedMovedPolicy()).equals(livePolicy);
      expect(inherited.master).equals(livePolicy);
      expect(inherited.fill).equals(Color.red);
      const cold = part(exports.MovedDerived);
      instances.push(cold);
      expect(cold.get(inherited.name).fill).equals(Color.red);
    };
    checkConnection();
    derived.env.undoManager.undo();
    await processed(activeTracker);
    expect(componentModule._source).equals(beforeMove);
    expect(inherited.owner).equals(derived);
    expect(inherited.name).equals('button');
    checkConnection();
    derived.env.undoManager.redo();
    await processed(activeTracker);
    expect(componentModule._source).equals(afterMove);
    expect(inherited.owner).equals(destination);
    expect(inherited.name).equals('button');
    checkConnection();
  });

  it('keeps a moved inherited part connected when a different part scope forces materialization naming', async () => {
    const derived = await exports.MovedDerived.edit();
    extraEditables.push(derived);
    const activeTracker = derived._changeTracker;
    const inherited = derived.get('button');
    const livePolicy = inherited.master;
    // A part opens a separate scope, so this collision remains reachable after legacy 869.
    const destination = part(exports.Wrapper, { name: 'destination',
      submorphs: [add({ name: 'button', fill: Color.green })] });
    derived.withMetaDo({ reconcileChanges: true }, () => derived.addMorph(destination));
    await processed(activeTracker);
    expect(destination.get('button').fill).equals(Color.green);
    const beforeMove = componentModule._source;
    derived.withMetaDo({ reconcileChanges: true }, () => destination.addMorph(inherited));
    await processed(activeTracker);
    const afterMove = componentModule._source;
    expect(inherited.name).equals('button_1');
    const cachedMovedPolicy = () => exports.MovedDerived.stylePolicy
      .getSubSpecAt(['destination']).getSubSpecFor(inherited.name);
    const checkConnection = () => {
      expect(cachedMovedPolicy()).equals(livePolicy);
      expect(inherited.master).equals(livePolicy);
      expect(inherited.fill).equals(Color.red);
      const cold = part(exports.MovedDerived);
      instances.push(cold);
      expect(cold.get('destination').get('button_1').fill).equals(Color.red);
      expect(cold.get('destination').get('button').fill).equals(Color.green);
    };
    checkConnection();
    derived.env.undoManager.undo();
    await processed(activeTracker);
    expect(componentModule._source).equals(beforeMove);
    expect(inherited.owner).equals(derived);
    expect(inherited.name).equals('button');
    expect(exports.MovedDerived.stylePolicy.getSubSpecFor(inherited.name)).equals(livePolicy);
    expect(inherited.master).equals(livePolicy);
    expect(inherited.fill).equals(Color.red);
    const cold = part(exports.MovedDerived);
    instances.push(cold);
    expect(cold.get('button').fill).equals(Color.red);
    derived.env.undoManager.redo();
    await processed(activeTracker);
    expect(componentModule._source).equals(afterMove);
    expect(inherited.owner).equals(destination);
    expect(inherited.name).equals('button_1');
    checkConnection();
  });

  it('keeps nested part font callbacks and local style overrides within their policy scope', async () => {
    const instance = part(exports.TextScope).openInWorld();
    instances.push(instance);
    const text = instance.get('scoped text');
    await text.whenFontLoaded();
    expect(() => instance.master.onMorphChange(text, {
      target: text, prop: '_fontFamilyToRender', prevValue: '', value: text.fontFamily, meta: {}
    })).not.to.throw();
    text.fill = Color.orange;
    instance.master.applyIfNeeded(true);
    expect(text.fill).equals(Color.orange);
    expect(instance.master.spec.submorphs.some(spec => spec.name === 'scoped text')).equals(false);
  });

  it('refreshes cached styling after a cross-scope move has replayed its owner layout', async () => {
    const introduced = part(exports.Rotary, { name: 'source part',
      layout: new TilingLayout({ renderViaCSS: false,
        resizePolicies: [['moving', { width: 'fill', height: 'fixed' }]] }),
      submorphs: [add({ name: 'moving', extent: pt(20, 20) })] });
    editable.withMetaDo({ reconcileChanges: true }, () => editable.addMorph(introduced));
    await processed();
    const moving = introduced.get('moving');
    editable.withMetaDo({ reconcileChanges: true }, () => editable.addMorph(moving));
    await processed();
    const sourceAfterMove = componentModule._source;
    const documentAfterMove = tracker._projectionalDocument;
    const policy = exports.Example.stylePolicy;
    const specAfterMove = policy.spec;
    const originalAfterMove = policy._originalSpec;
    const originalLayout = introduced.layout;
    const moveTransaction = editable.env.undoManager.undos.slice(-1)[0];
    for (const conflict of [{ spacing: 7 },
      { resizePolicies: [['rotated', { width: 'fill', height: 'fixed' }]] }]) {
      introduced.withMetaDo({ reconcileChanges: false, doNotOverride: true }, () => {
        introduced.layout = new TilingLayout({ ...originalLayout.getSpec(), ...conflict });
      });
      const conflictingSpec = introduced.layout.getSpec();
      // Check atomic validation directly; the undo manager drops failed entries.
      expect(() => moveTransaction.reverseApply()).to.throw(/Precondition failed.*layout/);
      await processed();
      expect(componentModule._source).equals(sourceAfterMove);
      expect(tracker._projectionalDocument).equals(documentAfterMove);
      expect(policy.spec).equals(specAfterMove);
      expect(policy._originalSpec).equals(originalAfterMove);
      expect(moving.owner).equals(editable);
      expect(introduced.layout.getSpec()).deep.equals(conflictingSpec);
      introduced.withMetaDo({ reconcileChanges: false, doNotOverride: true }, () => {
        introduced.layout = originalLayout;
      });
    }
    await replay('undo');
    expect(moving.owner).equals(introduced);
    expect(introduced.layout.getSpec().resizePolicies.find(([name]) => name === 'moving')[1].width).equals('fill');
    await replay('redo');
    expect(moving.owner).equals(editable);
    expect((introduced.layout.getSpec().resizePolicies || []).some(([name]) => name === 'moving')).equals(false);
    await replay('undo');
    expect(moving.owner).equals(introduced);
  });

  it('allows typing outside the actual active tracker without retaining the previous document', async () => {
    const editor = new Text({ readOnly: false, fixedWidth: true, fixedHeight: true,
      extent: pt(400, 300), textString: 'outside the component' });
    await editor.whenFontLoaded();
    const commitsBefore = editor.env.changeManager.commitCounter;
    let previousDocumentReads = 0;
    const previousDocument = editor.textString;
    let prototype = editor;
    while (!Object.getOwnPropertyDescriptor(prototype, 'textAndAttributes')) prototype = Object.getPrototypeOf(prototype);
    const getter = Object.getOwnPropertyDescriptor(prototype, 'textAndAttributes').get;
    Object.defineProperty(editor, 'textAndAttributes', { configurable: true,
      get () { if (editor.textString === previousDocument) previousDocumentReads++; return getter.call(this); }
    });
    try {
      editor.withMetaDo({ reconcileChanges: true }, () => editor.insertText('x', { row: 0, column: 0 }));
      expect(previousDocumentReads).equals(0);
      expect(editor.env.changeManager.commitCounter).equals(commitsBefore);
      const replacement = editor.changes.find(change => change.selector === 'replace');
      expect(replacement.meta).not.haveOwnProperty('prevTextAndAttributes');
      await processed();
      expect(componentModule._source).equals(source);
    } finally { delete editor.textAndAttributes; }
  });

  it('rejects a distinct structurally equal master in an exact runtime precondition', async () => {
    editable.master.setBreakpoints([[pt(0, 0), exports.Base]]);
    const result = responsiveCommit();
    await processed();
    const hooks = result.transaction.runtimeChangeSet.operations.find(operation => operation.property === 'master');
    const intended = new PolicyApplicator({}, { auto: exports.TwinA });
    const replacement = new PolicyApplicator({}, { auto: exports.TwinB });
    const operation = new SetMorphProperty({
      targetId: 'target', property: 'master', before: intended, after: intended,
      valueSemantics: hooks.valueSemantics, snapshotValue: hooks.snapshotValue,
      materializeValue: hooks.materializeValue, snapshotValuesEqual: hooks.snapshotValuesEqual
    });
    const target = { master: replacement };
    expect(() => operation.apply({ resolveMorph: () => target })).to.throw(/Precondition failed/);
    expect(target.master).equals(replacement);
  });

  it('keeps a real tiling layout mutable after a sibling rename and subsequent removal', async () => {
    editable.withMetaDo({ reconcileChanges: true }, () => { editable.get('sibling').name = 'renamed sibling'; });
    await processed();
    expect(Object.isFrozen(editable.layout.config.resizePolicies)).equals(false);
    editable.undoStart('remove button');
    editable.withMetaDo({ reconcileChanges: true }, () => editable.get('button').remove());
    await processed();
    editable.undoStop();
    expect((editable.layout.config.resizePolicies || []).some(([name]) => name === 'button')).equals(false);
    await replay('undo');
    expect(editable.get('button')).not.equals(null);
    expect(Object.isFrozen(editable.layout.config.resizePolicies)).equals(false);
    await replay('redo');
    expect(editable.get('button')).equals(null);
  });
});
