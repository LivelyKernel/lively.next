import { Rectangle, pt } from "lively.graphics";
import { arr } from "lively.lang";
import { inspect } from "lively.morphic";
import { Range } from "../text/range.js";

function todo(name) { throw new Error("not yet implemented " + name)}

export default class TextLayout {

  constructor() {
    this.layoutComputed = false;
  }

  reset() {
    // todo("reset");
  }

  estimateLineHeights(morph, force = false) {

    let {
      viewState,
      defaultTextStyle,
      lineWrapping: wraps,
      width,
      document: {lines},
      fontMetric
    } = morph;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (!force && line.height > 0) continue;
      let textAttributes = line.textAttributes,
          styles = [];

      // find all styles that apply to line
      if (!textAttributes || !textAttributes.length) styles.push(defaultTextStyle);
      else for (let j = 0; j < textAttributes.length; j++)
        styles.push({...defaultTextStyle, ...textAttributes[j]});

      // measure default char widths and heights
      let charWidthN = 0, charWidthSum = 0, charHeight = 0;
      for (let h = 0; h < styles.length; h++) {
        let {width, height} = fontMetric.defaultCharExtent({
          defaultTextStyle: styles[h],
          cssClassName: "newtext-text-layer"
        });
        charHeight = Math.max(height, charHeight);
        if (wraps) { charWidthSum += width; charWidthN++; }
      }

      let estimatedHeight = charHeight,
          charCount = wraps && line.text.length,
          isWrapped = false;
      if (charCount) {
        let charWidth = (charWidthSum/charWidthN),
            charsPerline = Math.max(3, width / charWidth),
            wrappedLineCount = Math.ceil(charCount / charsPerline) || 1;
        isWrapped = wrappedLineCount > 1;
        estimatedHeight = wrappedLineCount * charHeight;
      }
      line.changeHeight(estimatedHeight, isWrapped, true);
    }

    viewState._textLayoutStale = false;
  }

  textBounds(morph) {
    this.estimateLineHeights(morph, false/*force*/)
    let {width, document} = morph;
    return morph.padding.topLeft().extent(pt(width, document.height));
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
    // FIXME!!!!!
    return this.isLineVisible(morph, row)
  }

  whatsVisible(morph) {
    var startRow = morph.viewState.firstVisibleRow,
        endRow = morph.viewState.lastVisibleRow,
        lines = morph.document.lines.slice(startRow, endRow);
    return {lines, startRow, endRow};
  }

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

    for (let i = column+1; i < charBounds.length; i++) {
      if (charBounds[i].y+charBounds[i].height > bounds.y+bounds.height) break;
      lastIndex = i;
    }
    lastIndex++;

    for (let i = column-1; i >= 0; i--) {
      if (charBounds[i].y+charBounds[i].height < bounds.y+bounds.height) break;
      firstIndex = i;
    }

    if (ignoreLeadingWhitespace) {
      let rangeString = morph.getLine(row).slice(firstIndex, lastIndex),
          skip = rangeString.match(/^\s*/)[0].length;
      firstIndex += skip;
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
      if (range.end.column <= column) throw new Error("should not happen");
      column = range.end.column;
    }
    return ranges;
  }

  chunkAtPos(morph, pos) { todo("chunkAtPos"); }

  charBoundsOfRow(morph, row) {
    let doc = morph.document,
        line = doc.getLine(row);
    // if (line.charBounds) return line.charBounds; //cached

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // find char bounds via rendered nodes
    let {fontMetric, viewState: {dom_nodeFirstRow, dom_nodes}, padding} = morph,
        paddingLeft = padding.left(),
        paddingRight = padding.right(),
        paddingTop = padding.top(),
        paddingBottom = padding.bottom(),
        lineNode = dom_nodes[row - dom_nodeFirstRow],
        charBounds;

    if (false && lineNode) { // compute using rendered text node
      let {x: offsetX, y: offsetY} = morph.globalPosition;
      offsetX = offsetX - paddingLeft;
      offsetY = offsetY - paddingTop;
      charBounds = charBoundsOfLine(lineNode, line.text.length, offsetX, offsetY);
    } else {
      // this.estimateLineHeights(morph, false)
      let {defaultTextStyle, extent: {x: width, y: height}, lineWrapping, clipMode} = morph,
          offsetX = 0,
          offsetY = -doc.computeVerticalOffsetOf(row);

      offsetX = offsetX - paddingLeft;
      offsetY = offsetY - paddingTop;
      charBounds = fontMetric.manuallyComputeCharBoundsOfLine(
        line, offsetX, offsetY, {
          defaultTextStyle,
          paddingLeft,paddingRight, paddingTop, paddingBottom,
          width, height, lineWrapping, clipMode,
          cssClassName: "newtext-text-layer"
        },
      );
    }

    if ((!line.height || line.hasEstimatedHeight) && charBounds.length) {
      // FIXME: when computing height via charbounds... we need to consider
      // line margings/paddings, custom line heights....!
      let baseY = charBounds[0].y, lineHeight = 0;
      for (let i = 0; i < charBounds.length; i++) {
        let {y: charBoundsY, height: charBoundsHeight} = charBounds[i];
        lineHeight = Math.max(lineHeight, (charBoundsY - baseY) + charBoundsHeight+1/*????*/);
      }
      line.changeHeight(lineHeight, false/*isWrapped*/, false/*not estimated*/)
    }

    return line.charBounds = charBounds;
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

    return bounds;
  }

  pixelPositionFor(morph, docPos) {
    var { x, y } = this.boundsFor(morph, docPos);
    return pt(x, y);
  }

  textPositionFromPoint(morph, point) {
    this.estimateLineHeights(morph);

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
    for (var i = nChars-2; i >= 0; i--) {
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
    for (let i = 0; i < charBounds.length; i++) {
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