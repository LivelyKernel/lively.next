import { mdCompiler } from "./compiler.js";
import { arr } from "lively.lang";

export default class MarkdownNavigator  {

  ensureAST(ed) { return {}; }

  moveToHeading(ed, heading) {
    if (!heading) return;
    ed.cursorPosition = {row: heading.line, column: 0};
    ed.scrollCursorIntoView();
  }

  backwardSexp(ed) {
    var src = ed.textString,
        headings = mdCompiler.parseHeadings(src),
        pos = ed.cursorPosition,
        h = mdCompiler.headingOfLine(headings, pos.row);
    if (h && h.line === pos.row && pos.column === 0) {
      var siblings = mdCompiler.siblingsBefore(src, headings, h);
      h = arr.last(siblings);
    }
    this.moveToHeading(ed, h);
  }

  forwardSexp(ed) {
    var src = ed.textString,
        headings = mdCompiler.parseHeadings(src),
        h = mdCompiler.headingOfLine(headings, ed.cursorPosition.row),
        siblings = mdCompiler.siblingsAfter(src, headings, h);
    this.moveToHeading(ed, siblings[0]);
  }

  backwardUpSexp(ed) {
    var headings = mdCompiler.parseHeadings(ed.textString),
        heading = mdCompiler.headingOfLine(headings, ed.cursorPosition.row),
        owners = mdCompiler.ownerHeadings(headings, heading);
    this.moveToHeading(ed, arr.last(owners));
  }

  forwardDownSexp(ed) {
    var headings = mdCompiler.parseHeadings(ed.getValue()),
        heading = mdCompiler.headingOfLine(headings, ed.getCursorPosition().row),
        sub = mdCompiler.rangeOfHeading(ed.getValue(), headings, heading);
    this.moveToHeading(ed, sub.subheadings[1]);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // expansion

  expandRegion(ed, src, ast, expandState) {
    var pos = ed.cursorPosition,
        headings = mdCompiler.parseHeadings(ed.textString),
        heading = mdCompiler.headingOfLine(headings, pos.row);
    if (!heading) return expandState;

    if (heading
     && heading.line === pos.row 
     && pos.column === 0 
     && expandState.range[0] !== expandState.range[1]) {
      var owners = mdCompiler.ownerHeadings(headings, heading);
      heading = arr.last(owners);
      if (!heading) return expandState;
    }

    var newRange = mdCompiler.rangeOfHeading(src, headings, heading);
    if (!newRange) return expandState;

    return {
      range: [
          ed.positionToIndex(newRange.range.end),
          ed.positionToIndex(newRange.range.start)
        ],
        prev: expandState
    }
  }

  contractRegion(ed, src, ast, expandState) {
    return expandState.prev || expandState;
  }

};
