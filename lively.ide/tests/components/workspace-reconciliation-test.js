/* global afterEach, beforeEach, describe, it, System, $world */
import { expect } from 'mocha-es6';
import { Color } from 'lively.graphics';
import { promise } from 'lively.lang';
import { part } from 'lively.morphic';
import module from 'lively.modules/src/module.js';
import { createFiles, resource } from 'lively.resources';
import { InteractiveComponentDescriptor } from '../../components/editor.js';
import { releaseComponentEditingState } from './test-isolation.js';

const directory = 'local://workspace-reconciliation-test/';
const source = `import { component } from 'lively.morphic/components/core.js';
import { Color } from 'lively.graphics';
const beforeWorkspace = 1;
const WorkspaceComponent = component({
  name: 'workspace component',
  fill: Color.red,
  submorphs: [{ name: 'child' }]
});
const afterWorkspace = 2;
WorkspaceComponent;`;

describe('workspace component reconciliation', function () {
  this.timeout(20000);
  releaseComponentEditingState();
  let workspaces, descriptors, morphs, modules, logged, logError, unhandled, onRejection;

  beforeEach(() => {
    workspaces = [];
    descriptors = new Set();
    morphs = [];
    modules = [];
    logged = [];
    unhandled = [];
    logError = $world.logError;
    $world.logError = error => logged.push(error);
    onRejection = event => {
      unhandled.push(event.reason);
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', onRejection);
  });

  afterEach(async () => {
    for (const descriptor of descriptors) {
      const editable = descriptor._cachedComponent;
      descriptor.stopEditSession();
      editable?.remove();
    }
    morphs.forEach(morph => morph.remove());
    workspaces.forEach(workspace => workspace.remove());
    for (const componentModule of modules) {
      await componentModule.unload();
      await System._livelyModulesTranslationCache.deleteCachedData(componentModule.id);
    }
    if (await resource(directory).exists()) await resource(directory).remove();
    window.removeEventListener('unhandledrejection', onRejection);
    $world.logError = logError;
    expect(logged).to.be.empty;
    expect(unhandled).to.be.empty;
  });

  /** Open a real workspace backed by its text morph resource. */
  async function openWorkspace (content = source) {
    const workspace = await $world.execCommand('open javascript workspace', { systemInterface: 'local' });
    workspaces.push(workspace);
    workspace.content = content;
    const componentModule = module(System, workspace.jsPlugin.evalEnvironment.targetModule);
    modules.push(componentModule);
    return { workspace, editor: workspace.targetMorph, componentModule };
  }

  /** Start the user-facing command and verify it opened a protected visual session. */
  async function editComponent (state, componentName = 'WorkspaceComponent') {
    const editable = await state.workspace.execCommand('[workspace] edit component', { componentName });
    const descriptor = InteractiveComponentDescriptor.ensureInteractive(state.componentModule.recorder[componentName]);
    descriptors.add(descriptor);
    expect(editable).equals(descriptor._cachedComponent);
    expect(editable.world()).equals($world, 'the workspace command must open the visual editor');
    expect(editable._changeTracker).to.be.ok;
    expect(editable._changeTracker.projectionalDocumentForCurrentSource().supported).equals(true);
    expect(state.editor.pluginFind(plugin => plugin.isComponentSourceEditorPlugin)).to.be.ok;
    return { ...state, descriptor, editable, tracker: editable._changeTracker };
  }

  /** Check the visible buffer, module cache and backing resource agree. */
  async function expectSource (state, expected) {
    await promise.waitFor(3000, () => state.componentModule._source === expected);
    expect(state.editor.textString).equals(expected);
    expect(await state.componentModule.source()).equals(expected);
    expect(await resource(state.componentModule.id).read()).equals(expected);
  }

  /** Commit a halo-style fill gesture through the actual tracker. */
  async function setFill (state, fill) {
    state.editable.undoStart('workspace component fill');
    try {
      state.editable.withMetaDo({ reconcileChanges: true }, () => { state.editable.fill = fill; });
      await state.tracker.onceChangesProcessed();
    } finally { state.editable.undoStop(); }
    expect(state.tracker.lastShadowCommandBatch.projectionalCommit).to.be.ok;
  }

  /** Reimport generated text independently of the workspace's live policy cache. */
  async function expectColdFill (content, fill) {
    const fileName = `cold-${modules.length}.cp.js`;
    await createFiles(directory, { [fileName]: content + '\nexport { WorkspaceComponent };' });
    const componentModule = module(System, directory + fileName);
    modules.push(componentModule);
    const exports = await componentModule.load();
    const instance = part(exports.WorkspaceComponent);
    morphs.push(instance);
    instance.master.applyIfNeeded(true);
    expect(instance.fill).equals(fill);
  }

  /** Locate an edit by source content rather than fragile fixed line numbers. */
  function positionOf (editor, needle, offset = 0) {
    const index = editor.textString.indexOf(needle);
    expect(index).at.least(0);
    return editor.indexToPosition(index + offset);
  }

  it('opens a component from the workspace command and reuses its active session', async () => {
    const workspace = await openWorkspace();
    const opened = await workspace.workspace.execCommand('[workspace] edit component');
    const state = await editComponent(workspace);
    expect(state.editable).equals(opened);
    await expectSource(state, source);
    const second = await state.workspace.execCommand('[workspace] edit component', { componentName: 'WorkspaceComponent' });
    expect(second).equals(state.editable);
    expect(second._changeTracker).equals(state.tracker);
  });

  it('protects and resets the top-level component when a helper shadows its name', async () => {
    const helper = 'function helper() { const WorkspaceComponent = 1; return WorkspaceComponent; }\n';
    const content = source.replace('const beforeWorkspace', helper + 'const beforeWorkspace');
    const state = await editComponent(await openWorkspace(content));
    expect(state.descriptor._backupComponentDef).includes('fill: Color.red');
    state.editor.insertText('/* editable local */ ', positionOf(state.editor, 'WorkspaceComponent = 1'));
    const surroundingSource = state.editor.textString;
    expect(surroundingSource).includes('const /* editable local */ WorkspaceComponent = 1;');
    state.editor.insertText('broken', positionOf(state.editor, 'Color.red'));
    await expectSource(state, surroundingSource);
    await setFill(state, Color.green);
    expect(state.editor.textString).includes('const /* editable local */ WorkspaceComponent = 1;');
    expect(state.editor.textString).includes('fill: Color.green');
    const control = state.editor.submorphs.find(morph => morph.componentDescriptor === state.descriptor && morph.isActiveEditSession);
    expect(control).to.be.ok;
    await control.viewModel.resetComponentDef();
    expect(state.editor.textString).equals(surroundingSource);
    expect(await resource(state.componentModule.id).read()).equals(surroundingSource);
    state.editor.insertText('broken', positionOf(state.editor, 'Color.red'));
    expect(state.editor.textString).equals(surroundingSource);
  });

  it('protects workspace source when its component is opened through the descriptor API', async () => {
    const state = await openWorkspace();
    const result = await state.workspace.jsPlugin.runEval(source);
    expect(result.isError).not.equals(true);
    const descriptor = InteractiveComponentDescriptor.ensureInteractive(result.value);
    descriptors.add(descriptor);
    const editable = await descriptor.edit();
    morphs.push(editable);
    editable.openInWorld();
    state.editor.insertText('broken', positionOf(state.editor, 'Color.red'));
    await expectSource(state, source);
  });

  it('protects the active declaration against typing, deletion and whole-buffer replacement', async () => {
    const state = await editComponent(await openWorkspace());
    const { editor } = state;
    editor.insertText('broken', positionOf(editor, 'Color.red'));
    expect(editor.textString).equals(source);
    editor.deleteText({
      start: positionOf(editor, 'const WorkspaceComponent'),
      end: positionOf(editor, 'const afterWorkspace')
    });
    expect(editor.textString).equals(source);
    editor.textString = source.replace('Color.red', 'Color.green');
    expect(editor.textString).equals(source);
    editor.textAndAttributes = [source.replace('Color.red', 'Color.green'), null];
    await expectSource(state, source);
    expect(state.editable.fill).equals(Color.red);
  });

  it('blocks real paste and insertion at the declaration start while permitting its end boundary', async () => {
    const state = await editComponent(await openWorkspace());
    const { editor, tracker } = state;
    const session = editor.pluginFind(plugin => plugin.isComponentSourceEditorPlugin).sessions.get(tracker);
    editor.insertText('broken', { ...session.start.position });
    expect(editor.textString).equals(source);
    editor.selection = {
      start: positionOf(editor, 'Color.red'),
      end: positionOf(editor, 'Color.red', 'Color.red'.length)
    };
    editor.onPaste({
      stop () {},
      domEvt: { clipboardData: { getData: type => type === 'text' ? 'Color.blue' : '' } }
    });
    expect(editor.textString).equals(source);
    editor.insertText('\n// outside the declaration\n', { ...session.end.position });
    const surrounding = editor.textString;
    expect(surrounding).includes('});\n// outside the declaration\n');
    await expectSource(state, surrounding);
    editor.insertText('broken', positionOf(editor, 'Color.red'));
    expect(editor.textString).equals(surrounding);
    await setFill(state, Color.green);
    expect(editor.textString).includes('// outside the declaration');
    expect(editor.textString).includes('fill: Color.green');
  });

  it('preserves an incomplete surrounding buffer while rejecting and rolling back a visual edit', async () => {
    const state = await editComponent(await openWorkspace());
    const { editor } = state;
    const incomplete = '\nconst incomplete = ';
    editor.insertText(incomplete, editor.documentEndPosition);
    const invalidSource = editor.textString;
    await expectSource(state, invalidSource);
    const showError = $world.showError;
    const errors = [];
    let rejection;
    $world.showError = error => errors.push(error);
    state.editable.undoStart('visual edit while surrounding source is incomplete');
    try {
      state.editable.withMetaDo({ reconcileChanges: true }, () => { state.editable.fill = Color.green; });
      try { await state.tracker.onceChangesProcessed(); } catch (error) { rejection = error; }
    } finally {
      state.editable.undoStop();
      $world.showError = showError;
    }
    expect(rejection).to.be.instanceOf(Error);
    expect(rejection.name).equals('ProjectionalReconciliationUnsupportedError');
    expect(errors).to.have.length(1);
    expect(state.tracker.lastShadowCommandBatch.projectionalCommit).not.to.be.ok;
    expect(state.editable.fill).equals(Color.red);
    await expectSource(state, invalidSource);
    editor.insertText('broken', positionOf(editor, 'Color.red'));
    expect(editor.textString).equals(invalidSource);
    editor.deleteText({ start: editor.indexToPosition(source.length), end: editor.documentEndPosition });
    await expectSource(state, source);
    await setFill(state, Color.green);
    expect(editor.textString).includes('fill: Color.green');
  });

  it('reconciles a visual edit into the buffer with live/cold parity and exact undo/redo', async () => {
    const state = await editComponent(await openWorkspace());
    const instance = part(state.descriptor);
    morphs.push(instance);
    await setFill(state, Color.green);
    const finalSource = state.editor.textString;
    expect(finalSource).includes('fill: Color.green');
    await expectSource(state, finalSource);
    instance.master.applyIfNeeded(true);
    expect(instance.fill).equals(Color.green);
    await expectColdFill(finalSource, Color.green);
    state.editable.env.undoManager.undo();
    await state.tracker.onceChangesProcessed();
    await expectSource(state, source);
    expect(state.editable.fill).equals(Color.red);
    instance.master.applyIfNeeded(true);
    expect(instance.fill).equals(Color.red);
    state.editable.env.undoManager.redo();
    await state.tracker.onceChangesProcessed();
    await expectSource(state, finalSource);
    expect(state.editable.fill).equals(Color.green);
    instance.master.applyIfNeeded(true);
    expect(instance.fill).equals(Color.green);
  });

  it('preserves surrounding edits and shifted protection through visual undo/redo', async () => {
    const state = await editComponent(await openWorkspace());
    const { editor } = state;
    editor.insertText('// preceding edit\n', { row: 0, column: 0 });
    editor.insertText('\n// following edit', editor.documentEndPosition);
    const beforeSource = editor.textString;
    await expectSource(state, beforeSource);
    editor.insertText('broken', positionOf(editor, 'Color.red'));
    expect(editor.textString).equals(beforeSource);
    await setFill(state, Color.green);
    const finalSource = editor.textString;
    expect(finalSource).includes('// preceding edit\n');
    expect(finalSource).includes('\n// following edit');
    await expectSource(state, finalSource);
    state.editable.env.undoManager.undo();
    await state.tracker.onceChangesProcessed();
    await expectSource(state, beforeSource);
    state.editable.env.undoManager.redo();
    await state.tracker.onceChangesProcessed();
    await expectSource(state, finalSource);
  });

  it('keeps text undo separate from visual history without losing surrounding text', async () => {
    const state = await editComponent(await openWorkspace());
    await setFill(state, Color.green);
    const visualSource = state.editor.textString;
    state.editor.insertText('// text edit\n', { row: 0, column: 0 });
    const textSource = state.editor.textString;
    await expectSource(state, textSource);
    state.editor.textUndo();
    await expectSource(state, visualSource);
    expect(state.editable.fill).equals(Color.green);
    state.editor.textRedo();
    await expectSource(state, textSource);
    await setFill(state, Color.blue);
    const finalSource = state.editor.textString;
    state.editor.textUndo();
    await expectSource(state, finalSource);
    state.editable.env.undoManager.undo();
    await state.tracker.onceChangesProcessed();
    await expectSource(state, textSource);
    expect(state.editable.fill).equals(Color.green);
  });

  it('releases protection when the edit session closes', async () => {
    const state = await editComponent(await openWorkspace());
    state.descriptor.stopEditSession();
    state.editor.insertText('/* released */ ', positionOf(state.editor, 'fill:'));
    expect(state.editor.textString).includes('/* released */ fill: Color.red');
    expect(state.editable._changeTracker).not.to.be.ok;
  });

  it('reports a rejected reset without losing incomplete surrounding code or its active session', async () => {
    const state = await editComponent(await openWorkspace());
    await setFill(state, Color.green);
    expect(state.descriptor.isDirty()).equals(true);
    state.editor.insertText('\nconst incomplete = ', state.editor.documentEndPosition);
    const invalidSource = state.editor.textString;
    const control = state.editor.submorphs.find(morph => morph.componentDescriptor === state.descriptor && morph.isActiveEditSession);
    expect(control).to.be.ok;
    const showError = control.showError;
    const errors = [];
    control.showError = error => errors.push(error);
    try { await control.viewModel.resetComponentDef(); } finally { control.showError = showError; }
    expect(errors).to.have.length(1);
    expect(errors[0]).to.be.instanceOf(Error);
    expect(state.editable.fill).equals(Color.green);
    expect(state.editable._changeTracker).equals(state.tracker);
    expect(state.descriptor.isDirty()).equals(true);
    await expectSource(state, invalidSource);
    state.editor.insertText('broken', positionOf(state.editor, 'Color.green'));
    expect(state.editor.textString).equals(invalidSource);
  });

  it('closes through its real control without implicitly saving incomplete surrounding code', async () => {
    const state = await editComponent(await openWorkspace());
    state.editor.insertText('\nconst incomplete = ', state.editor.documentEndPosition);
    const invalidSource = state.editor.textString;
    const control = state.editor.submorphs.find(morph => morph.componentDescriptor === state.descriptor && morph.isActiveEditSession);
    expect(control).to.be.ok;
    const changeSource = state.componentModule.changeSource;
    const saves = [];
    state.componentModule.changeSource = (...args) => { saves.push(args); return Promise.resolve(); };
    try { await control.terminateEditSession(); } finally { state.componentModule.changeSource = changeSource; }
    expect(saves).to.be.empty;
    expect(state.editable._changeTracker).not.to.be.ok;
    expect(state.editor.textString).equals(invalidSource);
    await expectSource(state, invalidSource);
    state.editor.insertText('/* released */ ', positionOf(state.editor, 'fill:'));
    expect(state.editor.textString).includes('/* released */ fill: Color.red');
  });

  it('keeps source edits made during live preview when its real control closes', async () => {
    const state = await editComponent(await openWorkspace());
    await setFill(state, Color.green);
    const control = state.editor.submorphs.find(morph => morph.componentDescriptor === state.descriptor && morph.isActiveEditSession);
    expect(control).to.be.ok;
    await control.viewModel.toggleDerivedInstance(true);
    const preview = control.viewModel.instanceMorph;
    expect(preview).to.be.ok;
    morphs.push(preview);
    expect(preview.world()).equals($world);
    expect(state.editable._changeTracker).not.to.be.ok;
    expect(state.editor.pluginFind(plugin => plugin.isComponentSourceEditorPlugin)).not.to.be.ok;
    const cachedSource = state.componentModule._source;
    state.editor.insertText('\nconst incomplete = ', state.editor.documentEndPosition);
    const invalidSource = state.editor.textString;
    expect(cachedSource).not.equals(invalidSource);
    const changeSource = state.componentModule.changeSource;
    const saves = [];
    state.componentModule.changeSource = (...args) => { saves.push(args); return Promise.resolve(); };
    try { await control.terminateEditSession(); } finally { state.componentModule.changeSource = changeSource; }
    expect(saves).to.be.empty;
    expect(state.editor.textString).equals(invalidSource);
    expect(await resource(state.componentModule.id).read()).equals(invalidSource);
    expect(control.viewModel.instanceMorph).equals(null);
    expect(preview.world()).equals(null);
    expect(state.descriptor._cachedComponent).equals(null);
  });

  it('releases the session when its visual component is removed', async () => {
    const state = await editComponent(await openWorkspace());
    state.editable.remove();
    await promise.waitFor(3000, () => !state.editable._changeTracker);
    state.editor.insertText('/* released */ ', positionOf(state.editor, 'fill:'));
    expect(state.editor.textString).includes('/* released */ fill: Color.red');
  });

  for (const removed of ['editor', 'workspace']) {
    it(`releases source protection and the visual session when its ${removed} is removed`, async () => {
      const state = await editComponent(await openWorkspace());
      state[removed].remove();
      await promise.waitFor(3000, () => !state.editable._changeTracker);
      expect(state.descriptor._cachedComponent).not.to.be.ok;
      expect(state.editable.world()).equals(null);
      expect(state.editor.pluginFind(plugin => plugin.isComponentSourceEditorPlugin)).not.to.be.ok;
      expect(state.editor.anchors.filter(anchor => anchor.id.startsWith('component-source-'))).to.be.empty;
      expect(state.editor.markers.filter(marker => marker.id.startsWith('component-source-'))).to.be.empty;
    });
  }

  it('protects and synchronizes two equal source editors without clearing their manual-edit state', async () => {
    const workspace = await openWorkspace();
    const mirror = await openWorkspace();
    mirror.workspace.jsPlugin.evalEnvironment.targetModule = workspace.componentModule.id;
    const state = await editComponent(workspace);
    const plugins = [state.editor, mirror.editor].map(editor => editor.pluginFind(plugin => plugin.isComponentSourceEditorPlugin));
    expect(plugins.every(plugin => plugin?.sessions.has(state.tracker))).equals(true);
    mirror.editor.insertText('// shared surrounding edit\n', { row: 0, column: 0 });
    const editedSource = mirror.editor.textString;
    await expectSource(state, editedSource);
    expect(plugins.every(plugin => plugin.hasTextEdits)).equals(true);
    await setFill(state, Color.green);
    const finalSource = state.editor.textString;
    expect(mirror.editor.textString).equals(finalSource);
    expect(finalSource).includes('// shared surrounding edit');
    expect(finalSource).includes('fill: Color.green');
    expect(plugins.every(plugin => plugin.hasTextEdits)).equals(true);
    mirror.editor.insertText('broken', positionOf(mirror.editor, 'Color.green'));
    state.editor.insertText('broken', positionOf(state.editor, 'Color.green'));
    expect(mirror.editor.textString).equals(finalSource);
    expect(state.editor.textString).equals(finalSource);
    state.descriptor.stopEditSession();
    for (const editor of [state.editor, mirror.editor]) {
      expect(editor.pluginFind(plugin => plugin.isComponentSourceEditorPlugin)).not.to.be.ok;
    }
  });

  it('copies a protected source editor without reviving session plugins or anchors', async () => {
    const state = await editComponent(await openWorkspace());
    const copy = await state.editor.copy();
    morphs.push(copy);
    expect(copy.textString).equals(source);
    expect(copy.pluginFind(plugin => plugin.isComponentSourceEditorPlugin)).not.to.be.ok;
    expect(copy.anchors.filter(anchor => anchor.id?.startsWith('component-source-'))).to.be.empty;
    expect(copy.markers.filter(marker => marker.id.startsWith('component-source-'))).to.be.empty;
    copy.insertText('/* independent */ ', positionOf(copy, 'fill:'));
    expect(copy.textString).includes('/* independent */ fill: Color.red');
    state.editor.insertText('broken', positionOf(state.editor, 'Color.red'));
    await expectSource(state, source);
    expect(state.editable._changeTracker).equals(state.tracker);
  });

  it('keeps expression evaluation active and closes its session before selected declaration evaluation', async () => {
    const state = await editComponent(await openWorkspace());
    const { editor } = state;
    editor.selection = {
      start: editor.indexToPosition(editor.textString.lastIndexOf('WorkspaceComponent;')),
      end: editor.documentEndPosition
    };
    const expression = await editor.execCommand('doit');
    expect(expression.isError).not.equals(true);
    expect(state.editable._changeTracker).equals(state.tracker);
    expect(state.componentModule.recorder.WorkspaceComponent).equals(state.descriptor);
    const plugin = editor.pluginFind(plugin => plugin.isComponentSourceEditorPlugin);
    const session = plugin.sessions.get(state.tracker);
    editor.selection = { start: { ...session.start.position }, end: { ...session.end.position } };
    const declaration = await editor.execCommand('doit');
    expect(declaration.isError).not.equals(true);
    const currentDescriptor = InteractiveComponentDescriptor.ensureInteractive(state.componentModule.recorder.WorkspaceComponent);
    descriptors.add(currentDescriptor);
    expect(state.editable._changeTracker).not.to.be.ok;
    expect(state.editable.world()).equals(null);
    expect(currentDescriptor._cachedComponent).not.to.be.ok;
    expect(editor.pluginFind(plugin => plugin.isComponentSourceEditorPlugin)).not.to.be.ok;
    expect(editor.submorphs.filter(morph => morph.componentDescriptor === currentDescriptor && morph.isActiveEditSession)).to.be.empty;
  });

  it('closes the previous session before re-evaluating the full workspace buffer', async () => {
    const state = await editComponent(await openWorkspace());
    const result = await state.workspace.jsPlugin.runEval(state.editor.textString);
    expect(result.isError).not.equals(true);
    expect(state.editable._changeTracker).not.to.be.ok;
    state.editor.insertText('/* re-evaluated */ ', positionOf(state.editor, 'fill:'));
    expect(state.editor.textString).includes('/* re-evaluated */ fill: Color.red');
    const reopened = await editComponent(state);
    expect(reopened.tracker).not.equals(state.tracker);
    await setFill(reopened, Color.green);
    expect(reopened.editor.textString).includes('/* re-evaluated */ fill: Color.green');
  });

  it('protects multiple declarations independently without re-evaluating an active session', async () => {
    const content = source.replace('WorkspaceComponent;', `const SecondComponent = component({ name: 'second component', fill: Color.blue });
WorkspaceComponent;`);
    const first = await editComponent(await openWorkspace(content));
    const second = await editComponent(first, 'SecondComponent');
    expect(first.editable._changeTracker).equals(first.tracker);
    first.editor.insertText('broken', positionOf(first.editor, 'Color.red'));
    first.editor.insertText('broken', positionOf(first.editor, 'Color.blue'));
    expect(first.editor.textString).equals(content);
    first.descriptor.stopEditSession();
    first.editor.insertText('/* released */ ', positionOf(first.editor, 'Color.red'));
    const afterRelease = first.editor.textString;
    expect(afterRelease).includes('/* released */ Color.red');
    first.editor.insertText('broken', positionOf(first.editor, 'Color.blue'));
    expect(first.editor.textString).equals(afterRelease);
    await setFill(second, Color.green);
    expect(first.editor.textString).includes('/* released */ Color.red');
    expect(first.editor.textString).includes('fill: Color.green');
  });
});
