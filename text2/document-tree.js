import { arr, num, string } from "lively.lang";
import { printTree } from "lively.lang/text-graphics.js";


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
      size,
      options: {maxLeafSize, maxNodeSize, minLeafSize, minNodeSize}
    } = this;

    if (size === 0)
      throw new Error(`size of ${this} expected to be > 0!`);

    var sumChildSizes = arr.sum(arr.pluck(children, "size"));
    if (sumChildSizes != size)
      throw new Error(`Sum of child sizes is not size of ${this}: ${sumChildSizes} != ${size}`);

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

  constructor(parent = null, children = [], size = 0, options) {
    super(parent);
    this.options = options;
    this.children = children;
    this.size = size;
    this.height = 0;
    this.isLeaf = true;
  }

  get isNode() { return true; }

  resize(n) {
    this.size = this.size + n;
    this.parent && this.parent.resize(n);
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

  insert(lines, atIndex = this.size) {
    if (this.isLeaf) {
      lines = lines.map(text => new Line(this, text));
      this.children.splice(atIndex, 0, ...lines);
      this.resize(lines.length);
      this.balanceAfterGrowth();
      return lines;
    }

    if (this.children.length === 0)
      this.children.push(new InnerTreeNode(this, [], 0, this.options));

    var i = 0;
    for (; i < this.children.length; i++) {
      var child = this.children[i], childSize = child.size;
      if (atIndex <= childSize) return child.insert(lines, atIndex);
      atIndex = atIndex - childSize;
    }

    var last = this.children[i-1];
    return last.insert(lines, last.size);
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

  findLeafs(fromIndex, toIndex, baseIndex = 0) {
    // when searching for the parents of multiple lines indicated by fromIndex
    // (start line, inclusive) and toIndex (end line, inclusive), this methods
    // finds the leaf nodes for those lines.
    // The return value is an array of spec objects,
    // [{node, full: BOOLEAN, firstLine: NUMBER, lastLine: NUMBER}]
    // full indicates if all children are affected,
    // firstLine, lastLine are the indices in node.children that should be
    // selected (inclusive)
    if (fromIndex > baseIndex + this.size || toIndex < baseIndex) return [];

    if (this.isLeaf) {
      var firstLine = Math.max(0, fromIndex - baseIndex),
          max = this.children.length-1,
          lastLine = Math.min(max, toIndex - baseIndex),
          full = false;
      if (firstLine === 0 && lastLine === max) { full = true; lastLine = max; }
      return [{node: this, firstLine, lastLine, full}];
    }

    var result = [];
    for (var i = 0; i < this.children.length; i++) {
      var c = this.children[i];
      result.push(...c.findLeafs(fromIndex, toIndex, baseIndex));
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
          n = node.children.length;
      node.children.forEach(ea => ea.parent = null);
      node.children.length = 0;
      node.resize(-n);
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
          removedLines = children.splice(firstLine, n);
      removedLines.forEach(ea => ea.parent = null);
      node.resize(-n);
    }

    // ...same for last
    if (last && !last.full) {
      let {lastLine, firstLine, node} = last,
          {children} = node,
          n = (lastLine - firstLine)+1,
          removedLines = children.splice(firstLine, n);
      removedLines.forEach(ea => ea.parent = null);
      node.resize(-n);
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
      var mySize = this.size;
      this.withParentChainsUpToCommonParentDo(mergeTarget,
        (mergeNodeOrParent) => mergeNodeOrParent.size += mySize,
        (thisOrParent => thisOrParent.size -= mySize));

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
            stealN = stealLeft ? stealLeftN : stealRightN;
        this.withParentChainsUpToCommonParentDo(stealTarget,
          (mergeNodeOrParent) => mergeNodeOrParent.size -= stealN,
          (thisOrParent => thisOrParent.size += stealN));
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
    var {isLeaf, size, parent, children, options} = this,
        maxChildren = isLeaf ? options.maxLeafSize : options.maxNodeSize,
        split = children.length > maxChildren;

    if (!split) return;

    if (!parent) {
      parent = this.parent = new InnerTreeNode(null, [this], size, options);
      parent.isLeaf = false;
    }

    var splitIndex = Math.floor(children.length / 2),
        i = 0, mySize = 0, otherSize = 0;
    for (; i < splitIndex; i++) mySize = mySize+ children[i].size;
    for (; i < children.length; i++) otherSize = otherSize + children[i].size;

    this.children = children.slice(0, splitIndex);
    this.size = mySize;

    var indexInParent = parent.children.indexOf(this),
        otherChildren = children.slice(splitIndex),
        otherNode = new InnerTreeNode(parent, otherChildren, otherSize, options);
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
    var {isLeaf, size, children} = this,
        name = optName ? optName : isLeaf ? "leaf" : "node",
        indent = " ".repeat(depth),
        printed = `${indent}${name} (size: ${size})`;

    if (children.length) {
      var childrenPrinted = "",
          childIndex = index + size;
      for (var i = children.length; i--;) {
        var child = children[i];
        childIndex -= child.size;
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

  constructor(parent, height = 0, text = "", propsWithOffsets = null) {
    super(parent);
    this.changeText(text, propsWithOffsets);
    this.height = height;
  }

  get isLine() { return true; }

  get size() { return 1; }

  get text() { return this._text; }

  get propsWithOffsets() { return this._propsWithOffsets; }

  get props() {
    let {_props, _propsWithOffsets} = this;
    if (_props) return _props;
    if (!_propsWithOffsets) return null;
    let _propOffsets = this._propOffsets = [];
    _props = this._props = [];
    for (let i = 0; i < _propsWithOffsets.length; i+=3) {
      let start = _propsWithOffsets[i],
          end = _propsWithOffsets[i+1],
          prop = _propsWithOffsets[i+2];
      _propOffsets.push(start, end);
      _props.push(prop);
    }
    return _props;
  }

  get textAndProps() {
    // returns a list with 4-tuples that matches text slices to props
    // [startIndex, endIndex, text, props, ....]
    let {_textAndProps, _propsWithOffsets, _text} = this;
    if (_textAndProps) // cached
      return _textAndProps;

    if (!_propsWithOffsets) // no props
      return this._textAndProps = [0, _text.length, _text, null];

    let textAndProps = this._textAndProps = [],
        index = 0, indexIntoProps = 0;
    while (true) {
      if (indexIntoProps >= _propsWithOffsets.length) break;
      let start = _propsWithOffsets[indexIntoProps],
          end =  _propsWithOffsets[indexIntoProps+1],
          prop =  _propsWithOffsets[indexIntoProps+2];
      if (index < start)
        textAndProps.push(index, start, _text.slice(index, start), null);
      textAndProps.push(start, end, _text.slice(start, end), prop);
      indexIntoProps += 3;
      index = end;
    }
    if (index < _text.length)
      textAndProps.push(index, _text.length, _text.slice(index, _text.length), null);
    return textAndProps;
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

  prevLine() {
    var {parent, root, row} = this;
    if (!parent) return null;
    if (row <= 0) return null;
    return root.findRow(row-1);
  }

  nextLine() {
    var {parent, root, row} = this;
    if (!parent) return null;
    return root.findRow(row+1);
  }

  changeHeight(newHeight) {
    let {height, parent} = this,
        delta = newHeight - height;
    this.height = newHeight;
    while (parent) {
      parent.height += delta;
      parent = parent.parent;
    }
    return this;
  }

  changeText(text, propsWithOffsets = null) {
    this._text = text;
    this._propsWithOffsets = propsWithOffsets;
    this._props = null;
    this._propOffsets = null;
    this._textAndProps = null;
    return this;
  }

  print(index = 0, depth = 0) {
    var indent = " ".repeat(depth);
    return `${indent}line ${index} (height: ${this.height}, text: ${JSON.stringify(this._text)})`
  }

  toString() {
    return `line (${string.truncate(this._text, 30)}, ${this.height})`;
  }

}


export default class TextTree {

  constructor(lines, options) {
    this.options = {...defaultOptions, ...options};
    this.lines = lines;
  }

  get lines() { return this.root.lines(); }
  set lines(lines = []) {
    this.root = new InnerTreeNode(null, [], 0, 0, this.options);
    this.insertLines(lines);
  }

  insertLine(text, atIndex = this.root.size) {
    return this.insertLines([text], atIndex)[0];
  }

  removeLine(row) {
    this.root.removeFromToInRoot(row, row);
    // this.root.remove(row);
  }

  removeLines(fromRow, toRow) {
    this.root.removeFromToInRoot(fromRow, toRow);
  }

  insertLines(lineSpecs, atIndex) {
    let lines = this.root.insert(lineSpecs, atIndex);
    this.fixRoot();
    return lines;
  }

  balance() {
    this.root.balanceAfterGrowth();
    this.fixRoot();
  }

  fixRoot() {
    var newRoot = this.root.root;
    if (this.root !== newRoot) this.root = newRoot;
  }

  consistencyCheck() { this.root.consistencyCheck(); }

  print() { return this.root.print(0, 0, "root"); }

  print2() {
    return printTree(this.root,
      (node) => node.toString(),
      (node) => node.children,
      {padding: [2,1,2,1]});
  }

}
