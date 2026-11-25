/* global $world */
import { GridLayout, TilingLayout, ViewModel, component, part, without, Text, Icon, config } from 'lively.morphic';
import { Color, pt, rect } from 'lively.graphics';
import { SystemButton } from 'lively.components/buttons.cp.js';
import { signal } from 'lively.bindings';
import { parse } from 'lively.ast';
import { localInterface } from 'lively-system-interface';
import { module } from 'lively.modules';
import { SystemList } from '../../styling/shared.cp.js';
import { BrowserModel } from '../browser/index.js';
import { InspectionTree, PropertyTree, printValue } from '../inspector/context.js';
import { SystemInspector } from '../inspector/ui.cp.js';
import JavaScriptEditorPlugin from '../editor-plugin.js';
import {
  CURRENT_LINE_MARKER_ID, interpreterLineForSourcePosition, lineRangeForFrame,
  moduleUrlForFrame, readFrameSource, sourceNameForFrame, sourcePathForFrame, sourceUrlForFrame
} from './source.js';
import { evaluateInDebuggerScopes } from './evaluation.js';

const borderColor = Color.rgb(204, 204, 204);

/**
 * A scope as the debugger lists and evaluates it. The bindings of a frame scope
 * are accessors that raise the temporal dead zone of lexical declarations, so
 * a snapshot keeps only the label; selecting a frame lists its scopes again.
 */
class ScopeView {
  constructor (name, type, bindings = {}, scope) { Object.assign(this, { name, type, bindings, scope }); }

  get __only_serialize__ () { return ['name', 'type']; }

  __after_deserialize__ () { this.bindings = {}; }

  bindingNames () { return Object.keys(this.bindings); }

  setBinding (key, value) {
    if (this.scope) this.scope.set(key, value);
    else this.bindings[key] = value;
  }
}

/** The value of `bindings[key]`, or the error that reading it raises, e.g. in the temporal dead zone. */
function readBinding (bindings, key) {
  try { return bindings[key]; } catch (error) { return error; }
}

/** The receiver, arguments and exception of a frame, followed by its scope chain. */
function visibleScopesForFrame (frame) {
  if (!frame) return [];
  const read = getter => { try { return frame[getter](); } catch (err) { return undefined; } };
  const scopes = [['this', 'receiver', read('getThis')], ['arguments', 'arguments', read('getArguments')], ['exception', 'exception', read('getException')]]
    .filter(([,, value]) => value !== undefined).map(([name, type, value]) => new ScopeView(name, type, { [name]: value }));
  for (let scope = frame.getScope(); scope; scope = scope.getParentScope()) {
    const mapping = scope.getMapping(), isGlobal = mapping === globalThis;
    const name = isGlobal ? 'global' : scope.nativeSnapshot ? 'closure snapshot' : scope.lexicalNodeIndex !== undefined ? 'block' : 'scope';
    scopes.push(new ScopeView(name, isGlobal ? 'global' : 'local', mapping, scope));
  }
  return scopes;
}

/** An inspection tree whose top level lists `names` of `bindings` as plain `name: value` lines. */
class ScopeTree extends InspectionTree {
  static forBindings (bindings, names) {
    const properties = () => ({ includeDefault: false, properties: names.map(key => ({ key, value: readBinding(bindings, key) })) });
    return new this({ key: 'inspectee', isCollapsed: true, value: { inspectee: bindings, livelyCustomInspect: properties } });
  }

  display (node) { return node.keyString + ': ' + node.valueString; }
}

// [button name, tooltip, icon, action] in groups of adjacent buttons
const toolbarGroups = [
  [['proceed', 'Proceed', 'play-circle', 'proceed'], ['retry', 'Retry', 'redo', 'retry']],
  [['step into', 'Step Into', 'arrow-down', 'stepInto'], ['step over', 'Step Over', 'arrow-right', 'stepOver'],
    ['step out', 'Step Out', 'arrow-up', 'stepOut'], ['run to cursor', 'Run to the selected source line', 'bullseye', 'runToCursor']],
  [['restart frame', 'Restart Frame', 'rotate-left', 'restartFrame'], ['return', 'Return a value from the selected frame', 'reply', 'returnFromFrame']],
  [['edit method', 'Edit the selected method on its receiver', 'pencil-alt', 'editMethod'], ['save module', 'Save module (Ctrl-S / Command-S)', 'save', 'saveModule'],
    ['apply method', 'Apply saved changes after the current execution position', 'check', 'applySavedMethod']]
];

