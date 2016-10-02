import { arr, string, obj } from "lively.lang";
import { pt, Rectangle } from "lively.graphics";

const newline = "\n",
      newlineLength = 1; /*fixme make work for cr lf windows...*/

const styleProps = ["fontFamily", "fontSize", "fontColor", "fontWeight",
                    "fontStyle", "textDecoration", "fixedCharacterSpacing"];

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function styleFromTextAttributes(textAttributes) {
  var s = {};
  for (var i = 0; i < textAttributes.length; i++) {
    var d = textAttributes[i].data;
    if ("fontFamily" in d)            s.fontFamily = d.fontFamily;
    if ("fontSize" in d)              s.fontSize = d.fontSize;
    if ("fontColor" in d)             s.fontColor = d.fontColor;
    if ("fontWeight" in d)            s.fontWeight = d.fontWeight;
    if ("fontStyle" in d)             s.fontStyle = d.fontStyle;
    if ("textDecoration" in d)        s.textDecoration = d.textDecoration;
    if ("fixedCharacterSpacing" in d) s.fixedCharacterSpacing = d.fixedCharacterSpacing;
  }
  return s;
}

class TextChunk {

  constructor(text, fontMetric, textAttributes) {
    this.fontMetric = fontMetric;
    this.textAttributes = textAttributes;
    this.text = text;

    this.rendered = undefined;
    this._style = undefined;
    this._charBounds = undefined;
    this._width = undefined;
    this._height = undefined;
    return this;
  }

  get style() {
    return this._style || (this._style = styleFromTextAttributes(this.textAttributes));
  }

  compatibleWith(text2, fontMetric2, textAttributes2) {
    var {text, fontMetric, style} = this;
    return text === text2
        && fontMetric === fontMetric2
        // FIXME!!!!!! that's sloooooow....
        && obj.equals(style, styleFromTextAttributes(textAttributes2));
  }

  get height() {
    if (!this._height === undefined) this.computeBounds();
    return this._height;
  }

  get width() {
    if (this._width === undefined) this.computeBounds();
    return this._width;
  }

  get length() { return this.text.length; }

  get charBounds() {
    if (this._charBounds === undefined) this.computeCharBounds();
    return this._charBounds;
  }

  computeBounds() {
    let width = 0, height = 0;

    this.charBounds.map(char => {
      width += char.width;
      height = Math.max(height, char.height);
    });
    this._height = height;
    this._width = width;
    return this;
  }

  computeCharBounds() {
    let {text, fontMetric, style} = this;
    this._charBounds = text.length === 0 ?
      [] : fontMetric.charBoundsFor(style, text);
  }

