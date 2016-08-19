import { defaultStyle, defaultAttributes } from "../rendering/morphic-default.js";
import { h } from "virtual-dom";
import { arr, string } from "lively.lang";
import { pt, Rectangle } from "lively.graphics";

const newline = "\n",
      newlineLength = 1; /*fixme make work for cr lf windows...*/

// TODO: Would probably be cleaner to apply padding to a div containing the "entire" selection layer...
function selectionLayerPart(startPos, endPos, padding = Rectangle.inset(0,0,0,0)) {
  return h('div.selection-layer-part', {
    style: {
      pointerEvents: "none", position: "absolute",
      left: startPos.x + padding.left() + "px", top: startPos.y + padding.top() + "px",
      width: (endPos.x-startPos.x) + "px", height: (endPos.y-startPos.y)+"px",
      backgroundColor: "#bed8f7", zIndex: -1
    }
  })
}

// TODO: Would probably be cleaner to apply padding to a div containing the "entire" selection layer...
function cursor(pos, height, padding = Rectangle.inset(0,0,0,0)) {
    return h('div.selection-layer-part', {
    style: {
      pointerEvents: "none", position: "absolute",
      left: pos.x + padding.left() + "px", top: pos.y + padding.top() + "px",
      width: "2px", height: height + "px",
      backgroundColor: "black", zIndex: -1
    }
  })
}

class RenderedChunk {

  constructor(text, fontFamily, fontSize, fontMetric) {
    this.updateText(text, fontFamily, fontSize, fontMetric);
  }

  updateText(text, fontFamily, fontSize, fontMetric) {
    if (text === this.text
     && this.fontFamily === fontFamily
     && this.fontSize === fontSize
     && this.fontMetric === fontMetric) return this;

    this.charBoundsComputed = false;
    this.charBounds = [];
    this.boundsComputed = false;
    this.rendered = null;
    this.text = text;
    this.fontFamily = fontFamily;
    this.fontSize = fontSize;
    this.fontMetric = fontMetric;
    this._width = null;
    this._height = null;
    return this;
  }

  get height() {
    if (!this.boundsComputed) this.computeBounds();
    return this._height;
  }

  get width() {
    if (!this.boundsComputed) this.computeBounds();
    return this._width;
  }

  get length() { return this.text.length; }

  computeBounds() {
    let {height, width} = this.fontMetric.sizeForStr(this.fontFamily, this.fontSize, this.text);
    this._height = height;
    this._width = width;
    this.boundsComputed = true;
    return this;
  }

  computeCharBounds() {
    var {charBounds, text, fontFamily, fontSize, fontMetric} = this;
    text += newline;
    let nCols = text.length;
    charBounds.length = nCols;
    for (let col = 0, x = 0; col < nCols; col++) {
      var {width,height} = fontMetric.sizeFor(fontFamily, fontSize, text[col]);
      this.charBounds[col] = {x, y: 0, width,height};
      x += width;
    }
  }

  render() {
    if (this.rendered) return this.rendered;
    if (!this.boundsComputed) this.computeBounds();
    var {fontSize, fontFamily, text} = this;
    return this.rendered = h("div", {
      style: {pointerEvents: "none", fontSize: fontSize + "px", fontFamily}
    }, [text || h("br")]);
  }

  boundsFor(column) {
    if (!this.charBoundsComputed) this.computeCharBounds();
    return this.charBounds[column] || this.charBounds[this.charBounds.length-1];
  }

  xOffsetFor(column) {
    var bounds = this.boundsFor(column);
    return bounds ? bounds.x : 0;
  }

  columnForXOffset(xInPixels) {
    var {charBoundsComputed, charBounds} = this;
    if (!charBoundsComputed) this.computeCharBounds();
    var length = charBounds.length;
    if (!length || xInPixels < charBounds[0].x) return 0;
    if (xInPixels >= charBounds[length-1].x) return length-1;
    return charBounds.findIndex(({x, width}) => xInPixels >= x && xInPixels < x+width);
  }
}

export default class TextLayout {

