import { parse } from 'lively.ast';
import { connect, disconnect } from 'lively.bindings';
import { lessPosition, lessEqPosition } from 'lively.morphic/text/position.js';
import { findComponentDef, getEligibleSourceEditorsFor } from './helpers.js';

/** Synchronize generated source without adding it to the editor's separate text history. */
export function updateComponentSourceEditor (editor, source) {
  const previous = editor.textString;
  if (previous !== source) {
    editor.undoManager?.reset();
    let start = 0;
    while (start < previous.length && start < source.length && previous[start] === source[start]) start++;
    let previousEnd = previous.length;
    let sourceEnd = source.length;
    while (previousEnd > start && sourceEnd > start && previous[previousEnd - 1] === source[sourceEnd - 1]) {
      previousEnd--;
      sourceEnd--;
    }
    editor.withMetaDo({ componentSourceUpdate: true }, () => editor.dontRecordChangesWhile(() => {
      if (editor.document) editor.replace({
        start: editor.indexToPosition(start), end: editor.indexToPosition(previousEnd)
      }, source.slice(start, sourceEnd), false, true, false);
      else editor.textString = source;
    }));
  }
  editor.pluginFind?.(plugin => plugin.isComponentSourceEditorPlugin)?.refreshRanges();
}

/** Protect active declarations while the rest of their source stays editable. */
export class ComponentSourceEditorPlugin {
  constructor (componentModule) {
    this.componentModule = componentModule;
    this.sessions = new Map();
  }

  get isComponentSourceEditorPlugin () { return true; }

  __serialize__ () { return { __expr__: 'null' }; }

  attach (editor) {
    this.editor = editor;
    connect(editor, 'textChange', this, 'onTextChange', { isEpiConnection: true });
    connect(editor, 'onOwnerChanged', this, 'updateOwners', { isEpiConnection: true });
    // Earlier text entries may cross the declaration that is becoming protected.
    editor.undoManager?.reset();
    this.updateOwners();
  }

  detach () {
    const editor = this.editor;
    this.stopSessions();
    disconnect(editor, 'textChange', this, 'onTextChange');
    disconnect(editor, 'onOwnerChanged', this, 'updateOwners');
    for (const owner of this.owners || []) disconnect(owner, 'removeMorph', this, 'updateOwners');
    this.owners = [];
    this.editor = null;
  }

  updateOwners () {
    const editor = this.editor;
    if (!editor) return;
    for (const owner of this.owners || []) disconnect(owner, 'removeMorph', this, 'updateOwners');
    this.owners = editor.ownerChain();
    for (const owner of this.owners) connect(owner, 'removeMorph', this, 'updateOwners', { isEpiConnection: true });
    if (editor.world()) this.wasInWorld = true;
    else if (this.wasInWorld) Promise.resolve().then(() => {
      if (this.editor && !this.editor.world()) this.stopSessions();
    });
  }

  addSession (tracker) {
    if (this.sessions.has(tracker)) return;
    const editor = this.editor;
    const id = `component-source-${tracker.componentDescriptor.componentName}`;
    const start = editor.addAnchor({ id: id + '-start' });
    const end = editor.addAnchor({ id: id + '-end', insertBehavior: 'stay' });
    // Session ranges and guards must not survive copying or saving their editor.
    for (const anchor of [start, end]) anchor.__serialize__ = () => ({ __expr__: 'null' });
    const marker = editor.addMarker({
      id,
      get range () { return { start: start.position, end: end.position }; },
      style: { 'background-color': 'rgba(127, 127, 127, 0.15)', 'pointer-events': 'none' }
    });
    this.sessions.set(tracker, { start, end, marker });
    this.refreshRanges();
  }

  removeSession (tracker) {
    const session = this.sessions.get(tracker);
    if (!session) return;
    this.editor.removeAnchor(session.start);
    this.editor.removeAnchor(session.end);
    this.editor.removeMarker(session.marker);
    this.sessions.delete(tracker);
    if (!this.sessions.size) this.editor.removePlugin(this);
  }

