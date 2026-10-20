/* global afterEach, beforeEach, describe, it, System, $world */
import { expect } from 'mocha-es6';
import { createFiles, resource } from 'lively.resources';
import module from 'lively.modules/src/module.js';
import { promise } from 'lively.lang';
import { Color, pt } from 'lively.graphics';
import { morph, part, Text, add } from 'lively.morphic';
import { parse } from 'lively.ast';
import { InteractiveComponentDescriptor } from '../../components/editor.js';
import { compareShadowProjectionToCurrentSource } from '../../components/reconciliation/shadow-projection.js';
import { releaseComponentEditingState } from './test-isolation.js';

const directory = 'local://projectional-review-structure/';
const moduleId = `${directory}components.cp.js`;
const initialSource = `import { component, part } from 'lively.morphic/components/core.js';
import { Text } from 'lively.morphic';
import { Color, pt } from 'lively.graphics';
const Inner = component({ name: 'Inner', fill: Color.purple, submorphs: [{ name: 'deep', fill: Color.orange }] });
const Hover = component({ name: 'Hover', fill: Color.green });
const P = component({ name: 'P', submorphs: [part(Inner, { name: 'inner' })] });
const Q = component(P, { name: 'Q' });
const A = component({ name: 'A', submorphs: [{ type: Text, name: 'box', textString: 'original', fill: Color.yellow, extent: pt(50, 50), fixedWidth: true, fixedHeight: true }, part(Inner, { name: 'some ref' })] });
const B = component(A, { name: 'B', submorphs: [{ name: 'box', fill: Color.green }] });
const C = component({ name: 'C' });
const Tree = component({ name: 'Tree', submorphs: [{ name: 'branch', submorphs: [{ name: 'keep', fill: Color.yellow }, { name: 'drop', fill: Color.yellow }] }] });
const TreeDerived = component(Tree, { name: 'TreeDerived', submorphs: [{ name: 'branch', submorphs: [{ name: 'keep', fill: Color.green }, { name: 'drop', fill: Color.orange }] }] });
const Commented = component({ name: 'Commented', submorphs: [
  { name: 'first' } /* keep this comment */, { name: 'second' }, { name: 'third' }
] });
export { Inner, Hover, P, Q, A, B, C, Tree, TreeDerived, Commented };`;

