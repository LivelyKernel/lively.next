import { Rectangle, pt } from "lively.graphics";
import { arr } from "lively.lang";
import { inspect } from "lively.morphic";
import { Range } from "../text/range.js";

function todo(name) { throw new Error("not yet implemented " + name)}

export default class TextLayout {

  constructor() {
    this.reset();
  }

  reset() {
    this.resetLineCharBoundsCache();
  }

  resetLineCharBoundsCache(morph) {
    this.lineCharBoundsCache = new WeakMap();
    if (morph) {
      this.estimateLineHeights(morph, true);
      morph.makeDirty();
    }
  }

  resetLineCharBoundsCacheOfLine(line) {
    if (!line) return;
    this.lineCharBoundsCache.set(line, null);
  }

  resetLineCharBoundsCacheOfRow(morph, row) {
    let doc = morph.document;
    doc && this.resetLineCharBoundsCacheOfLine(doc.getLine(row));
  }

  resetLineCharBoundsCacheOfRange(morph, range) {
    for (let row = range.start.row; row <= range.end.row; row++)
      this.resetLineCharBoundsCacheOfRow(morph, row);
  }

  estimateLineHeights(morph, force = false) {
    let {
          fontMetric, textRenderer, document,
          defaultTextStyle,
          extent: {x: morphWidth, y: morphHeight},
          clipMode, textAlign, padding, lineWrapping
        } = morph,
        paddingLeft = padding.left(),
        paddingRight = padding.right(),
        paddingTop = padding.top(),
        paddingBottom = padding.bottom(),
        { lines, stringSize } = document;

    // fast and exact version for small texts:
    if (morph.lineCount() < 10 && morph.document.stringSize < 3000) {
      var directRenderLineFn = textRenderer.directRenderLineFn(morph),
          directRenderTextLayerFn = textRenderer.directRenderTextLayerFn(morph),
          linesBounds = fontMetric.manuallyComputeBoundsOfLines(
            lines, 0, 0, {
              defaultTextStyle, width: morphWidth, height: morphHeight,
              clipMode, lineWrapping, textAlign,
              paddingLeft, paddingRight, paddingTop, paddingBottom
            }, directRenderTextLayerFn, directRenderLineFn);
      for (var i = 0; i < lines.length; i++) {
        var {width, height} = linesBounds[i];
        lines[i].changeExtent(width, height, false);
      }
      return;
    }

    var directRenderTextLayerFn = textRenderer.directRenderTextLayerFn(morph);

    morphWidth = morphWidth - paddingLeft - paddingRight;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (!force && line.height > 0) continue;

      var textAttributes = line.textAttributes, styles = [];

      // find all styles that apply to line
      if (!textAttributes || !textAttributes.length) styles.push(defaultTextStyle);
      else for (var j = 0; j < textAttributes.length; j++)
        styles.push({...defaultTextStyle, ...textAttributes[j]});

      // measure default char widths and heights
      var measureCount = styles.length, // for avg width
          charWidthSum = 0,
          charHeight = 0;
      for (var h = 0; h < measureCount; h++) {
        var {width, height} = fontMetric.defaultCharExtent({
          defaultTextStyle: styles[h],
          width: 1000,
          paddingBottom, paddingTop, paddingRight, paddingLeft
        }, directRenderTextLayerFn);
        charHeight = Math.max(height, charHeight);
        charWidthSum = charWidthSum + width;
      }

      var estimatedHeight = charHeight,
          charCount = line.text.length || 1,
          charWidth = Math.round(charWidthSum/measureCount),
          unwrappedWidth = charCount * charWidth,
          estimatedWidth = !lineWrapping ? unwrappedWidth : Math.min(unwrappedWidth, morphWidth);
      if (lineWrapping) {
        var charsPerline = Math.max(3, morphWidth / charWidth),
            wrappedLineCount = Math.ceil(charCount / charsPerline) || 1,
        estimatedHeight = Math.round(wrappedLineCount * charHeight);
      }
      line.changeExtent(estimatedWidth, estimatedHeight, true);
    }