export class LivelyDebuggerModel extends ViewModel {
  static get properties () {
    return {
      continuation: {},
      onComplete: { serialize: false },
      onCancel: { serialize: false },
      selectedFrame: { serialize: false },
      selectedScope: { serialize: false },
      workspaceBindings: { initialize () { this.workspaceBindings = {}; } },
      sourceBuffers: { initialize () { this.sourceBuffers = new Map(); } },
      expose: { get () { return ['continuation', 'onWindowClose', 'closeDebugger', 'proceed', 'commands', 'keybindings']; } },
      bindings: {
        get () {
          return [
            { target: 'stack list', signal: 'selection', handler: 'selectFrame' },
            { target: 'scope list', signal: 'selection', handler: 'selectScope' },
            ...toolbarGroups.flat().map(([name,,, handler]) => ({ target: name + ' button', signal: 'fire', handler })),
            { target: 'source pane', signal: 'textChange', handler: 'rememberSourceEdits' },
            { target: 'terminal toggler', signal: 'onMouseDown', handler: 'toggleWorkspace', override: false },
            { target: 'workspace resizer', signal: 'onDrag', handler: 'adjustWorkspaceProportions', override: false },
            { target: /^(scope\/value pane|workspace input)$/, signal: 'extent', handler: 'relayoutWorkspaceControls' },
            { target: /^(scope\/value pane|workspace input)$/, signal: 'position', handler: 'relayoutWorkspaceControls' }
          ];
        }
      }
    };
  }

  viewDidLoad () {
    // Saved buffers are keyed by the module URL of the session that saved them.
    this.sourceBuffers = new Map([...this.sourceBuffers].map(([url, buffer]) => [buffer.moduleName ? module(buffer.moduleName).id : url, buffer]));
    this.ui.sourcePane.addCommands(this.commands);
    this.observeSuspension(this.continuation);
    this.refreshFromContinuation();
    this.refreshWorkspaceEditor();
    this.relayoutWorkspaceControls();
  }

  get commands () {
    return [{ name: 'save debugger module', exec: () => this.saveModule() },
      { name: 'focus debugger workspace', exec: () => { this.makeWorkspaceVisible(true); return true; } }];
  }

  get keybindings () {
    return [{ keys: { mac: 'Command-S', win: 'Ctrl-S' }, command: 'save debugger module' }, { keys: 'F2', command: 'focus debugger workspace' }];
  }

  rememberSourceEdits () {
    const pane = this.ui.sourcePane, buffer = this.sourceBuffers.get(this.currentModuleUrl);
    if (buffer) buffer.source = pane.textString;
    pane.borderColor = buffer && buffer.source !== buffer.savedSource ? Color.red : borderColor;
    if (pane.textString !== this.currentSourceText) pane.removeMarker(CURRENT_LINE_MARKER_ID);
  }

  hasUnsavedChanges () {
    this.rememberSourceEdits();
    return [...this.sourceBuffers.values()].some(buffer => buffer.source !== buffer.savedSource);
  }

  async saveModule () {
    if (this.isSaving) return false;
    this.rememberSourceEdits();
    const url = this.currentModuleUrl, buffer = this.sourceBuffers.get(url);
    if (!buffer) return this.actionFailed('Save Module', new Error('This frame has no editable module source.'));
    const source = buffer.source;
    this.isSaving = true;
    try {
      // Saving evaluates the module while it writes it, so only valid source is saved.
      parse(source);
      const savedSource = await localInterface.coreInterface.resourceRead(url);
      if (savedSource !== buffer.savedSource && savedSource !== source &&
          !await this.view.world().confirm('This module changed outside the debugger. Overwrite those changes?', { requester: this.view })) return false;
      await localInterface.interactivelyChangeModule(url, source, { doSave: true, doEval: true });
      buffer.savedSource = source;
      this.rememberSourceEdits();
      this.view.setStatusMessage('Module saved. Apply Saved Method or Restart Frame to use it in the suspended computation.');
      return true;
    } catch (err) {
      return this.actionFailed('Save Module', err);
    } finally { this.isSaving = false; }
  }

