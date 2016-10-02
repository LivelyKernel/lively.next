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

function chunksFrom(textOfLine, fontMetric, textAttributesOfLine) {
  let chunks = [];
  for (var i = 0; i < textAttributesOfLine.length; i += 3) {
    var startCol = textAttributesOfLine[i],
        endCol = textAttributesOfLine[i+1],
        attributes = textAttributesOfLine[i+2];
    chunks.push(new TextChunk(textOfLine.slice(startCol, endCol), fontMetric, attributes));
  }
  return chunks;
}

function updateChunks(oldChunks, newChunks) {
  // compares oldChunks with newChunks and modifies(!) oldChunks so that the
  // oldChunks list gets patched with changed or new chunks
  // returns true if changes occurred, false otherwise
  if (!oldChunks.length && newChunks.length) {
    oldChunks.push(...newChunks);
    return true;
  }

  let oldChunkCount = oldChunks.length,
      newChunkCount = newChunks.length,
      changed = false;

  for (let i = 0; i < newChunks.length; i++) {
    let oldChunk = oldChunks[i],
        newChunk = newChunks[i],
        { text: newText, fontMetric: newFontMetric, textAttributes: newTextAttributes } = newChunk;
    if (!oldChunk || !oldChunk.compatibleWith(newText, newFontMetric, newTextAttributes)) {
      oldChunks[i] = newChunk;
      changed = true;
    }
  }

  if (newChunkCount < oldChunkCount) {
    oldChunks.splice(newChunkCount, oldChunkCount - newChunkCount);
    changed = true;
  }

  return changed;
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
    // return false;
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
    let width = 0, height = 0,
        bounds = this.charBounds,
        nBounds = bounds.length;
    if (nBounds === 0) {
      height = this.fontMetric.defaultLineHeight(this.style);
    } else {
      for (var i = 0; i < bounds.length; i++) {
        var char = bounds[i];
        width += char.width;
        height = Math.max(height, char.height);
      }
    }
    this._height = height;
    this._width = width;
    return this;
  }

  computeCharBounds() {
    let {text, fontMetric, style} = this;
    this._charBounds = text.length === 0 ?
      [] : fontMetric.charBoundsFor(style, text);
  }

  splitAt(splitWidth) {
    var width = this.width;
    if (splitWidth <= 0 || width < splitWidth) return [this];

    var {_charBounds, _style, _height, text, fontMetric, textAttributes} = this;

    if (!_charBounds.length) return [this];

    // if (splitWidth < _charBounds[0].width) return [null, this];

    for (let i = 1/*min 1 char*/; i < _charBounds.length; i++) {
      let {x, width: w} = _charBounds[i],
          currentWidth = x+w;
      if (currentWidth <= splitWidth) continue;
      let left = Object.assign(
                  new TextChunk(text.slice(0, i), fontMetric, textAttributes),
                  {_style, _width: x, _height, _charBounds: _charBounds.slice(0, i)}),
          nextWidth = 0,
          charBoundsSplitted = _charBounds.slice(i).map(ea => {
            nextWidth += ea.width; return {...ea, x: ea.x-x} }),
          right = Object.assign(
            new TextChunk(text.slice(i), fontMetric, textAttributes),
            {_style, _width: nextWidth, _height, _charBounds: charBoundsSplitted});

      return [left, right]

    }

    console.warn("Chunk split failed! Reached max width but found no char bounds to split");
    return [this];
  }

}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

class TextLayoutLine {

  constructor(chunks = []) {
    this.chunks = chunks;
    this.resetCache();
  }

  resetCache() {
    this.rendered = this._charBounds = this._height = this._width = undefined;
  }

  get length() {
    var l = 0;
    for (let i = 0; i < this.chunks.length; i++)
      l += this.chunks[i].length
    return l;
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
    for (let i = 0; i < this.chunks.length; i++) {
      var chunk = this.chunks[i];
      this._width += chunk.width;
      this._height = Math.max(this._height, chunk.height);
    }
    return this;
  }

  updateIfNecessary(newChunks) {
    var changed = updateChunks(this.chunks, newChunks);
    changed && this.resetCache();
    return changed;
  }

  boundsFor(column) {
    var charBounds = this.charBounds;
    return charBounds[column]
        || charBounds[charBounds.length-1]
        || {x: 0, y: 0, width: 0, height: 0};
  }

