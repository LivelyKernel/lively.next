/* global afterEach, beforeEach, describe, it, System, $world */
import { expect } from 'mocha-es6';
import { createFiles, resource } from 'lively.resources';
import module from 'lively.modules/src/module.js';
import { promise } from 'lively.lang';
import { Color } from 'lively.graphics';
import { InteractiveComponentDescriptor } from '../../components/editor.js';
import { releaseComponentEditingState } from './test-isolation.js';

const directory = 'local://reintroduction-lifetime-tests/';
const moduleId = directory + 'lib.cp.js';
const source = `import { component } from 'lively.morphic/components/core.js';
import { Color } from 'lively.graphics';
const A = component({ name: 'A', submorphs: [
  { name: 'box', fill: Color.yellow }, { name: 'holder' }
] });
const B = component(A, { name: 'B', submorphs: [{ name: 'box', fill: Color.green }] });
export { A, B };`;

describe('component reintroduction receipt lifetime', function () {
  this.timeout(60000);
  releaseComponentEditingState();
  let mod, descriptors, manager, errors, showError, logError;
  const opened = [];

  beforeEach(async () => {
    errors = [];
    showError = $world.showError;
    logError = $world.logError;
    $world.showError = $world.logError = error => errors.push(error.message || String(error));
    await createFiles(directory, { 'lib.cp.js': source });
    mod = module(System, moduleId);
    const exports = await mod.load();
    descriptors = Object.fromEntries(Object.entries(exports).map(([name, descriptor]) =>
      [name, InteractiveComponentDescriptor.ensureInteractive(descriptor)]));
  });

  afterEach(async () => {
    Object.values(descriptors || {}).forEach(descriptor => descriptor.stopEditSession());
    opened.splice(0).forEach(morph => { morph._changeTracker?.dispose(); morph.remove(); });
    manager?.undoStop();
    manager?.reset();
    await mod.unload();
    await resource(directory).remove();
    await System._livelyModulesTranslationCache.deleteCachedData(moduleId);
    $world.showError = showError;
    $world.logError = logError;
  });

  const open = async name => {
    const morph = await descriptors[name].edit();
    morph.openInWorld();
    opened.push(morph);
    manager = morph.env.undoManager;
    return morph;
  };

  const settle = async morph => {
    await morph._changeTracker?.onceChangesProcessed();
    await promise.delay(20);
    expect(errors, 'component edits and history replay must not report errors').deep.equals([]);
  };

  const edit = async (morph, label, callback) => {
    morph.undoStart(label);
    try {
      morph.withMetaDo({ reconcileChanges: true }, callback);
      await settle(morph);
    } finally { morph.undoStop(); }
  };

  const removeBox = async base => {
    let removed;
    await edit(base, 'remove box', () => { removed = base.get('box').remove(); });
    const receipt = descriptors.A.previouslyRemovedMorphs?.get(removed);
    expect(receipt?.size, 'removal must retain the derived override for reintroduction').equals(1);
    const [entry] = receipt.values();
    expect(typeof entry.projection.document.sourceMetadata.resolveComponentDocument,
      'the receipt exercises a document resolver that retains its tracker').equals('function');
    return removed;
  };

  for (const closeDirectly of [false, true]) {
    it('releases document receipts on ' + (closeDirectly ? 'tracker dispose' : 'session close'), async () => {
      const base = await open('A');
      const derived = await open('B');
      manager.reset();
      const removed = await removeBox(base);
      removed.openInWorld();
      opened.push(removed);
      if (closeDirectly) {
        base._changeTracker.dispose();
        derived._changeTracker.dispose();
      } else {
        descriptors.A.stopEditSession();
        descriptors.B.stopEditSession();
      }
      manager.reset();
      expect(!!removed.world(), 'the WeakMap key must remain live after history reset').equals(true);
      expect(base._changeTracker, 'the base tracker must be closed').equals(undefined);
      expect(derived._changeTracker, 'the derived tracker must be closed').equals(undefined);
      expect(descriptors.A.previouslyRemovedMorphs?.get(removed),
        'closed sessions must not retain projection documents or their tracker resolver closures').equals(undefined);
    });
  }

  for (const newParent of [false, true]) {
    it('consumes a successful receipt and replays exact endpoints ' + (newParent ? 'under another parent' : 'at its old parent'), async () => {
      const base = await open('A');
      const derived = await open('B');
      manager.reset();
      const removed = await removeBox(base);
      const sourceRemoved = mod._source;
      await edit(base, 'reintroduce box', () => {
        if (newParent) base.get('holder').addMorph(removed);
        else base.addMorphAt(removed, 0);
      });
      const sourceRestored = mod._source;
      const owner = newParent ? 'holder' : base.name;
      expect(removed.owner.name, 'the original morph must reach the requested owner').equals(owner);
      expect(String(derived.get('box').fill), 'reintroduction must preserve the derived override').equals(String(Color.green));
      expect(descriptors.A.previouslyRemovedMorphs?.get(removed),
        'a successfully consumed receipt must release its document resolver closures').equals(undefined);
      expect(manager.undos.length, 'removal and reintroduction must keep their two history entries').equals(2);

      manager.undo();
      await settle(base);
      expect(mod._source, 'undo must restore the exact removed source').equals(sourceRemoved);
      expect(base.get('box'), 'undo must remove the reintroduced base node').equals(null);
      expect(derived.get('box'), 'undo must remove the reintroduced derived node').equals(null);
      manager.redo();
      await settle(base);
      expect(mod._source, 'redo must restore the exact reintroduced source').equals(sourceRestored);
      expect(base.get('box'), 'redo must retain original base morph identity').equals(removed);
      expect(removed.owner.name, 'redo must restore the exact owner').equals(owner);
      expect(String(derived.get('box').fill), 'redo must restore the derived override').equals(String(Color.green));
      expect(derived.get('box').owner.name, 'redo must restore the derived owner').equals(newParent ? 'holder' : derived.name);
    });
  }

  it('never reuses a consumed override after it was reset to the inherited value', async () => {
    const base = await open('A');
    const derived = await open('B');
    manager.reset();
    let removed = await removeBox(base);
    await edit(base, 'reintroduce box', () => base.addMorphAt(removed, 0));
    await edit(derived, 'clear override', () => { derived.get('box').fill = Color.yellow; });
    await edit(base, 'remove again', () => { removed = base.get('box').remove(); });
    await edit(base, 'reintroduce again', () => base.addMorphAt(removed, 0));
    expect(mod._source.slice(mod._source.indexOf('const B')),
      'a consumed receipt must never restore the old green override').not.match(/green/);
    expect(String(derived.get('box').fill), 'the derived node must inherit the reset value').equals(String(Color.yellow));
  });
});