  splitToNotBeWiderAs(maxWidth) {
    if (this.width <= maxWidth) return [this];

    var {charBounds, _style, _height} = this,
        chunks = [];

    var current = {from: 0, width: 0};
    var lastSplitX = 0;

    for (var i = 0; i < charBounds.length; i++) {
      var {x,width} = charBounds[i];
      if (current.width === 0
       || x-lastSplitX + current.width + width <= maxWidth) { current.width += width; continue; }

      chunks.push(Object.assign(new TextChunk(this.text.slice(current.from, i), this.fontMetric, this.textAttributes), {
        _style, _width: current.width, _height, _charBounds: charBounds.slice(current.from, i)}));

      current.width = width;
      current.from = i;
      lastSplitX = x + width;
    }

    if (current.width) {
      chunks.push(Object.assign(new TextChunk(this.text.slice(current.from, i), this.fontMetric, this.textAttributes), {
        _style, _width: current.width, _height, _charBounds: charBounds.slice(current.from, i)}));
    }
// console.log(`${current.from}, ${i}`)
    
    return chunks;
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

class TextLayoutLine {

  static chunksFrom(text, fontMetric, textAttributesOfLine) {
    let chunks = [];
    for (var i = 0; i < textAttributesOfLine.length; i += 3) {
      var startCol = textAttributesOfLine[i],
          endCol = textAttributesOfLine[i+1],
          attributes = textAttributesOfLine[i+2];
      chunks.push(new TextChunk(text.slice(startCol, endCol), fontMetric, attributes));
    }
    return chunks;
  }

  constructor(text, fontMetric, textAttributesOfLine) {
    this.updateIfNecessary(text, fontMetric, textAttributesOfLine);
  }

  resetCache() {
    this.rendered = this._charBounds = this._height = this._width = undefined;
  }

  get height() {
    if (this._height === undefined) this.computeBounds();
    return this._height;
  }

  get width() {
    if (this._width === undefined) this.computeBounds();
    return this._width;
  }

  computeBounds() {
    this._width = this._height = 0;
    this.chunks.map(chunk => {
      this._width += chunk.width;
      this._height = Math.max(this._height, chunk.height);
    });
    return this;
  }

  updateIfNecessary(text, fontMetric, textAttributes) {
    let newChunks = this.constructor.chunksFrom(text, fontMetric, textAttributes),
        {chunks: oldChunks} = this;
    if (!oldChunks) {
      this.chunks = newChunks
      return;
    }

    let oldChunkCount = oldChunks.length,
        newChunkCount = newChunks.length,
        shouldReset = false;

    for (let i = 0; i < newChunks.length; i++) {
      let oldChunk = oldChunks[i],
          newChunk = newChunks[i],
          { text: newText, fontMetric: newFontMetric, textAttributes: newTextAttributes } = newChunk;
      if (!oldChunk || !oldChunk.compatibleWith(newText, newFontMetric, newTextAttributes)) {
        this.chunks[i] = newChunk;
        shouldReset = true;
      }
    }

    if (newChunkCount < oldChunkCount) {
      this.chunks.splice(newChunkCount, oldChunkCount - newChunkCount);
      shouldReset = true;
    }

    if (shouldReset) this.resetCache();
  }

  boundsFor(column) {
    var charBounds = this.charBounds;
    return charBounds[column]
        || charBounds[charBounds.length-1]
        || {x: 0, y: 0, width: 0, height: 0};
  }

  columnForXOffset(xInPixels) {
    let {charBounds} = this,
        length = charBounds.length,
        first = charBounds[0],
        last = charBounds[length-1];

    // everything to the left of the first char + half its width is col 0
    if (!length || xInPixels <= first.x+Math.round(first.width/2)) return 0;

    // everything to the right of the last char + half its width is last col
    if (xInPixels > last.x+Math.round(last.width/2)) return length-1;

    // find col so that x between right side of char[col-1] and left side of char[col]
    for (var i = length-2; i >= 0; i--) {
      let {x, width} = charBounds[i];
      if (xInPixels >= x + Math.round(width/2)) return i+1;
    }
    return 0;
  }

  get charBounds() {
    if (this._charBounds === undefined) this.computeCharBounds();
    return this._charBounds;
  }

  computeCharBounds() {
    let prefixWidth = 0,
        { chunks, height: lineHeight } = this,
        nChunks = chunks.length;
    this._charBounds = [];

    for (var i = 0; i < nChunks; i++) {
      let { charBounds, width, height } = chunks[i];

      for (let j = 0; j < charBounds.length; j++) {
        let bounds = charBounds[j],
            {x, y, width} = bounds;
        this._charBounds.push({x: x + prefixWidth, y, width, height: lineHeight});
      }

      prefixWidth += width;
    }

    // "newline"
    this._charBounds.push({x: prefixWidth, y: 0, width: 0, height: lineHeight});
  }

}

class TextLayoutWrappableLine extends TextLayoutLine {

  updateIfNecessary(text, fontMetric, textAttributes) {
    if (!this.wrappedLines) this.wrappedLines = [];

    var newVisibleBounds = text.innerBounds(),
        oldVisibleBounds = this.visibleBounds;

    if (!oldVisibleBounds || oldVisibleBounds.equals(newVisibleBounds)) {
      this.chunks.length = 0;
    }

    let newChunks = this.constructor.chunksFrom(text, fontMetric, textAttributes),
        {chunks: oldChunks} = this;
    if (!oldChunks) {
      this.chunks = newChunks
      return;
    }

    let oldChunkCount = oldChunks.length,
        newChunkCount = newChunks.length,
        shouldReset = false;

    for (let i = 0; i < newChunks.length; i++) {
      let oldChunk = oldChunks[i],
          newChunk = newChunks[i],
          { text: newText, fontMetric: newFontMetric, textAttributes: newTextAttributes } = newChunk;
      if (!oldChunk || !oldChunk.compatibleWith(newText, newFontMetric, newTextAttributes)) {
        this.chunks[i] = newChunk;
        shouldReset = true;
      }
    }

    if (newChunkCount < oldChunkCount) {
      this.chunks.splice(newChunkCount, oldChunkCount - newChunkCount);
      shouldReset = true;
    }

    if (shouldReset) this.resetCache();
  }

}


export default class TextLayout {

  constructor(fontMetric) {
    this.lineWrapping = false;
    this.reset(fontMetric);
  }

  reset(fontMetric) {
    this.layoutComputed = false;
    this.lines = [];
    if (fontMetric) this.fontMetric = fontMetric;
    this.firstVisibleLine = undefined;
    this.lastVisibleLine = undefined;
  }

  firstFullVisibleLine(morph) {
    var bounds = this.boundsFor(morph, {row: this.firstVisibleLine, column: 0});
    return this.firstVisibleLine + (bounds.top() < morph.scroll.y ? 1 : 0);
  }

  lastFullVisibleLine(morph) {
    var bounds = this.boundsFor(morph, {row: this.lastVisibleLine, column: 0});
    return this.lastVisibleLine + (bounds.bottom() > morph.scroll.y + morph.height ? -1 : 0);
  }

  defaultCharSize(morph) {
    return this.fontMetric.sizeFor(morph.fontFamily, morph.fontSize, "X");
  }

  shiftLinesIfNeeded(morph, {start, end}, changeType) {
    var nRows = end.row - start.row;
    if (nRows === 0) return;
    var nInsRows = changeType === "insertText" ? nRows : 0,
        nDelRows = changeType === "deleteText" ? nRows : 0,
        placeholderRows = Array(nInsRows);
    this.lines.splice(start.row+1, nDelRows, ...placeholderRows);
  }

  updateFromMorphIfNecessary(morph) {
    if (this.layoutComputed) return false;

// TODO: specify which lines have changed!

    let doc = morph.document,
        fontMetric = this.fontMetric,
        lines = doc.lines,
        nRows = lines.length,
        textAttributesChunked = doc.textAttributesChunked(0, nRows-1),
        Line = this.lineWrapping ? TextLayoutWrappableLine : TextLayoutLine,
        morphBounds = morph.innerBounds();

    for (let row = 0; row < nRows; row++) {
      let textAttributesOfLine = textAttributesChunked[row],
          text = lines[row],
          line = this.lines[row];
      if (!line)
        this.lines[row] = new Line(text, fontMetric, textAttributesOfLine);
      else
        line.updateIfNecessary(text, fontMetric, textAttributesOfLine);
    }
    this.lines.splice(nRows, this.lines.length - nRows);

    this.layoutComputed = true;
    return true;
  }

  pixelPositionFor(morph, pos) {
    var { x, y } = this.boundsFor(morph, pos);
    return pt(x, y);
  }

  pixelPositionForIndex(morph, index) {
    var pos = morph.document.indexToPosition(index);
    return this.pixelPositionFor(morph, pos);
  }

  textPositionFor(morph, point) {
    this.updateFromMorphIfNecessary(morph);
    var {lines} = this;
    if (!lines.length) return {row: 0, column: 0};

    let {x,y: remainingHeight} = point, line, row;
    if (remainingHeight < 0) remainingHeight = 0;
    for (row = 0; row < lines.length; row++) {
      line = lines[row];
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
    for (let row = 0; row < this.lines.length; row++) {
      var {width, height} = this.lines[row];
      textWidth = Math.max(width, textWidth);
      textHeight += height;
    }
    return new Rectangle(0,0, textWidth, textHeight);
  }


  boundsFor(morph, {row, column}) {
    this.updateFromMorphIfNecessary(morph);
    let {lines} = this,
        maxLength = lines.length-1,
        safeRow = Math.max(0, Math.min(maxLength, row)),
        line = lines[safeRow];

    if (!line) return new Rectangle(0,0,0,0);

    for (var y = 0, i = 0; i < safeRow; i++)
      y += lines[i].height;
    let { x, width, height } = line.boundsFor(column);
    return new Rectangle(x, y, width, height);
  }

  boundsForIndex(morph, index) {
    this.updateFromMorphIfNecessary(morph);
    var pos = morph.document.indexToPosition(index);
    return this.boundsFor(morph, pos);
  }
}
