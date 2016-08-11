import { Morph } from "../index.js";
import { defaultAttributes } from "../rendering/morphic-default.js";
import { h } from "virtual-dom";

export class ClipboardHelper extends Morph {

  get isClipboardHelper() { return true; }

  render(renderer) {
    return h('textarea', {
      ...defaultAttributes(this),
      resize: "none",
      value: " ",
      style: {
        position: "absolute",
        width: "0px",
        height: "0px",
        overflow: "hidden",
        padding: "0px",
        border: "0px"
      }});
  }

  onFocus(evt) { this._hasFocus = true; }

  onBlur(evt) {
    this._hasFocus = false;
    this.makeDirty();
  }
}