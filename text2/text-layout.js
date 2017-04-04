import { Rectangle, pt } from "lively.graphics";
import { charBoundsOfLine } from "./measuring.js";
import { arr } from "lively.lang";
import { inspect } from "lively.morphic";

function todo(name) { throw new Error("not yet implemented " + name)}

export default class TextLayout {

  constructor() {
    this.layoutComputed = false;
    this.fontMetric = null
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
      textRenderer: {domTextMeasure}
    } = morph;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (!force && line.height > 0) continue;
      let textAttributes = line.textAttributes,
          styles = [];

      // find all styles that apply to line
      if (!textAttributes) styles.push(defaultTextStyle);
      else for (let j = 0; j < textAttributes.length; j++)
        styles.push({...defaultTextStyle, ...textAttributes[j]});

      // measure default char widths and heights
      let charWidthN = 0, charWidthSum = 0, charHeight = 0;
      for (let h = 0; h < styles.length; h++) {
        let {width, height} = domTextMeasure.defaultCharExtent(styles[h]);
        charHeight = Math.max(height, charHeight);
        if (wraps) { charWidthSum += width; charWidthN++; }
      }

      let estimatedHeight = charHeight;
      if (wraps) {
        let charWidth = (charWidthSum/charWidthN),
            charsPerline = Math.max(3, width / charWidth);
        estimatedHeight = (Math.ceil(line.text.length / charsPerline) || 1) * charHeight;
      }
      line.changeHeight(estimatedHeight, true);
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
    todo("screenLineRange");
    var ranges = morph.textLayout.rangesOfWrappedLine(morph, textPos.row),
        range = ranges.slice().reverse().find(({start, end}) => start.column <= textPos.column),
        content = morph.textInRange(range),
        leadingSpace = content.match(/^\s*/);
    if (leadingSpace[0].length && ignoreLeadingWhitespace)
      range.start.column += leadingSpace[0].length;
    if (range !== arr.last(ranges)) range.end.column--;
    return new Range(range);
  }
  
  shiftLinesIfNeeded(morph, range, action) {
    // action = "insertText"|"deleteText"
    todo("shiftLinesIfNeeded");
  }

  chunkAtPos(morph, pos) { todo("chunkAtPos"); }
  
  charBoundsOfRow(morph, row) {    
    let doc = morph.document,
        line = doc.getLine(row);
    // if (line.charBounds) return line.charBounds; //cached
    
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // find char bounds via rendered nodes
    let charBounds,
        {dom_nodeFirstRow, dom_nodes} = morph.viewState,
        lineNode = dom_nodes[row - dom_nodeFirstRow];

    if (false && lineNode) { // compute using rendered text node
      let {x: offsetX, y: offsetY} = morph.globalPosition;
      charBounds = charBoundsOfLine(line, lineNode, offsetX, offsetY);
    } else {
      let {defaultTextStyle, textRenderer: {domTextMeasure}} = morph,
          offsetX = 0,
          offsetY = -doc.computeVerticalOffsetOf(row);
      charBounds = domTextMeasure.manuallyComputeCharBoundsOfLine(line, defaultTextStyle, offsetX, offsetY);
    }

    if (!line.height || line.hasEstimatedHeight) {
      // FIXME: when computing height via charbounds... we need to consider
      // line margings/paddings, custom line heights....!
      let height = 0;
      for (let i = 0; i < charBounds.length; i++)
        height = Math.max(height, charBounds.height + charBounds.y);
      line.changeHeight(height, false/*not estimated*/)
    }

    return line.charBounds = charBounds;
  }

  boundsFor(morph, docPos) {
    let {row, column} = docPos,
        charBounds = this.charBoundsOfRow(morph, row),
        bounds = charBounds[column] || arr.last(charBounds);
    if (!bounds) {
      // throw new Error(`Cannot compute bounds for line ${row}/${column}`);
      console.warn(`Cannot compute bounds for line ${row}/${column}`);
      bounds = {x: 0, y: 0, width: 0, height: 0};
    }

    return new Rectangle(bounds.x, bounds.y, bounds.width, bounds.height);
  }

  pixelPositionFor(morph, docPos) {
    var { x, y } = this.boundsFor(morph, docPos);
    return pt(x, y);
  }

  textPositionFromPoint(morph, point) {
    let {x, y} = point,
        found = morph.document.findLineByVerticalOffset(y);
    if (!found) return {row: 0, column: 0};
    let {line: {row}} = found,
        charBounds = this.charBoundsOfRow(morph, row);
    for (let column = 0; column < charBounds.length; column++) {
      let bnds = charBounds[column];
      if (x >= bnds.x && x <= bnds.x+bnds.width
       && y >= bnds.y && y <= bnds.y+bnds.height)
         return {column, row};
    }
    return {row: 0, column: 0};
  }
}