  /** Select and mark the current line of the selected frame, unless its source is edited. */
  refreshSelectedLine (sourceText = this.ui.sourcePane.textString) {
    const pane = this.ui.sourcePane, range = lineRangeForFrame(this.selectedFrame, sourceText);
    pane.removeMarker(CURRENT_LINE_MARKER_ID);
    if (sourceText !== this.currentSourceText) { this.rememberSourceEdits(); return null; }
    if (!range) return null;
    pane.selectLine(range.start.row, false);
    const style = { 'background-color': 'rgba(66, 165, 245, 0.18)', 'box-shadow': 'inset 3px 0 0 rgba(41, 121, 255, 0.85)', 'pointer-events': 'none' };
    pane.addMarker({ id: CURRENT_LINE_MARKER_ID, range, style });
    pane.centerRow(range.start.row);
    return range;
  }

  refreshFromContinuation () {
    const frames = this.continuation ? this.continuation.frames() : [];
    this.ui.stackList.items = frames.map((frame, index) =>
      ({ isListItem: true, value: frame, string: '#' + index + '  ' + sourceNameForFrame(frame) }));
    this.ui.stackList.selection = frames[0] || null;
    this.selectFrame(frames[0] || null);
    if (this.continuation?.exception) this.view.showError(this.continuation.exception);
  }

  /** Name the window after the selected frame's module; called again once the view is in a window. */
  updateTitle () {
    const win = this.view.getWindow(), frame = this.selectedFrame;
    if (!win || !frame) return;
    const url = this.currentModuleUrl, mod = url && module(url), pkg = mod && mod.package();
    const path = pkg ? `[${BrowserModel.prototype.formatPackageName(pkg)}] ${mod.pathInPackage()}` : sourcePathForFrame(frame);
    win.title = 'debugger' + (path ? ' - ' + path : '');
  }

  async selectFrame (frame) {
    this.rememberSourceEdits();
    this.selectedFrame = frame;
    const source = readFrameSource(frame), url = moduleUrlForFrame(frame);
    let buffer = this.sourceBuffers.get(url);
    if (url && (!buffer || buffer.source === buffer.savedSource)) {
      const savedSource = await localInterface.moduleRead(url);
      if (this.selectedFrame !== frame) return;
      // A draft may have been typed while the module was read.
      buffer = this.sourceBuffers.get(url);
      if (!buffer || buffer.source === buffer.savedSource) {
        this.sourceBuffers.set(url, buffer = { source: savedSource, savedSource, moduleName: module(url).shortName() });
      }
    }
    this.currentSourceText = source;
    this.currentModuleUrl = url;
    this.updateTitle();
    const pane = this.ui.sourcePane;
    const plugin = pane.pluginFind(p => p.isJSEditorPlugin) || pane.addPlugin(new JavaScriptEditorPlugin());
    plugin.evalEnvironment = { ...plugin.evalEnvironment, targetModule: sourceUrlForFrame(frame) };
    pane.readOnly = !url;
    this.view.get('save module button').viewModel[url ? 'enable' : 'disable']();
    const displayedSource = buffer ? buffer.source : source;
    if (pane.textString !== displayedSource) pane.textString = displayedSource;
    this.rememberSourceEdits();
    await pane.whenRendered();
    if (this.selectedFrame !== frame) return;
    plugin.highlight();
    pane.env.forceUpdate();
    this.refreshSelectedLine(displayedSource);
    const scopes = visibleScopesForFrame(frame);
    this.ui.scopeList.items = scopes.map(scope => {
      const count = scope.bindingNames().length;
      return { isListItem: true, value: scope, string: scope.name + (count ? ' (' + count + ')' : '') };
    });
    this.ui.scopeList.selection = scopes[0] || null;
    this.selectScope(scopes[0] || null);
    this.refreshWorkspaceEditor();
  }

  async selectScope (scope) {
    this.selectedScope = scope;
    const tree = this.ui.valueTree, treeData = ScopeTree.forBindings(scope?.bindings || {}, scope?.bindingNames() || []);
    await treeData.collapse(treeData.root, false);
    tree.selectedNode = null;
    tree.treeData = treeData;
  }

  evaluationScopes () {
    const workspace = new ScopeView('workspace', 'workspace', this.workspaceBindings);
    return [workspace, ...visibleScopesForFrame(this.selectedFrame)];
  }

