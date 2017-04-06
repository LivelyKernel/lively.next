/*

The text document deals with the actual contents of text: lines which in turn
contain text strings and attributes.  The document is independent from render
specific aspects, pixel position or sizes, input events.

The most import methods are Document>>textString as well as Document>>lines to
retrieve the entire text content as a string or line objects of a text morph.
Document>>insert and Document>>remove are the only(!) methods to modify the
content of a document from the outside.

Internally, text documents use a B-Tree structure to keep track of lines and to
allow efficient access and modification.  Apart from strings and text
attributes, lines keep track of some internal data like the line height and
B-Tree related data.  Consider those to be "private".

*/

import { arr, num, string } from "lively.lang";
import { printTree } from "lively.lang/text-graphics.js";

import {
  lessEqPosition,
  minPosition,
  maxPosition,
  lessPosition,
  eqPosition
} from "../text/position.js";

import {
  concatTextAndAttributes, splitTextAndAttributesIntoLines,
  joinTextAttributes,
  modifyAttributesInRange,
  concatAttributePair,
  splitTextAndAttributesAt
} from "./attributes.js";

var defaultOptions = {
  maxLeafSize: 3,
  minLeafSize: 2,
  leafSplit: 0.5,
  maxNodeSize: 10,
  minNodeSize: 5,
  nodeSplit: 0.5
}


class TreeNode {

  constructor(parent) {
    this.parent = parent;
  }

  get root() { return this.parent ? this.parent.root : this; }

  get isRoot() { return !this.parent; }

  withParents() {
    var node = this, result = [];
    while (node) { result.push(node); node = node.parent; }
    return result;
  }

  traverse(doFn) {
    var result = [doFn.call(null,this)];
    if (this.isLeaf) return result;
    for (var i = 0; i < this.children.length; i++) {
      result.push(...this.children[i].traverse(doFn));
    }
    return result;
  }

  consistencyCheck() {
    var {
      isRoot,
      isLeaf,
      children,
      size, stringSize, height,
      options: {maxLeafSize, maxNodeSize, minLeafSize, minNodeSize}
    } = this;

    if (size === 0)
      throw new Error(`size of ${this} expected to be > 0!`);

    var sumChildSizes = arr.sum(arr.pluck(children, "size"));
    if (sumChildSizes != size)
      throw new Error(`Sum of child sizes is not size of ${this}: ${sumChildSizes} != ${size}`);

    var sumChildrenStringSize = arr.sum(arr.pluck(children, "stringSize"));
    if (sumChildrenStringSize != stringSize)
      throw new Error(`Sum of child stringSize is not stringSIze of ${this}: ${sumChildrenStringSize} != ${stringSize}`);

    var sumChildrenHeight = arr.sum(arr.pluck(children, "height"));
    if (sumChildrenHeight != height)
      throw new Error(`Sum of child Height is not Height of ${this}: ${sumChildrenHeight} != ${height}`);

    if (!isRoot) {
      var max = isLeaf ? maxLeafSize : maxNodeSize,
          min = isLeaf ? minLeafSize : minNodeSize;
      if (!num.between(children.length, min, max))
        throw new Error(`children count of ${this} expected to be between ${min} and ${max} but is ${children.length}`);
      if (isLeaf) {
        if (!children.every(ea => ea.isLine))
          throw new Error(`children of leaf ${this} are not all lines!`)
      } else {
        if (!children.every(ea => ea.isNode))
          throw new Error(`children of non-leaf ${this} are not all inner nodes!`)
      }
    }

    if (!isLeaf)
      children.forEach(ea => ea.consistencyCheck());
  }

}


class InnerTreeNode extends TreeNode {

  constructor(parent = null, children = [], size = 0, height = 0, stringSize = 0, options) {
    super(parent);
    this.options = options;
    this.children = children;
    this.size = size;
    this.stringSize = stringSize;
    this.height = height;
    this.isLeaf = true;
  }

  get isNode() { return true; }

  resize(n, height, stringSize) {
    this.size = this.size + n;
    this.height = this.height + height;
    this.stringSize = this.stringSize + stringSize;
    this.parent && this.parent.resize(n, height, stringSize);
    // if (n > 0) this.balanceAfterGrowth(n);
  }

  lines(result = []) {
    if (this.isLeaf) { result.push(...this.children); return result; }
    for (var i = 0; i < this.children.length; i++)
      this.children[i].lines(result)
    return result;
  }

  findRow(row) {
    if (row < 0 || row >= this.size) return null;
    if (this.isLeaf) return this.children[row];
    for (var i = 0; i < this.children.length; i++) {
      var child = this.children[i], childSize = child.size;
      if (row < childSize) return child.findRow(row);
      row = row - childSize;
    }
    return null;
  }

  findLineByVerticalOffset(y, lineY = 0) {
    if (y < 0 || y > this.height) return null;
    for (let i = 0; i < this.children.length; i++) {
      let child = this.children[i],
          childHeight = child.height;
      if (y <= childHeight)
        return this.isLeaf ? {line: child, offset: y, y: lineY} :
          child.findLineByVerticalOffset(y, lineY);
      y = y - childHeight;
      lineY = lineY + childHeight;
    }
    return null;
  }

  computeVerticalOffsetOf(row, y = 0) {
    if (row < 0 || row >= this.size) {
      console.warn(`strange row in computeVerticalOffsetOf: ${row}`);
      return y;
    }
    if (this.isLeaf) {
      for (let i = 0; i < Math.min(row, this.children.length); i++)
        y = y + this.children[i].height;
      return y;
    }
    for (var i = 0; i < this.children.length; i++) {
      var child = this.children[i], childSize = child.size;
      if (row < childSize) return child.computeVerticalOffsetOf(row, y);
      row = row - childSize;
      y = y + child.height;
    }
    return y;
  }


