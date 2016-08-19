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
      backgroundColor: "#bed8f7", zIndex: -3
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
      backgroundColor: "black", zIndex: -2
    }
  })
}

class RenderedChunk {

  constructor(text, config) {
    // config: {fontFamily, fontSize, fontMetric, fontColor}
    this.config = config;
    this.text = text;

    this.rendered = undefined;
    this._charBounds = undefined;
    this._width = undefined;
    this._height = undefined;
    return this;
  }

  compatibleWith(text2, fontFamily2, fontSize2, fontMetric2, fontColor2, fontKerning2) {
    var {text, config: {fontFamily, fontSize, fontMetric, fontColor, fontKerning}} = this;
    return text       === text2
        && fontFamily === fontFamily2
        && fontSize   === fontSize2
        && fontColor  === fontColor2
        && fontMetric === fontMetric2
        && fontKerning === fontKerning2;
  }

  get height() {
    if (this._height === undefined) this.computeBounds();
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
    let {text, config: {fontFamily, fontSize, fontMetric}} = this,
        {height, width} = fontMetric.sizeForStr(fontFamily, fontSize, text);

    this._height = height;
    this._width = width;
    return this;
  }

  computeCharBounds() {
    let {text, config: {fontFamily, fontSize, fontMetric}} = this;
    text += newline;
    let nCols = text.length,
        _charBounds = this._charBounds = new Array(nCols);
    for (let col = 0, x = 0; col < nCols; col++) {
      let {width,height} = fontMetric.sizeFor(fontFamily, fontSize, text[col]);
      _charBounds[col] = {x, y: 0, width, height};
      x += width;
    }
  }

  render() {
    if (this.rendered) return this.rendered;
    var {config: {fontSize, fontFamily, fontColor, fontKerning}, text, width, height} = this,
        textNodes = text ? fontKerning ? text
                                       : text.split("").map(c => h("span", c))
                         : h("br");
    fontColor = fontColor || "";

    return this.rendered = h("div", {
      style: {
        pointerEvents: "none",
        fontSize: fontSize + "px",
        fontFamily,
        lineHeight: "initial",
        color: fontColor.isColor ? fontColor.toString() : String(fontColor)
      }
    }, textNodes);
  }

  boundsFor(column) {
    var charBounds = this.charBounds
    return charBounds[column] || charBounds[charBounds.length-1];
  }

  xOffsetFor(column) {
    var bounds = this.boundsFor(column);
    return bounds ? bounds.x : 0;
  }

  columnForXOffset(xInPixels) {
    var {charBounds} = this,
        length = charBounds.length;
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

    let {fontFamily, fontSize, fontColor, fontKerning, document} = morph,
        fontMetric = this.fontMetric,
        lines = document.lines,
        nRows = lines.length;

    // for now: 1 line = 1 chunk
    for (let row = 0; row < nRows; row++) {
      var chunk = this.chunks[row];
      if (!chunk || !chunk.compatibleWith(lines[row], fontFamily, fontSize, fontColor, fontKerning, fontMetric))
        this.chunks[row] = new RenderedChunk(lines[row], {fontFamily, fontSize, fontColor, fontKerning, fontMetric});
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
        .concat(morph.debug ? this.renderDebugLayer(morph) : [])
        .concat(this.renderTextLayer(morph))
        .concat(renderer.renderSubmorphs(morph))
      );
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

  renderDebugLayer(morph) {
    let {chunks} = this,
        {y: visibleTop} = morph.scroll,
        visibleBottom = visibleTop + morph.height,
        {padding} = morph,
        debugHighlights = [],
        paddingLeft = padding.left(),
        textHeight = padding.top(),
        textWidth = 0;

    for (let row = 0; row < chunks.length; row++) {
      let {width, height, charBounds} = chunks[row];
      for (let col = 0; col < charBounds.length; col++) {
        let {x, width, height} = charBounds[col];
        x += paddingLeft;
        debugHighlights.push(h("div", {
          style: {
            position: "absolute",
            left: x+"px",
            top: textHeight+"px",
            width: width+"px",
            height: height+"px",
            outline: "1px solid orange",
            pointerEvents: "none",
            zIndex: -1
          }
        }))
      }

      textHeight += height;
      textWidth = Math.max(textWidth, width);
      if (textHeight < visibleTop || textHeight > visibleBottom) continue;
    }

    debugHighlights.push(h("div", {
      style: {
        position: "absolute",
        left: padding.left()+"px",
        top: padding.top()+"px",
        width: textWidth+"px",
        height: textHeight+"px",
        outline: "1px solid red",
        pointerEvents: "none",
        zIndex: -1
      }
    }));

    return debugHighlights
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


  boundsFor(morph, {row, column}) {
    this.updateFromMorphIfNecessary(morph);
    let chunks = this.chunks,
        maxLength = chunks.length-1,
        safeRow = Math.max(0, Math.min(maxLength, row)),
        line = chunks[safeRow];

    if (!line) return pt(0,0);

    for (var y = 0, i = 0; i < safeRow; i++)
      y += chunks[i].height;
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