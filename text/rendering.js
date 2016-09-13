import { defaultStyle, defaultAttributes } from "../rendering/morphic-default.js";
import { h } from "virtual-dom";
import { arr, string, obj } from "lively.lang";
import { pt, Rectangle } from "lively.graphics";
import { Range } from "./range.js";
import { StyleRange } from "./style.js";

const newline = "\n",
      newlineLength = 1; /*fixme make work for cr lf windows...*/

function selectionLayerPart(startPos, endPos) {
  return h('div.selection-layer-part', {
    style: {
      pointerEvents: "none", position: "absolute",
      left: startPos.x + "px", top: startPos.y + "px",
      width: (endPos.x-startPos.x) + "px", height: (endPos.y-startPos.y)+"px",
      backgroundColor: "#bed8f7", zIndex: -3
    }
  })
}

function cursor(pos, height, visible) {
    return h('div.selection-layer-part', {
    style: {
      pointerEvents: "none", position: "absolute",
      left: pos.x -1 + "px", top: pos.y + "px",
      width: "2px", height: height + "px",
      backgroundColor: "black", zIndex: -1,
      display: visible ? "" : "none"
    }
  })
}


class RenderedLine {

  static chunksFrom(text, config) {
    let { fontMetric, styleRanges } = config;
    styleRanges = text ? styleRanges.filter(ea => !ea.isEmpty()) :
                         styleRanges.slice(0,1);
    return styleRanges.map(ea => RenderedChunk.fromStyleRange(text, fontMetric, ea));
  }

  constructor(text, config) {
    this.chunks = this.constructor.chunksFrom(text, config);
    return this;
  }

  get height() {
    return arr.max(this.chunks.map(chunk => chunk.height));
  }

  get width() {
    return arr.sum(this.chunks.map(chunk => chunk.width));
  }

  compatibleWith(text2, config2) {
    let chunks2 = this.constructor.chunksFrom(text2, config2),
        { chunks } = this;
    if (chunks.length !== chunks2.length) return false
    for (let i = 0; i < chunks.length; i++) {
      let chunk = chunks[i],
          { text: text2, config: config2 } = chunks2[i];
      if (!chunk.compatibleWith(text2, config2)) return false;
    }
    return true;
  }

  boundsFor(column) {
    let startCol = 0,
        startPixel = 0,
        { chunks } = this,
        lastIndex = chunks.length-1;
    for (let i = 0; ; i++) {
      let chunk = chunks[i],
          { text, width } = chunk,
          cols = text.length,
          endCol = startCol + cols;
      if ((column >= startCol && column < endCol)
          || i === lastIndex) {
        let columnInChunk = column - startCol,
            {x, y, width, height} = chunk.boundsFor(columnInChunk),
            offsetX = x + startPixel;
        return { x: x + startPixel, y, width, height };
      }
      startPixel += width;
      startCol += cols;
    }
  }

  columnForXOffset(xInPixels) {
    let startPixel = 0,
        startCol = 0,
        { chunks } = this,
        lastIndex = chunks.length-1,
        found = false;
    for (let i = 0; ; i++) {
      let chunk = chunks[i],
          { text, width } = chunks[i],
          cols = text.length,
          endPixel = startPixel + width;
      if ((xInPixels >= startPixel && xInPixels < endPixel)
          || i === lastIndex) {
        return startCol + chunk.columnForXOffset(xInPixels - startPixel);
      }
      startPixel += width;
      startCol += cols;
    }
  }

  get allCharBounds() {
    let prefixWidth = 0;
    return this.chunks.map(chunk => {
      let { charBounds, width } = chunk,
          offsetCharBounds = charBounds.map(bounds => ({ x: bounds.x + prefixWidth, y: bounds.y, width: bounds.width, height: bounds.height }));
      prefixWidth += width;
      return offsetCharBounds;
    });
  }

  render() {
    if (this.rendered) return this.rendered;
    let { chunks, height, width } = this;
    return this.rendered = h("div", { style: {
        position: "relative",
        lineHeight: 1
      }
    }, chunks.map(ea => ea.render()));
  }
}


class RenderedChunk {

  static fromStyleRange(lineText, fontMetric, styleRange) {
    let { start, end, style } = styleRange,
        startCol = start.column,
        endCol = end.column,
        chunkText = lineText.slice(startCol, endCol),
        chunkConfig = {style, fontMetric};
    return new RenderedChunk(chunkText, chunkConfig);
  }

  constructor(text, config) {
    this.config = config;
    this.text = text;

    this.rendered = undefined;
    this._charBounds = undefined;
    this._width = undefined;
    this._height = undefined;
    return this;
  }

  compatibleWith(text2, config2) {
    var {text, config} = this;
    return text                   === text2
        && config.fontMetric      === config2.fontMetric
        && obj.equals(config.style, config2.style);
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
    let {text, config: {style, fontMetric}} = this;
    text += newline;
    this._charBounds = fontMetric.charBoundsFor(style, text);
  }