  ensureLine(lineSpec) {
    if (!lineSpec) lineSpec = "";
    let isString = typeof lineSpec === "string";

    if (!isString && lineSpec.isLine) {
      lineSpec.parent = this;
      return lineSpec;
    }

    let textAndAttributes = isString ?
      [lineSpec, null] :
      lineSpec.textAndAttributes || [lineSpec.text|| "", null];
    return new Line(this, isString ? 0 : lineSpec.height || 0, textAndAttributes);
  }

  insert(lineSpecs, atIndex = this.size) {
    if (this.isLeaf) {
      let lines = [], height = 0, stringSize = 0;
      for (let i = 0; i < lineSpecs.length; i++) {
        let line = this.ensureLine(lineSpecs[i]);
        lines.push(line);
        height = height + line.height;
        stringSize = stringSize + line.stringSize;
      }
      this.children.splice(atIndex, 0, ...lines);
      this.resize(lines.length, height, stringSize);
      this.balanceAfterGrowth();
      return lines;
    }

    if (this.children.length === 0)
      this.children.push(new InnerTreeNode(this, [], 0, 0, 0, this.options));

    var i = 0;
    for (; i < this.children.length; i++) {
      var child = this.children[i], childSize = child.size;
      if (atIndex <= childSize)
        return child.insert(lineSpecs, atIndex);
      atIndex = atIndex - childSize;
    }

    let last = this.children[i-1];
    return last.insert(lineSpecs, last.size);
  }

  withParentChainsUpToCommonParentDo(otherNode, otherNodeAndParentsDoFunc, thisNodeAndParentsDoFunc) {
    // Given the two nodes this and otherNode, run two iterations:
    // 1. Up to but not including the common parent node (the first node in
    // both this.withParents() and otherNode.withParents()) call
    // `otherNodeAndParentsDoFunc` for otherNode and all its parents
    // 2. Up to but not including the common parent node for this and all my
    // parents
    var myParents = this.withParents(),
        currentOtherNode = otherNode,
        commonParent, otherI = 0;
    while (currentOtherNode) {
      if (myParents.includes(currentOtherNode)) { commonParent = currentOtherNode; break; }
      otherNodeAndParentsDoFunc(currentOtherNode, otherI++);
      currentOtherNode = currentOtherNode.parent;
    }

    let commonParentIndex = myParents.indexOf(commonParent);
    if (commonParentIndex < 0) commonParentIndex = myParents.length; // in this case for all
    let thisNodeAndParents = myParents.slice(0, commonParentIndex);
    for (let i = 0; i < thisNodeAndParents.length; i++) {
      thisNodeAndParentsDoFunc(thisNodeAndParents[i], i);
    }
  }

  findLineWithTextIndex(textIndex, row = 0) {
    // textIndex is the character position relative to the entire text
    // represented by this node. Returns the line and the remaining index
    // offset into the lines string
    if (this.isLeaf) {
      for (let i = 0; i < this.children.length; i++) {
        let line = this.children[i],
            stringSize = line.stringSize;
        if (textIndex < stringSize)
          return {line, column: textIndex, row};
        textIndex = textIndex - stringSize;
        row++;
      }
      let line = arr.last(this.children),
          stringSize = line.stringSize;
      return {line, row: row-1, column: stringSize-1}
    }

    let localIndex = 0
    for (let i = 0; i < this.children.length; i++) {
      let node = this.children[i],
          stringSize = node.stringSize;
      if (textIndex < localIndex + stringSize)
        return node.findLineWithTextIndex(textIndex - localIndex, row);
      row = row + node.size;
      localIndex = localIndex + stringSize;
    }
    return arr.last(this.children).findLineWithTextIndex(textIndex - localIndex);
  }

  findLeafs(fromRow, toRow, baseIndex = 0) {
    // when searching for the parents of multiple lines indicated by fromRow
    // (start line, inclusive) and toRow (end line, inclusive), this methods
    // finds the leaf nodes for those lines.
    // The return value is an array of spec objects,
    // [{node, full: BOOLEAN, firstLine: NUMBER, lastLine: NUMBER}]
    // full indicates if all children are affected,
    // firstLine, lastLine are the indices in node.children that should be
    // selected (inclusive)
    if (fromRow > baseIndex + this.size || toRow < baseIndex) return [];

    if (this.isLeaf) {
      var firstLine = Math.max(0, fromRow - baseIndex),
          max = this.children.length-1,
          lastLine = Math.min(max, toRow - baseIndex),
          full = false;
      if (firstLine === 0 && lastLine === max) { full = true; lastLine = max; }
      return [{node: this, firstLine, lastLine, full}];
    }

    var result = [];
    for (var i = 0; i < this.children.length; i++) {
      var c = this.children[i];
      result.push(...c.findLeafs(fromRow, toRow, baseIndex));
      baseIndex = baseIndex + c.size;
    }
    return result;
  }

