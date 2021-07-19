import CSSEditorPlugin from '../editor-plugin.js';
import '../mode.js';
import { getMode } from '../../editor-modes.js';

export default class LESSEditorPlugin extends CSSEditorPlugin {
  get shortName () { return 'text/x-less'; }

  get isCSSEditorPlugin () { return true; }
}
