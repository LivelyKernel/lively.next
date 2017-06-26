// FIXME proper dependency to lively.ast

import { arr } from "lively.lang";




function searchForTagRange(ed, startLeft, startRight) {
  
  let rangeRight = {start: startRight, end: ed.documentEndPosition},
      rangeLeft = {start: {column: 0, row: 0}, end: startLeft},
      foundRight = null, foundLeft = null;

  ed.editorPlugin.visitTokensInRange(
    rangeRight,
    (token, state, row, fromCol, toCol, stream, line, mode) => {
      if (foundRight) return;
      if (token !== "tag") return;
      let range = {start: {row, column: fromCol}, end: {row, column: toCol}},
          text = ed.textInRange(range);
      range.end.column++;
      foundRight = {range, text};
    })

  if (!foundRight) return null;

  ed.editorPlugin.visitTokensInRange(
    rangeLeft,
    (token, state, row, fromCol, toCol, stream, line, mode) => {
      if (foundLeft) return;
      if (token !== "tag") return;
      let range = {start: {row, column: fromCol}, end: {row, column: toCol}},
          text = ed.textInRange(range);
      if (text !== foundRight.text) return;
      range.start.column--;
      foundLeft = {range, text};
    });

  if (!foundLeft) return;

  return {tagname: foundLeft.text, start: foundLeft.range.start, end: foundRight.range.end};
}


export function htmlParse(textMorph) {
  // produces a tree like
  //  root
  //  html
  //   \-head
  //     |-title
  //     \-body
  //       |-h1
  //       \-span
  // ea node has start/end text pos + tagName properties
  
  let docRange = textMorph.documentRange,
      tree = makeNode(null, docRange.start, docRange.end),
      stack = [tree],
      tagStart = false;
  
  textMorph.editorPlugin.visitTokensInRange(
    textMorph.documentRange,
    (token, state, row, fromCol, toCol, stream, line, mode) => {
      let range = {start: {row, column: fromCol}, end: {row, column: toCol}},
          t = textMorph.textInRange(range);
      if (token === "tag bracket") {
        if (t === "</" || t === "/>") {
          let closedTag = stack.pop();
          closedTag.end = range.end;
console.log("CLOOOSING", t, closedTag.tagName);
        } else if (t === "<") tagStart = true;
        return;
      }
      if (token === "tag") {
        if (tagStart) {
          tagStart = false;
          range.start.column--; // <
          let newTag = makeNode(t, range.start, null);
          arr.last(stack).children.push(newTag);
          stack.push(newTag);
        }
      }
    });
  return tree;
  
  function makeNode(tagName, start, end) {
    return {start, end, tagName, children: []};
  }
}

export default class HTMLNavigator {

  ensureAST() { return {}; }

  // -=-=-=-=-=-=-
  // expanding
  // -=-=-=-=-=-=-

  expandRegion(ed, src, ast, expandState) {
      // use token if no selection
/*global show*/

      var hasSelection = expandState.range[0] !== expandState.range[1],
          p = ed.indexToPosition(expandState.range[0]),
          token = ed.tokenAt(p);
show(token)

      // if (!hasSelection && token && ["keyword", "identifier"].includes(token.type)) {
      if (!hasSelection && token) {
        return expandOnToken(token)
      }
      return {range: [start, end],prev: expandState}

      ast = ast || this.parse(src);

      var pos = expandState.range[0],
          nodes = lively.ast.query.nodesAtIndex(ast, pos),
          containingNode = nodes.reverse().find(function(node) {
              return node.start < expandState.range[0]
                  || node.end > expandState.range[1]; });

      if (!containingNode) return expandState;

      var start = containingNode.start,
          end = containingNode.end;

      if (containingNode.type === "Literal" && (containingNode.raw || "").match(/^['"`]/)
       && (expandState.range[0] !== containingNode.start && expandState.range[1] !== containingNode.end)
       && (containingNode.start+1 < expandState.range[0]
        || containingNode.end-1 > expandState.range[1])) {
        return {range: [start+1, end-1],prev: expandState}
      }

      return {range: [start, end],prev: expandState}

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

      function expandOnToken(t) {
        return {range: [posToIdx(t.start), posToIdx(t.end)], prev: expandState}
      }

      function tokenPosition() {
        var offset = posToIdx({column: 0, row: p.row});
        return {
          tokenStart: offset + token.start,
          tokenEnd: offset + token.start + token.value.length
        }
      }

      function posToIdx(pos) { return ed.positionToIndex(pos); }
      function idxToPos(idx) { return ed.indexToPosition(idx); }
  }

  contractRegion(ed, src, ast, expandState) {
    return expandState.prev || expandState;
  }
}