  removeFromToInRoot(fromIndex, toIndex) {
    // Remove lines fromIndex to toIndex
    if (!this.isRoot)
      throw new Error("removeFromTo() should be called on the root node");

    if (fromIndex > toIndex)
      [fromIndex, toIndex] = [toIndex, fromIndex];

    let {size, options: {maxLeafSize, minLeafSize}} = this,
        leafs = this.findLeafs(fromIndex, toIndex),
        first = leafs.shift(),
        last = leafs.pop(),
        toRemove = leafs,
        rebalance = [],
        firstLeftSibling, lastRightSibling,
        firstNeedsMerge = false, lastNeedsMerge = false;


    if (fromIndex >= size) return;

    if (last && first.node === last.node) last = null;

    // The first, leftmost affected node. If all its lines are remove, remove
    // it entirely, otherwise remember it for merge/stealing
    if (first.full) toRemove.push(first);
    else {
      let {lastLine, firstLine, node: {children}} = first,
          n = (lastLine - firstLine)+1;
      firstNeedsMerge = children.length - n < minLeafSize;
    }

    // ...same with the last (rightmost) affected node
    if (last) {
      if (last.full) toRemove.push(last);
      else {
        let {lastLine, firstLine, node: {children}} = last,
            n = (lastLine - firstLine)+1;
        lastNeedsMerge = children.length - n < minLeafSize;
      }
    }

    // look for siblings for merge steal operations before we change anything
    if (firstNeedsMerge || lastNeedsMerge) {
      var prevLine = first.node.children[0].prevLine();
      firstLeftSibling = prevLine ? prevLine.parent : null;
      var nextLine = arr.last(last ? last.node.children : first.node.children).nextLine();
      lastRightSibling = nextLine ? nextLine.parent : null;
    }

    // remove the nodes inbetween first/last + first if "full" and last if "full"
    for (let i = 0; i < toRemove.length; i++) {
      var node = toRemove[i].node,
          n = node.children.length,
          height = 0, stringSize = 0;
      for (let j = 0; j < n; j++) {
        let ea = node.children[j];
        height = height + ea.height;
        stringSize = stringSize + ea.stringSize;
        ea.parent = null;
      }
      node.children.length = 0;
      node.resize(-n, -height, -stringSize);
      var p = node.parent;
      if (p) {
        node.parent = null;
        p.children.splice(p.children.indexOf(node), 1);
        if (!rebalance.includes(p)) rebalance.push(p);
      }
    }

    // if only some lines in first get removed do that here
    if (!first.full) {
      let {lastLine, firstLine, node} = first,
          {children, options} = node,
          n = (lastLine - firstLine)+1,
          removedLines = children.splice(firstLine, n),
          height = 0, stringSize = 0;
      for (let j = 0; j < removedLines.length; j++) {
        let ea = removedLines[j];
        height = height + ea.height;
        stringSize = stringSize + ea.stringSize;
        ea.parent = null;
      }
      node.resize(-n, -height, -stringSize);
    }

    // ...same for last
    if (last && !last.full) {
      let {lastLine, firstLine, node} = last,
          {children} = node,
          n = (lastLine - firstLine)+1,
          removedLines = children.splice(firstLine, n),
          height = 0, stringSize = 0;
      for (let j = 0; j < removedLines.length; j++) {
        let ea = removedLines[j];
        height += ea.height;
        stringSize += ea.stringSize;
        ea.parent = null;
      }
      node.resize(-n, -height, -stringSize);
    }

    // merge if needed
    if (firstNeedsMerge) {
      first.node.letLeafMergeOrStealAfterRemove(
        firstLeftSibling, !last || last.full ? lastRightSibling : last.node);
    }

    // also do that for last but consider the case that the first node might
    // have been merged "away"
    if (last && lastNeedsMerge) {
      last.node.letLeafMergeOrStealAfterRemove(
        first.full || !first.node.parent ? firstLeftSibling : first.node, lastRightSibling);
    }

    // rebalance all affected nodes, meaning to change tree structure as necessary
    rebalance.forEach(ea => ea.balanceAfterShrink());
  }

