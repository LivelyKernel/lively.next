import { GridLayout, TilingLayout, ViewModel, component, part, without, Label, Text, Icon, config } from 'lively.morphic';
import { Color, pt, rect } from 'lively.graphics';
import { SystemButton } from 'lively.components/buttons.cp.js';
import { SystemList } from '../../styling/shared.cp.js';
import { signal } from 'lively.bindings';
import { parse } from 'lively.ast';
import { localInterface } from 'lively-system-interface';
import { InspectionTree, PropertyTree, printValue } from '../inspector/context.js';
import { SystemInspector } from '../inspector/ui.cp.js';
import {
  restartInspectorFrame,
  returnFromInspectorFrame,
  applySavedInspectorMethod,
  runToInspectorPosition,
  resumeInspectorContinuation,
  stepOutInspectorContinuation,
  stepInspectorContinuation
} from 'lively.context/lib/inspector-interpreter.js';
import {
  CURRENT_LINE_MARKER_ID,
  initialFrameForContinuation,
  interpreterLineForSourcePosition,
  sourceNameForFrame,
  sourceUrlForFrame,
  moduleUrlForFrame,
  lineRangeForFrame,
  locationStringForFrame,
  readFrameSource
} from './source.js';
import JavaScriptEditorPlugin from '../editor-plugin.js';
import { evaluateInDebuggerScopes } from './evaluation.js';

function frameLabel (frame, index) {
  const name = sourceNameForFrame(frame);
  const location = frame.location || {};
  const line = Number.isFinite(location.lineNumber) ? ':' + (location.lineNumber + 1) : '';
  return '#' + index + '  ' + name + line;
}


function scopeLabel (scope) {
  const names = scope.bindingNames();
  const suffix = names.length ? ' (' + names.length + ')' : '';
  return (scope.name || scope.type || 'scope') + suffix;
}

function valueTreeObjectForScope (scope) {
  const bindings = scope && scope.bindings;
  return bindings || {};
}

function interpreterScopesForFrame (frame) {
  const scopes = [];
  let scope = frame && frame.getScope && frame.getScope();
  while (scope) {
    const currentScope = scope;
    const mapping = scope.getMapping ? scope.getMapping() : {};
    scopes.push({
      name: mapping === globalThis ? 'global' : currentScope.nativeSnapshot ? 'closure snapshot' : currentScope.lexicalNodeIndex !== undefined ? 'block' : 'scope',
      type: mapping === globalThis ? 'global' : 'local',
      bindingNames () { return Object.keys(mapping); },
      hasBinding (candidate) { return Object.prototype.hasOwnProperty.call(mapping, candidate); },
      lookup (candidate) { return mapping[candidate]; },
      setBinding (candidate, value) { return currentScope.set(candidate, value); },
      get bindings () { return mapping; }
    });
    scope = scope.getParentScope && scope.getParentScope();
  }
  return scopes;
}

function syntheticScope (name, value, type = name) {
  return {
    name,
    type,
    bindingNames () { return [name]; },
    hasBinding (candidate) { return candidate === name; },
    lookup (candidate) { return candidate === name ? value : undefined; },
    get bindings () { return { [name]: value }; }
  };
}

function frameValue (frame, getterName) {
  if (!frame || typeof frame[getterName] !== 'function') return undefined;
  try {
    return frame[getterName]();
  } catch (err) {
    return undefined;
  }
}

function visibleScopesForFrame (frame) {
  if (!frame) return [];
  const scopes = [];
  const thisValue = frameValue(frame, 'getThis');
  const args = frameValue(frame, 'getArguments');
  const exception = frameValue(frame, 'getException');

  if (thisValue !== undefined) scopes.push(syntheticScope('this', thisValue, 'receiver'));
  if (args !== undefined) scopes.push(syntheticScope('arguments', args, 'arguments'));
  if (exception !== undefined) scopes.push(syntheticScope('exception', exception, 'exception'));
  const frameScopes = frame.scopes
    ? frame.scopes()
    : interpreterScopesForFrame(frame);
  return scopes.concat(frameScopes);
}