  refreshRanges () {
    const source = this.editor.textString;
    if (source !== this._rangeSource) {
      this._rangeSource = source;
      try { this._rangeAst = parse(source); } catch (error) {
        // Anchors keep the declaration protected while surrounding code is incomplete.
        this._rangeAst = null;
      }
    }
    if (!this._rangeAst) return;
    for (const [tracker, session] of this.sessions) {
      const declaration = findComponentDef(this._rangeAst, tracker.componentDescriptor.componentName);
      if (!declaration) continue;
      session.start.position = this.editor.indexToPosition(declaration.start);
      session.end.position = this.editor.indexToPosition(declaration.end);
    }
  }

  isTextChangeAllowed (range) {
    const editor = this.editor;
    if (editor.env.changeManager.defaultMeta.componentSourceUpdate) return true;
    if (editor.editorPlugin?.evalEnvironment?.targetModule !== this.componentModule.id) {
      this.stopSessions();
      return true;
    }
    const empty = !lessPosition(range.start, range.end);
    for (const { start, end } of this.sessions.values()) {
      const overlaps = empty
        ? lessEqPosition(start.position, range.start) && lessPosition(range.start, end.position)
        : lessPosition(range.start, end.position) && lessPosition(start.position, range.end);
      if (!overlaps) continue;
      editor.world()?.showStatusMessage?.('Close the component edit session to edit this declaration.');
      return false;
    }
    return true;
  }

  onTextChange (change) {
    if (change?.meta?.componentSourceUpdate || this.editor.env.changeManager.defaultMeta.componentSourceUpdate) {
      this.refreshRanges();
      return;
    }
    const previous = this.componentModule._source;
    if (previous === this.editor.textString) return;
    const editors = getEligibleSourceEditorsFor(this.componentModule.id, previous);
    for (const tracker of this.sessions.keys()) {
      tracker.pruneSessionHistory('source-edit');
      delete tracker._pendingModuleSource;
    }
    this.hasTextEdits = true;
    this.componentModule.setSource(this.editor.textString);
    for (const editor of editors) {
      if (editor === this.editor) continue;
      const plugin = editor.pluginFind(plugin => plugin.isComponentSourceEditorPlugin);
      if (plugin) plugin.hasTextEdits = true;
      updateComponentSourceEditor(editor, this.editor.textString);
    }
  }

  beforeEvaluation (code) {
    if (code === this.editor.textString) return this.stopSessions();
    let ast;
    try { ast = parse(code); } catch (error) { return; }
    // Redeclaring an active component replaces its editable and invalidates its controls.
    if ([...this.sessions.keys()].some(tracker => findComponentDef(ast, tracker.componentDescriptor.componentName))) {
      this.stopSessions();
    }
  }

  stopSessions () {
    const editor = this.editor;
    for (const tracker of [...this.sessions.keys()]) {
      const descriptor = tracker.componentDescriptor;
      descriptor.stopEditSession();
      tracker.trackedComponent.remove();
      for (const control of editor.submorphs.slice()) {
        if (control.componentDescriptor === descriptor) control.remove();
      }
      editor.removeAnchor('Component->' + descriptor.componentName);
    }
  }
}

/** Register a tracker with all full-source editors for its module. */
export function protectComponentSource (tracker) {
  if (typeof $world === 'undefined' || !$world.withAllSubmorphsSelect) return;
  const editors = getEligibleSourceEditorsFor(tracker.componentModuleId, tracker.currentModuleSource);
  for (const editor of editors) {
    let plugin = editor.pluginFind(plugin => plugin.isComponentSourceEditorPlugin);
    if (!plugin) plugin = editor.addPlugin(new ComponentSourceEditorPlugin(tracker.componentModule));
    plugin.addSession(tracker);
    (tracker._sourceEditorPlugins ||= new Set()).add(plugin);
  }
}