  letLeafMergeOrStealAfterRemove(leftSibling, rightSibling) {
    if (!this.isLeaf)
      throw new Error(`Called letLeafMergeOrStealAfterRemove() in non-leaf ${this}`);

    var {children, options} = this,
        maxChildren = options.maxLeafSize,
        minChildren = options.minLeafSize,
        needsChange = children.length < minChildren;

    // if (!needsMerge)
    //   throw new Error(`Called letLeafMergeOrStealAfterRemove() but ${this} does not need merge/theft!`);

    // ...try to merge with left or right sibling
    var mergeLeft = leftSibling && leftSibling.children.length + children.length <= maxChildren,
        mergeRight = !mergeLeft && rightSibling && rightSibling.children.length + children.length <= maxChildren,
        mergeTarget = mergeLeft ? leftSibling : mergeRight ? rightSibling : null;

    if (mergeTarget) {
      // update size of sibling and parents up to common parent and
      // subtract my size from self and all parents up to common parent with sibling
      var mySize = this.size, myHeight = this.height, myStringSize = this.stringSize;
      this.withParentChainsUpToCommonParentDo(mergeTarget,
        mergeNodeOrParent => {
          mergeNodeOrParent.size = mergeNodeOrParent.size + mySize;
          mergeNodeOrParent.height = mergeNodeOrParent.height + myHeight;
          mergeNodeOrParent.stringSize = mergeNodeOrParent.stringSize + myStringSize;
        },
        (thisOrParent => {
          thisOrParent.size = thisOrParent.size - mySize;
          thisOrParent.height = thisOrParent.height - myHeight;
          thisOrParent.stringSize = thisOrParent.stringSize - myStringSize;
        }));

      // move children over
      children.forEach(ea => ea.parent = mergeTarget);
      if (mergeLeft) mergeTarget.children.push(...children);
      else mergeTarget.children.unshift(...children);
      children.length = 0;
    }  else {
      // if this node can't be merged with a sibling than at least try to
      // steal nodes from a sibling to fill me up!

      var stealLeftN = leftSibling ? Math.ceil((leftSibling.children.length - minChildren) / 2) : 0,
          stealRightN = rightSibling ? Math.ceil((rightSibling.children.length - minChildren) / 2) : 0,
          stealLeft = stealLeftN > 0 && stealLeftN >= stealRightN,
          stealRight = !stealLeft && stealRightN > 0;

      if (stealLeft || stealRight) {
        var newChildren = stealLeft ?
              leftSibling.children.splice(leftSibling.children.length - stealLeftN, stealLeftN) :
              rightSibling.children.splice(0, stealRightN),
            stealTarget = stealLeft ? leftSibling : rightSibling,
            stealN = stealLeft ? stealLeftN : stealRightN,
            stealHeight = 0, stealStringSize = 0;
        for (let i = 0; i < newChildren.length; i++) {
          stealHeight = stealHeight + newChildren[i].height;
          stealStringSize = stealStringSize + newChildren[i].stringSize;
        }

        this.withParentChainsUpToCommonParentDo(stealTarget,
          mergeNodeOrParent => {
            mergeNodeOrParent.size = mergeNodeOrParent.size - stealN
            mergeNodeOrParent.height = mergeNodeOrParent.height - stealHeight;
            mergeNodeOrParent.stringSize = mergeNodeOrParent.stringSize - stealStringSize;
          },
          (thisOrParent => {
            thisOrParent.size = thisOrParent.size + stealN;
            thisOrParent.height = thisOrParent.height + stealHeight;
            thisOrParent.stringSize = thisOrParent.stringSize + stealStringSize;
          }));
        newChildren.forEach(ea => ea.parent = this);
        if (stealLeft) this.children.unshift(...newChildren);
        else this.children.push(...newChildren);
      }
    }

    if (children.length === 0) {
      var p = this.parent;
      if (p) {
        this.parent = null;
        p.children.splice(p.children.indexOf(this), 1);
        p.balanceAfterShrink();
      }
    } else {
      this.balanceAfterShrink();
    }
  }

  balanceAfterGrowth() {
    var {isLeaf, size, stringSize, parent, children, height, options} = this,
        maxChildren = isLeaf ? options.maxLeafSize : options.maxNodeSize,
        split = children.length > maxChildren;

    if (!split) return;

    if (!parent) {
      parent = this.parent = new InnerTreeNode(null, [this], size, height, stringSize, options);
      parent.isLeaf = false;
    }

    var splitIndex = Math.floor(children.length / 2),
        i = 0, mySize = 0, otherSize = 0,
        myHeight  = 0, otherHeight = 0,
        myStringSize = 0, otherStringSize = 0;
    for (; i < splitIndex; i++) {
      mySize = mySize + children[i].size;
      myHeight = myHeight + children[i].height;
      myStringSize = myStringSize + children[i].stringSize;
    };
    for (; i < children.length; i++) {
      otherSize = otherSize + children[i].size;;
      otherHeight = otherHeight + children[i].height;
      otherStringSize = otherStringSize + children[i].stringSize;
    }

    this.children = children.slice(0, splitIndex);
    this.size = mySize;
    this.height = myHeight;
    this.stringSize = myStringSize;

    var indexInParent = parent.children.indexOf(this),
        otherChildren = children.slice(splitIndex),
        otherNode = new InnerTreeNode(parent, otherChildren, otherSize, otherHeight, otherStringSize, options);
    otherNode.isLeaf = isLeaf;
    otherChildren.forEach(ea => ea.parent = otherNode);
    parent.children.splice(indexInParent + 1, 0, otherNode);

    if (otherNode.children.length > maxChildren)
      otherNode.balanceAfterGrowth();
    if (this.children.length > maxChildren)
      this.balanceAfterGrowth();

    this.parent.balanceAfterGrowth();
  }

  balanceAfterShrink() {
    var {isLeaf, parent, children, options} = this,
        {maxLeafSize, maxNodeSize, minLeafSize, minNodeSize} = options,
        maxChildren = isLeaf ? maxLeafSize : maxNodeSize,
        minChildren = isLeaf ? minLeafSize : minNodeSize;

    if (children.length >= minChildren) {
      parent && parent.balanceAfterShrink();
      return;
    }

    if (children.length === 0) {
      if (parent) {
        arr.remove(parent.children, this);
        parent.balanceAfterShrink();
      }
      return;
    }

    // less children than desired

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    if (isLeaf) {
      // its a leaf so children are lines, try to remove myself...
      if (parent && parent.children.length === 1) {
        // I'm the only child...
        this.parent = null;
        parent.children.length = 0;
        parent.children.push(...children);
        children.forEach(ea => ea.parent = parent);
        parent.isLeaf = true;
      }
      parent && parent.balanceAfterShrink();
      return;
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // not a leaf, try to get rid of myself anyway...
    var grandChildren = [];
    for (var i = 0; i < children.length; i++) {
      grandChildren.push(...children[i].children);
    }

    var leaf = children[0].isLeaf;
    if (grandChildren.length > (leaf ? maxLeafSize : maxNodeSize)) return;

    children.forEach(ea => ea.parent = null);
    grandChildren.forEach(ea => ea.parent = this);
    children.length = 0;
    children.push(...grandChildren);
    this.isLeaf = leaf;

    parent && parent.balanceAfterShrink();
  }

  print(index = 0, depth = 0, optName) {
    var {isLeaf, size, stringSize, height, children} = this,
        name = optName ? optName : isLeaf ? "leaf" : "node",
        indent = " ".repeat(depth),
        printed = `${indent}${name} (size: ${size}, height: ${height}, stringSize: ${stringSize})`;

    if (children.length) {
      var childrenPrinted = "",
          childIndex = index + size;
      for (var i = children.length; i--;) {
        var child = children[i];
        childIndex = childIndex - child.size;
        childrenPrinted = "\n" + child.print(childIndex, depth + 1) + childrenPrinted;
      }
      printed += childrenPrinted;
    }

    return printed;
  }

  toString() {
    return `node (${this.isLeaf ? "leaf, " : ""}size: ${this.size})`;
  }

}


export class Line extends TreeNode {

