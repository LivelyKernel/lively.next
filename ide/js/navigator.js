// FIXME proper dependency to lively.ast

import { arr } from "lively.lang";

export default class JavaScriptNavigator {

  ensureAST(astOrSource) {
    return typeof astOrSource === "string" ?
      lively.ast.fuzzyParse(astOrSource) :
      astOrSource;
  }

  move(selector, ed) {
    var select = !!ed.activeMark || !ed.selection.isEmpty(),
        sel = ed.selection,
        pos = sel.lead,
        idx = ed.positionToIndex(pos),
        newIdx = this[selector](ed.textString, idx),
        newPos = ed.indexToPosition(newIdx),
        isBackwards = sel.isBackwards;
    sel.lead = newPos;
    if (!select)
      sel.anchor = newPos;
    ed.scrollCursorIntoView();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // movement
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  forwardSexp(ed) { this.move("_forwardSexp", ed); }
  backwardSexp(ed) { this.move("_backwardSexp", ed); }
  backwardUpSexp(ed) { this.move("_backwardUpSexp", ed); }
  forwardDownSexp(ed) { this.move("_forwardDownSexp", ed); }

  _forwardSexp(src, pos) {
      var ast = this.ensureAST(src),
          nodes = lively.ast.acorn.walk.findNodesIncluding(ast, pos),
          containingNode = nodes.reverse().find(function(n) { return n.end !== pos; });
      if (!containingNode) return pos;
      if (containingNode.type === 'BlockStatement') {
          var sibling = containingNode.body.find(function(node) { return node.start > pos; });
          if (sibling) return sibling.start;
      }
      return containingNode.end;
  }

  _backwardSexp(src, pos) {
      var ast = this.ensureAST(src),
          nodes = lively.ast.acorn.walk.findNodesIncluding(ast, pos),
          containingNode = nodes.reverse().find(function(n) { return n.start !== pos; });
      if (!containingNode) return pos;
      if (containingNode.type === 'BlockStatement') {
          var sibling = containingNode.body.slice().reverse().find(function(node) { return node.end < pos; });
          if (sibling) return sibling.end;
      }
      return containingNode ? containingNode.start : pos;
  }

  _backwardUpSexp(src, pos) {
      var ast = this.ensureAST(src),
          nodes = lively.ast.acorn.walk.findNodesIncluding(ast, pos),
          containingNode = nodes.reverse().find(function(n) { return n.start !== pos; });
      return containingNode ? containingNode.start : pos;
  }

  _forwardDownSexp(src, pos) {
      var ast = this.ensureAST(src),
          found = lively.ast.acorn.walk.findNodeAfter(ast, pos, function(type, node) { return node.start > pos; });
      return found ? found.node.start : pos;
  }


  // -=-=-=-=-=-=-=-
  // selection
  // -=-=-=-=-=-=-=-

  markDefun(ed) {
    var range = this.rangeForFunctionOrDefinition(
      ed.textString, [
        ed.positionToIndex(ed.selection.range.start),
        ed.positionToIndex(ed.selection.range.end)
      ]);
    if (range) ed.execCommand('expandRegion', {start: range[0], end: range[1]});
  }

  rangeForNodesMatching(src, pos, func) {
      // if the cursor is at a position that has a containing node matching func
      // return start/end index of that node
      var ast = this.ensureAST(src),
          nodes = lively.ast.acorn.walk.findNodesIncluding(ast, pos),
          containingNode = nodes.reverse().find(func);
      return containingNode ? [containingNode.start, containingNode.end] : null;
  }

  rangeForFunctionOrDefinition(src, currentRange) {
      var isNullSelection = currentRange[0] === currentRange[1];
      return this.rangeForNodesMatching(src, currentRange[1], function(node) {
          var typeOK = ['AssignmentExpression', 'FunctionDeclaration', 'FunctionExpression', 'MethodDefinition'].includes(node.type);
          if (typeOK &&
              ((isNullSelection && node.end !== currentRange[1])
            || (!isNullSelection && node.start < currentRange[0]))) return true;
          return false;
      });
  }


  // -=-=-=-=-=-=-
  // definitions
  // -=-=-=-=-=-=-

  resolveIdentifierAt(editor, pos/*index!*/) {
    if (typeof pos !== "number") pos = editor.positionToIndex(pos);

    // 1. is there an identifier at the cursor position?
    var parsed = this.ensureAST(editor.textString),
        nodes = lively.ast.query.nodesAt(pos, parsed).reverse(),
        id = nodes.find(ea => ea.type === "Identifier");

    if (!id) {
      var node = nodes[0];
      if (node && node.type.includes("Specifier") && node.local && node.local.type === "Identifier")
        id = node.local;
      if (!id) return undefined;
    }

    // If identifier is found we gather more information about the variable named by it
    var decl = lively.ast.query.findDeclarationClosestToIndex(parsed, id.name, pos),
        scope = decl ?
          lively.ast.query.scopeAtIndex(parsed, decl.start) :
          lively.ast.query.scopeAtIndex(parsed, pos),
        refs = lively.ast.query.findReferencesAndDeclsInScope(scope, id.name).filter(ea => ea !== decl);

    return {parsed, scope, id, name: id.name, decl, refs}
  }

  // -=-=-=-=-=-=-
  // expanding
  // -=-=-=-=-=-=-

  expandRegion(ed, src, ast, expandState) {
      // use token if no selection
      var hasSelection = expandState.range[0] !== expandState.range[1],
          p = ed.indexToPosition(expandState.range[0]),
          token = ed.tokenAt(p);

      if (!hasSelection && token && ["keyword", "identifier"].includes(token.type)) {
        return expandOnToken(token)
      }

      ast = ast || (new JavaScriptNavigator()).ensureAST(src);
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
        var tokenPos = tokenPosition(t || token);
        return {range: [tokenPos.tokenStart, tokenPos.tokenEnd], prev: expandState}
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