  refreshWorkspaceEditor () {
    const editor = this.ui.workspaceInput;
    const plugin = editor.pluginFind(p => p.isJSEditorPlugin) || editor.addPlugin(new JavaScriptEditorPlugin());
    plugin.runEval = source => this.evaluateWorkspaceSource(source);
    plugin.evalEnvironment.knownGlobals = this.evaluationScopes().flatMap(scope => scope.bindingNames());
    plugin.highlight();
  }

  isWorkspaceVisible () { return this.ui.workspaceInput.visible; }

  relayoutWorkspaceControls () {
    const pane = this.isWorkspaceVisible() ? this.ui.workspaceInput : this.view.getSubmorphNamed('scope/value pane');
    this.ui.workspaceControls.bottomLeft = pane.bounds().bottomLeft();
  }

  /** Change the heights of the workspace rows while the main pane keeps its extent. */
  setWorkspaceRows (workspaceHeight, resizerHeight) {
    const { mainPane } = this.ui, { layout, extent } = mainPane;
    layout.disable();
    this.withoutBindingsDo(() => {
      layout.row(3).height = workspaceHeight;
      layout.row(2).height = resizerHeight;
      mainPane.extent = extent;
    });
    layout.enable();
    layout.forceLayout();
  }

  makeWorkspaceVisible (show) {
    const { workspaceInput: editor, workspaceResizer: resizer, terminalToggler, mainPane } = this.ui;
    if (show !== this.isWorkspaceVisible()) {
      if (!show) this.workspaceHeight = mainPane.layout.row(3).height;
      this.setWorkspaceRows(show ? this.workspaceHeight || 110 : 0, show ? 5 : 0);
      editor.visible = resizer.visible = show;
      terminalToggler.fontColor = show ? Color.rgbHex('00e0ff') : Color.white;
    }
    this.relayoutWorkspaceControls();
    (show ? editor : this.ui.sourcePane).focus();
  }

  toggleWorkspace () { this.makeWorkspaceVisible(!this.isWorkspaceVisible()); }

  adjustWorkspaceProportions (evt) {
    if (!this.isWorkspaceVisible()) return;
    const { layout } = this.ui.mainPane, height = layout.row(3).height;
    this.setWorkspaceRows(Math.max(50, Math.min(height - evt.state.dragDelta.y, layout.row(1).height + height - 50)), 5);
    this.relayoutWorkspaceControls();
  }

  async evaluateWorkspace () {
    const result = await this.evaluateWorkspaceSource(this.ui.workspaceInput.textString);
    if (result.isError) { this.view.showError(result.value); return false; }
    return result.value;
  }

  async evaluateWorkspaceSource (source) {
    try {
      const value = await evaluateInDebuggerScopes(source, this.evaluationScopes());
      this.workspaceBindings.it = value;
      this.refreshWorkspaceEditor();
      return { value, isError: false };
    } catch (err) {
      signal(this.view, 'debuggerActionFailed', { actionName: 'Workspace', frame: this.selectedFrame, error: err });
      return { value: err, isError: true };
    }
  }

  async proceed () {
    const { continuation } = this;
    try {
      if (continuation.reason === 'await' && !continuation.error?.promise) {
        // A restored world holds the await without its operation.
        const source = await this.view.world().prompt('This await was saved before its operation completed. Supply the awaited result:', { input: 'undefined' });
        if (source == null) return;
        continuation.supplyAwaitResult(await evaluateInDebuggerScopes(source, this.evaluationScopes()));
      }
      this.observeSuspension(continuation);
      this.isProceeding = true;
      const result = await continuation.resume();
      signal(this.view, 'debuggerProceed', continuation);
      if (result?.isContinuation && this.cancelAfterProceed) {
        this.onCancel?.();
        this.continuation = null;
        return result;
      }
      return this.showResult('', result);
    } catch (err) {
      if (this.cancelAfterProceed) this.onCancel?.();
      return this.actionFailed('Proceed', err);
    } finally { this.isProceeding = this.cancelAfterProceed = false; }
  }

  retry () { return this.proceed(); }