  constructor(parent, height = 0, textAndAttributes = []) {
    super(parent);

    this.textAndAttributes = joinTextAttributes(textAndAttributes);
    this._text = "";
    this._textAttributes = null;
    this.height = height;
    this.hasEstimatedHeight = false;

    // line text settings
    this.textAlign = "left";
    this.lineHeight = null;
    this.marginTop = 0;
    this.marginBottom = 0;
  }

  get isLine() { return true; }

  get size() { return 1; }

  get stringSize() { return this.text.length + 1/*newline*/;}

  get text() {
    if (this._text) return this._text;
    let text = "", attrs = this.textAndAttributes;
    for (let i = 0; i < attrs.length; i = i+2)
      text = text + attrs[i];
    return this._text = text;
  }

  get textAttributes() {
    if (this._textAttributes) return this._textAttributes;
    let textAttributes = [], attrs = this.textAndAttributes;
    for (let i = 0; i < attrs.length; i = i+2) {
      let attr = attrs[i+1];
      if (attr && !textAttributes.includes(attr))
        textAttributes.push(attrs[i+1]);
    }
    return this._textAttributes = textAttributes;
  }

  get row() {
    var p = this.parent;
    if (!p) return 0;

    var parents = this.withParents();
    if (parents.length === 1)
      return parents.children.indexOf(this);

    // closest parent is last
    var index = 0;
    for (let i = parents.length-1; i >= 1; i--) {
      let parent = parents[i],
          itsParent = parents[i - 1],
          nodeIndex = parent.children.indexOf(itsParent);
      for (let j = 0; j < nodeIndex; j++) {
        index = index + parent.children[j].size;
      }
    }
    return index;
  }

  nextLine() {
    let {parent} = this;
    if (!parent) return null;
    let next = parent.children[parent.children.indexOf(this)+1];
    if (next) return next;
    let {root, row} = this;
    return root.findRow(row+1);
  }

  prevLine() {
    let {parent} = this;
    if (!parent) return null;
    let prev = parent.children[parent.children.indexOf(this)-1];
    if (prev) return prev;
    let {root, row} = this;
    return root.findRow(row-1);
  }

  changeHeight(newHeight, isEstimatedHeight = false) {
    let {height, parent} = this,
        delta = newHeight - height;
    this.height = newHeight;
    this.hasEstimatedHeight = isEstimatedHeight;
    while (parent) {
      parent.height = parent.height + delta;
      parent = parent.parent;
    }
    return this;
  }

  changeText(newText, textAndAttributes = null) {
    let {parent, text, height} = this,
        deltaLength = (newText.length+1) - (text.length+1),
        deltaHeight = -height;
    this.height = 0;
    this.hasEstimatedHeight = false;
    this._text = newText;
    this._textAttributes = null;
    this.textAndAttributes = textAndAttributes || [newText, null];
    while (parent) {
      parent.stringSize = parent.stringSize + deltaLength;
      parent.height = parent.height + deltaHeight;
      parent = parent.parent;
    }
    return this;
  }

  changeTextAndAttributes(textAndAttributes) {
    // textAndAttributes like [0, 3, "foo", {...}, ...]
    textAndAttributes = joinTextAttributes(textAndAttributes);
    let text = "";
    for (let i = 0; i < textAndAttributes.length; i = i+2)
      text = text + textAndAttributes[i];
    return this.changeText(text, textAndAttributes);
  }

  print(index = 0, depth = 0) {
    let indent = " ".repeat(depth),
        {height, stringSize, _text} = this;
    return `${indent}line ${index} (height: ${height}, stringSize: ${stringSize}, text: ${JSON.stringify(_text)})`
  }

  toString() {
    let {height, _text} = this;
    return `line (${string.truncate(_text, 30)}, ${height})`;
  }

}




const newline = "\n",
      newlineLength = 1; /*fixme make work for cr lf windows...*/

export default class Document {

  static get newline() { return newline; }

  static fromString(string, options) {
    return new this(string.split(newline), options);
  }

