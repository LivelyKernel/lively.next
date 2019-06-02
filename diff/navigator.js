import { lessEqPosition, lessPosition } from "lively.morphic/text/position.js";
import { obj, arr } from "lively.lang";
import DiffTokenizer from "./tokenizer.js";

// new DiffNavigator().findHunkStart(that, that.cursorPosition)
// new DiffNavigator().findHunkEnd(that, that.cursorPosition)

// [/^diff --git/, /^index/, /^---/, /^$/]
// that.search(/^diff --git/, {backwards: true})

// that.document.scanBackward(startPos, matchFn)

export default class DiffNavigator {

  ensureAST(ed) {
    return new DiffTokenizer().tokenize(ed.textString).tokens;
  }

  tokenStateAt(ed, pos = ed.cursorPosition) {
    var p = ed.pluginFind(ea => ea.isDiffEditorPlugin);
    if (!p) return null;
    var {tokens, patches} = p,
        tokenIndex = tokens.findIndex(({start,end}) =>
          lessEqPosition(start, pos) && lessPosition(pos, end)),
        token = tokens[tokenIndex];
    return {token, tokenIndex, tokens, patches};
  }

  findPatchAt(ed, pos = ed.cursorPosition) {
    var entity = this.findContainingHunkOrPatch(ed, {start: pos, end: pos});
    return !entity ? null : entity.isFilePatchHunk ? entity.patch : entity;
  }

  findHunkAt(ed, pos = ed.cursorPosition) {
    var entity = this.findContainingHunkOrPatch(ed, {start: pos, end: pos});
    return !entity ? null : !entity.isFilePatchHunk ? null : entity;
  }

  findPatchStart(ed, pos) {
    var patch = this.findPatchAt(ed, pos);
    return patch ? patch.tokens[0].start : pos;
  }

  findPatchEnd(ed, pos) {
    var patch = this.findPatchAt(ed, pos);
    return patch ? arr.last(patch.tokens).end : pos;
  }

  findHunkStart(ed, pos) {
    var hunk = this.findHunkAt(ed, pos);
    return hunk ?  hunk.tokens[0].start : pos;
  }

  findHunkEnd(ed, pos = ed.cursorPosition) {
    var hunk = this.findHunkAt(ed, pos);
    return hunk ?  arr.last(hunk.tokens).end : pos;
  }

  backwardSexp(ed) {
    // nav = Navigator
    var pos = ed.cursorPosition,
        hunkStart = this.findHunkStart(ed),
        patchStart = this.findPatchStart(ed);

    if (obj.equals(pos, hunkStart)) {
      ed.saveExcursion(() => { ed.selection.goLeft(); hunkStart = this.findHunkStart(ed); });
      if (obj.equals(pos, hunkStart)) hunkStart = null;
    }

    if (obj.equals(pos, patchStart)) {
      ed.saveExcursion(() => { ed.selection.goLeft(); patchStart = this.findPatchStart(ed); });
      if (obj.equals(pos, patchStart)) patchStart = null;
    }

    if (!hunkStart && !patchStart) return;
    var target;
    if (!hunkStart) target = patchStart;
    else if (!patchStart) target = hunkStart;
    else if (hunkStart.row > patchStart.row) target = hunkStart;
    else target = patchStart;
    ed.cursorPosition = target;
    ed.scrollCursorIntoView();
  }

  forwardSexp(ed) {
    // nav = Navigator
    // ed = that.aceEditor
    var nav = this,
        pos = ed.cursorPosition,
        hunkEnd = nav.findHunkEnd(ed);
    if (obj.equals(pos, hunkEnd)) {
      ed.saveExcursion(function() { ed.selection.goRight(); hunkEnd = nav.findHunkEnd(ed); });
      if (obj.equals(pos, hunkEnd)) hunkEnd = null;
    }
    if (!hunkEnd) return;
    ed.cursorPosition = hunkEnd;
    ed.scrollCursorIntoView();
  }

  backwardUpSexp(ed) {
    // nav = Navigator
    var nav = this,
        pos = ed.cursorPosition,
        patchStart = nav.findPatchStart(ed);
    if (!patchStart) return;
    ed.cursorPosition = (patchStart);
    ed.scrollCursorIntoView();
  }

  forwardDownSexp(ed) { show("Not yet implemented"); }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // expansion

  findContainingHunkOrPatch(ed, startingRange) {
    var start, end,
        {tokens, patches, token: tokenStart} = this.tokenStateAt(ed, startingRange.start),
        {token: tokenEnd} = this.tokenStateAt(ed, startingRange.end);

    // accross patches?
    if (tokenStart.patch != tokenEnd.patch) return null;

    if (tokenStart.hasOwnProperty("hunk") && tokenEnd.hasOwnProperty("hunk"))
      if (tokenStart.hunk === tokenEnd.hunk)
        return patches[tokenStart.patch].hunks[tokenStart.hunk];

    return patches[tokenStart.patch];
  }

  findContainingHunkOrPatchRange(ed, startingRange) {
    var entity = this.findContainingHunkOrPatch(ed, startingRange);
    if (!entity) return null;
    var toks = entity.tokens,
        start = toks[0].start,
        end = arr.last(toks).end;
    return {start, end};
  }

  expandRegion(ed, src, ast, expandState) {
    var newRange = this.findContainingHunkOrPatchRange(ed, ed.selection.range);
    return newRange ? {
      range: [ed.positionToIndex(newRange.start), ed.positionToIndex(newRange.end)],
      prev: expandState
    } : expandState;
  }

  contractRegion(ed, src, ast, expandState) {
    return expandState.prev || expandState;
  }

}
