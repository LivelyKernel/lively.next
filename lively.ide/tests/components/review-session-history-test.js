/* global afterEach, beforeEach, describe, it, System, $world */
import { expect } from 'mocha-es6';
import { createFiles, resource } from 'lively.resources';
import module from 'lively.modules/src/module.js';
import { morph, part } from 'lively.morphic';
import { Color, pt } from 'lively.graphics';
import { InteractiveComponentDescriptor } from '../../components/editor.js';
import { releaseComponentEditingState } from './test-isolation.js';

const directory = 'local://review-session-history-test/';
const header = `import { component, ComponentDescriptor } from 'lively.morphic/components/core.js';
import { InteractiveComponentDescriptor } from 'lively.ide/components/editor.js';
import { Color, pt } from 'lively.graphics';
component.DescriptorClass = InteractiveComponentDescriptor;
`;
const footer = '\ncomponent.DescriptorClass = ComponentDescriptor;\n';
const source = header + `
export const A = component({ name: 'a', submorphs: [{ name: 'box', position: pt(10, 20) }] });
export const B = component({ name: 'b', submorphs: [{ name: 'box', position: pt(30, 40) }] });
` + footer;

describe('shared module session history disposal', () => {
  releaseComponentEditingState();
  let modules, descriptors, editables, instances, manager, notices, errors;
  let showError, logError, showStatusMessage;

  beforeEach(async () => {
    modules = new Map();
    descriptors = {};
    editables = {};
    instances = [];
    notices = [];
    errors = [];
    showError = $world.showError;
    logError = $world.logError;
    showStatusMessage = $world.showStatusMessage;
    $world.showError = error => errors.push(error);
    $world.logError = error => errors.push(error);
    $world.showStatusMessage = message => notices.push(message);
    await load('two.cp.js', source);
    await open('A');
    await open('B');
    manager = editables.A.env.undoManager;
    manager.reset();
  });

  afterEach(async () => {
    Object.values(descriptors).forEach(descriptor => descriptor.stopEditSession());
    Object.values(editables).forEach(editable => editable.remove());
    instances.forEach(instance => instance.remove());
    manager?.undoStop();
    manager?.reset();
    for (const componentModule of [...modules.values()].reverse()) {
      await componentModule.unload();
      await System._livelyModulesTranslationCache.deleteCachedData(componentModule.id);
    }
    await resource(directory).remove();
    $world.showError = showError;
    $world.logError = logError;
    $world.showStatusMessage = showStatusMessage;
  });

  /** Load real sibling and derived component modules for replay. */
  async function load (file, text) {
    await createFiles(directory, { [file]: text });
    const componentModule = module(System, directory + file);
    modules.set(file, componentModule);
    Object.assign(descriptors, await componentModule.load());
  }

  /** Start the real editable session and committed listener. */
  async function open (name) {
    const descriptor = InteractiveComponentDescriptor.ensureInteractive(descriptors[name]);
    descriptors[name] = descriptor;
    const editable = await descriptor.edit();
    editable.openInWorld();
    editables[name] = editable;
    return editable;
  }

  /** Await authoritative source work and the diagnostic comparison. */
  async function processed (name) {
    const tracker = editables[name]._changeTracker;
    await tracker.onceChangesProcessed();
    await tracker._shadowComparisonPromise;
    expect(errors, 'real reconciliation must not report an error').to.be.empty;
  }

  /** Use the ordinary reconciled gesture group. */
  async function edit (name, callback) {
    const editable = editables[name];
    editable.undoStart(`edit ${name}`);
    try {
      editable.withMetaDo({ reconcileChanges: true }, () => callback(editable));
      await processed(name);
    } finally { editable.undoStop(); }
  }

  /** Record a distinct scalar source endpoint. */
  function move (name, x) {
    return edit(name, editable => { editable.get('box').position = pt(x, x * 2); });
  }

  /** Keep a plain Morph history control outside the source domains. */
  function unrelatedEdit () {
    const other = morph({ fill: Color.red });
    instances.push(other);
    other.undoStart('unrelated fill');
    other.fill = Color.green;
    return { other, entry: other.undoStop() };
  }

  /** Capture exact module strings without triggering a reload. */
  function sources () {
    return [...modules].map(([file, componentModule]) => [file, componentModule._source]);
  }

  /** Require live and cold policy endpoints to agree after pruning. */
  function expectPosition (name, x) {
    const cold = part(descriptors[name]);
    instances.push(cold);
    expect(editables[name].get('box').position, `${name}'s live endpoint must be kept`).deep.equals(pt(x, x * 2));
    expect(cold.get('box').position, `${name}'s cold policy endpoint must agree`).deep.equals(pt(x, x * 2));
  }

  /** Pruning another session's history must have a visible result. */
  function expectNotice () {
    expect(notices, 'shared-source pruning must be visible to the user').has.length(1);
    expect(notices[0]).includes('cleared undo and redo');
    expect(notices[0]).includes('Current edits were kept');
  }

  it('control: replays two live sessions in exact module chronology', async () => {
    const before = sources();
    await move('A', 11);
    await move('B', 33);
    const after = sources();
    manager.undo();
    await processed('B');
    manager.undo();
    await processed('A');
    expect(sources(), 'both undos must restore the original module').deep.equals(before);
    manager.redo();
    await processed('A');
    manager.redo();
    await processed('B');
    expect(sources(), 'both redos must restore the final module').deep.equals(after);
    expectPosition('A', 11);
    expectPosition('B', 33);
  });

  it('clears dependent undos when B closes instead of leaving A stuck', async () => {
    await move('A', 11);
    await move('B', 33);
    const after = sources();
    descriptors.B.stopEditSession();
    expect(() => manager.undo(), 'closing B must never leave a throwing A undo').not.to.throw();
    expect(manager.undos, 'all exact-source dependants must be removed together').to.be.empty;
    expect(manager.redos, 'pruning must not create redo entries').to.be.empty;
    expect(sources(), 'closing a session must keep the current module text').deep.equals(after);
    expectPosition('A', 11);
    expectPosition('B', 33);
    expectNotice();
  });

  it('clears dependent redos when B closes after both edits were undone', async () => {
    await move('B', 33);
    await move('A', 11);
    manager.undo();
    await processed('A');
    manager.undo();
    await processed('B');
    const before = sources();
    descriptors.B.stopEditSession();
    expect(() => manager.redo(), 'closing B must never leave a throwing A redo').not.to.throw();
    expect(manager.redos, 'dependent redo snapshots must be pruned too').to.be.empty;
    expect(manager.undos, 'pruned redo must not become undo').to.be.empty;
    expect(sources(), 'pruning redos must not replay source changes').deep.equals(before);
    expectNotice();
  });

  it('prunes interleaved module edits inside a composite but keeps unrelated chronology', async () => {
    const { other } = unrelatedEdit();
    await move('A', 11);
    await move('B', 33);
    other.undoStart('unrelated second fill');
    other.fill = Color.blue;
    other.undoStop();
    await move('A', 12);
    await move('B', 34);
    manager.group();
    const after = sources();
    descriptors.B.stopEditSession();
    expect(manager.undos, 'the surviving unrelated composite must occupy one slot').has.length(1);
    expect(() => manager.undo(), 'interleaved component snapshots must not poison composite undo').not.to.throw();
    expect(other.fill, 'unrelated writes must undo in their original order').equals(Color.red);
    expect(sources()).deep.equals(after);
    manager.redo();
    expect(other.fill, 'unrelated writes must redo in their original order').equals(Color.blue);
    expect(sources()).deep.equals(after);
    expectPosition('A', 12);
    expectPosition('B', 34);
    expectNotice();
  });

  it('prunes both stacks while preserving unrelated undo and redo entries', async () => {
    const { other, entry } = unrelatedEdit();
    await move('A', 11);
    await move('B', 33);
    const { other: later, entry: laterEntry } = unrelatedEdit();
    manager.undo();
    manager.undo();
    await processed('B');
    const after = sources();
    descriptors.B.stopEditSession();
    expect(manager.undos, 'earlier unrelated undo identity must survive').deep.equals([entry]);
    expect(manager.redos, 'later unrelated redo identity must survive').deep.equals([laterEntry]);
    manager.undo();
    expect(other.fill).equals(Color.red);
    manager.redo();
    manager.redo();
    expect(other.fill).equals(Color.green);
    expect(later.fill).equals(Color.green);
    expect(sources(), 'unrelated replay must leave both component endpoints intact').deep.equals(after);
    expectNotice();
  });

  it('keeps an independent module replayable after pruning shared-module history', async () => {
    await load('other.cp.js', header + `export const Other = component({ name: 'other', submorphs: [{ name: 'box', position: pt(5, 10) }] });` + footer);
    await open('Other');
    await move('A', 11);
    await move('Other', 6);
    await move('B', 33);
    const afterShared = modules.get('two.cp.js')._source;
    descriptors.B.stopEditSession();
    expect(manager.undos, 'an independent source module must retain its history').has.length(1);
    manager.undo();
    await processed('Other');
    expectPosition('Other', 5);
    manager.redo();
    await processed('Other');
    expectPosition('Other', 6);
    expect(modules.get('two.cp.js')._source, 'independent replay must not modify the pruned module').equals(afterShared);
    expectNotice();
  });

  it('control: closing an unedited B session leaves A history intact', async () => {
    await move('A', 11);
    const after = sources();
    descriptors.B.stopEditSession();
    expect(manager.undos, 'closing a session with no owned source history must not prune A').has.length(1);
    manager.undo();
    await processed('A');
    manager.redo();
    await processed('A');
    expect(sources()).deep.equals(after);
    expect(notices, 'no shared history was pruned').to.be.empty;
  });

  it('prunes joined source history while keeping unclaimed active recorder changes', async () => {
    await move('A', 11);
    const other = morph({ fill: Color.red });
    instances.push(other);
    other.openInWorld();
    $world.undoStart('unfinished mixed gesture');
    other.fill = Color.green;
    expect(manager.undoInProgress.recorder.changes.some(change => change.target === other),
      'the world recorder must actually own the unrelated change').equals(true);
    editables.B.withMetaDo({ reconcileChanges: true }, () => {
      editables.B.get('box').position = pt(33, 66);
    });
    await processed('B');
    const after = sources();
    descriptors.B.stopEditSession();
    manager.undoStop();
    expect(manager.undos, 'the unclaimed recorder segment must survive source pruning').has.length(1);
    manager.undo();
    expect(other.fill).equals(Color.red);
    manager.redo();
    expect(other.fill).equals(Color.green);
    expect(sources(), 'the unfinished component endpoint must remain unchanged').deep.equals(after);
    expectNotice();
  });

  it('follows derived-module source dependencies before pruning any entries', async () => {
    await load('derived.cp.js', header + `
import { A } from './two.cp.js';
export const Derived = component(A, { name: 'derived', submorphs: [{ name: 'box', fill: Color.yellow }] });
` + footer);
    await open('Derived');
    await edit('A', editable => { editable.get('box').name = 'caption'; });
    expect(modules.get('derived.cp.js')._source, 'the fixture must create a cross-module source dependency').includes('caption');
    await edit('Derived', editable => { editable.get('caption').opacity = 0.5; });
    await move('B', 33);
    const after = sources();
    descriptors.B.stopEditSession();
    expect(manager.undos, 'transitively dependent derived-module history must also be removed').to.be.empty;
    expect(() => manager.undo()).not.to.throw();
    expect(() => manager.redo()).not.to.throw();
    expect(sources(), 'dependency pruning must not rewrite either source module').deep.equals(after);
    expect(editables.Derived.get('caption').opacity, 'derived runtime changes must be kept').equals(0.5);
    expectNotice();
  });
});
