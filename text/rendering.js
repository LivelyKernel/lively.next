import { defaultStyle, defaultAttributes } from "../rendering/morphic-default.js";
import { h } from "virtual-dom";
import { arr, string } from "lively.lang";
import { pt, Rectangle } from "lively.graphics";

function positionToIndex({row, column}, lines, startRow = 0) {
  // positionToIndex({row: 1, column: 1}, ["fooo", "barrrr"])
  var newlineLength = 1, /*fixme make work for cr lf windows...*/
      index = 0;
  row = Math.min(row, lines.length);
  for (var i = startRow; i < row; ++i)
    index += lines[i].length + newlineLength;
  return index + column;
}

function indexToPosition(index, lines, startRow = 0) {
  // indexToPosition(0, ["fooo", "barrrr"])
  if (lines.length === 0) return {row: 0, column: 0};
  var newlineLength = 1; /*fixme make work for cr lf windows...*/
  for (var i = startRow, l = lines.length; i < l; i++) {
    index -= lines[i].length + newlineLength;
    if (index < 0)
      return {row: i, column: index + lines[i].length + newlineLength};
  }
  return {row: l-1, column: lines[l-1].length};
}


function selectionLayerPart(startPos, endPos) {
  return h('div.selection-layer', {
    style: {
      pointerEvents: "none", position: "absolute",
      left: startPos.x + "px", top: startPos.y+"px",
      width: (endPos.x-startPos.x) + "px", height: (endPos.y-startPos.y)+"px",
      backgroundColor: "#bed8f7", zIndex: -1
    }
  })
}

