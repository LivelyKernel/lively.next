import { Rectangle } from "lively.graphics";
export default class TextLayout {

  constructor() {
    this.layoutComputed = false;
    this.fontMetric = null
  }

  reset() {}

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

  wrappedLines(morph) {}

  isFirstLineVisible() {}
  isLastLineVisible() {}
  isLineVisible(morph, row) {}
  isLineFullyVisible(morph, row) {}

  rangesOfWrappedLine(morph, row) {}
  
  shiftLinesIfNeeded(morph, range, action) {
    // action = "insertText"|"deleteText"
  }
  
  chunkAtPos(morph, pos) {}
  chunkAtScreenPos(morph, pos) {}
  
  screenToDocPos(morph, screenPos) {}
  docToScreenPos(morph, docPos) {}
  screenPosFor(morph, docPos) {}
  
  boundsFor(morph, docPos) {}
  pixelPositionFor(morph, docPos) {}

}