function workspaceScope (bindings) {
  return {
    name: 'workspace',
    type: 'workspace',
    bindingNames () { return Object.keys(bindings); },
    hasBinding (candidate) { return Object.prototype.hasOwnProperty.call(bindings, candidate); },
    lookup (candidate) { return bindings[candidate]; },
    get bindings () { return bindings; }
  };
}

export class LivelyDebuggerModel extends ViewModel {
  static get properties () {
    return {
      continuation: {},
      inspectorContinuation: {},
      selectedFrame: {},
      selectedScope: {},
      workspaceBindings: {
        initialize () { this.workspaceBindings = {}; }
      },
      sourceBuffers: {
        initialize () { this.sourceBuffers = new Map(); }
      },

      expose: {
        get () { return ['continuation', 'onWindowClose', 'closeDebugger', 'proceed', 'commands', 'keybindings']; }
      },

      bindings: {
        get () {
          return [
            { target: 'stack list', signal: 'selection', handler: 'selectFrame' },
            { target: 'scope list', signal: 'selection', handler: 'selectScope' },
            { target: 'proceed button', signal: 'fire', handler: 'proceed' },
            { target: 'retry button', signal: 'fire', handler: 'retry' },
            { target: 'step into button', signal: 'fire', handler: 'stepInto' },
            { target: 'step over button', signal: 'fire', handler: 'stepOver' },
            { target: 'step out button', signal: 'fire', handler: 'stepOut' },
            { target: 'restart frame button', signal: 'fire', handler: 'restartFrame' },
            { target: 'return button', signal: 'fire', handler: 'returnFromFrame' },
            { target: 'edit method button', signal: 'fire', handler: 'editMethod' },
            { target: 'save module button', signal: 'fire', handler: 'saveModule' },
            { target: 'source pane', signal: 'textChange', handler: 'rememberSourceEdits' },
            { target: 'apply method button', signal: 'fire', handler: 'applySavedMethod' },
            { target: 'run to cursor button', signal: 'fire', handler: 'runToCursor' },
            { target: 'terminal toggler', signal: 'onMouseDown', handler: 'toggleWorkspace', override: false },
            { target: 'workspace resizer', signal: 'onDrag', handler: 'adjustWorkspaceProportions', override: false }
          ];
        }
      }
    };
  }

  viewDidLoad () {
    this.ui.sourcePane.addCommands(this.commands);
    this.rememberReleasableContinuation(this.continuation);
    this.refreshFromContinuation();
    this.refreshWorkspaceEditor();
  }

  get commands () {
    return [
      { name: 'save debugger module', exec: () => this.saveModule() },
      { name: 'focus debugger workspace', exec: () => { this.makeWorkspaceVisible(true); return true; } }
    ];
  }

  get keybindings () {
    return [
      { keys: { mac: 'Command-S', win: 'Ctrl-S' }, command: 'save debugger module' },
      { keys: 'F2', command: 'focus debugger workspace' }
    ];
  }

  rememberSourceEdits () {
    const buffer = this.sourceBuffers.get(this.currentModuleUrl);
    if (buffer) buffer.source = this.ui.sourcePane.textString;
    this.ui.sourcePane.borderColor = buffer && buffer.source !== buffer.savedSource
      ? Color.red : Color.rgb(204, 204, 204);
    if (this.ui.sourcePane.textString !== this.currentSourceText) {
      this.ui.sourcePane.removeMarker(CURRENT_LINE_MARKER_ID);
      this.ui.locationLabel.textString = locationStringForFrame(this.selectedFrame) + ' (edited source; Apply or Restart Frame)';
    }
  }

  hasUnsavedChanges () {
    this.rememberSourceEdits();
    return Array.from(this.sourceBuffers.values()).some(buffer => buffer.source !== buffer.savedSource);
  }