function cursor(pos, height) {
    return h('div.selection-layer', {
    style: {
      pointerEvents: "none", position: "absolute",
      left: pos.x + "px", top: pos.y + "px",
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

  computeBounds() {
    let {height, width} = this.fontMetric.sizeForStr(this.fontFamily, this.fontSize, this.text);
    this._height = height;
    this._width = width;
    this.boundsComputed = true;
    return this;
  }

  computeCharBounds() {
    var {charBounds, text} = this
    let nCols = text.length;
    charBounds.length = nCols;
    for (let col = 0, x = 0; col < nCols; col++) {
      var size = this.fontMetric.sizeFor(this.fontFamily, this.fontSize, text[col]);
      size.x = x; size.y = 0;
      this.charBounds[col] = size;
      x += size.width;
    }
  }

  render() {
    if (this.rendered) return this.rendered;
    if (!this.boundsComputed) this.computeBounds();
    var {fontSize, fontFamily} = this;
    return this.rendered = h("div", {
      style: {pointerEvents: "none", fontSize: fontSize + "px", fontFamily}
    }, [this.text]);
  }

  xOffsetFor(column) {
    if (!this.charBoundsComputed) this.computeCharBounds();
    var bounds = this.charBounds[column] || this.charBounds[this.charBounds.length-1];
    return bounds ? bounds.x : 0;
  }

  columnForXOffset(xInPixels) {
    var {charBoundsComputed, charBounds} = this;
    if (!charBoundsComputed) this.computeCharBounds();
    var length = charBounds.length;
    if (!length || xInPixels < charBounds[0].x) return -1;
    if (xInPixels >= charBounds[length-1].x) return length-1;
    return charBounds.findIndex(({x, width}) => xInPixels >= x && xInPixels < x+width);
  }
}

export default class TextRenderer {

  constructor(fontMetric) {
    this.layoutComputed = false;
    this.lines = [];
    this.fontMetric = fontMetric;
  }

  updateLines(string, fontFamily, fontSize, fontMetric) {
    let lines = lively.lang.string.lines(string),
        nRows = lines.length;
    // for now: 1 line = 1 chunk
    for (let row = 0; row < nRows; row++) {
      this.lines[row] = this.lines[row] ?
        this.lines[row].updateText(lines[row], fontFamily, fontSize, fontMetric) :
        new RenderedChunk(lines[row], fontFamily, fontSize, fontMetric);
    }
    this.lines.splice(nRows, this.lines.length - nRows);
    this.layoutComputed = true;
    return this;
  }

  updateFromMorphIfNecessary(morph) {
    if (this.layoutComputed) return;
    var {fontFamily, fontSize, textString} = morph;
    this.updateLines(textString, fontFamily, fontSize, this.fontMetric);
  }

  renderMorph(renderer, morph) {
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

    var {start, end} = morph.selection;

    if (start > end) ([end, start] = [start, end]);

    var lines = this.lines.map(({text}) => text),
        startTextPos = indexToPosition(start, lines),
        endTextPos = indexToPosition(end, lines),
        startPos = this.pixelPositionFor(morph, startTextPos),
        endPos = this.pixelPositionFor(morph, endTextPos),
        endLineHeight = this.lines[endTextPos.row].height;

    // collapsed selection -> cursor
    if (start === end) {
      if (morph.rejectsInput()) return [];
      return [cursor(startPos, this.fontMetric.defaultLineHeight(morph.fontFamily, morph.fontSize))];
    }
    // single line -> one rectangle
    if (startTextPos.row === endTextPos.row) {
      return [selectionLayerPart(startPos, endPos.addXY(0, endLineHeight))]
    }

    var endPosLine1 = pt(morph.width, startPos.y+this.lines[startTextPos.row].height),
        startPosLine2 = pt(0, endPosLine1.y);

    // two lines -> two rectangles
    if (startTextPos.row+1 === endTextPos.row) {
      return [
        selectionLayerPart(startPos, endPosLine1),
        selectionLayerPart(startPosLine2, endPos.addXY(0, endLineHeight))];
    }

    var endPosMiddle = pt(morph.width, endPos.y),
        startPosLast = pt(0, endPos.y);

    // 3+ lines -> three rectangles
    return [
      selectionLayerPart(startPos, endPosLine1),
      selectionLayerPart(startPosLine2, endPosMiddle),
      selectionLayerPart(startPosLast, endPos.addXY(0, endLineHeight))];

  }

  renderTextLayer(morph) {
    this.updateFromMorphIfNecessary(morph);

    let {lines} = this,
        textWidth = 0, textHeight = 0,
        {y: visibleTop} = morph.scroll,
        visibleBottom = visibleTop + morph.height,
        lastVisibleLineBottom = 0,
        row = 0,
        spacerBefore,
        renderedLines = [],
        spacerAfter;

    for (;row < lines.length; row++) {
      let {width, height} = lines[row],
          newTextHeight = textHeight + height;
      if (newTextHeight >= visibleTop) break;
      textWidth = Math.max(width, textWidth);
      textHeight += height;
    }

    spacerBefore = h("div", {style: {height: textHeight+"px", width: textWidth+"px"}});

    for (;row < lines.length; row++) {
      let {width, height} = lines[row];
      if (textHeight > visibleBottom) break;
      renderedLines.push(lines[row].render());

      textWidth = Math.max(width, textWidth);
      textHeight += height;
    }

    lastVisibleLineBottom = textHeight;

    for (;row < lines.length; row++) {
      let {width, height} = lines[row];
      textWidth = Math.max(width, textWidth);
      textHeight += height;
    }

    spacerAfter = h("div", {style: {height: textHeight-lastVisibleLineBottom+"px", width: textWidth+"px"}});

    return h('div.text-layer', {
      style: {
        pointerEvents: "none", whiteSpace: "pre",
        width: textWidth+"px", height: textHeight+"px"
      }
    }, [spacerBefore].concat(renderedLines).concat(spacerAfter));
  }

  pixelPositionFor(morph, {row, column}) {
    this.updateFromMorphIfNecessary(morph);
    var line = this.lines[row];
    if (!line) throw new Error(`position ${row}/${column} out of bounds`);
    var y = 0; for (var i = 0; i < row; i++) y += this.lines[i].height
    return pt(line.xOffsetFor(column), y);
  }

  pixelPositionForIndex(morph, index) {
    var row, col;
    for (row = 0; row < this.lines.length; row++) {
      var textLength = this.lines[row].text.length;
      if (index <= textLength) break;
      index -= textLength + 1;
    }
    return this.pixelPositionFor(morph, {row, column: index});
  }

  textPositionFor(morph, pos) {
    this.updateFromMorphIfNecessary(morph);
    var {lines} = this;
    if (!lines.length) return {row: 0, column: 0};

    let {x,y: remainingHeight} = pos, line, row;
    for (row = 0; row < lines.length; row++) {
      line = lines[row];
      if (remainingHeight < line.height) break;
      remainingHeight -= line.height;
    }

    return {row, column: line.columnForXOffset(x)};
  }

  textBounds(morph) {
    this.updateFromMorphIfNecessary(morph);
    let textWidth = 0, textHeight = 0;
    for (let row = 0; row < this.lines.length; row++) {
      var {width, height} = this.lines[row];
      textWidth = Math.max(width, textWidth);
      textHeight += height;
    }
    return new Rectangle(0,0, textWidth, textHeight);
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