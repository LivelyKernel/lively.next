import { defaultStyle, defaultAttributes } from "../rendering/morphic-default.js";
import { h } from "virtual-dom";

export function renderText(renderer, textMorph) {
  let { textString, selection, readOnly, clipboardHelper } = textMorph;
  return h("div.text", {
    ...defaultAttributes(textMorph),
    style: {
      ...defaultStyle(textMorph),
      "white-space": "pre",
      padding: "0px",
      "font-family": textMorph.fontFamily,
      "font-size": textMorph.fontSize + "px",
      "color": String(textMorph.fontColor)
    }
  }, [
    renderer.renderSubmorphs(textMorph),
    textString.substring(0, selection.start),
    h('span.selected.no-html-select', textString.substring(selection.start, selection.end)),
    h('span.cursor.no-html-select', { style: { visibility: (readOnly || !clipboardHelper._hasFocus ? "hidden" : "initial") } }, "\u200b"),
    textString.substring(selection.end)
  ]);
}
