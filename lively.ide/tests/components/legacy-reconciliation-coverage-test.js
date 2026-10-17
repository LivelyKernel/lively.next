/* global afterEach, beforeEach, describe, it, System, $world */
import { expect } from 'mocha-es6';
import { createFiles, resource } from 'lively.resources';
import module from 'lively.modules/src/module.js';
import { Color } from 'lively.graphics';
import { Morph, morph, part } from 'lively.morphic';
import { add } from 'lively.morphic/components/core.js';
import { InteractiveComponentDescriptor } from '../../components/editor.js';
import { releaseComponentEditingState } from './test-isolation.js';

const directory = 'local://legacy-reconciliation-coverage-test/';
const sources = {
  A: `import { component } from 'lively.morphic/components/core.js';
import { Text } from 'lively.morphic';
import { Color, pt } from 'lively.graphics';
const A = component({ name: 'a', fill: Color.red, submorphs: [
  { name: 'shared', fill: Color.yellow }, { name: 'other', fill: Color.green },
  { type: Text, name: 'text', textString: 'yo bro!', readOnly: false,
    fixedWidth: true, fixedHeight: true, extent: pt(200, 100) }
] });
export { A };`,
  B: `import { component } from 'lively.morphic/components/core.js';
import { Color } from 'lively.graphics';
const B = component({ name: 'b', fill: Color.blue, submorphs: [
  { name: 'shared', fill: Color.cyan }
] });
export { B };`
};