  async returnFromFrame () {
    const source = await this.view.world().prompt('Return this value from the selected frame:', { input: 'undefined' });
    if (source == null) return;
    const value = () => evaluateInDebuggerScopes(source, this.evaluationScopes());
    return this.runAction('', () => this.continuation.returnFrom(value(), { frame: this.selectedFrame }), 'Return');
  }

  editMethod () {
    const frame = this.selectedFrame, original = frame?.func.originalFunction;
    const methodName = original && (original.methodName || original.displayName || original.name);
    return this.view.world().execCommand('open object editor', { target: frame.getThis(), methodName });
  }

  stepInto () { return this.runAction('Step Into', () => this.continuation.stepInto({ frame: this.selectedFrame })); }
  stepOver () { return this.runAction('Step Over', () => this.continuation.stepOver({ frame: this.selectedFrame })); }
  stepOut () { return this.runAction('Step Out', () => this.continuation.stepOut({ frame: this.selectedFrame })); }
  restartFrame () { return this.runAction('Restart Frame', () => this.continuation.restartFrame({ frame: this.selectedFrame })); }
  applySavedMethod () { return this.runAction('Apply Saved Method', () => this.continuation.applySavedMethod({ frame: this.selectedFrame })); }

  runToCursor () {
    return this.runAction('Run to Cursor', () => {
      const pane = this.ui.sourcePane;
      if (pane.textString !== this.currentSourceText) throw new Error('Apply Saved Method or Restart Frame before running to a line in edited source.');
      return this.continuation.runToLine(interpreterLineForSourcePosition(this.selectedFrame, pane.cursorPosition), { frame: this.selectedFrame });
    });
  }

  /** Run a debugger action; a synchronous failure returns false at once, a completion closes the debugger. */
  runAction (label, action, actionName = label) {
    try {
      const result = action();
      return result?.then
        ? result.then(result => this.showResult(label, result), err => this.actionFailed(actionName, err))
        : this.showResult(label, result);
    } catch (err) { return this.actionFailed(actionName, err); }
  }

  async showResult (label, result) {
    if (result?.isContinuation) {
      this.observeSuspension(result);
      this.continuation = result;
      this.refreshFromContinuation();
      return result;
    }
    if (label) this.view.setStatusMessage(label + ' completed: ' + printValue(result));
    this.onComplete?.(result);
    this.continuation = null;
    await this.closeDebugger();
    return result;
  }

  actionFailed (actionName, err) {
    this.view.showError(actionName + ' failed: ' + (err?.message || err));
    signal(this.view, 'debuggerActionFailed', { actionName, frame: this.selectedFrame, error: err });
    return false;
  }

  /** Show the computation while a resumed `await` is pending. */
  observeSuspension (continuation) {
    if (continuation?.currentFrame) continuation.onSuspend = pending => { this.continuation = pending; this.refreshFromContinuation(); };
  }

  async onWindowClose () {
    if (this.hasUnsavedChanges() && !await this.view.world().confirm('Discard unsaved debugger module changes?', { requester: this.view })) return false;
    // A running Proceed delivers its completion; a new stop cancels the computation.
    if (this.isProceeding) this.cancelAfterProceed = true;
    else if (this.continuation) this.onCancel?.();
    this.continuation = null;
  }

  async closeDebugger () {
    const win = this.view.getWindow();
    if (win) await win.close(false);
    else if (await this.onWindowClose() !== false) this.view.remove();
  }
}

const ToolbarButton = component(SystemButton, {
  extent: pt(35, 26),
  borderRadius: 0,
  borderWidth: { top: 1, bottom: 1, left: 0, right: 1 },
  padding: rect(0, 0, 0, 0),
  submorphs: [{ name: 'label', fontColor: Color.rgb(52, 73, 94), fontSize: 15 }]
});

// The workspace uses the controls, resizer and editor of the Inspector.
const inspectorStyle = name => SystemInspector.stylePolicy.extractStylePolicyFor(name);

const WorkspaceControls = component(inspectorStyle('editor controls wrapper'), {
  name: 'workspace controls',
  isLayoutable: false,
  extent: pt(35, 26),
  submorphs: [
    { name: 'terminal toggler', tooltip: 'Show or hide the evaluation workspace (F2 to focus)' },
    without('filler'), without('this binding selector'), without('fix import button')
  ]
});

const WorkspaceResizer = component(inspectorStyle('resizer'), { name: 'workspace resizer', visible: false });

