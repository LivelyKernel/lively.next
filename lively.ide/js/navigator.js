// FIXME proper dependency to lively.ast

import { query, fuzzyParse, acorn, custom, walk } from 'lively.ast';

export default class JavaScriptNavigator {
  ensureAST (ed) { return this.parse(ed.textString); }
  parse (source) { return fuzzyParse(source); }

  move (selector, ed) {
    const select = !!ed.activeMark || !ed.selection.isEmpty();
    const sel = ed.selection;
    const pos = sel.lead;
    const idx = ed.positionToIndex(pos);
    const newIdx = this[selector](ed.textString, idx);
    const newPos = ed.indexToPosition(newIdx);
    const isBackwards = sel.isBackwards;
    sel.lead = newPos;
    if (!select) { sel.anchor = newPos; }
    ed.scrollCursorIntoView();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // movement
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  forwardSexp (ed) { this.move('_forwardSexp', ed); }
  backwardSexp (ed) { this.move('_backwardSexp', ed); }
  backwardUpSexp (ed) { this.move('_backwardUpSexp', ed); }
  forwardDownSexp (ed) { this.move('_forwardDownSexp', ed); }

  _forwardSexp (src, pos) {
    const ast = this.parse(src);
    const nodes = custom.findNodesIncluding(ast, pos);
    const containingNode = nodes.reverse().find(function (n) { return n.end !== pos; });
    if (!containingNode) return pos;
    if (containingNode.type === 'BlockStatement') {
      const sibling = containingNode.body.find(function (node) { return node.start > pos; });
      if (sibling) return sibling.start;
    }
    return containingNode.end;
  }

  _backwardSexp (src, pos) {
    const ast = this.parse(src);
    const nodes = custom.findNodesIncluding(ast, pos);
    const containingNode = nodes.reverse().find(function (n) { return n.start !== pos; });
    if (!containingNode) return pos;
    if (containingNode.type === 'BlockStatement') {
      const sibling = containingNode.body.slice().reverse().find(function (node) { return node.end < pos; });
      if (sibling) return sibling.end;
    }
    return containingNode ? containingNode.start : pos;
  }

  _backwardUpSexp (src, pos) {
    const ast = this.parse(src);
    const nodes = custom.findNodesIncluding(ast, pos);
    const containingNode = nodes.reverse().find(function (n) { return n.start !== pos; });
    return containingNode ? containingNode.start : pos;
  }

  _forwardDownSexp (src, pos) {
    const ast = this.parse(src);
    const found = walk.findNodeAfter(ast, pos, function (type, node) { return node.start > pos; });
    return found ? found.node.start : pos;
  }

  // -=-=-=-=-=-=-=-
  // selection
  // -=-=-=-=-=-=-=-

  markDefun (ed) {
    const range = this.rangeForFunctionOrDefinition(
      ed.textString, [
        ed.positionToIndex(ed.selection.range.start),
        ed.positionToIndex(ed.selection.range.end)
      ]);
    if (range) ed.execCommand('expandRegion', { start: range[0], end: range[1] });
  }

  rangeForNodesMatching (src, pos, func) {
    // if the cursor is at a position that has a containing node matching func
    // return start/end index of that node
    const ast = this.parse(src);
    const nodes = custom.findNodesIncluding(ast, pos);
    const containingNode = nodes.reverse().find(func);
    return containingNode ? [containingNode.start, containingNode.end] : null;
  }

  rangeForFunctionOrDefinition (src, currentRange) {
    const isNullSelection = currentRange[0] === currentRange[1];
    return this.rangeForNodesMatching(src, currentRange[1], function (node) {
      const typeOK = ['AssignmentExpression', 'FunctionDeclaration', 'FunctionExpression', 'MethodDefinition'].includes(node.type);
      if (typeOK &&
              ((isNullSelection && node.end !== currentRange[1]) ||
            (!isNullSelection && node.start < currentRange[0]))) return true;
      return false;
    });
  }

  // -=-=-=-=-=-=-
  // definitions
  // -=-=-=-=-=-=-

  resolveIdentifierAt (editor, pos/* index! */) {
    if (typeof pos !== 'number') pos = editor.positionToIndex(pos);

    // 1. is there an identifier at the cursor position?
    const parsed = this.ensureAST(editor);
    const nodes = query.nodesAt(pos, parsed).reverse();
    let id = nodes.find(ea => ea.type === 'Identifier');

    if (!id) {
      const node = nodes[0];
      if (node && node.type.includes('Specifier') && node.local && node.local.type === 'Identifier') { id = node.local; }
      if (!id) return undefined;
    }

    // If identifier is found we gather more information about the variable named by it
    const decl = query.findDeclarationClosestToIndex(parsed, id.name, pos);
    const scope = decl
      ? query.scopeAtIndex(parsed, decl.start)
      : query.scopeAtIndex(parsed, pos);
    const { refs } = query.findReferencesAndDeclsInScope(scope, id.name);

    return { parsed, scope, id, name: id.name, decl, refs };
  }

  // -=-=-=-=-=-=-
  // expanding
  // -=-=-=-=-=-=-

  expandRegion (ed, src, ast, expandState) {
    // use token if no selection

    const hasSelection = expandState.range[0] !== expandState.range[1];
    const p = ed.indexToPosition(expandState.range[0]);
    const token = ed.tokenAt(p);

    if (!hasSelection && token && ['keyword', 'identifier'].includes(token.type)) {
      return expandOnToken(token);
    }

    ast = ast || this.parse(src);

    const pos = expandState.range[0];
    const nodes = query.nodesAtIndex(ast, pos);
    const containingNode = nodes.reverse().find(function (node) {
      return node.start < expandState.range[0] ||
                  node.end > expandState.range[1];
    });

    if (!containingNode) return expandState;

    const start = containingNode.start;
    const end = containingNode.end;

    if (containingNode.type === 'Literal' && (containingNode.raw || '').match(/^['"`]/) &&
       (expandState.range[0] !== containingNode.start && expandState.range[1] !== containingNode.end) &&
       (containingNode.start + 1 < expandState.range[0] ||
        containingNode.end - 1 > expandState.range[1])) {
      return { range: [start + 1, end - 1], prev: expandState };
    }

    return { range: [start, end], prev: expandState };

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    function expandOnToken (t) {
      const tokenPos = tokenPosition(t || token);
      return { range: [tokenPos.tokenStart, tokenPos.tokenEnd], prev: expandState };
    }

    function tokenPosition () {
      const offset = posToIdx({ column: 0, row: p.row });
      return {
        tokenStart: offset + token.start,
        tokenEnd: offset + token.start + token.value.length
      };
    }

    function posToIdx (pos) { return ed.positionToIndex(pos); }
    function idxToPos (idx) { return ed.indexToPosition(idx); }
  }

  contractRegion (ed, src, ast, expandState) {
    return expandState.prev || expandState;
  }
}

