import { arr, string } from "lively.lang";

export default class MarkdownNavigator  {

  ensureAST(ed) { return ed.editorPlugin.parsedMarkdown(); }

  moveToHeading(ed, heading) {
    if (!heading) return;
    ed.cursorPosition = {row: heading.line, column: 0};
    ed.scrollCursorIntoView();
  }

  backwardSexp(ed) {
    var src = ed.textString,
        {headings} = this.ensureAST(ed),
        pos = ed.cursorPosition,
        h = this.headingOfLine(headings, pos.row);
    if (h && h.line === pos.row && pos.column === 0) {
      var siblings = this.siblingsBefore(src, headings, h);
      h = arr.last(siblings);
    }
    this.moveToHeading(ed, h);
  }

  forwardSexp(ed) {
    var src = ed.textString,
        {headings} = this.ensureAST(ed),
        h = this.headingOfLine(headings, ed.cursorPosition.row),
        siblings = this.siblingsAfter(src, headings, h);
    this.moveToHeading(ed, siblings[0]);
  }

  backwardUpSexp(ed) {
    let {headings} = this.ensureAST(ed),
        heading = this.headingOfLine(headings, ed.cursorPosition.row),
        owners = this.ownerHeadings(headings, heading);
    this.moveToHeading(ed, arr.last(owners));
  }

  forwardDownSexp(ed) {
    let {headings} = this.ensureAST(ed),
        heading = this.headingOfLine(headings, ed.cursorPosition.row),
        sub = this.rangeOfHeading(ed.textString, headings, heading);
    this.moveToHeading(ed, sub.subheadings[1]);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // expansion

  expandRegion(ed, src, ast, expandState) {
    var pos = ed.cursorPosition,
        {headings} = this.ensureAST(ed),
        heading = this.headingOfLine(headings, pos.row);
    if (!heading) return expandState;

    if (heading
     && heading.line === pos.row 
     && pos.column === 0 
     && expandState.range[0] !== expandState.range[1]) {
      var owners = this.ownerHeadings(headings, heading);
      heading = arr.last(owners);
      if (!heading) return expandState;
    }

    var newRange = this.rangeOfHeading(src, headings, heading);
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

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // helper methods

  ownerHeadings(headings, heading) {
    if (heading.depth <= 1) return [];
    var before = headings.slice(0, headings.indexOf(heading));
    if (!before.length) return [];
    var owner = before.reverse().find(ea => ea.depth < heading.depth);
    return this.ownerHeadings(headings, owner).concat([owner]);
  }

  withSiblings(markdownSrcOrLines, headings, heading) {
    if (heading.depth === 1) return headings.filter(ea => ea.depth === 1);
    var owners = this.ownerHeadings(headings, heading),
        sub = this.rangeOfHeading(markdownSrcOrLines, headings, arr.last(owners));
    return sub.subheadings.filter(ea => ea.depth === heading.depth);
  }

  siblingsBefore(markdownSrcOrLines, headings, heading) {
    var sibs = this.withSiblings(markdownSrcOrLines, headings, heading);
    return sibs.slice(0, sibs.indexOf(heading));
  }

  siblingsAfter(markdownSrcOrLines, headings, heading) {
    var sibs = this.withSiblings(markdownSrcOrLines, headings, heading);
    return sibs.slice(sibs.indexOf(heading) + 1);
  }

  headingOfLine(headings, line) {
    // find last heading at or above line
    var found;
    for (var i = 0; i < headings.length; i++) {
      if (headings[i].line > line) break;
      found = headings[i];
    }
    return found;
  }

  rangeOfHeading(markdownSrcOrLines, headings, heading) {
    // return the entire text range of the content at and below heading
    var md = this,
        lines = Array.isArray(markdownSrcOrLines) ?
          markdownSrcOrLines : string.lines(markdownSrcOrLines),
        start = headings.find(ea => heading && ea.line === heading.line),
        startIndex = headings.indexOf(start),
        end = headings.slice(startIndex+1).find(ea => ea.depth <= heading.depth),
        subheadings = headings.slice(
          headings.indexOf(start),
          end ? headings.indexOf(end) : headings.length);
    return {
      range: {
        start: {row: start.line, column: 0},
        end: end ?
          {row: end.line-1, column: lines[end.line-1].length} :
          {row: lines.length-1, column: lines[lines.length-1].length}
      },
      subheadings: subheadings
    }
  }

};
