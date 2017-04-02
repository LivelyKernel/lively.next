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

  ensureLine(lineSpec) {
    if (!lineSpec) lineSpec = "";
    if (typeof lineSpec === "string")
      return new Line(this, 0, lineSpec);
    if (lineSpec.isLine) {
      lineSpec.parent = this;
      return lineSpec;
    }
    return new Line(this, lineSpec.height || 0, lineSpec.text || "", lineSpec.attributesWithOffsets);
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

  constructor(parent, height = 0, text = "", attributesWithOffsets = null) {
    super(parent);
    this._text = text;
    this.attributesWithOffsets = attributesWithOffsets;
    this._textAndAttributes = null;
    this.height = height;
    this.hasEstimatedHeight = false;
  }

  get isLine() { return true; }

  get size() { return 1; }

  get stringSize() { return this.text.length + 1/*newline*/;}

  get text() { return this._text; }

  get textAndAttributes() {
    // returns a list with 4-tuples that matches text slices to attributes
    // [startIndex, endIndex, text, attributeObj, ....]
    let {_textAndAttributes, attributesWithOffsets, _text} = this;
    if (_textAndAttributes) // cached
      return _textAndAttributes;

    if (!attributesWithOffsets) // no attributes
      return this._textAndAttributes = [0, _text.length, _text, null];

    let textAndAttributes = this._textAndAttributes = [],
        index = 0, indexIntoAttrs = 0;
    while (true) {
      if (indexIntoAttrs >= attributesWithOffsets.length) break;
      let {
        [indexIntoAttrs]: start,
        [indexIntoAttrs+1]: end,
        [indexIntoAttrs+2]: attr
      } = attributesWithOffsets
      if (index < start)
        textAndAttributes.push(index, start, _text.slice(index, start), null);
      textAndAttributes.push(start, end, _text.slice(start, end), attr);
      indexIntoAttrs = indexIntoAttrs + 3;
      index = end;
    }
    if (index < _text.length)
      textAndAttributes.push(index, _text.length, _text.slice(index, _text.length), null);
    return textAndAttributes;
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

  changeText(newText, attributesWithOffsets = null) {
    let {parent, _text} = this,
        deltaLength = (newText.length+1) - (_text === undefined ? 0 : _text.length+1);
    this._text = newText;
    this.attributesWithOffsets = attributesWithOffsets;
    this._textAndAttributes = null;
    while (parent) {
      parent.stringSize = parent.stringSize + deltaLength;
      parent = parent.parent;
    }
    return this;
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


/*

let t = Date.now()
lively.lang.fun.timeToRunN(() => {
  let attr1 = Math.random() < 0.5 ? {foo: 23} : null;
  let attr2 = Math.random() < 0.5 ? {foo: 23} : null;
  concatAttributePair("hello", attr1, "world", attr2)
}, 500000);
Date.now() - t;

*/

function shallowEquals(obj1, obj2) {
  if (!obj1 || !obj2) return obj1 == obj2;
  let areEqual = true, seen = {};
  for (let key1 in obj1) {
    seen[key1] = true;
    if (!obj2.hasOwnProperty(key1)
     || obj1[key1] !== obj2[key1])
       { areEqual = false; break; }
  }
  if (areEqual) {
    for (let key2 in obj2) {
      if (seen[key2]) continue;
      if (!obj1.hasOwnProperty(key2)
       || obj1[key2] !== obj2[key2])
         { areEqual = false; break; }
    }
  }
  return areEqual;
}

function concatAttributePair(text1, attr1, text2, attr2) {
  // concatAttributePair("hello", null, "world", null) => ["helloworld", null]
  // concatAttributePair("hello", null, "world", {foo: 23}) => ["hello", null, "world", {foo: 23}]
  // concatAttributePair("hello", {foo: 23}, "world", {foo: 23}) => ["helloworld", {foo: 23}]
  if (!attr1 && !attr2) return [text1 + text2, attr1];
  if (attr1 == attr2) return [text1 + text2, attr1];
  if (!attr1 || !attr2) return [text1, attr1, text2, attr2];
  return shallowEquals(attr1, attr2) ?
    [text1 + text2, attr1] :
    [text1, attr1, text2, attr2];
}

// let l = new Line(null, 0, "hello", [2,5, {foo: 23}]);

// let split = splitLineTextAndAttributesAt(l, 0)
// let split = splitLineTextAndAttributesAt(l, 2)
// let split = splitLineTextAndAttributesAt(l, 1)
// let split = splitLineTextAndAttributesAt(l, 3)
// split[0].map((ea, i) => typeof ea === "string"?ea:null).filter(Boolean).join("")
// split[1].map((ea, i) => typeof ea === "string"?ea:null).filter(Boolean).join("")
function splitLineTextAndAttributesAt(line, column) {
  // returns a two-item array: left everything that is before column, right trailing

  let t = line.text, length = t.length;
  if (!line.attributesWithOffsets)
    return [[0, column, t.slice(0, column), null], [column, length, t.slice(column), null]];

  let textAndAttributes = line.textAndAttributes;
  for (let i = 0; i < textAndAttributes.length; i = i+4) {
    let from = textAndAttributes[i+0],
        to = textAndAttributes[i+1],
        text = textAndAttributes[i+2],
        attr = textAndAttributes[i+3];
    if (to <= column) continue;
    if (from === column)
      return [textAndAttributes.slice(0, i), textAndAttributes.slice(i)];

    return [
      [...textAndAttributes.slice(0, i), from, column, text.slice(0, column-from), attr],
      [column, to, text.slice(column-from), attr, ...textAndAttributes.slice(i+4)]];
  }

  return [textAndAttributes, [t.length, t.length, "", null]];
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
  get size() { return this.root.size; }
  get stringSize() { return this.size === 0 ? 0 : this.root.stringSize-1/*last newline*/; }

  get lines() { return this.root.lines(); }
  set lines(lines = []) {
    this.root = new InnerTreeNode(null, [], 0, 0, 0, this.options);
    this.insertLines(lines);
  }

  clipRow(row) { return Math.max(0, Math.min(row, this.root.size-1)); }
  clipPositionToLines({row, column}) {
    let nLines = this.size;

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

  getLine(row) { return this.root.findRow(this.clipRow(row)); }
  getLineString(row) {
    let line = this.getLine(row);
    return line ? line.text : "";
  }

  insertLine(text, atRow = this.root.size) {
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
    let {size} = this;
    if (size === 0) return {row: 0, column: 0};
    let row = size-1;
    let line = this.getLine(row);
    return {row, column: line.stringSize-1}
  }

  get textAttributes() {}
  set textAttributes(attrs) {}

  get textAndAttributes() {
        // pairs the strings with attributes of the lines, merging text/attributes
    // between line ends of possible.
    // Returns a list of text/attribute pairs like
    //   ["hello", {bar: 23}, "wold", {foo: "..."}, ...]

    let {lines} = this;
    if (!lines.length) return result;

    let nl = newline,
        lastRow = lines.length-1,
        result = [],
        nextIndex = 0,
        l1 = lines[0];

    // add first without concat
    nextIndex = !l1.attributesWithOffsets ?
      result.push(l1.text, null) :
      result.push(...l1.textAndAttributes);

    for (let row = 1; row <= lastRow; row++) {

      let line = lines[row];

      // no attributes? simple concat....
      if (!line.attributesWithOffsets) {
        let lastAttr = result[nextIndex-1],
            lastText = result[nextIndex-2];
        if (shallowEquals(lastAttr, null)) {
          result[nextIndex-2] = lastText + nl + line.text;
        } else {
          result[nextIndex-2] = lastText + nl;
          nextIndex = result.push(line.text, null)
        }
        continue;
      }

      // add all the texts and attributes from line.textAndAttributes
      // Note that line.textAndAttributes also includes start/end offset so a 4
      // tuple that we unpack here
      let lastAttr = result.pop(),
          lastText = result.pop(),
          textAndAttributes = line.textAndAttributes,
          firstText = textAndAttributes[3],
          firstAttr = textAndAttributes[4];

      result.push(...concatAttributePair(lastText, lastAttr, firstText, firstAttr, nl));
      for (let i = 4; i < textAndAttributes.length; i = i+4)
        result.push(textAndAttributes[i+2], textAndAttributes[i+3]);
      nextIndex = result.length;
    }

    return result;
  }

  set textAndAttributes(attrs) {}

  getTextAndAttributesOfLine(row) {}
  setTextAndAttributesOfLine(row, attrs) {}
  getAttributesWithOffsetsOfLine(row) {}
  setAttributesWithOffsetsOfLine(row, attrs) {}

  mixinTextAttribute(attr, range) {
    // let {start, end} = range;
    // if (lessPosition(end, start)) [start, end] = [end, start];
    // let {row: startRow, column: startColumn} = start,
    //     {row: endRow, column: endColumn} = end;
    // let line = this.getLine(startRow),
    //     textAndAttributes = line.textAndAttributes;
    // for (let i = 0; i < textAndAttributes.length; i = i+3) {
    //   let from = textAndAttributes[0],
    //       to = textAndAttributes[1],
    //       attr = textAndAttributes[2];
    //   if (to <= startColumn) continue;
    //   if (from === startColumn)
    // }
    // line.textAndAttributes
    // [1,3, {foo: 23}, 3, 5, {foo: 23}]
  }
  mixoutTextAttribute(attr, range) {
    
  }

  removeTextAttributes(attr, range) {}
  resetTextAttributes() {}

  stylesChunked(range) {}

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
    return this.insert(string, range.start);
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

  insert(string, pos) {
    if (!string) return {start: pos, end: pos};

    let {row, column} = pos;
    if (row < 0) row = 0;
    if (column < 0) column = 0;

    let line = this.getLine(row);

    if (!line) { // text empty
      let lines = this.insertLines(string.split(newline));
      return {
        start: {row: 0, column: 0},
        end: {row: lines.length, column: arr.last(lines).text.length}
      };
    }

    // if insertion position comes after last row fill in new lines
    if (row >= this.size) {
      let docEndPos = this.endPosition;
      string = "\n".repeat(row - docEndPos.row) + string;
      ({row, column} = docEndPos);
    }

    let lineText = line.text,
        insertionLines = string.split(newline),
        firstLine = insertionLines.shift(),
        nNewLines = insertionLines.length,
        endPos = {row, column};

    if (column > lineText.length) {
      firstLine = " ".repeat(column - line.text.length) + firstLine;
    }

    let firstLineText = lineText.slice(0, column) + firstLine;
    if (nNewLines === 0) {
      endPos.column = firstLineText.length;
      firstLineText = firstLineText + lineText.slice(column);
    }
    line.changeText(firstLineText);

    if (nNewLines > 0) {
      endPos.row += nNewLines;
      endPos.column = insertionLines[nNewLines-1].length;
      insertionLines[nNewLines-1] = insertionLines[nNewLines-1] + lineText.slice(column);
      this.insertLines(insertionLines, row+1);
    }

    // // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // // text attribute updating...
    // // Note that the _textAttributesByLine index can include identical
    // // TextAttribute objects on multiple lines so track which one where updated
    // // already
    // for (let i = this._textAttributes.length-1; i >= 0; i--) {
    //   let attr = this._textAttributes[i];
    //   // since the attributes are sorted we know that no other attr that needs
    //   // update is in _textAttributes but not in _textAttributesByLine
    //   if (attr.start.row <= row) break;
    //   attr.onInsert(insertionRange);
    // }
    // var attrsSeen = [];
    // (this._textAttributesByLine[row] || (this._textAttributesByLine[row] = [])).forEach(attr => {
    //   if (attrsSeen.includes(attr)) return;
    //   attrsSeen.push(attr);
    //   if (!attr.onInsert(insertionRange)) return;
    //   for (let j = 0; j < insertionLines.length; j++) {
    //     let newRow = row+1+j,
    //         attrsInNewRow = this._textAttributesByLine[newRow];
    //     // need to maintain the sort order! ....
    //     if (attr.end.row >= newRow) attrsInNewRow.push(attr);
    //   }
    // });
    // // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    return {start: {row, column}, end: endPos};
  }

  remove(range) {
    if (this.size === 0) return;

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
        textFront = firstLine.text.slice(0, fromCol),
        textBack = lastLine.text.slice(toCol);
    firstLine.changeText(textFront + textBack);
    if (lines.length > 1) this.removeLines(fromRow+1, toRow);

    // // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // // here we update and remove the text attributes that are affected by the
    // // removal.
    // var rangesToRemove = [],
    //     currentRangeStart = undefined, currentRangeEnd = undefined,
    //     textAttributes = this._textAttributes;
    //
    // // first lets find the indexes of the attributes that need to be removed.
    // // Removing every one of them individually via splice or even filtering
    // // them is slow for large attribute arrays. Instead of doing this we build
    // // a list of start end indexes in the _textAttributes array that mark the
    // // ranges to be removed. Those can be non-consecutive b/c text attributes
    // // are sorted by Range.compare.
    // // Given attributes a = range(0,0,0,1), b = range(0,1,0,4), c = range(0,2,0,3).
    // // Sorted _textAttributes = [a,b,c]
    // // If we remove range(0,0,0,3) attributes a and c would be both empty (range(0,0,0,0))
    // // and would need to be removed. Attribute b however would be range(0,0,0,1) and stay.
    // // The range intervals we will determine for this case are [[0,1], [1,2]]
    // for (var i = 0; i < textAttributes.length; i++) {
    //   var ea = textAttributes[i];
    //   if (ea.onDelete(range) && ea.isEmpty()) {
    //     if (currentRangeStart === undefined)
    //       currentRangeStart = i;
    //     currentRangeEnd = i + 1;
    //   } else {
    //     if (currentRangeStart !== undefined) {
    //       rangesToRemove.push([currentRangeStart, currentRangeEnd]);
    //       currentRangeStart = currentRangeEnd = undefined;
    //     }
    //   }
    // }
    //
    // if (currentRangeStart !== undefined)
    //   rangesToRemove.push([currentRangeStart, currentRangeEnd]);
    //
    // // build new textAttributes array
    // rangesToRemove.reverse().forEach(([i,j]) =>
    //   textAttributes = textAttributes.slice(0,i).concat(textAttributes.slice(j)));
    // // set it, new _textAttributesByLine index will be build there
    // this.setSortedTextAttributes(textAttributes);
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

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

  toString() { return `Document(${this.size} lines)`; }


  consistencyCheck() {
    if (this.size !== this.lines.length)
      throw new Error(`[consistency check] ${this} size: ${this.size} !== ${this.lines.length}`);
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