  constructor(lines, options) {
    this.options = {...defaultOptions, ...options};
    this.lines = lines;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // tree controls

  balance() {
    this.root.balanceAfterGrowth();
    this.fixRoot();
  }

  fixRoot() {
    var newRoot = this.root.root;
    if (this.root !== newRoot) this.root = newRoot;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // line related

  get height() { return this.root.height; }
  get rowCount() { return this.root.size; }
  get stringSize() { return this.rowCount === 0 ? 0 : this.root.stringSize-1/*last newline*/; }

  get lines() { return this.root.lines(); }
  set lines(lines = []) {
    this.root = new InnerTreeNode(null, [], 0, 0, 0, this.options);
    this.insertLines(lines);
  }

  clipRow(row) { return Math.max(0, Math.min(row, this.rowCount-1)); }
  clipPositionToLines({row, column}) {
    let nLines = this.rowCount;

    if (nLines === 0) return {row: 0, column: 0};

    if (row < 0) row = 0;
    else if (row >= nLines) row = nLines-1;

    if (column < 0) column = 0;
    else {
      let lineLength = this.getLineString(row).length;
      if (column > lineLength) column = lineLength;
    }

    return {row, column};
  }

  findLineByVerticalOffset(height) { return this.root.findLineByVerticalOffset(height); }
  computeVerticalOffsetOf(row) { return this.root.computeVerticalOffsetOf(row); }

  getLine(row) { return this.root.findRow(this.clipRow(row)); }
  getLineString(row) {
    let line = this.getLine(row);
    return line ? line.text : "";
  }

  insertLine(text, atRow = this.root.rowCount) {
    return this.insertLines([text], atRow)[0];
  }

  removeLine(row) {
    this.root.removeFromToInRoot(row, row);
    // this.root.remove(row);
  }

  removeLines(fromRow, toRow) {
    this.root.removeFromToInRoot(fromRow, toRow);
  }

  insertLines(lineSpecs, atRow) {
    let lines = this.root.insert(lineSpecs, atRow);
    this.fixRoot();
    return lines;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // text interface

  get textString() {
    let string = "", lines = this.lines;
    if (!lines.length) return string;
    for (var i = 0; i < lines.length-1; i++)
      string = string + lines[i].text + newline;
    string = string + lines[i].text;
    return string;
  }
  set textString(string) { this.lines = string.split(newline); }

  get endPosition() {
    let {rowCount} = this;
    if (rowCount === 0) return {row: 0, column: 0};
    let row = rowCount-1, line = this.getLine(row);
    return {row, column: line.stringSize-1}
  }

  get textAndAttributes() {
    // pairs the strings with attributes of the lines, merging text/attributes
    // between line ends of possible.
    // Returns a list of text/attribute pairs like
    //   ["hello", {bar: 23}, "wold", {foo: "..."}, ...]

    let {lines} = this;
    if (!lines.length) return result;

    let nl = newline,
        lastRow = lines.length-1,
        result = lines[0].textAndAttributes.slice();

    for (let row = 1; row <= lastRow; row++) {
      // add all the texts and attributes from line.textAndAttributes
      // tuple that we unpack here
      let line = lines[row],
          lastAttr = result.pop() || null,
          lastText = result.pop() || "",
          textAndAttributes = line.textAndAttributes,
          firstText = textAndAttributes[0] || "",
          firstAttr = textAndAttributes[1] || null;

      result.push(...concatAttributePair(lastText, lastAttr, firstText, firstAttr, nl));
      for (let i = 2; i < textAndAttributes.length; i = i+2)
        result.push(textAndAttributes[i], textAndAttributes[i+1]);
    }

    return result;
  }

  set textAndAttributes(attrs) {
    this.lines = splitTextAndAttributesIntoLines(attrs, newline)
                  .map(ea => new Line(null, 0, ea));
  }

  getTextAndAttributesOfLine(row) { return this.getLine(row).textAndAttributes; }

  setTextAndAttributesOfLine(row, attrs) {
    let line = this.getLine(row);
    line.changeTextAndAttributes(attrs);
    return attrs;
  }

  mixinTextAttribute(mixinAttr, range) {
    modifyAttributesInRange(this, range,
      (line, attr) => Object.assign({}, attr, mixinAttr));
  }

  mixoutTextAttribute(attr, range = {start: {row: 0, column: 0}, end: this.endPosition}) {
    if (!attr) return;
    let keys = Object.keys(attr);
    modifyAttributesInRange(this, range,
      (line, attr) => {
        if (!attr) return attr;
        let mixout = {}, keyCount;
        for (let key in attr) {
          if (!keys.includes(key)) {
            mixout[key] = attr[key];
            keyCount++;
          }
        }
        return keyCount === 0 ? null : mixout;
      });
  }

  resetTextAttributes() {
    let lines = this.lines;
    lines.forEach(line => line.changeText(line.text));
  }

  textAttributeAt({row, column}) {
    column = Math.max(0, column);
    let line = this.getLine(row);
    if (!line) return null;
    let index = 0, attrs = line.textAndAttributes;
    for (let i = 0; i < attrs.length; i = i+2) {
      let text = attrs[i], attr = attrs[i+1];
      index = index + text.length;
      if (column < index) return attr;
    }
    return attrs[attrs.length-1];
  }

  textInRange({start, end}) {
    start = this.clipPositionToLines(start);
    end = this.clipPositionToLines(end);
    if (lessPosition(end, start)) [start, end] = [end, start];

    let {row, column} = start,
        {row: endRow, column: endColumn} = end;

    if (row === endRow)
      return column === endColumn ?
        "" : this.getLineString(row).slice(column, endColumn);

    let line = this.getLine(row),
        result = line.text.slice(column);
    while ((line = line.nextLine()) && ++row < endRow)
      result += newline + line.text;
    return result + newline + this.getLineString(endRow).slice(0, endColumn);
  }

  setTextInRange(string, range) {
    this.remove(range);
    return this.insertText(string, range.start, false);
  }

  indexToPosition(index) {
    if (index < 0) index = 0;
    let {row, column} = this.root.findLineWithTextIndex(index, 0);
    return {row, column};
  }

  positionToIndex({row, column}) {
    let line = this.getLine(row);
    column = Math.max(0, Math.min(column, line.stringSize-1));
    let index = column,
        parent = line.parent,
        node = line;
    while (parent) {
      let nodeIndex = parent.children.indexOf(node),
          leftSiblings = parent.children.slice(0, nodeIndex);
      for (let i = 0; i < leftSiblings.length; i++)
        index = index + leftSiblings[i].stringSize;
      node = parent;
      parent = parent.parent;
    }
    return index;
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  insertTextAndAttributes(textAndAttributes, pos) {
    // inserts text and attribute pairs of `textAndAttributes` into the
    // document at text position `pos`.

    if (!textAndAttributes || !textAndAttributes.length)
      return {start: pos, end: pos};

    let {row, column} = pos;
    if (row < 0) row = 0;
    if (column < 0) column = 0;

    let line = this.getLine(row),
        attrsForLines = splitTextAndAttributesIntoLines(textAndAttributes, newline);

    if (!line) { // text empty
      let lines = this.insertLines(attrsForLines.map(ea => new Line(null, 0, ea)));
      return {
        start: {row: 0, column: 0},
        end: {row: lines.length, column: arr.last(lines).text.length}
      };
    }

    // if insertion position comes after last row fill in new lines
    if (row >= this.rowCount) {
      let docEndPos = this.endPosition;
      for (let i = 0; i < row - docEndPos.row; i++)
        attrsForLines.unshift(["", null]);
      ({row, column} = docEndPos);
    }

    // just a new line, split line row and column and be done
    if (attrsForLines.length === 1 && attrsForLines[0][0] === "")
      return this.splitLineAt({row, column});

    let firstInsertionLine = attrsForLines.shift(),
        nInsertionLines = attrsForLines.length,
        endPos = {row, column},
        lineLength = line.stringSize-1;

    if (column > lineLength) {
      let fill = " ".repeat(column - lineLength);
      if (firstInsertionLine.length)
        firstInsertionLine[0] = fill + firstInsertionLine[0];
      else
        firstInsertionLine.push(fill, null);
    }

    let [before, after] = splitTextAndAttributesAt(line.textAndAttributes, column);
    if (before[0] === "") before = []; // empty prefix
    let lineTextAndAttributes = concatTextAndAttributes(before, firstInsertionLine, true);
    if (nInsertionLines === 0) {
      let firstInsertionLineLength = 0;
      for (let i = 0; i < firstInsertionLine.length; i = i+2)
        firstInsertionLineLength += firstInsertionLine[i].length;
      endPos.column = column + firstInsertionLineLength;
      concatTextAndAttributes(lineTextAndAttributes, after, true);
    }
    line.changeTextAndAttributes(lineTextAndAttributes);

    if (nInsertionLines === 0) return {start: {row, column}, end: endPos};
    let lastInsertionLine = attrsForLines[nInsertionLines-1],
        lastInsertionLineLength = 0;
    for (let i = 0; i < lastInsertionLine.length; i = i+2)
      lastInsertionLineLength += lastInsertionLine[i].length;
    endPos.row += nInsertionLines;
    endPos.column = lastInsertionLineLength;

    let lines = this.insertLines(attrsForLines.map(ea => new Line(null, 0, ea)), row+1),
        lastLine = arr.last(lines);
    lastLine.changeTextAndAttributes(
      concatTextAndAttributes(lastLine.textAndAttributes, after, true));

    return {start: {row, column}, end: endPos};
  }

  insertText(text, pos, extendAttrs = false) {
    // FIXME... imlement via insertTextAndAttributes???

    // inserts string `text` into the document at text position `pos`.
    // if `extendAttrs` is true then the attributes directly at pos will expand
    // of the inserted text.
    if (!text) return {start: pos, end: pos};

    let {row, column} = pos;
    if (row < 0) row = 0;
    if (column < 0) column = 0;

    let line = this.getLine(row);

    if (!line) { // text empty
      let lines = this.insertLines(text.split(newline));
      return {
        start: {row: 0, column: 0},
        end: {row: lines.length, column: arr.last(lines).text.length}
      };
    }

    // if insertion position comes after last row fill in new lines
    if (row >= this.rowCount) {
      let docEndPos = this.endPosition;
      text = "\n".repeat(row - docEndPos.row) + text;
      ({row, column} = docEndPos);
    }

    let insertionLines = text.split(newline),
        firstInsertionLine = insertionLines.shift(),
        nInsertionLines = insertionLines.length,
        endPos = {row, column},
        lineLength = line.stringSize-1;

    if (column > lineLength) {
      firstInsertionLine = " ".repeat(column - lineLength) + firstInsertionLine;
    }

    let [before, after] = splitTextAndAttributesAt(line.textAndAttributes, column);
    if (before[0] === "") before = []; // empty prefix
    let attr = extendAttrs && before.length ? before[before.length-1] : null,
        lineTextAndAttributes = concatTextAndAttributes(before, [firstInsertionLine, attr], true);
    if (nInsertionLines === 0) {
      endPos.column = column + firstInsertionLine.length;
      concatTextAndAttributes(lineTextAndAttributes, after, true);
    }
    line.changeTextAndAttributes(lineTextAndAttributes);

    if (nInsertionLines === 0) return {start: {row, column}, end: endPos};

    endPos.row += nInsertionLines;
    endPos.column = insertionLines[nInsertionLines-1].length;

    let lines = this.insertLines(insertionLines, row+1),
        lastLine = arr.last(lines);
    lastLine.changeTextAndAttributes(
      concatTextAndAttributes(lastLine.textAndAttributes, after, true));

    return {start: {row, column}, end: endPos};
  }

  remove(range) {
    if (this.rowCount === 0) return;

    var {start, end} = range;

    if (start.row === end.row && start.column === end.column) return;
    if (lessPosition(end, start)) [start, end] = [end, start];

    let docEndPos = this.endPosition;
    if (lessEqPosition(docEndPos, start)) return;

    let {row: fromRow, column: fromCol} = maxPosition(start, {column: 0, row: 0}),
        {row: toRow, column: toCol} = minPosition(end, docEndPos);

    if (fromCol < 0) fromCol = 0;
    if (toCol < 0) toCol = 0;

    let line = this.getLine(fromRow),
        firstLine = line,
        lines = [line];
    for (let i = 0; i < toRow - fromRow; i++)
      lines.push(line = line.nextLine());
    let lastLine = lines[lines.length-1],
        [before] = splitTextAndAttributesAt(firstLine.textAndAttributes, fromCol),
        [_, after] = splitTextAndAttributesAt(lastLine.textAndAttributes, toCol);

    firstLine.changeTextAndAttributes(concatTextAndAttributes(before, after, true));
    if (lines.length > 1) this.removeLines(fromRow+1, toRow);
  }

  splitLineAt({row, column}) {
    let line = this.getLine(row),
        [before, after] = splitTextAndAttributesAt(line.textAndAttributes, column);
    line.changeTextAndAttributes(before);
    this.insertLines([new Line(null, 0, after)], row+1);
    return {start: {row, column}, end: {row: row+1, column: 0}};
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // word accessors

  wordsOfLine(row) {
    var line = this.getLineString(row),
        words = [], word,
        isWordDelimiter = char => /[^a-z0-9_]/i.test(char);

    for (var i = 0; i < line.length; i++) {
      if (isWordDelimiter(line[i])) {
        if (word) {
          word.range.end.column = i;
          words.push(word);
          word = null;
        }
      } else {
        word = (word || {index: words.length, string: "", range: {start: {row, column: i}, end: {row, column: i}}});
        word.string += line[i];
      }
    }
    if (word) { word.range.end.column = i; words.push(word); }
    return words;
  }

  wordAt({row, column}, words = this.wordsOfLine(row)) {
    return words.find(ea => {
      var {range: {start: {column: startCol}, end: {column: endCol}}} = ea;
      return startCol <= column && column <= endCol;
    }) || {range: {start: {column, row}, end: {column, row}}, string: ""};
  }

  wordLeft(pos) {
    var {row, column} = pos,
        words = this.wordsOfLine(row);

    // nothing on this line, find previous word of a line above
    if (!words.length || lessEqPosition(pos, words[0].range.start)) {
      while (--row >= 0) {
        words = this.wordsOfLine(row);
        if (words.length) return arr.last(words);
      }
      return {range: {start: pos, end: pos}, string: ""};
    }

    var word = this.wordAt(pos);
    // if there is a word at pos and pos = beginning of word we return the word
    // to the left, otherwise word
    if (word.string)
      return eqPosition(word.range.start, pos) ? words[word.index-1] : word;

    // no word at pos, find the next left word next to pos
    return words.slice().reverse().find(word => word.range.end.column <= column) || {range: {start: pos, end: pos}, string: ""};
  }

  wordRight(pos) {
    var {column, row} = pos,
        words = this.wordsOfLine(pos.row);
    if (!words.length || lessEqPosition(arr.last(words).range.end, pos)) {
      while (++row < this.lines.length) {
        words = this.wordsOfLine(row);
        if (words.length) return words[0];
      }
      return {range: {start: pos, end: pos}, string: ""};
    }
    var word = this.wordAt(pos);
    if (word.string) {
      return eqPosition(word.range.end, pos) ? words[word.index+1] : word;
    }
    return words.find(word => word.range.start.column >= column) || {range: {start: pos, end: pos}, string: ""};
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // search support

  scanForward(startPos, matchFn) {
    let {row, column: startColumn} = startPos,
        line = this.getLine(row),
        text = line.text;

    // first line
    for (let column = startColumn; column < line.stringSize-1; column++) {
      let result = matchFn(text[column], {row, column});
      if (result) return result;
    }

    while (line = line.nextLine()) {
      row++; text = line.text;
      for (let column = 0; column < line.stringSize-1; column++) {
        let result = matchFn(text[column], {row, column});
        if (result) return result;
      }
    }

    return null;
  }

  scanBackward(startPos, matchFn) {
    let {row, column: startColumn} = startPos,
        line = this.getLine(row),
        text = line.text;

    // first line
    for (let column = startColumn-1; column >= 0; column--) {
      let result = matchFn(text[column], {row, column});
      if (result) return result;
    }

    // the rest
    while (line = line.prevLine()) {
      row--; text = line.text;
      for (let column = line.stringSize-2; column >= 0; column--) {
        let result = matchFn(text[column], {row, column});
        if (result) return result;
      }
    }

    return null;
  }


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // debugging

  copy() { return new this.constructor(this.lines.slice(), this.options); }

  toString() { return `Document(${this.rowCount} lines)`; }


  consistencyCheck() {
    if (this.rowCount !== this.lines.length)
      throw new Error(`[consistency check] ${this} row count: ${this.rowCount} !== ${this.lines.length}`);
    if (this.textString.length !== this.stringSize)
      throw new Error(`[consistency check] ${this} textString.length vs stringSize: ${this.textString.length} !== ${this.stringSize}`);
    this.root.consistencyCheck();
  }

  print() { return this.root.print(0, 0, "root"); }

  print2() {
    return printTree(this.root,
      (node) => node.toString(),
      (node) => node.children,
      {padding: [2,1,2,1]});
  }
}
