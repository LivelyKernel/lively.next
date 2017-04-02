import { Rectangle } from "lively.graphics";

function todo(name) { throw new Error("not yet implemented " + name)}

export default class TextLayout {

  constructor() {
    this.layoutComputed = false;
    this.fontMetric = null
  }

  reset() {
    // todo("reset");
  }

  textBounds(morph) {
    let {
      viewState,
      defaultStyle,
      width,
      lineWrapping: wraps,
      document
    } = morph;
    morph.textRenderer.estimateLineHeights(viewState, document, defaultStyle, width, wraps, false/*force*/);
    return new Rectangle(0,0, width, document.height);
  }

  wrappedLines(morph) { todo("wrappedLines"); }

  isFirstLineVisible() { todo("isFirstLineVisible"); }
  isLastLineVisible() { todo("isLastLineVisible"); }
  isLineVisible(morph, row) { todo("isLineVisible"); }
  isLineFullyVisible(morph, row) { todo("isLineFullyVisible"); }

  rangesOfWrappedLine(morph, row) { todo("rangesOfWrappedLine"); }
  
  shiftLinesIfNeeded(morph, range, action) {
    // action = "insertText"|"deleteText"
    todo("shiftLinesIfNeeded");
  }

  chunkAtPos(morph, pos) { todo("chunkAtPos"); }
  chunkAtScreenPos(morph, pos) { todo("chunkAtScreenPos"); }
  
  screenToDocPos(morph, screenPos) { todo("screenToDocPos"); }
  docToScreenPos(morph, docPos) { todo("docToScreenPos"); }
  screenPosFor(morph, docPos) { todo("screenPosFor"); }
  
  boundsFor(morph, docPos) { todo("boundsFor"); }
  pixelPositionFor(morph, docPos) { todo("pixelPositionFor"); }

}