const WorkspaceEditor = component(inspectorStyle('code editor'), {
  name: 'workspace input', visible: false, borderColor, borderWidth: 1, fill: Color.white, padding: rect(4, 2, 0, 26), fontSize: 13
});

const listStyle = { fontFamily: 'IBM Plex Sans', fontSize: 14, manualItemHeight: true, padding: rect(4, 4, 4, 4), borderRadius: 0, borderColor, fill: Color.white, dropShadow: null };

function gridLayout (grid, spec) {
  const groups = Object.fromEntries(grid.flat().map(name => [name, { align: 'topLeft', resize: true }]));
  return new GridLayout({ autoAssign: false, grid, groups, ...spec });
}

function toolbarButtons () {
  const left = { borderRadius: { topLeft: 5, bottomLeft: 5, topRight: 0, bottomRight: 0 }, borderWidth: 1 };
  const right = { borderRadius: { topLeft: 0, bottomLeft: 0, topRight: 5, bottomRight: 5 } };
  return toolbarGroups.flatMap((group, groupIndex) => [
    ...groupIndex ? [{ name: ['execution', 'stepping', 'frame'][groupIndex - 1] + ' spacer', fill: Color.transparent, extent: pt(15, 26) }] : [],
    ...group.map(([name, tooltip, icon], index) => part(ToolbarButton, {
      name: name + ' button',
      tooltip,
      ...index === 0 && left,
      ...index === group.length - 1 && right,
      submorphs: [{ name: 'label', textAndAttributes: Icon.textAttribute(icon) }]
    }))
  ]);
}

export const LivelyDebugger = component({
  name: 'lively debugger',
  defaultViewModel: LivelyDebuggerModel,
  extent: pt(900, 560),
  fill: Color.transparent,
  reactsToPointer: false,
  layout: gridLayout([['toolbar', 'toolbar'], ['stack list', 'main pane']], {
    columns: [0, { fixed: 260, paddingRight: 6 }, 1, { width: 1 }],
    rows: [0, { fixed: 44 }, 1, { height: 1 }]
  }),
  submorphs: [{
    name: 'toolbar', extent: pt(900, 44), fill: Color.transparent, reactsToPointer: false, submorphs: toolbarButtons(),
    layout: new TilingLayout({ axisAlign: 'center', orderByIndex: true, padding: rect(10, 0, 0, 0), spacing: 0 })
  },
  part(SystemList, { name: 'stack list', itemHeight: 24, ...listStyle }),
  {
    name: 'main pane',
    fill: Color.transparent,
    layout: gridLayout([['source pane'], ['scope/value pane'], ['workspace resizer'], ['workspace input']], {
      rows: [0, { fixed: 210, paddingBottom: 6 }, 1, { height: 1 }, 2, { fixed: 0 }, 3, { fixed: 0 }]
    }),
    submorphs: [{
      type: Text, name: 'source pane', readOnly: true, needsDocument: true, fixedWidth: true, fixedHeight: true, lineWrapping: 'by-chars',
      padding: rect(4, 2, 0, 0), borderColor, borderWidth: 1, fill: Color.white, ...config.codeEditor.defaultStyle, fontSize: 13, textString: ''
    }, {
      name: 'scope/value pane',
      fill: Color.transparent,
      layout: gridLayout([['scope list', 'value tree']], { columns: [0, { fixed: 190, paddingRight: 6 }, 1, { width: 1 }] }),
      submorphs: [
        part(SystemList, { name: 'scope list', itemHeight: 22, ...listStyle }),
        { type: PropertyTree, name: 'value tree', fill: Color.white, borderColor, borderWidth: 1, clipMode: 'hidden', fontFamily: 'IBM Plex Mono', fontSize: 13, treeData: {} }
      ]
    },
    part(WorkspaceResizer),
    part(WorkspaceEditor),
    part(WorkspaceControls)]
  }]
});

export function openForContinuation (continuation, world = $world, { onComplete, onCancel } = {}) {
  const view = part(LivelyDebugger, { viewModel: { continuation, onComplete, onCancel } });
  const win = view.openInWindow({ title: 'debugger', world: world || $world });
  view.viewModel.updateTitle();
  win.activate();
  win.ensureToBeInWorldBounds();
  return view;
}