  async saveModule () {
    if (this.isSaving) return false;
    this.rememberSourceEdits();
    const url = this.currentModuleUrl, buffer = this.sourceBuffers.get(url);
    if (!buffer) return this.interpreterActionFailed('Save Module', new Error('This frame has no editable module source.'));
    const source = buffer.source;
    this.isSaving = true;
    try {
      // changeSource saves and evaluates concurrently, so validate before writing.
      parse(source);
      const savedSource = await localInterface.coreInterface.resourceRead(url);
      if (savedSource !== buffer.savedSource && savedSource !== source &&
          !await this.view.world().confirm('This module changed outside the debugger. Overwrite those changes?', {requester: this.view})) return false;
      await localInterface.interactivelyChangeModule(url, source, {doSave: true, doEval: true});
      buffer.savedSource = source;
      this.rememberSourceEdits();
      this.ui.status.textString = 'Module saved. Apply Saved Method or Restart Frame to use it in the suspended computation.';
      return true;
    } catch (err) {
      return this.interpreterActionFailed('Save Module', err);
    } finally { this.isSaving = false; }
  }

  renderDraggableTreeLabel (args) {
    return args.value;
  }

  renderPropertyControl ({ keyString, valueString }) {
    return keyString + ': ' + valueString;
  }

  refreshSelectedLine (sourceText = this.ui.sourcePane.textString) {
    const sourcePane = this.ui.sourcePane;
    if (!sourcePane) return null;
    if (!sourcePane.document && sourcePane.backWithDocument) sourcePane.backWithDocument();
    if (sourcePane.removeMarker) sourcePane.removeMarker(CURRENT_LINE_MARKER_ID);

    const range = lineRangeForFrame(this.selectedFrame, sourceText);
    this.ui.locationLabel.textString = locationStringForFrame(this.selectedFrame);
    if (sourceText !== this.currentSourceText) {
      this.rememberSourceEdits();
      return null;
    }
    if (!range) return null;

    const row = range.start.row;
    if (sourcePane.selectLine) sourcePane.selectLine(row, false);
    else sourcePane.selection = range;

    if (sourcePane.addMarker) {
      sourcePane.addMarker({
        id: CURRENT_LINE_MARKER_ID,
        range,
        style: {
          'background-color': 'rgba(66, 165, 245, 0.18)',
          'box-shadow': 'inset 3px 0 0 rgba(41, 121, 255, 0.85)',
          'pointer-events': 'none'
        }
      });
    }

    try {
      if (sourcePane.centerRow) sourcePane.centerRow(row);
      else if (sourcePane.centerRange) sourcePane.centerRange(range);
      else if (sourcePane.scrollCursorIntoView) sourcePane.scrollCursorIntoView();
    } catch (err) {
      if (sourcePane.scrollCursorIntoView) sourcePane.scrollCursorIntoView();
    }
    return range;
  }

  refreshFromContinuation () {
    const frames = this.continuation ? this.continuation.frames() : [];
    this.ui.stackList.items = frames.map((frame, index) => ({
      isListItem: true,
      string: frameLabel(frame, index),
      value: frame
    }));
    const initialFrame = initialFrameForContinuation(this.continuation, frames);
    this.ui.stackList.selection = initialFrame;
    this.selectFrame(initialFrame);
    this.updateStatus();
  }

  updateStatus () {
    const reason = this.continuation && this.continuation.reason || 'debugger';
    const exception = this.continuation && this.continuation.exception;
    const exceptionText = exception ? '  ' + printValue(exception) : '';
    this.ui.status.textString = reason + exceptionText;
  }