  render() {
    if (this.rendered) return this.rendered;
    var { config: {style: {fontSize, fontFamily, fontColor,
                          fontWeight, fontStyle, textDecoration,
                          fixedCharacterSpacing}},
          text, width, height} = this,
        textNodes = text ?
                      fixedCharacterSpacing ?
                        text.split("").map(c => h("span", c)) :
                        text :
                      h("br");
    fontColor = fontColor || "";

    return this.rendered = h("span", {
      style: {
        lineHeight: 1,
        fontSize: fontSize + "px",
        fontFamily,
        fontWeight,
        fontStyle,
        textDecoration,
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
}

export default class TextLayout {

  constructor(fontMetric) {
    this.layoutComputed = false;
    this.lines = [];
    this.fontMetric = fontMetric;
  }

  updateFromMorphIfNecessary(morph) {
    if (this.layoutComputed) return;

    let { document } = morph,
        fontMetric = this.fontMetric,
        lines = document.lines,
        styleRanges = document.styleRanges,
        nRows = lines.length;

    for (let row = 0; row < nRows; row++) {
      let lineStyleRanges = document.styleRangesByLine[row],
          text = lines[row],
          config = { fontMetric, styleRanges: lineStyleRanges },
          line = this.lines[row];
      if (!line || !line.compatibleWith(text, config))
        this.lines[row] = new RenderedLine(text, config);
    }
    this.lines.splice(nRows, this.lines.length - nRows);

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

    if (!morph._selection) return [];

    let {start, end, lead, cursorVisible} = morph.selection,
        isReverse           = morph.selection.isReverse(),
        {padding, document} = morph,
        lines               = this.lines,
        paddingOffset       = padding.topLeft(),
        startPos            = this.pixelPositionFor(morph, start).addPt(paddingOffset),
        endPos              = this.pixelPositionFor(morph, end).addPt(paddingOffset),
        cursorPos           = isReverse ? startPos : endPos,
        endLineHeight       = lines[end.row].height;

    // collapsed selection -> cursor
    if (morph.selection.isEmpty())
      return [cursor(cursorPos, lines[lead.row].height, cursorVisible)];

    // single line -> one rectangle
    if (start.row === end.row)
      return [
        selectionLayerPart(startPos, endPos.addXY(0, endLineHeight)),
        cursor(cursorPos, lines[lead.row].height, cursorVisible)]

    let endPosLine1 = pt(morph.width, startPos.y + lines[start.row].height),
        startPosLine2 = pt(0, endPosLine1.y);

    // two lines -> two rectangles
    if (start.row+1 === end.row) {
      return [
        selectionLayerPart(startPos, endPosLine1),
        selectionLayerPart(startPosLine2, endPos.addXY(0, endLineHeight)),
        cursor(cursorPos, lines[lead.row].height, cursorVisible)];
    }

    let endPosMiddle = pt(morph.width, endPos.y),
        startPosLast = pt(0, endPos.y);

    // 3+ lines -> three rectangles
    return [
      selectionLayerPart(startPos, endPosLine1),
      selectionLayerPart(startPosLine2, endPosMiddle),
      selectionLayerPart(startPosLast, endPos.addXY(0, endLineHeight)),
      cursor(cursorPos, lines[lead.row].height, cursorVisible)];

  }

  renderTextLayer(morph) {
    let {lines} = this,
        textWidth = 0, textHeight = 0,
        {padding, scroll, height} = morph,
        {y: visibleTop} = scroll.subPt(padding.topLeft()),
        visibleBottom = visibleTop + height,
        lastVisibleLineBottom = 0,
        row = 0,
        spacerBefore,
        renderedLines = [],
        spacerAfter,
        lineLeft = padding.left(),
        lineTop = padding.top();

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
      renderedLines.push(lines[row].render(lineLeft, lineTop));

      textWidth = Math.max(width, textWidth);
      textHeight += height;
      lineTop += height;
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
        width: textWidth+"px", height: textHeight+"px",
        padding: `${padding.top()}px ${padding.right()}px ${padding.bottom()}px ${padding.left()}px`
      }
    }, [spacerBefore].concat(renderedLines).concat(spacerAfter));
  }

  renderDebugLayer(morph) {
    let {lines} = this,
        {y: visibleTop} = morph.scroll,
        visibleBottom = visibleTop + morph.height,
        {padding} = morph,
        debugHighlights = [],
        paddingLeft = padding.left(),
        paddingTop = padding.top(),
        textHeight = 0,
        textWidth = 0;

    for (let row = 0; row < lines.length; row++) {
      let {width, height, allCharBounds} = lines[row];
      for (let charBounds of allCharBounds) {
        for (let col = 0; col < charBounds.length; col++) {
          let {x, width, height} = charBounds[col],
                  y = textHeight + paddingTop;
          x += paddingLeft;
          debugHighlights.push(h("div", {
            style: {
              position: "absolute",
              left: x+"px",
              top: y+"px",
              width: width+"px",
              height: height+"px",
              outline: "1px solid orange",
              pointerEvents: "none",
              zIndex: -2
            }
          }))
        }
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
        zIndex: -2
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

    if (!line) return pt(0,0);

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