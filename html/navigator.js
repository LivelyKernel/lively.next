/*global inspect*/
// FIXME proper dependency to lively.ast

import { arr } from "lively.lang";

function nodesAt(index, node, result = []) {
  if (!node) return result;
  let l = node.__location;
  if (l) {
    if (index < l.startOffset || l.endOffset < index) return result;
    result.push(node);

    if (l.attrs) {
      let attrName = Object.keys(l.attrs).find(name => {
        let {startOffset, endOffset} = l.attrs[name];
        return startOffset <= index && index <= endOffset;
      });
      if (attrName) {
        let attr = node.attrs.find(ea => ea.name === attrName);
        attr.__location = l.attrs[attrName];
        result.push(attr);
      }
    }
  }
  if (node.childNodes)
    node.childNodes.forEach(childNode => nodesAt(index, childNode, result));
  return result;
}

function expandOnToken(ed, t, prevExpandState) {
  return {range: [posToIdx(ed, t.start), posToIdx(ed, t.end)], prev: prevExpandState};
}

function tokenPosition(ed, row, token) {
  var offset = posToIdx(ed, {column: 0, row});
  return {
    tokenStart: offset + token.start,
    tokenEnd: offset + token.start + token.value.length
  };
}

function posToIdx(ed, pos) { return ed.positionToIndex(pos); }
function idxToPos(ed, idx) { return ed.indexToPosition(idx); }



export default class HTMLNavigator {

  ensureAST(ed) { return ed.editorPlugin.parse(); }

  // -=-=-=-=-=-=-
  // selection
  // -=-=-=-=-=-=-

  rangesForStartAndEndTag(ed, pos, ast) {
    let index = posToIdx(ed, ed.cursorPosition),
        node = arr.last(nodesAt(index, ast));
    if (!node) return null;
    let {startTag, endTag} = node.__location;
    if (!startTag) return null;
    return {
      startTag: {
        start: idxToPos(ed, startTag.startOffset),
        end: idxToPos(ed, startTag.endOffset),
      },
      endTag: endTag ? {
        start: idxToPos(ed, endTag.startOffset),
        end: idxToPos(ed, endTag.endOffset),
      } : null
    };
  }

  // -=-=-=-=-=-=-
  // movement
  // -=-=-=-=-=-=-

  move(selector, ed) {
    var select = !!ed.activeMark || !ed.selection.isEmpty(),
        sel = ed.selection,
        pos = sel.lead,
        idx = ed.positionToIndex(pos),
        newIdx = this[selector](ed, idx),
        newPos = ed.indexToPosition(newIdx),
        isBackwards = sel.isBackwards;
    if (!newPos) return;
    sel.lead = newPos;
    if (!select)
      sel.anchor = newPos;
    ed.scrollCursorIntoView();
  }

  forwardSexp(ed) { this.move("_forwardSexp", ed); }
  backwardSexp(ed) { this.move("_backwardSexp", ed); }
  backwardUpSexp(ed) { this.move("_backwardUpSexp", ed); }
  forwardDownSexp(ed) { this.move("_forwardDownSexp", ed); }

  _forwardSexp(ed, fromIndex) {
    let ast = ed.editorPlugin.parse(),
        node = arr.last(nodesAt(fromIndex, ast));
    return (node && node.__location.endOffset) || fromIndex;
  }
  _backwardSexp(ed, fromIndex) {
    let ast = ed.editorPlugin.parse(),
        node = arr.last(nodesAt(fromIndex, ast));
    if (!node) return fromIndex;
    if (node.__location.startOffset === fromIndex)
      node = arr.last(nodesAt(fromIndex-1, ast));
    return (node && node.__location.startOffset) || fromIndex;
  }
  _forwardDownSexp(ed, fromIndex) {
    let ast = ed.editorPlugin.parse(),
        node = arr.last(nodesAt(fromIndex, ast));
    return (node && node.childNodes && node.childNodes[0]
         && node.childNodes[0].__location && node.childNodes[0].__location.startOffset)
        || fromIndex;
  }
  _backwardUpSexp(ed, fromIndex) {
    let ast = ed.editorPlugin.parse(),
        node = arr.last(nodesAt(fromIndex, ast).slice(0, -1));
    return (node && node.__location.startOffset) || fromIndex;
  }

  // -=-=-=-=-=-=-
  // expanding
  // -=-=-=-=-=-=-

  expandRegion(ed, src, ast, expandState) {
    // use token if no selection

    var [from, to] = expandState.range,
        hasSelection = from !== to,
        p = ed.indexToPosition(from),
        token = ed.tokenAt(p);

    if (!hasSelection && token && token.start.column + 1 < token.end.column)
      return expandOnToken(ed, token, expandState);

    let containingNode = hasSelection
      ? lively.lang.arr.intersect(nodesAt(from, ast), nodesAt(to, ast))
        .reverse()
        .find(ea => {
          let l = ea.__location;
          return l && l.startOffset < from || l.endOffset > to;
        })
      : arr.last(nodesAt(from, ast));
    if (!containingNode) return expandState;
    let {startOffset, endOffset} = containingNode.__location;

    return {range: [startOffset, endOffset], prev: expandState};
  }

  contractRegion(ed, src, ast, expandState) {
    return expandState.prev || expandState;
  }
}