describe('legacy component editing coverage', () => {
  releaseComponentEditingState();
  const modules = new Map();
  const descriptors = new Map();
  const editables = new Map();
  const instances = [];
  let manager, showError;
  const errors = [];

  beforeEach(async () => {
    await createFiles(directory, Object.fromEntries(Object.entries(sources)
      .map(([name, source]) => [name + '.cp.js', source])));
    for (const name of Object.keys(sources)) {
      const componentModule = module(System, directory + name + '.cp.js');
      modules.set(name, componentModule);
      const exports = await componentModule.load();
      descriptors.set(name, InteractiveComponentDescriptor.ensureInteractive(exports[name]));
    }
    showError = $world.showError;
    errors.length = 0;
    $world.showError = error => errors.push(String(error));
    await open('A');
    manager = editables.get('A').env.undoManager;
    manager.reset();
  });

  afterEach(async () => {
    $world.showError = showError;
    for (const descriptor of descriptors.values()) descriptor.stopEditSession();
    for (const editable of editables.values()) editable.remove();
    instances.splice(0).forEach(instance => instance.remove());
    manager?.undoStop();
    manager?.reset();
    for (const componentModule of modules.values()) {
      await componentModule.unload();
      await System._livelyModulesTranslationCache.deleteCachedData(componentModule.id);
    }
    modules.clear();
    descriptors.clear();
    editables.clear();
    await resource(directory).remove();
  });

  /** Open an actual source-backed session, including its world lifecycle. */
  async function open (name) {
    const editable = await descriptors.get(name).edit();
    editables.set(name, editable);
    editable.openInWorld();
    return editable;
  }

  /** Wait for both sessions so no edit can borrow stale module text. */
  async function processed () {
    for (const editable of editables.values()) await editable._changeTracker.onceChangesProcessed();
  }

  /** Capture both module texts to detect cross-session writes during replay. */
  function currentSources () {
    return [...modules].map(([name, componentModule]) => [name, componentModule._source]);
  }

  /** Compare the committed policy with a fresh instance. */
  function cold (name) {
    const instance = part(descriptors.get(name));
    instances.push(instance);
    instance.master.applyIfNeeded(true);
    return instance;
  }

  /** Replay every entry created by the test and require exact source boundaries. */
  async function roundTrip (before, check, checkUndone = () => {}) {
    const after = currentSources();
    const count = manager.undos.length;
    expect(count).above(0);
    for (let index = 0; index < count; index++) {
      manager.undo();
      await processed();
    }
    expect(currentSources()).deep.equals(before);
    checkUndone();
    for (let index = 0; index < count; index++) {
      manager.redo();
      await processed();
    }
    expect(currentSources()).deep.equals(after);
    check();
    expect(errors).deep.equals([]);
  }

  it('legacy 318 keeps interleaved sessions in separate modules and independent undo', async () => {
    const a = editables.get('A');
    const b = await open('B');
    const states = [currentSources()];
    for (const [target, fill] of [[a, Color.orange], [b, Color.purple],
      [a, Color.black], [b, Color.green]]) {
      target.withMetaDo({ reconcileChanges: true }, () => { target.fill = fill; });
      await processed();
      states.push(currentSources());
    }
    expect(manager.undos).has.length(4);
    manager.undo();
    await processed();
    expect(currentSources()).deep.equals(states[3]);
    expect(a.fill).equals(Color.black);
    expect(b.fill).equals(Color.purple);
    manager.redo();
    await processed();
    const check = () => {
      expect(a.fill).equals(Color.black);
      expect(b.fill).equals(Color.green);
      expect(cold('A').fill).equals(a.fill);
      expect(cold('B').fill).equals(b.fill);
    };
    check();
    await roundTrip(states[0], check);
  });

  it('legacy 370 scopes a same-named child edit to its containing part master', async () => {
    const a = editables.get('A');
    const b = await open('B');
    const before = currentSources();
    b.withMetaDo({ reconcileChanges: true }, () => b.addMorph({ name: 'from session', fill: Color.red }));
    await processed();
    const bSource = modules.get('B')._source;
    const trap = part(descriptors.get('B'), { name: 'name trap' });
    a.withMetaDo({ reconcileChanges: true }, () => a.addMorph(trap));
    await processed();
    trap.withMetaDo({ reconcileChanges: true }, () => { trap.get('shared').fill = Color.black; });
    await processed();
    const check = () => {
      expect(modules.get('B')._source).equals(bSource);
      expect(a.get('shared').fill).equals(Color.yellow);
      expect(b.get('shared').fill).equals(Color.cyan);
      expect(trap.get('shared').fill).equals(Color.black);
      expect(cold('A').get('name trap').get('shared').fill).equals(Color.black);
      expect(cold('A').get('shared').fill).equals(Color.yellow);
      expect(cold('B').get('shared').fill).equals(Color.cyan);
      expect(cold('A').get('name trap').get('from session').fill).equals(Color.red);
    };
    check();
    await roundTrip(before, check);
  });

  it('legacy 683 inserts and deletes newlines through native Text commands', async () => {
    const text = editables.get('A').get('text');
    const before = currentSources();
    text.cursorPosition = { row: 0, column: 0 };
    for (const string of ['hello', '\n', 'r', '\n', 'o']) {
      text.execCommand('insertstring', { string });
      await processed();
    }
    expect(text.textString).equals('hello\nr\noyo bro!');
    expect(cold('A').get('text').textString).equals(text.textString);
    text.execCommand('delete backwards');
    text.execCommand('delete backwards');
    await processed();
    const check = () => {
      expect(text.textString).equals('hello\nryo bro!');
      expect(cold('A').get('text').textString).equals(text.textString);
    };
    check();
    await roundTrip(before, check);
  });

  it('legacy 703 reconciles forward DEL through its native Text command', async () => {
    const text = editables.get('A').get('text');
    const before = currentSources();
    text.cursorPosition = { row: 0, column: 0 };
    text.execCommand('delete');
    await processed();
    const check = () => {
      expect(text.textString).equals('o bro!');
      expect(cold('A').get('text').textString).equals('o bro!');
    };
    check();
    await roundTrip(before, check);
  });

  it('keeps an embedded replacement atomic when the old morph has already left the text', async () => {
    const text = editables.get('A').get('text');
    await text.whenFontLoaded();
    text.withMetaDo({ reconcileChanges: true }, () => {
      text.textAndAttributes = [morph({ name: 'embedded', fill: Color.cyan }), null];
    });
    await processed();
    manager.reset();
    const before = currentSources();
    text.withMetaDo({ reconcileChanges: true }, () => {
      text.textAndAttributes = [morph({ name: 'embedded', fill: Color.orange }), null];
    });
    await processed();
    const check = () => {
      expect(text.textAndAttributes[0].fill).equals(Color.orange);
      expect(cold('A').get('text').textAndAttributes[0].fill).equals(Color.orange);
    };
    check();
    expect(manager.undos).has.length(1);
    await roundTrip(before, check, () => {
      expect(text.textAndAttributes[0].fill).equals(Color.cyan);
      expect(cold('A').get('text').textAndAttributes[0].fill).equals(Color.cyan);
    });
  });

  it('compensates an unsupported introduction in an open editable exactly once', async () => {
    const a = editables.get('A');
    a.withMetaDo({ reconcileChanges: true }, () => { a.fill = Color.orange; });
    await processed();
    const before = currentSources();
    const policySpec = descriptors.get('A').stylePolicy.spec;
    expect(manager.undos).has.length(1);
    class SourceLessMorph extends Morph {}
    SourceLessMorph[Symbol.for('lively-module-meta')] = null;
    const unsupported = new SourceLessMorph({ name: 'unsupported' });
    a.withMetaDo({ reconcileChanges: true }, () => a.addMorph(unsupported));
    let rejection;
    try { await processed(); } catch (error) { rejection = error; }
    expect(rejection).to.be.instanceOf(Error);
    expect(errors).has.length(1);
    expect(currentSources()).deep.equals(before);
    expect(descriptors.get('A').stylePolicy.spec).equals(policySpec);
    expect(unsupported.owner).equals(null);
    expect(a.submorphs.map(child => child.name)).deep.equals(cold('A').submorphs.map(child => child.name));
    expect(manager.undos).has.length(1);
    expect(manager.undoInProgress).equals(null);
    manager.undo();
    await processed();
    expect(a.fill).equals(Color.red);
    manager.redo();
    await processed();
    expect(a.fill).equals(Color.orange);
    expect(currentSources()).deep.equals(before);
    a.withMetaDo({ reconcileChanges: true }, () => { a.fill = Color.purple; });
    await processed();
    expect(cold('A').fill).equals(Color.purple);
    expect(errors).has.length(1);
  });

  it('legacy 869 allocates names throughout an introduced hierarchy', async () => {
    const a = editables.get('A');
    const before = currentSources();
    const policyBefore = descriptors.get('A').stylePolicy.spec;
    const bundle = morph({ name: 'bundle', submorphs: [
      { name: 'shared', fill: Color.orange }, { name: 'other', fill: Color.purple }
    ] });
    a.withMetaDo({ reconcileChanges: true }, () => a.addMorph(bundle));
    await processed();
    const check = () => {
      expect(bundle.submorphs.map(child => child.name)).deep.equals(['shared_1', 'other_1']);
      expect(cold('A').get('bundle').submorphs.map(child => child.name))
        .deep.equals(['shared_1', 'other_1']);
      expect(a.get('shared').fill).equals(Color.yellow);
      expect(a.get('other').fill).equals(Color.green);
    };
    check();
    await roundTrip(before, check, () => {
      expect(bundle.owner).equals(null);
      expect(descriptors.get('A').stylePolicy.spec).equals(policyBefore);
      expect(bundle.submorphs.map(child => child.name)).deep.equals(['shared', 'other']);
    });
  });

  it('legacy 884 allocates an inline addition without renaming inherited children', async () => {
    const a = editables.get('A');
    const before = currentSources();
    const policyBefore = descriptors.get('A').stylePolicy.spec;
    const inline = part(descriptors.get('B'), { name: 'inline',
      submorphs: [add({ name: 'shared', fill: Color.orange })] });
    a.withMetaDo({ reconcileChanges: true }, () => a.addMorph(inline));
    await processed();
    const check = () => {
      expect(inline.submorphs.map(child => child.name)).deep.equals(['shared', 'shared_1']);
      expect(inline.get('shared').fill).equals(Color.cyan);
      expect(inline.get('shared_1').fill).equals(Color.orange);
      expect(cold('A').get('inline').submorphs.map(child => child.name))
        .deep.equals(['shared', 'shared_1']);
    };
    check();
    await roundTrip(before, check, () => {
      expect(inline.owner).equals(null);
      expect(descriptors.get('A').stylePolicy.spec).equals(policyBefore);
      expect(inline.submorphs.map(child => child.name)).deep.equals(['shared', 'shared']);
    });
  });
});