  rowColumnOffsetForPixelPos(xInPixels, yInPixels) {
    let {charBounds} = this,
        length = charBounds.length,
        first = charBounds[0],
        last = charBounds[length-1],
        result = {row: 0, column: 0};

    // everything to the left of the first char + half its width is col 0
    if (!length || xInPixels <= first.x+Math.round(first.width/2)) return result;

    // everything to the right of the last char + half its width is last col
    if (xInPixels > last.x+Math.round(last.width/2)) {
      result.column = length-1;
      return result;
    }

    // find col so that x between right side of char[col-1] and left side of char[col]
    for (var i = length-2; i >= 0; i--) {
      let {x, width} = charBounds[i];
      if (xInPixels >= x + Math.round(width/2)) {
        result.column = i+1;
        return result;
      }
    }

    return result;
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


class WrappedTextLayoutLine {

  constructor() {
    this.chunks = [];
    this.wrappedLines = [];
    this._wrapAt = Infinity;
    this.resetCache();
  }

  resetCache() {
    this._charBounds = this._height = this._width = undefined;
  }

  get length() {
    var l = 0;
    for (let i = 0; i < this.wrappedLines.length; i++)
      l += this.wrappedLines[i].length
    return l;
  }

  get wrapAt() { return this._wrapAt; }
  set wrapAt(x) {
    var changed = this._wrapAt !== x;
    this._wrapAt = x;
    changed && this.resetCache();
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
    for (let i = 0; i < this.wrappedLines.length; i++) {
      let l = this.wrappedLines[i];
      this._width = Math.max(l.width, this._width);
      this._height += l.height;
    }
    return this;
  }

  updateIfNecessary(newcChunks, wrapAt) {
    let chunks = this.chunks,
        changed = updateChunks(chunks, newcChunks) || this.wrapAt !== wrapAt;

    if (!changed) return false;

    this.wrapAt = wrapAt;

    var chunksByLine = [[]],
        currentLineChunks = chunksByLine[0],
        x = 0;

    for (let i = 0; i < chunks.length; i++) {


      // let nextChunk = chunks.shift(),
      let nextChunk = chunks[i],
          nextW = nextChunk.width,
          nextX = x + nextW;

      if (x + nextW <= wrapAt) { x += nextW; currentLineChunks.push(nextChunk); continue; }
      // let localWraptAt = wrapAt-x;

      while (true) {
        let [split1, split2] = nextChunk.splitAt(wrapAt-x);
        if (split1) {
          x += split1.width;
          currentLineChunks.push(split1);
        }
        if (!split2) break;

        chunksByLine.push(currentLineChunks = []);
        x = 0;
        nextChunk = split2;
      }

    }

    let nLines = chunksByLine.length;

    for (let i = 0; i < nLines; i++) {
      let chunks = chunksByLine[i],
          line = this.wrappedLines[i] || (this.wrappedLines[i] =  new TextLayoutLine())
      line.updateIfNecessary(chunks);
    }

    if (nLines !== this.wrappedLines.length) {
      this.wrappedLines.splice(nLines, this.wrappedLines.length - nLines);
    }

    this.resetCache();
    return true;
  }

  boundsFor(column) {
    var charBounds = this.charBounds;
    return charBounds[column]
        || charBounds[charBounds.length-1]
        || {x: 0, y: 0, width: 0, height: 0};
  }

  rowColumnOffsetForPixelPos(xInPixels, yInPixels) {
    // look for the wrapped line and offset row accordingly,
    // use rowColumnOffsetForPixelPos of simple line for column
    var line, currentHeight = 0, lines = this.wrappedLines;
    for (var i = 0; i < lines.length; i++) {
      line = lines[i];
      currentHeight += line.height;
      if (currentHeight > yInPixels) break;
    }
    return {
      column: line.rowColumnOffsetForPixelPos(xInPixels, currentHeight - yInPixels).column,
      row: i
    }
  }

  get charBounds() {
    if (this._charBounds === undefined) this.computeCharBounds();
    return this._charBounds;
  }

  computeCharBounds() {
    let currentX = 0, currentY = 0,
        { wrappedLines } = this;

    this._charBounds = [];

    for (let i = 0; i < wrappedLines.length; i++) {

      let { charBounds, height: lineHeight } = wrappedLines[i];

      for (let j = 0; j < charBounds.length; j++) {
        let bounds = charBounds[j],
            {x, y, width, height} = bounds;

        // add its bounding box
        this._charBounds.push({x: x + currentX, y: y+currentY, width, height});
      }

      currentY += lineHeight
    }

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

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // accessing
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  wrappedLines(morph) {
    this.updateFromMorphIfNecessary(morph);
    if (!this.lineWrapping)
      return this.lines;
    var wrappedLines = [], lines = this.lines;
    for (let i = 0; i < lines.length; i++)
      wrappedLines.push(...lines[i].wrappedLines);
    return wrappedLines;
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

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // updating
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

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
        lineWrappingBefore = this.lineWrapping,
        lineWrapping = this.lineWrapping = morph.lineWrapping,
        Line = lineWrapping ? WrappedTextLayoutLine : TextLayoutLine,
        wrapAt = lineWrapping && morph.fixedWidth ? morph.width : Infinity,
        fontMetric = this.fontMetric,
        docLines = doc.lines,
        nRows = docLines.length,
        textAttributesChunked = doc.textAttributesChunked(0, nRows-1),
        morphBounds = morph.innerBounds();

    // need different keinds of lines, so reset
    if (lineWrapping !== lineWrappingBefore) this.lines = [];

    for (let row = 0; row < nRows; row++) {
      let textAttributesOfLine = textAttributesChunked[row],
          text = docLines[row],
          line = this.lines[row],
          chunksOfLine = chunksFrom(text, fontMetric, textAttributesOfLine);

      if (!line) line = this.lines[row] = new Line();
      line.updateIfNecessary(chunksOfLine, wrapAt);
    }
    this.lines.splice(nRows, this.lines.length - nRows);

    this.layoutComputed = true;
    return true;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // position access and conversion, including
  // pixel pos <=> doc pos <=> screen pos
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  pixelPositionFor(morph, docPos) {
    var { x, y } = this.boundsFor(morph, docPos);
    return pt(x, y);
  }

  pixelPositionForIndex(morph, index) {
    var pos = morph.document.indexToPosition(index);
    return this.pixelPositionFor(morph, pos);
  }

  pixelPositionForScreenPos(morph, pos) {
    var { x, y } = this.boundsForScreenPos(morph, pos);
    return pt(x, y);
  }

  boundsFor(morph, docPos) {
    return this.boundsForScreenPos(morph, this.docToScreenPos(morph, docPos));
  }

  boundsForIndex(morph, index) {
    this.updateFromMorphIfNecessary(morph);
    var pos = morph.document.indexToPosition(index);
    return this.boundsFor(morph, pos);
  }

  boundsForScreenPos(morph, {row, column}) {
    this.updateFromMorphIfNecessary(morph);
    let lines = this.wrappedLines(morph),
        maxLength = lines.length-1,
        safeRow = Math.max(0, Math.min(maxLength, row)),
        line = lines[safeRow];

    if (!line) return new Rectangle(0,0,0,0);

    for (var y = 0, i = 0; i < safeRow; i++)
      y += lines[i].height;
    let { x, width, height } = line.boundsFor(column);
    return new Rectangle(x, y, width, height);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  screenPositionFor(morph, point) {
    this.updateFromMorphIfNecessary(morph);
    var lines = this.wrappedLines(morph);
    if (!lines.length) return {row: 0, column: 0};

    let {x,y: remainingHeight} = point, line, row = 0;
    if (remainingHeight < 0) remainingHeight = 0;

    for (; row < lines.length; row++) {
      line = lines[row];
      if (remainingHeight < line.height) break;
      remainingHeight -= line.height;
    }
    row = Math.min(row, lines.length-1)

    var {row: rowOffset, column: columnOffset} =
      line.rowColumnOffsetForPixelPos(x, remainingHeight);

    return {row: row+rowOffset, column: columnOffset};
  }

  textIndexFor(morph, point) {
    var pos = this.textPositionFor(morph, point);
    return morph.document.positionToIndex(pos);
  }

  textBounds(morph) {
    this.updateFromMorphIfNecessary(morph);
    let textWidth = 0, textHeight = 0,
        lines = this.wrappedLines(morph);
    for (let row = 0; row < lines.length; row++) {
      var {width, height} = lines[row];
      textWidth = Math.max(width, textWidth);
      textHeight += height;
    }
    return new Rectangle(0,0, textWidth, textHeight);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  docToScreenPos(morph, {row, column}) {
    if (!this.lineWrapping) return {row, column};
    this.updateFromMorphIfNecessary(morph);
    var screenRow = Math.max(0, row),
        line = this.lines[row];
    if (!line) line = this.lines[row = this.lines.length-1];
    if (!line) return {row: 0, column: 0};

    var screenRows = 0;
    for (let j = 0; j < row; j++)
      screenRows += this.lines[j].wrappedLines.length;

    var columnLeft = column, nChars;
    for (var i = 0; i < line.wrappedLines.length; i++) {
      nChars = line.wrappedLines[i].length;
      if (columnLeft < nChars)
        return {row: screenRows+i, column: columnLeft}
      columnLeft -= nChars;
    }
    return {row: screenRows+i-1, column: nChars}
  }

  screenToDocPos(morph, {row, column}) {
    if (!this.lineWrapping) {
      row = Math.max(0, Math.min(row, this.lines.length-1));
      column = Math.max(0, Math.min(column, this.lines.length));
      return {row, column};
    }

    this.updateFromMorphIfNecessary(morph);

    let wrappedLines = [], lines = this.lines,
        targetLine,
        screenRow = 0,
        docCol, docRow, found = false;

    for (docRow = 0; docRow < lines.length; docRow++) {
      docCol = 0;
      let wrappedLines = lines[docRow].wrappedLines;
      for (let i = 0; i < wrappedLines.length; i++, screenRow++) {
        if (screenRow === row) {
          column = Math.min(column, wrappedLines[i].length);
          docCol += column;
          found = true;
          break;
        }
        docCol += wrappedLines[i].length;
      }
      if (found) break;
    }

    return found ?
      {row: docRow, column: docCol} :
      {row: docRow-1, column: lines[docRow-1].length};
  }

}