  async selectFrame (frame) {
    this.rememberSourceEdits();
    this.selectedFrame = frame;
    const source = await readFrameSource(frame);
    if (this.selectedFrame !== frame) return;
    const url = moduleUrlForFrame(frame);
    let buffer = this.sourceBuffers.get(url);
    if (url && (!buffer || buffer.source === buffer.savedSource)) {
      const savedSource = await localInterface.moduleRead(url);
      if (this.selectedFrame !== frame) return;
      buffer = {source: savedSource, savedSource};
      this.sourceBuffers.set(url, buffer);
    }
    this.currentSourceText = source;
    this.currentModuleUrl = url;
    const pane = this.ui.sourcePane;
    const plugin = pane.pluginFind(p => p.isJSEditorPlugin) || pane.addPlugin(new JavaScriptEditorPlugin());
    plugin.evalEnvironment = {...plugin.evalEnvironment, targetModule: sourceUrlForFrame(frame)};
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
    this.ui.scopeList.items = scopes.map(scope => ({
      isListItem: true,
      string: scopeLabel(scope),
      value: scope
    }));
    this.ui.scopeList.selection = scopes[0] || null;
    this.selectScope(scopes[0] || null);
    this.refreshWorkspaceEditor();
  }

  async selectScope (scope) {
    this.selectedScope = scope;
    const tree = this.ui.valueTree;
    const treeData = InspectionTree.forObject(valueTreeObjectForScope(scope), this);
    await treeData.collapse(treeData.root, false);
    if (treeData.root.children && treeData.root.children[0]) {
      await treeData.collapse(treeData.root.children[0], false);
    }
    tree.treeData = treeData;
    if (tree.treeData.root.isCollapsed) {
      await tree.onNodeCollapseChanged({ node: treeData.root, isCollapsed: false });
      tree.selectedIndex = 1;
    }
  }

  evaluationScopes () {
    const frameScopes = visibleScopesForFrame(this.selectedFrame);
    return [workspaceScope(this.workspaceBindings || {})].concat(frameScopes);
  }

  refreshWorkspaceEditor () {
    const editor = this.ui.workspaceInput;
    const plugin = editor.pluginFind(p => p.isJSEditorPlugin) || editor.addPlugin(new JavaScriptEditorPlugin());
    plugin.runEval = source => this.evaluateWorkspaceSource(source);
    plugin.evalEnvironment.knownGlobals = this.evaluationScopes().flatMap(scope => scope.bindingNames());
    plugin.highlight();
  }

  isWorkspaceVisible () { return this.ui.workspaceInput.visible; }

  makeWorkspaceVisible (show) {
    const { workspaceInput: editor, workspaceResizer: resizer, terminalToggler, mainPane } = this.ui;
    const { layout, extent } = mainPane;
    if (show !== this.isWorkspaceVisible()) {
      if (!show) this.workspaceHeight = layout.row(5).height;
      layout.disable();
      this.withoutBindingsDo(() => {
        layout.row(5).height = show ? this.workspaceHeight || 110 : 0;
        layout.row(4).height = show ? 5 : 0;
        mainPane.extent = extent;
      });
      layout.enable();
      editor.visible = resizer.visible = show;
      terminalToggler.fontColor = show ? Color.rgbHex('00e0ff') : Color.white;
      layout.forceLayout();
    }
    (show ? editor : this.ui.sourcePane).focus();
  }

  toggleWorkspace () { this.makeWorkspaceVisible(!this.isWorkspaceVisible()); }

  adjustWorkspaceProportions (evt) {
    if (!this.isWorkspaceVisible()) return;
    const { mainPane } = this.ui;
    const { layout, extent } = mainPane;
    const height = layout.row(5).height;
    layout.disable();
    layout.row(5).height = Math.max(50, Math.min(height - evt.state.dragDelta.y, layout.row(2).height + height - 50));
    mainPane.extent = extent;
    layout.enable();
    layout.forceLayout();
  }

  async evaluateWorkspace () {
    const result = await this.evaluateWorkspaceSource(this.ui.workspaceInput.textString);
    return result.isError ? false : result.value;
  }