  constructor(fontMetric) {
    this.layoutComputed = false;
    this.chunks = [];
    this.fontMetric = fontMetric;
  }

  updateFromMorphIfNecessary(morph) {
    if (this.layoutComputed) return;

    let {fontFamily, fontSize, fontColor, document} = morph,
        fontMetric = this.fontMetric,
        lines = document.lines,
        nRows = lines.length;

    // for now: 1 line = 1 chunk
    for (let row = 0; row < nRows; row++) {
      var chunk = this.chunks[row];
      if (!chunk || !chunk.compatibleWith(lines[row], fontFamily, fontSize, fontColor, fontMetric))
        this.chunks[row] = new RenderedChunk(lines[row], {fontFamily, fontSize, fontColor, fontMetric});
    }

    this.chunks.splice(nRows, this.chunks.length - nRows);
    this.layoutComputed = true;
    return this;
  }

  renderMorph(renderer, morph) {
    this.updateFromMorphIfNecessary(morph);

    return h("div", {
      ...defaultAttributes(morph),
      style: {
        ...defaultStyle(morph),
        cursor: morph.nativeCursor === "auto" ?
          (morph.readOnly ? "default" : "text") :
          morph.nativeCursor
      }
    }, this.renderSelectionLayer(morph)
        .concat(this.renderTextLayer(morph))
        .concat(renderer.renderSubmorphs(morph)));
  }

  renderSelectionLayer(morph) {
    // FIXME just hacked together... needs cleanup!!!

    var {start, end} = morph.selection,
        {padding, document} = morph;

    if (start > end) [end, start] = [start, end];

    var chunks        = this.chunks,
        startTextPos  = document.indexToPosition(start),
        endTextPos    = document.indexToPosition(end),
        startPos      = this.pixelPositionFor(morph, startTextPos),
        endPos        = this.pixelPositionFor(morph, endTextPos),
        endLineHeight = chunks[endTextPos.row].height;

    // collapsed selection -> cursor
    if (start === end) {
      if (morph.rejectsInput()) return [];
      let {fontFamily, fontSize} = morph,
          chunkAtCursor = chunks[startTextPos.row],
          h = chunkAtCursor ? chunkAtCursor.height : this.fontMetric.defaultLineHeight(fontFamily, fontSize);
      return [cursor(startPos, chunks[startTextPos.row].height, padding)];
    }

    // single line -> one rectangle
    if (startTextPos.row === endTextPos.row) {
      return [selectionLayerPart(startPos, endPos.addXY(0, endLineHeight), padding)]
    }

    var endPosLine1 = pt(morph.width, startPos.y + chunks[startTextPos.row].height),
        startPosLine2 = pt(0, endPosLine1.y);

    // two lines -> two rectangles
    if (startTextPos.row+1 === endTextPos.row) {
      return [
        selectionLayerPart(startPos, endPosLine1, padding),
        selectionLayerPart(startPosLine2, endPos.addXY(0, endLineHeight), padding)];
    }

    var endPosMiddle = pt(morph.width, endPos.y),
        startPosLast = pt(0, endPos.y);

    // 3+ lines -> three rectangles
    return [
      selectionLayerPart(startPos, endPosLine1, padding),
      selectionLayerPart(startPosLine2, endPosMiddle, padding),
      selectionLayerPart(startPosLast, endPos.addXY(0, endLineHeight), padding)];

  }

