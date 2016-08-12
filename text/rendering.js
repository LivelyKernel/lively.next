import { defaultStyle, defaultAttributes } from "../rendering/morphic-default.js";
import { h } from "virtual-dom";

export function renderText(renderer, textMorph) {
  let { textString, selection, readOnly, clipboardHelper, padding } = textMorph;
  return h("div", {
    ...defaultAttributes(textMorph),
    style: {
      ...defaultStyle(textMorph),
      cursor: textMorph.nativeCursor === "auto" ? (textMorph.readOnly ? "default" : "text") : textMorph.nativeCursor
    }
  }, [renderer.renderSubmorphs(textMorph),
      h("div.text", {
        style: {
          "pointer-events": "none",
          "white-space": "pre",
          "padding": `${padding.top()}px ${padding.right()}px ${padding.bottom()}px ${padding.left()}px`,
          "font-family": textMorph.fontFamily,
          "font-size": textMorph.fontSize + "px",
          "color": String(textMorph.fontColor)
        }
      }, [textString.substring(0, selection.start),
          h('span.selected.no-html-select', textString.substring(selection.start, selection.end)),
          h('span.cursor.no-html-select', { style: { visibility: (readOnly || !clipboardHelper._hasFocus ? "hidden" : "initial") } }, "\u200b"),
          textString.substring(selection.end)])]);
}