  async evaluateWorkspaceSource (source) {
    this.workspaceBindings = this.workspaceBindings || {};
    try {
      const result = await Promise.resolve(evaluateInDebuggerScopes(source, this.evaluationScopes()));
      this.workspaceBindings.it = result;
      this.ui.status.textString = 'workspace: ' + printValue(result);
      this.refreshWorkspaceEditor();
      return { value: result, isError: false };
    } catch (err) {
      this.ui.status.textString = 'workspace failed: ' + (err && err.message || err);
      signal(this.view, 'debuggerActionFailed', { actionName: 'Workspace', frame: this.selectedFrame, error: err });
      return { value: err, isError: true };
    }
  }

  async proceed () {
    try {
      this.rememberReleasableContinuation(this.continuation);
      const result = await resumeInspectorContinuation(this.continuation);
      signal(this.view, 'debuggerProceed', this.continuation);
      if (result && result.isContinuation) {
        this.continuation = result;
        this.refreshFromContinuation();
        this.updateStatus();
      } else {
        this.continuation = null;
        await this.closeDebugger();
      }
      return result;
    } catch (err) {
      return this.interpreterActionFailed('Proceed', err);
    }
  }

  retry () {
    return this.proceed();
  }

  async returnFromFrame () {
    const source = await this.view.world().prompt('Return this value from the selected frame:', {input: 'undefined'});
    if (source == null) return;
    try {
      const value = evaluateInDebuggerScopes(source, this.evaluationScopes());
      const result = returnFromInspectorFrame(this.continuation, value, {startFrame: this.selectedFrame});
      if (!result || !result.isContinuation) { this.continuation = null; await this.closeDebugger(); return result; }
      return this.updateAfterInterpreterResult('Return', result);
    } catch (error) { return this.interpreterActionFailed('Return', error); }
  }

  editMethod () {
    const frame = this.selectedFrame, original = frame && frame.func && frame.func.originalFunction;
    return this.view.world().execCommand('open object editor', {
      target: frame.getThis(), methodName: original && (original.methodName || original.displayName || original.name)
    });
  }

  applySavedMethod () {
    try {
      const result = applySavedInspectorMethod(this.continuation, {startFrame: this.selectedFrame});
      return this.updateAfterInterpreterResult('Apply Saved Method', result);
    } catch (error) { return this.interpreterActionFailed('Apply Saved Method', error); }
  }

  runToCursor () {
    try {
      if (this.ui.sourcePane.textString !== this.currentSourceText) throw new Error('Apply Saved Method or Restart Frame before running to a line in edited source.');
      const position = this.ui.sourcePane.cursorPosition;
      const result = runToInspectorPosition(this.continuation, interpreterLineForSourcePosition(this.selectedFrame, position), {startFrame: this.selectedFrame});
      return this.updateAfterInterpreterResult('Run to Cursor', result);
    } catch (error) { return this.interpreterActionFailed('Run to Cursor', error); }
  }

  stepInto () {
    return this.stepWithInterpreter('Step Into', 'stepInto');
  }

  stepOver () {
    return this.stepWithInterpreter('Step Over', 'stepOver');
  }

  async stepOut () {
    try {
      const result = await stepOutInspectorContinuation(this.continuation, {
        startFrame: this.selectedFrame
      });
      return this.updateAfterInterpreterResult('Step Out', result);
    } catch (err) {
      return this.interpreterActionFailed('Step Out', err);
    }
  }

  restartFrame () {
    try {
      const result = restartInspectorFrame(this.continuation, { startFrame: this.selectedFrame });
      return this.updateAfterInterpreterResult('Restart Frame', result);
    } catch (err) {
      return this.interpreterActionFailed('Restart Frame', err);
    }
  }

  async stepWithInterpreter (label, action) {
    try {
      const result = await stepInspectorContinuation(this.continuation, {
        action,
        startFrame: this.selectedFrame
      });
      return this.updateAfterInterpreterResult(label, result);
    } catch (err) {
      return this.interpreterActionFailed(label, err);
    }
  }