describe('projectional component structure review regressions', function () {
  this.timeout(30000);
  releaseComponentEditingState();
  let componentModule, descriptors, editable, manager, errors, showError, logError;
  const opened = [];

  beforeEach(async () => {
    errors = [];
    showError = $world.showError;
    logError = $world.logError;
    $world.showError = error => errors.push(String(error?.message || error));
    $world.logError = error => errors.push(String(error?.message || error));
    await createFiles(directory, { 'components.cp.js': initialSource });
    componentModule = module(System, moduleId);
    const exports = await componentModule.load();
    descriptors = Object.fromEntries(Object.entries(exports).map(([name, value]) =>
      [name, InteractiveComponentDescriptor.ensureInteractive(value)]));
    editable = await open('C');
    manager = editable.env.undoManager;
    manager.reset();
  });

  afterEach(async () => {
    Object.values(descriptors || {}).forEach(descriptor => descriptor.stopEditSession());
    opened.splice(0).forEach(target => {
      target._changeTracker?.dispose();
      target.remove();
    });
    manager?.undoStop();
    manager?.reset();
    await componentModule?.unload();
    await resource(directory).remove();
    await System._livelyModulesTranslationCache.deleteCachedData(moduleId);
    $world.showError = showError;
    $world.logError = logError;
  });

  /** Open a real interactive descriptor and retain it for cleanup. */
  async function open (name) {
    const target = await descriptors[name].edit();
    target.openInWorld();
    opened.push(target);
    return target;
  }

  /** Collect a rejected reconciliation so the test reports its own assertion. */
  async function settle (target = editable) {
    await target._changeTracker?.onceChangesProcessed().catch(error => errors.push(error.message));
    await promise.delay(25);
  }

  /** Read the actual generated declaration without depending on formatting. */
  function definition (name) {
    return parse(componentModule._source).body.find(statement =>
      statement.type === 'VariableDeclaration' && statement.declarations[0].id.name === name)
      .declarations[0].init;
  }

  /** Read an object property's AST value. */
  function property (object, name) {
    return object.properties.find(prop => prop.key.name === name || prop.key.value === name)?.value;
  }

  it('S7-2 introduces a part without pinning its inherited subtree', async () => {
    editable.withMetaDo({ reconcileChanges: true }, () => editable.addMorph(part(descriptors.P, { name: 'pinst' })));
    await settle();
    const child = property(definition('C').arguments[0], 'submorphs')?.elements[0];
    expect(child?.callee.name, 'part: introduction must use the component reference').equals('part');
    expect(child.arguments[1].properties.map(prop => prop.key.name),
      'part: only the instance name belongs in the override').deep.equals(['name']);
    expect(part(descriptors.C).get('pinst').get('inner').get('deep').fill,
      'part: cold instances must inherit the nested component').equals(Color.orange);
    expect(errors, 'part: minimal introduction must commit').deep.equals([]);
  });

  it('S7-2 retains an introduced part hover master in source and cold instances', async () => {
    const instance = part(descriptors.Inner, { name: 'configured' });
    instance.master.applyConfiguration({ hover: descriptors.Hover });
    editable.withMetaDo({ reconcileChanges: true }, () => editable.addMorph(instance));
    await settle();
    expect(componentModule._source, 'master: the introduced hover configuration must remain in source')
      .matches(/hover:\s*Hover/);
    const master = part(descriptors.C).get('configured').master;
    expect((master.getConfig() || master.parent?.getConfig?.())?.hover,
      'master: cold instances must keep the hover policy').equals(descriptors.Hover.stylePolicy);
    expect(errors, 'master: configured introduction must commit').deep.equals([]);
  });

  it('S7-4 introduces a derived part whose base contains a nested part', async () => {
    const sourceBefore = componentModule._source;
    editable.withMetaDo({ reconcileChanges: true }, () => editable.addMorph(part(descriptors.Q, { name: 'derived' })));
    await settle();
    expect(errors, 'derived part: nested inherited masters must serialize').deep.equals([]);
    expect(part(descriptors.C).get('derived').get('inner').get('deep').fill,
      'derived part: cold nested content must match the introduced content').equals(Color.orange);
    const sourceAfter = componentModule._source;
    manager.undo();
    expect(componentModule._source, 'derived part: undo restores exact source').equals(sourceBefore);
    expect(editable.get('derived'), 'derived part: undo removes the instance').equals(null);
    manager.redo();
    expect(componentModule._source, 'derived part: redo restores exact source').equals(sourceAfter);
    expect(editable.get('derived').get('inner').get('deep').fill,
      'derived part: redo restores nested content').equals(Color.orange);
  });

  it('S7-4 introduces Text containing morph and part embeds exactly once', async () => {
    const base = await open('A');
    const derived = await open('B');
    const embedded = morph({ name: 'embedded', fill: Color.blue });
    const embeddedPart = part(descriptors.Inner, { name: 'embedded part' });
    const text = new Text({ name: 'rich', textAndAttributes: ['before', null, embedded, null, 'between', null, embeddedPart, null] });
    base.withMetaDo({ reconcileChanges: true }, () => base.addMorph(text));
    await settle(base);
    expect(errors, 'embedded Text: introducing rich content must commit').deep.equals([]);
    const cold = part(descriptors.B).get('rich');
    expect(cold.textAndAttributes.filter(value => value?.isMorph).map(value => value.name),
      'embedded Text: both identities must appear once in a cold document').deep.equals(['embedded', 'embedded part']);
    expect(cold.submorphs.map(value => value.name), 'embedded Text: no structural duplicate').deep.equals(['embedded', 'embedded part']);
    expect(cold.get('embedded').fill, 'embedded Text: preserve the plain embed').equals(Color.blue);
    expect(cold.get('embedded part').get('deep').fill, 'embedded Text: preserve nested part content').equals(Color.orange);
    expect(derived.get('rich').submorphs.map(value => value.name),
      'embedded Text: the cached derived editable must contain each embed once').deep.equals(['embedded', 'embedded part']);
    const sourceAfter = componentModule._source;
    manager.undo();
    expect(base.get('rich'), 'embedded Text: undo removes the Text').equals(null);
    expect(derived.get('rich'), 'embedded Text: undo removes the derived Text').equals(null);
    manager.redo();
    expect(componentModule._source, 'embedded Text: redo restores exact source').equals(sourceAfter);
    expect(base.get('rich'), 'embedded Text: redo retains the original Text').equals(text);
  });

  it('suppression replaces the inherited override instead of keeping it before without', async () => {
    const derived = await open('B');
    const sourceBefore = componentModule._source;
    derived.withMetaDo({ reconcileChanges: true }, () => derived.get('box').remove());
    await settle(derived);
    const entries = property(definition('B').arguments[1], 'submorphs').elements;
    expect(entries.length, 'suppression: remove the stale override entry').equals(1);
    expect(entries[0].callee.name, 'suppression: retain only the without marker').equals('without');
    expect(part(descriptors.B).get('box'), 'suppression: cold instances omit the child').equals(null);
    manager.undo();
    await settle(derived);
    expect(componentModule._source, 'suppression: undo restores the exact original override').equals(sourceBefore);
    expect(derived.get('box').fill, 'suppression: undo restores the green runtime override').equals(Color.green);
    manager.redo();
    await settle(derived);
    expect(derived.get('box'), 'suppression: redo removes the child').equals(null);
    expect(errors, 'suppression: source, policy and replay must agree').deep.equals([]);
  });

  it('reintroduction restores the removed derived override without leaving it dormant', async () => {
    const base = await open('A');
    const derived = await open('B');
    const sourceBefore = componentModule._source;
    let removed;
    base.withMetaDo({ reconcileChanges: true }, () => { removed = base.get('box').remove(); });
    await settle(base);
    expect(property(definition('B').arguments[1], 'submorphs'),
      'reintroduction: D1(b) removes the override while the node is absent').equals(undefined);
    base.withMetaDo({ reconcileChanges: true }, () => base.addMorph(removed));
    await settle(base);
    expect(derived.get('box').fill, 'reintroduction: restore the earlier derived green override').equals(Color.green);
    expect(part(descriptors.B).get('box').fill, 'reintroduction: cold instances restore the override').equals(Color.green);
    const sourceAfter = componentModule._source;
    manager.undo();
    expect(derived.get('box'), 'reintroduction: undo insertion leaves the node absent').equals(null);
    manager.undo();
    expect(componentModule._source, 'reintroduction: undo removal restores the original source').equals(sourceBefore);
    manager.redo();
    manager.redo();
    expect(componentModule._source, 'reintroduction: redo both operations restores exact source').equals(sourceAfter);
    expect(derived.get('box').fill, 'reintroduction: redo restores the derived endpoint').equals(Color.green);
    expect(errors, 'reintroduction: restoration must not reject').deep.equals([]);
  });

  it('reintroduction restores surviving overrides and prunes deleted descendants', async () => {
    const base = await open('Tree');
    const derived = await open('TreeDerived');
    let branch;
    base.withMetaDo({ reconcileChanges: true }, () => { branch = base.get('branch').remove(); });
    await settle(base);
    expect(property(definition('TreeDerived').arguments[1], 'submorphs'),
      'reintroduction pruning: source has no dormant derived overrides').equals(undefined);
    branch.get('drop').remove();
    editable.withMetaDo({ reconcileChanges: true }, () => { editable.fill = Color.blue; });
    await settle();
    base.withMetaDo({ reconcileChanges: true }, () => base.addMorph(branch));
    await settle(base);
    expect(errors, 'reintroduction pruning: the surviving subtree must commit').deep.equals([]);
    expect(derived.get('keep').fill, 'reintroduction pruning: retain the surviving override').equals(Color.green);
    expect(derived.get('drop'), 'reintroduction pruning: discard the deleted descendant').equals(null);
    const cold = part(descriptors.TreeDerived);
    expect(cold.get('keep').fill, 'reintroduction pruning: cold instances retain the override').equals(Color.green);
    expect(cold.get('drop'), 'reintroduction pruning: cold instances omit the deleted descendant').equals(null);
    expect(part(descriptors.C).fill, 'reintroduction pruning: preserve an interleaved edit').equals(Color.blue);
  });

  it('reintroduces a part after its last inherited descendant was removed', async () => {
    const base = await open('A');
    const derived = await open('B');
    derived.withMetaDo({ reconcileChanges: true }, () => { derived.get('deep').fill = Color.blue; });
    await settle(derived);
    let removed;
    base.withMetaDo({ reconcileChanges: true }, () => { removed = base.get('some ref').remove(); });
    await settle(base);
    removed.get('deep').remove();
    base.withMetaDo({ reconcileChanges: true }, () => base.addMorph(removed));
    await settle(base);
    expect(errors, 'part reintroduction: dropping the last descendant must commit').deep.equals([]);
    expect(derived.get('some ref').submorphs, 'part reintroduction: the cached derived part must be empty').deep.equals([]);
    expect(part(descriptors.B).get('some ref').submorphs, 'part reintroduction: the cold part must be empty').deep.equals([]);
  });

  it('introduces a rich Text as an ordinary child of another Text', async () => {
    const base = await open('A');
    const derived = await open('B');
    base.withMetaDo({ reconcileChanges: true }, () => base.get('box').addMorph({
      type: Text, name: 'nested text', textAndAttributes: ['hello', null,
        morph({ name: 'plain embed', fill: Color.blue }), null,
        part(descriptors.C, { name: 'part embed' }), null]
    }));
    await settle(base);
    expect(errors, 'structural Text child: do not classify it as an inline embed').deep.equals([]);
    expect(part(descriptors.B).get('nested text').submorphs.map(node => node.name),
      'structural Text child: cold rich content must contain each embed once').deep.equals(['plain embed', 'part embed']);
    expect(derived.get('nested text').submorphs.length,
      'structural Text child: propagate rich content to the derived editable').equals(2);
  });

  for (const inline of [false, true]) {
    it(`allocates nested introduced names before derived runtime copies (${inline ? 'inline part' : 'plain hierarchy'})`, async () => {
      const base = await open('A');
      const derived = await open('B');
      const allocatedName = inline ? 'inner_1' : 'some ref_1';
      const introduced = inline
        ? part(descriptors.P, { name: 'introduced', submorphs: [add({ name: 'inner' })] })
        : morph({ name: 'introduced', submorphs: [{ name: 'some ref' }, { name: 'box' }] });
      base.withMetaDo({ reconcileChanges: true }, () => base.addMorph(introduced));
      await settle(base);
      expect(errors, 'names: allocated descendants must match their copied runtime nodes').deep.equals([]);
      expect(introduced.get(allocatedName), 'names: the introduced scope must contain the allocated descendant').to.be.ok;
      expect(derived.get('introduced').get(allocatedName), 'names: the derived editable must contain the allocated descendant').to.be.ok;
      expect(part(descriptors.B).get('introduced').get(allocatedName), 'names: cold instances must match').to.be.ok;
    });
  }

  it('removes an array entry with a comment before its comma without losing the comment', async () => {
    const target = await open('Commented');
    target.withMetaDo({ reconcileChanges: true }, () => target.get('first').remove());
    await settle(target);
    expect(errors, 'comment removal: the source must remain parseable').deep.equals([]);
    expect(componentModule._source, 'comment removal: preserve unrelated comment text').includes('/* keep this comment */');
    expect(part(descriptors.Commented).submorphs.map(child => child.name),
      'comment removal: cold children must match the removal').deep.equals(['second', 'third']);
    manager.undo();
    expect(target.submorphs.map(child => child.name), 'comment removal: undo restores child order').deep.equals(['first', 'second', 'third']);
  });

  it('ignores an inherited reattachment whose attachment and transform are unchanged', async () => {
    const derived = await open('B');
    const target = derived.get('box');
    const before = componentModule._source;
    derived.withMetaDo({ reconcileChanges: true }, () => derived.addMorph(target, derived.submorphs[1]));
    await settle(derived);
    expect(errors, 'unchanged attachment: an inherited no-op must not reject').deep.equals([]);
    expect(componentModule._source, 'unchanged attachment: source remains exact').equals(before);
    expect(derived.get('box'), 'unchanged attachment: retain the same child').equals(target);
  });

  it('refreshes session owner subscriptions when an ancestor is reparented', async () => {
    const left = morph({ name: 'left' });
    const right = morph({ name: 'right' });
    const parent = morph({ name: 'parent' });
    left.openInWorld();
    right.openInWorld();
    opened.push(left, right, parent);
    left.addMorph(parent);
    parent.addMorph(editable);
    const tracker = editable._changeTracker;
    right.addMorph(parent);
    expect(tracker._sessionOwners.includes(right), 'owner chain: subscribe to the new ancestor').equals(true);
    expect(tracker._sessionOwners.includes(left), 'owner chain: release the old ancestor').equals(false);
    right.remove();
    await promise.delay(25);
    expect(editable._changeTracker, 'owner chain: removal under the new ancestor closes the session').equals(undefined);
    expect(editable.env.changeManager.committedChangeListeners,
      'owner chain: the detached tracker must unsubscribe').not.includes(tracker._committedChangeListener);
    expect(descriptors.C._cachedComponent, 'owner chain: detachment clears the cached session').equals(null);
  });

  for (const name of ['B', 'C']) {
    it(`compares a supported shadow using its ${name === 'B' ? 'parent' : 'part'} source context`, async () => {
      const target = name === 'B' ? await open('B') : editable;
      target.withMetaDo({ reconcileChanges: true }, () => {
        if (name === 'B') target.get('box').opacity = 0.5;
        else target.addMorph(part(descriptors.P, { name: 'pinst' }));
      });
      await settle(target);
      const projection = target._changeTracker.lastShadowCommandBatch.shadowProjection;
      expect(projection.supported, 'shadow: the actual edit must project').equals(true);
      const comparison = compareShadowProjectionToCurrentSource(projection, componentModule._source);
      expect(comparison.matches, 'shadow: reparse must retain the parent and part resolvers').equals(true);
      expect(errors, 'shadow: comparison must follow a successful commit').deep.equals([]);
    });
  }
});