  renderTextLayer(morph) {
    let {chunks} = this,
        textWidth = 0, textHeight = 0,
        {y: visibleTop} = morph.scroll,
        visibleBottom = visibleTop + morph.height,
        {padding} = morph,
        lastVisibleLineBottom = 0,
        row = 0,
        spacerBefore,
        renderedLines = [],
        spacerAfter;

    for (;row < chunks.length; row++) {
      let {width, height} = chunks[row],
          newTextHeight = textHeight + height;
      if (newTextHeight >= visibleTop) break;
      textWidth = Math.max(width, textWidth);
      textHeight += height;
    }

    spacerBefore = h("div", {style: {height: textHeight+"px", width: textWidth+"px"}});

    for (;row < chunks.length; row++) {
      let {width, height} = chunks[row];
      if (textHeight > visibleBottom) break;
      renderedLines.push(chunks[row].render());

      textWidth = Math.max(width, textWidth);
      textHeight += height;
    }

    lastVisibleLineBottom = textHeight;

    for (;row < chunks.length; row++) {
      let {width, height} = chunks[row];
      textWidth = Math.max(width, textWidth);
      textHeight += height;
    }

    spacerAfter = h("div", {style: {height: textHeight-lastVisibleLineBottom+"px", width: textWidth+"px"}});

    return h('div.text-layer', {
      style: {
        pointerEvents: "none", whiteSpace: "pre",
        width: textWidth+"px", height: textHeight+"px",
        padding: `${padding.top()}px ${padding.right()}px ${padding.bottom()}px ${padding.left()}px`
      }
    }, [spacerBefore].concat(renderedLines).concat(spacerAfter));
  }

  pixelPositionFor(morph, pos) {
    var { x, y } = this.boundsFor(morph, pos);
    return pt(x, y);
  }

  pixelPositionForIndex(morph, index) {
    var pos = morph.document.indexToPosition(index);
    return this.pixelPositionFor(morph, pos);
  }

  textPositionFor(morph, pos) {
    this.updateFromMorphIfNecessary(morph);
    var {chunks} = this;
    if (!chunks.length) return {row: 0, column: 0};

    let {x,y: remainingHeight} = pos, line, row;
    if (remainingHeight < 0) remainingHeight = 0;
    for (row = 0; row < chunks.length; row++) {
      line = chunks[row];
      if (remainingHeight < line.height) break;
      remainingHeight -= line.height;
    }

    return {row, column: line.columnForXOffset(x)};
  }

  textIndexFor(morph, point) {
    var pos = this.textPositionFor(morph, point);
    return morph.document.positionToIndex(pos);
  }

  textBounds(morph) {
    this.updateFromMorphIfNecessary(morph);
    let textWidth = 0, textHeight = 0;
    for (let row = 0; row < this.chunks.length; row++) {
      var {width, height} = this.chunks[row];
      textWidth = Math.max(width, textWidth);
      textHeight += height;
    }
    return new Rectangle(0,0, textWidth, textHeight);
  }


  pixelPositionFor(morph, {row, column}) {
    this.updateFromMorphIfNecessary(morph);
    let chunks = this.chunks,
        maxLength = chunks.length-1,
        safeRow = Math.max(0, Math.min(maxLength, row)),
        line = chunks[safeRow];

    if (!line) return pt(0,0);
    for (var y = 0, i = 0; i < safeRow; i++)
      y += chunks[i].height;
    return pt(line.xOffsetFor(column), y);
    let { x, width, height } = line.boundsFor(column);
    return new Rectangle(x, y, width, height);
  }

  boundsForIndex(morph, index) {
    this.updateFromMorphIfNecessary(morph);
    var pos = morph.document.indexToPosition(index);
    return this.boundsFor(morph, pos);
  }
}



/* -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
this is going towards tokenization, we will do this later in a seperate
tokenizer:

processLine(line, x, y, fontFamily, fontSize) {
  let fontMetric = this.fontMetric,
      rendered = [],
      [text] = line,
      maxHeight = 0,
      state = text === " " ? "space" : "text";

  for (let col = 1; col < line.length; col++) {
    let newState = line[col] === " " ? "space" : "text";
    if (newState !== state) {
      let {height, width} = fontMetric.sizeForStr(fontFamily, fontSize, text);
      rendered.push({x, y, height, text})
      maxHeight = Math.max(maxHeight, height);
      x += width;
      text = line[col];
      state = newState;
    } else {
      text += line[col];
    };
  }

  if (text.length) {
    let {height, width} = fontMetric.sizeForStr(fontFamily, fontSize, text);
    rendered.push({x, y, height, text})
    maxHeight = Math.max(maxHeight, height);
  }

  return {maxHeight, rendered};
}
*/