  async updateAfterInterpreterResult (label, result) {
    result = await result;
    if (result && result.isContinuation) {
      this.rememberReleasableContinuation(this.continuation);
      this.continuation = result;
      this.refreshFromContinuation();
      this.ui.status.textString = label + ' stopped' + (result.exception ? ': ' + printValue(result.exception) : '');
      return result;
    }
    this.ui.status.textString = label + ' completed: ' + printValue(result);
    this.continuation = null;
    await this.closeDebugger();
    return result;
  }

  interpreterActionFailed (actionName, err) {
    const message = actionName + ' failed: ' + (err && err.message || err);
    this.ui.status.textString = message;
    signal(this.view, 'debuggerActionFailed', { actionName, frame: this.selectedFrame, error: err });
    return false;
  }

  rememberReleasableContinuation (continuation) {
    if (continuation && typeof continuation.release === 'function') {
      this.inspectorContinuation = continuation;
    }
  }

  async onWindowClose () {
    if (this.hasUnsavedChanges() && !await this.view.world().confirm('Discard unsaved debugger module changes?', {requester: this.view})) return false;
    const continuation = this.inspectorContinuation || this.continuation;
    if (continuation && continuation.release) continuation.release();
    this.inspectorContinuation = null;
    this.continuation = null;
  }

  async closeDebugger () {
    const win = this.view.getWindow && this.view.getWindow();
    if (win) await win.close(false);
    else if (await this.onWindowClose() !== false) this.view.remove();
  }
}

const ToolbarButton = component(SystemButton, {
  extent: pt(35, 26),
  borderRadius: 0,
  borderWidth: { top: 1, bottom: 1, left: 0, right: 1 },
  padding: rect(0, 0, 0, 0),
  submorphs: [{
    name: 'label',
    fontColor: Color.rgb(52, 73, 94),
    fontSize: 15
  }]
});

const InspectorWorkspaceControls = component(SystemInspector.stylePolicy.extractStylePolicyFor('editor controls wrapper'), {
  name: 'workspace controls',
  extent: pt(640, 26),
  submorphs: [
    { name: 'terminal toggler', tooltip: 'Show or hide the evaluation workspace (F2 to focus)' },
    without('this binding selector'),
    without('fix import button')
  ]
});

const InspectorWorkspaceResizer = component(SystemInspector.stylePolicy.extractStylePolicyFor('resizer'), {
  name: 'workspace resizer',
  visible: false
});

const InspectorWorkspaceEditor = component(SystemInspector.stylePolicy.extractStylePolicyFor('code editor'), {
  name: 'workspace input',
  visible: false,
  borderColor: Color.rgb(204, 204, 204),
  borderWidth: 1,
  fill: Color.white,
  fontSize: 13
});

