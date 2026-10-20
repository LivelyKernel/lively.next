/* global afterEach, beforeEach, describe, it, System, $world */
import { expect } from 'mocha-es6';
import { createFiles, resource } from 'lively.resources';
import module from 'lively.modules/src/module.js';
import { promise } from 'lively.lang';
import { Color, pt } from 'lively.graphics';
import { Label, Text, part } from 'lively.morphic';
import { InteractiveComponentDescriptor } from '../../components/editor.js';
import { parseComponentSource } from '../../components/reconciliation/source-adapter.js';
import { releaseComponentEditingState } from './test-isolation.js';

const directory = 'local://projectional-review-regressions/';
const moduleId = `${directory}components.cp.js`;
const initialSource = `import { component } from 'lively.morphic/components/core.js';
import { Color, pt } from 'lively.graphics';
const A = component({ name: 'a', fill: Color.red, submorphs: [{ name: 'box', fill: Color.yellow, position: pt(10, 20) }] });
const B = component(A, { name: 'b', submorphs: [{ name: 'box', fill: Color.green }] });
const C = component({ name: 'c', submorphs: [{ name: 'box', position: pt(30, 40) }] });
export { A, B, C };`;

describe('projectional component review regressions', function () {
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
    descriptors = Object.fromEntries(['A', 'B', 'C'].map(name =>
      [name, InteractiveComponentDescriptor.ensureInteractive(exports[name])]));
    editable = await open('A');
    manager = editable.env.undoManager;
    manager.reset();
  });

  afterEach(async () => {
    Object.values(descriptors || {}).forEach(descriptor => descriptor.stopEditSession());
    opened.splice(0).forEach(morph => {
      morph._changeTracker?.dispose();
      morph.remove();
    });
    $world.halos().forEach(halo => halo.remove());
    manager?.undoStop();
    manager?.reset();
    await componentModule?.unload();
    await resource(directory).remove();
    await System._livelyModulesTranslationCache.deleteCachedData(moduleId);
    $world.showError = showError;
    $world.logError = logError;
  });

  /** Open the actual descriptor's editing session in the test world. */
  async function open (name) {
    const morph = await descriptors[name].edit();
    morph.openInWorld();
    opened.push(morph);
    return morph;
  }

  /** Wait for source reconciliation and deferred session cleanup. */
  async function settle (morph = editable) {
    await morph._changeTracker?.onceChangesProcessed();
    await promise.delay(30);
    await morph._changeTracker?.onceChangesProcessed();
  }

  for (const close of ['halo', 'multi-selection halo', 'Delete key']) {
    it(`B1 closes an editable through ${close} and undo restores a working session`, async () => {
      const targets = close === 'multi-selection halo' ? [editable, await open('C')] : [editable];
      const trackers = targets.map(target => target._changeTracker);
      const world = editable.world();
      const halo = world.showHaloFor(targets.length === 1 ? editable : targets);
      manager.reset();
      if (close === 'Delete key') await world.simulateKeys('Delete');
      else halo.closeSession();
      await promise.delay(30);
      for (const [index, target] of targets.entries()) {
        expect(target.world(), `${close}: editable must leave the world`).equals(null);
        expect(target._changeTracker, `${close}: detached session must release its tracker`).equals(undefined);
        expect(target.env.changeManager.committedChangeListeners,
          `${close}: detached tracker must unsubscribe`).not.includes(trackers[index]._committedChangeListener);
      }
      expect(descriptors.A._cachedComponent, `${close}: descriptor cache must close`).equals(null);
      expect(errors, `${close}: close must not reject or compensate removal`).deep.equals([]);
      expect(manager.undos, `${close}: close must occupy one undo slot`).has.length(1);
      expect(componentModule._source, `${close}: closing a session must not edit its definition`).equals(initialSource);
      manager.undo();
      await promise.delay(30);
      for (const target of targets) {
        expect(target.world(), `${close}: undo must restore the original editable`).equals(world);
        expect(target._changeTracker, `${close}: undo must restore an active tracker`).to.be.ok;
        expect(target._changeTracker.componentDescriptor._cachedComponent,
          `${close}: undo must restore the descriptor cache`).equals(target);
      }
      manager.redo();
      await promise.delay(30);
      targets.forEach(target => expect(target.world(), `${close}: redo must close again`).equals(null));
      manager.undo();
      await promise.delay(30);
      for (const target of targets) {
        target.withMetaDo({ reconcileChanges: true }, () => { target.get('box').position = pt(15, 30); });
        await settle(target);
      }
      expect(componentModule._source, `${close}: the restored session must reconcile subsequent edits`)
        .matches(/position: pt\(15,\s*30\)/);
      for (const target of targets) {
        expect(target._changeTracker.lastShadowCommandBatch?.commitDiagnostic,
          `${close}: restored session must commit subsequent edits`).equals(undefined);
      }
      expect(errors, `${close}: undo and subsequent editing must not report errors`).deep.equals([]);
    });
  }

  it('S7-1 serializes a plain introduced morph with only its canonical properties', async () => {
    editable.withMetaDo({ reconcileChanges: true }, () => {
      editable.addMorph({ name: 'plain', fill: Color.blue });
    });
    await settle();
    const parsed = parseComponentSource({ source: componentModule._source, moduleId, exportName: 'A' });
    const introduced = parsed.document.root.children.find(node => node.name === 'plain');
    expect(Object.keys(introduced.properties), 'plain: transient and default state must not enter the source')
      .deep.equals(['fill']);
    expect(introduced.properties.fill.expression, 'plain: the explicit fill must survive canonicalization').equals('Color.blue');
    expect(componentModule._source, 'plain: serialized source must omit transient state')
      .not.matches(/positionOnCanvas|scrollbarOffset|styleClasses/);
    expect(errors, 'plain: canonical serialization must commit').deep.equals([]);
  });

  for (const Type of [Label, Text]) {
    it(`S7-1 serializes introduced ${Type.name} text once without measured extent`, async () => {
      const text = new Type({ name: 'introduced text', textString: 'hello' });
      text.openInWorld();
      opened.push(text);
      await text.whenRendered();
      text.remove();
      editable.withMetaDo({ reconcileChanges: true }, () => editable.addMorph(text));
      await settle();
      const parsed = parseComponentSource({ source: componentModule._source, moduleId, exportName: 'A' });
      const properties = parsed.document.root.children.find(node => node.name === 'introduced text').properties;
      expect(properties, `${Type.name}: measured extent is not an explicit style override`).not.haveOwnProperty('extent');
      expect(properties, `${Type.name}: textString must not duplicate textAndAttributes`).not.haveOwnProperty('textString');
      expect(properties.textAndAttributes.value, `${Type.name}: canonical text content must survive`).deep.equals(['hello', null]);
      expect(componentModule._source, `${Type.name}: source must omit transient state`)
        .not.matches(/positionOnCanvas|scrollbarOffset|styleClasses/);
      const instance = part(descriptors.A);
      expect(instance.get('introduced text').textString, `${Type.name}: a fresh part must have the same text`).equals('hello');
      expect(errors, `${Type.name}: canonical serialization must commit`).deep.equals([]);
    });
  }

  it('S7-3 clears a derived override when the property returns to its inherited value', async () => {
    const derived = await open('B');
    derived.withMetaDo({ reconcileChanges: true }, () => { derived.get('box').fill = Color.yellow; });
    await settle(derived);
    expect(componentModule._source, 'inherited fill: remove the empty child override, as in legacy reconciliation')
      .includes("const B = component(A, { name: 'b' });");
    expect(descriptors.B.stylePolicy.spec.submorphs?.[0]?.fill,
      'inherited fill: the policy must not retain the local override').equals(undefined);
    expect(part(descriptors.B).get('box').fill, 'inherited fill: fresh instances must inherit yellow').equals(Color.yellow);
    expect(errors, 'inherited fill: clearing the override must commit without error').deep.equals([]);
  });
});