    morph.viewState._textLayoutStale = false;
  }

  defaultCharExtent(morph) {
    let {textRenderer, fontMetric, defaultTextStyle} = morph,
        directRenderTextLayerFn = textRenderer.directRenderTextLayerFn(morph);
    return fontMetric.defaultCharExtent({defaultTextStyle, width: 1000}, directRenderTextLayerFn);
  }

  textBounds(morph) {
    let {
      document: doc,
      padding,
      borderWidthLeft,
      borderWidthRight,
      borderWidthTop,
      borderWidthBottom
    } = morph;

    return new Rectangle(
      padding.left(), padding.top(),
      doc.width + borderWidthLeft + borderWidthRight,
      doc.height + borderWidthTop + borderWidthBottom);
  }

  isFirstLineVisible(morph) {
    return morph.viewState.firstVisibleRow <= 0;
  }
  isLastLineVisible(morph) {
    return morph.viewState.lastVisibleRow >= morph.lineCount() - 1;
  }

  isLineVisible(morph, row) {
    return row >= morph.viewState.firstVisibleRow && row <= morph.viewState.lastVisibleRow;
  }

  isLineFullyVisible(morph, row) {
    return row >= morph.viewState.firstFullyVisibleRow && row <= morph.viewState.lastFullyVisibleRow;
  }

  whatsVisible(morph) {
    var startRow = morph.viewState.firstVisibleRow,
        endRow = morph.viewState.lastVisibleRow,
        lines = morph.document.lines.slice(startRow, endRow);
    return {lines, startRow, endRow};
  }

  firstFullVisibleLine(morph) { return morph.viewState.firstFullyVisibleRow; }
  lastFullVisibleLine(morph) { return morph.viewState.lastFullyVisibleRow; }

  screenLineRange(morph, textPos, ignoreLeadingWhitespace) {
    // find the range that includes textPos whose start and end chars are in a
    // vertical line. Normally all chars of a line are positioned vertically
    // next to each other, unless the line is wrapped. This is for figuring
    // that out

    let {row, column} = textPos;
    column = Math.max(0, column);
    row = Math.min(morph.lineCount()-1, Math.max(0, row));

    let charBounds = this.charBoundsOfRow(morph, row);
    if (column > charBounds.length-1) column = charBounds.length-1;
    let bounds = charBounds[column];

    let firstIndex = column, lastIndex = column;

    for (var i = column+1; i < charBounds.length; i++) {
      if (charBounds[i].y+charBounds[i].height > bounds.y+bounds.height) break;
      lastIndex = i;
    }
    // For last range we go until end of line
    if (lastIndex === charBounds.length-1) lastIndex++;

    for (var i = column-1; i >= 0; i--) {
      if (charBounds[i].y+charBounds[i].height < bounds.y+bounds.height) break;
      firstIndex = i;
    }

    if (ignoreLeadingWhitespace) {
      let rangeString = morph.getLine(row).slice(firstIndex, lastIndex),
          skip = rangeString.match(/^\s*/)[0].length;
      firstIndex = firstIndex + skip;
    }

    return new Range({start: {row, column: firstIndex}, end: {row, column: lastIndex}});
  }

  rangesOfWrappedLine(morph, row) {
    let lineLength = morph.getLine(row).length,
        column = 0, ranges = [];
    while (true) {
      let range = this.screenLineRange(morph, {row, column}, false);
      ranges.push(range);
      if (range.end.column >= lineLength) break;
      let nextColumn = range.end.column + 1;
      if (nextColumn >= lineLength) break;
      if (nextColumn <= column)
        throw new Error(`should not happen ${range.end.column} vs ${column}`);
      column = nextColumn;
    }
    return ranges;
  }

  chunkAtPos(morph, pos) { todo("chunkAtPos"); }

  charBoundsOfRow(morph, row) {
    let doc = morph.document,
        line = doc.getLine(row);

    let cached = this.lineCharBoundsCache.get(line);
    if (cached) return cached;
    let {
          fontMetric, textRenderer,
          defaultTextStyle,
          extent: {x: width, y: height},
          clipMode, textAlign, padding, lineWrapping
        } = morph,
        paddingLeft = padding.left(),
        paddingRight = padding.right(),
        paddingTop = padding.top(),
        paddingBottom = padding.bottom(),
        directRenderLineFn = textRenderer.directRenderLineFn(morph),
        directRenderTextLayerFn = textRenderer.directRenderTextLayerFn(morph),
        charBounds = fontMetric.manuallyComputeCharBoundsOfLine(
          line, 0, 0, {
            defaultTextStyle, width, height, clipMode, lineWrapping, textAlign,
            paddingLeft, paddingRight, paddingTop, paddingBottom
          }, directRenderTextLayerFn, directRenderLineFn);

    this.lineCharBoundsCache.set(line, charBounds);
    return charBounds;
  }

  boundsFor(morph, docPos) {
    let {row, column} = docPos;
    column = Math.max(0, column);
    row = Math.min(morph.lineCount()-1, Math.max(0, row));

    let charBounds = this.charBoundsOfRow(morph, row),
        bounds;

    if (charBounds.length > 0) {
      if (column >= charBounds.length) {
        let {x, y, width, height} = charBounds[charBounds.length-1];
        bounds = new Rectangle(x+width, y, 0, height);
      } else bounds = Rectangle.fromLiteral(charBounds[column]);
    }

    if (!bounds) {
      // throw new Error(`Cannot compute bounds for line ${row}/${column}`);
      console.warn(`Cannot compute bounds for line ${row}/${column}`);
      bounds = new Rectangle(0, 0, 0, 0);
    }

    let {document: doc, padding} = morph;
    bounds.x = bounds.x + padding.left();
    bounds.y = bounds.y + padding.top() + doc.computeVerticalOffsetOf(row);

    return bounds;
  }

  pixelPositionFor(morph, docPos) {
    var { x, y } = this.boundsFor(morph, docPos);
    return pt(x, y);
  }

  textPositionFromPoint(morph, point) {
    let {x, y} = point,
        {document: doc, padding} = morph,
        padL = padding.left(),
        padT = padding.top(),
        found = doc.findLineByVerticalOffset(y-padT);

    if (!found) {
      if (y >= doc.height+padT) found = {line: {row: doc.rowCount-1}}
      else if (y <= padL) found = {line: {row: 0}}
      else return {row: 0, column: 0};/*????*/
    }

    let {line: {row}} = found,
        charBounds = this.charBoundsOfRow(morph, row),
        nChars = charBounds.length,
        first = charBounds[0],
        last = charBounds[nChars-1],
        result = {row, column: 0};

    // charBounds are in local line coordinates. Translate points x, y so that it fits
    x = x - padL;
    y = y - (padT + doc.computeVerticalOffsetOf(row));

    // everything to the left of the first char + half its width is col 0
    if (nChars === 0 || (x <= first.x + Math.round(first.width/2)
                      && y >= first.y && y <= first.y + first.height)) return result;

    if (x > last.x + Math.round(last.width/2) && y >= last.y && y <= last.y + last.height) {
      result.column = nChars;
      return result;
    }

    // find col so that x between right side of char[col-1] and left side of char[col]
    // consider wrapped lines, i.e. charBounds.y <= y <= charBounds.y+charBounds.height
    let wrappedCharBoundsWithMatchingVerticalPos = [];
    for (var i = nChars-1; i >= 0; i--) {
      let cb = charBounds[i],
          {x: cbX, width: cbWidth, y: cbY, height: cbHeight} = cb;
      if (y < cbY || y > cbY + cbHeight) continue;
      wrappedCharBoundsWithMatchingVerticalPos.push(cb);
      if (x >= cbX + Math.round(cbWidth/2)) {

        let clickedAtEndOfWrappedLine = wrappedCharBoundsWithMatchingVerticalPos.length === 1;
        result.column = clickedAtEndOfWrappedLine ? i/*pos in front of line break*/ : i+1;
        return result;
      }
    }

    // we counted backwards, so the last bounds in
    // wrappedCharBoundsWithMatchingVerticalPos is actually the first in the
    // wrapped line. Since we are left of its center, we just take it
    if (wrappedCharBoundsWithMatchingVerticalPos.length) {
      result.column = charBounds.indexOf(arr.last(wrappedCharBoundsWithMatchingVerticalPos));
      return result;
    }

    // if still not found we go by proximity...
    let minDist = Infinity, minIndex = -1;
    for (var i = 0; i < charBounds.length; i++) {
      let cb = charBounds[i],
          {x: cbX, width: cbWidth, y: cbY, height: cbHeight} = cb,
          dist = point.distSquared(pt(cbX+cbWidth/2, cbY+cbHeight/2));
      if (dist >= minDist) continue;
      minDist = dist;
      minIndex = i;
    }

    result.column = minIndex;
    return result;
  }
}