export const LivelyDebugger = component({
  name: 'lively debugger',
  defaultViewModel: LivelyDebuggerModel,
  extent: pt(900, 560),
  fill: Color.transparent,
  reactsToPointer: false,
  layout: new GridLayout({
    autoAssign: false,
    grid: [
      ['toolbar', 'toolbar'],
      ['stack list', 'main pane'],
      ['status', 'status']
    ],
    groups: {
      toolbar: { align: 'topLeft', resize: true },
      'stack list': { align: 'topLeft', resize: true },
      'main pane': { align: 'topLeft', resize: true },
      status: { align: 'topLeft', resize: true }
    },
    columns: [
      0, { fixed: 260, paddingRight: 6 },
      1, { width: 1 }
    ],
    rows: [
      0, { fixed: 44 },
      1, { height: 1 },
      2, { fixed: 26 }
    ]
  }),
  submorphs: [{
    name: 'toolbar',
    extent: pt(900, 44),
    fill: Color.transparent,
    reactsToPointer: false,
    layout: new TilingLayout({
      axisAlign: 'center',
      orderByIndex: true,
      padding: rect(10, 0, 0, 0),
      spacing: 0
    }),
    submorphs: [
      part(ToolbarButton, {
        name: 'proceed button',
        tooltip: 'Proceed',
        borderRadius: { topLeft: 5, bottomLeft: 5, topRight: 0, bottomRight: 0 },
        borderWidth: 1,
        submorphs: [{ name: 'label', textAndAttributes: Icon.textAttribute('play-circle') }]
      }),
      part(ToolbarButton, {
        name: 'retry button',
        tooltip: 'Retry',
        borderRadius: { topLeft: 0, bottomLeft: 0, topRight: 5, bottomRight: 5 },
        submorphs: [{ name: 'label', textAndAttributes: Icon.textAttribute('redo') }]
      }),
      { name: 'execution spacer', fill: Color.transparent, extent: pt(15, 26) },
      part(ToolbarButton, {
        name: 'step into button',
        tooltip: 'Step Into',
        borderRadius: { topLeft: 5, bottomLeft: 5, topRight: 0, bottomRight: 0 },
        borderWidth: 1,
        submorphs: [{ name: 'label', textAndAttributes: Icon.textAttribute('arrow-down') }]
      }),
      part(ToolbarButton, {
        name: 'step over button',
        tooltip: 'Step Over',
        submorphs: [{ name: 'label', textAndAttributes: Icon.textAttribute('arrow-right') }]
      }),
      part(ToolbarButton, {
        name: 'step out button',
        tooltip: 'Step Out',
        submorphs: [{ name: 'label', textAndAttributes: Icon.textAttribute('arrow-up') }]
      }),
      part(ToolbarButton, {
        name: 'run to cursor button',
        tooltip: 'Run to the selected source line',
        borderRadius: { topLeft: 0, bottomLeft: 0, topRight: 5, bottomRight: 5 },
        submorphs: [{ name: 'label', textAndAttributes: Icon.textAttribute('bullseye') }]
      }),
      { name: 'stepping spacer', fill: Color.transparent, extent: pt(15, 26) },
      part(ToolbarButton, {
        name: 'restart frame button',
        tooltip: 'Restart Frame',
        borderRadius: { topLeft: 5, bottomLeft: 5, topRight: 0, bottomRight: 0 },
        borderWidth: 1,
        submorphs: [{ name: 'label', textAndAttributes: Icon.textAttribute('rotate-left') }]
      }),
      part(ToolbarButton, { name: 'return button', tooltip: 'Return a value from the selected frame',
        borderRadius: { topLeft: 0, bottomLeft: 0, topRight: 5, bottomRight: 5 },
        submorphs: [{ name: 'label', textAndAttributes: Icon.textAttribute('reply') }] }),
      { name: 'frame spacer', fill: Color.transparent, extent: pt(15, 26) },
      part(ToolbarButton, { name: 'edit method button', tooltip: 'Edit the selected method on its receiver',
        borderRadius: { topLeft: 5, bottomLeft: 5, topRight: 0, bottomRight: 0 },
        borderWidth: 1,
        submorphs: [{ name: 'label', textAndAttributes: Icon.textAttribute('pencil-alt') }] }),
      part(ToolbarButton, { name: 'save module button', tooltip: 'Save module (Ctrl-S / Command-S)',
        submorphs: [{ name: 'label', textAndAttributes: Icon.textAttribute('save') }] }),
      part(ToolbarButton, { name: 'apply method button', tooltip: 'Apply saved changes after the current execution position',
        borderRadius: { topLeft: 0, bottomLeft: 0, topRight: 5, bottomRight: 5 },
        submorphs: [{ name: 'label', textAndAttributes: Icon.textAttribute('check') }] })
    ]
  },
  part(SystemList, {
    name: 'stack list',
    fontFamily: 'IBM Plex Sans',
    fontSize: 14,
    itemHeight: 24,
    manualItemHeight: true,
    padding: rect(4, 4, 4, 4),
    borderRadius: 0,
    borderColor: Color.rgb(204, 204, 204),
    fill: Color.white,
    dropShadow: null
  }),
  {
    name: 'main pane',
    fill: Color.transparent,
    layout: new GridLayout({
      autoAssign: false,
      grid: [
        ['source header'],
        ['source pane'],
        ['scope/value pane'],
        ['workspace controls'],
        ['workspace resizer'],
        ['workspace input']
      ],
      groups: {
        'source header': { align: 'topLeft', resize: true },
        'source pane': { align: 'topLeft', resize: true },
        'scope/value pane': { align: 'topLeft', resize: true },
        'workspace controls': { align: 'topLeft', resize: true },
        'workspace resizer': { align: 'topLeft', resize: true },
        'workspace input': { align: 'topLeft', resize: true }
      },
      rows: [
        0, { fixed: 26 },
        1, { fixed: 210, paddingBottom: 6 },
        2, { height: 1, paddingBottom: 6 },
        3, { fixed: 26 },
        4, { fixed: 0 },
        5, { fixed: 0 }
      ]
    }),
    submorphs: [{
      name: 'source header',
      extent: pt(640, 26),
      fill: Color.transparent,
      layout: new TilingLayout({
        axisAlign: 'center',
        orderByIndex: true,
        padding: rect(8, 0, 8, 0)
      }),
      submorphs: [{
        type: Label,
        name: 'location label',
        value: '',
        fontColor: Color.rgb(52, 73, 94),
        fontFamily: 'IBM Plex Sans',
        fontSize: 12,
        padding: rect(0, 3, 0, 0),
        reactsToPointer: false
      }]
    }, {
      type: Text,
      name: 'source pane',
      readOnly: true,
      fixedWidth: true,
      fixedHeight: true,
      lineWrapping: 'by-chars',
      padding: rect(4, 2, 0, 0),
      borderColor: Color.rgb(204, 204, 204),
      borderWidth: 1,
      fill: Color.white,
      ...config.codeEditor.defaultStyle,
      fontSize: 13,
      textString: ''
    }, {
      name: 'scope/value pane',
      fill: Color.transparent,
      layout: new GridLayout({
        autoAssign: false,
        grid: [['scope list', 'value tree']],
        groups: {
          'scope list': { align: 'topLeft', resize: true },
          'value tree': { align: 'topLeft', resize: true }
        },
        columns: [
          0, { fixed: 190, paddingRight: 6 },
          1, { width: 1 }
        ]
      }),
      submorphs: [
        part(SystemList, {
          name: 'scope list',
          fontFamily: 'IBM Plex Sans',
          fontSize: 14,
          itemHeight: 22,
          manualItemHeight: true,
          padding: rect(4, 4, 4, 4),
          borderRadius: 0,
          borderColor: Color.rgb(204, 204, 204),
          fill: Color.white,
          dropShadow: null
        }),
        {
          type: PropertyTree,
          name: 'value tree',
          fill: Color.white,
          borderColor: Color.rgb(204, 204, 204),
          borderWidth: 1,
          clipMode: 'hidden',
          fontFamily: 'IBM Plex Mono',
          fontSize: 13,
          treeData: {}
        }]
    },
    part(InspectorWorkspaceControls),
    part(InspectorWorkspaceResizer),
    part(InspectorWorkspaceEditor)]
  }, {
    type: Label,
    name: 'status',
    value: '',
    fill: Color.transparent,
    fontColor: Color.rgb(44, 62, 80),
    fontFamily: 'IBM Plex Sans',
    fontSize: 12,
    padding: rect(6, 4, 0, 0)
  }]
});

export function openForContinuation (continuation, world = null) {
  const debuggerMorph = part(LivelyDebugger, { viewModel: { continuation } });
  const targetWorld = world || (typeof $world !== 'undefined' && $world);
  const win = debuggerMorph.openInWindow({ title: 'Lively Debugger', world: targetWorld });
  if (win && win.activate) win.activate();
  if (win && win.ensureToBeInWorldBounds) win.ensureToBeInWorldBounds();
  return debuggerMorph;
}
