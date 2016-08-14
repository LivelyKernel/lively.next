import { defaultStyle, defaultAttributes } from "../rendering/morphic-default.js";
import { h } from "virtual-dom";
import { arr } from "lively.lang";
import { pt, Rectangle } from "lively.graphics";

class RenderedChunk {

  constructor(text, fontFamily, fontSize, fontMetric) {
    this.updateText(text, fontFamily, fontSize, fontMetric);
  }

  updateText(text, fontFamily, fontSize, fontMetric) {
    if (text === this.text
     && this.fontFamily === fontFamily
     && this.fontSize === fontSize
     && this.fontMetric === fontMetric) return;

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
    this.updateFromMorphIfNecessary(morph);

    return h("div", {
      ...defaultAttributes(morph),
      style: {
        ...defaultStyle(morph),
        cursor: morph.nativeCursor === "auto" ? (morph.readOnly ? "default" : "text") : morph.nativeCursor
      }
    }, [

      h('div.text-layer', {
        style: {pointerEvents: "none"}
      }, arr.interpose(this.lines.map(line => line.render())))

    ].concat(renderer.renderSubmorphs(morph)));
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