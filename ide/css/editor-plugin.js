import EditorPlugin from "../editor-plugin.js";

import "./mode.js"
import { getMode } from "../editor-modes.js";


export default class CSSEditorPlugin extends EditorPlugin {

  static get shortName() { return "css"; }

  constructor() {
    super()
    this.mode = getMode({}, {name: "css"});
  }

  get isCSSEditorPlugin() { return true }
}