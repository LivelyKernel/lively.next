import { CodeMirrorEnabledEditorPlugin } from '../editor-plugin.js';
import './mode.js';
import { getMode } from '../editor-modes.js';

export default class CSSEditorPlugin extends CodeMirrorEnabledEditorPlugin {
  get shortName () { return 'css'; }

  get isCSSEditorPlugin () { return true; }
}
