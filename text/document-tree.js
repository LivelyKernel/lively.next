import { arr, string } from "lively.lang";
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
      options: {maxLeafSize, maxNodeSize, minLeafSize, minNodeSize}
    } = this;
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
    this.size += n;
    this.parent && this.parent.resize(n);
    // if (n > 0) this.balanceAfterGrowth(n);
  }

  findRow(row) {
    if (row < 0 || row >= this.size) return null;
    if (this.isLeaf) return this.children[row];
    for (var i = 0; i < this.children.length; i++) {
      var child = this.children[i], childSize = child.size;
      if (row < childSize) return child.findRow(row);
      row -= childSize;
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
      atIndex -= childSize;
    }

    var last = this.children[i-1];
    return last.insert(lines, last.size);
  }

  remove(index) {
    if (index > this.size) throw new Error(`Trying to remove index ${index} from ${this}`);

    if (!this.isLeaf) {
      for (var i = 0; i < this.children.length; i++) {
        var child = this.children[i], childSize = child.size;
        if (index < childSize) return child.remove(index);
        index -= childSize;
      }
      throw new Error("Should never get here...");
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // merge left or right

    var {children, options} = this,
        line = children[index],
        maxChildren = options.maxLeafSize,
        minChildren = options.minLeafSize;

    var needsMerge = children.length - 1 < minChildren;
    if (needsMerge) {
      var prevLine = children[0].prevLine();
      var leftSibling = prevLine ? prevLine.parent : null;
      var nextLine = arr.last(children).nextLine();
      var rightSibling = nextLine ? nextLine.parent : null;
    }

    // remove line from my children
    children.splice(index, 1);
    line.parent = null;
    this.resize(-1);

    // if less than desired nodes...
    if (needsMerge) {

      // ...try to merge with left or right sibling
      var mergeLeft = leftSibling && leftSibling.children.length + children.length <= maxChildren,
          mergeRight = !mergeLeft && rightSibling && rightSibling.children.length + children.length <= maxChildren,
          mergeTarget = mergeLeft ? leftSibling : mergeRight ? rightSibling : null;

      if (mergeTarget) {
        // update size of sibling and parents up to common parent
        var mySize = this.size,
            myParents = this.withParents(),
            nodeToResize = mergeTarget,
            commonParent;
        while (nodeToResize) {
          if (myParents.includes(nodeToResize)) {
            commonParent = nodeToResize; break; }
          nodeToResize.size += mySize;
          nodeToResize = nodeToResize.parent;
        }

        // subtract my size from self and all parents up to common parent with sibling
        if (commonParent)
          myParents.slice(0, myParents.indexOf(commonParent)).forEach(n => n.size -= mySize);
        // move children over
        children.forEach(ea => ea.parent = mergeTarget);
        if (mergeLeft) mergeTarget.children.push(...children);
        else mergeTarget.children.unshift(...children);
        children.length = 0;
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

    return line;
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
    for (; i < splitIndex; i++) mySize += children[i].size;
    for (; i < children.length; i++) otherSize += children[i].size;

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


class Line extends TreeNode {

  constructor(parent, text = "") {
    super(parent);
    this.text = text;
    this.height = 0;
  }

  get isLine() { return true; }

  get size() { return 1; }

  get row() {
    var p = this.parent;
    if (!p) return 0;

    var parents = this.withParents().reverse();
    if (parents.length === 1)
      return parents.children.indexOf(this);

    var index = 0;
    for (var i = 0; i < parents.length-1; i++) {
      var parent = parents[i],
          node = parents[i + 1],
          nodeIndex = parent.children.indexOf(node);
      for (var j = 0; j < nodeIndex; j++) {
        index += parent.children[j].size;
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

  print(index = 0, depth = 0) {
    var indent = " ".repeat(depth);
    return `${indent}line ${index} (height: ${this.height}, text: ${JSON.stringify(this.text)})`
  }

  toString() {
    return `line (${string.truncate(this.text, 30)})`;
  }

}


export default class TextTree {

  constructor(lines, options) {
    this.options = {...defaultOptions, ...options};
    this.root = new InnerTreeNode(null, [], 0, this.options);
    if (lines)
      this.insertLines(lines);
  }

  insertLine(text, atIndex = this.root.size) {
    return this.insertLines([text], atIndex)[0];
  }

  removeLine(row) {
    this.root.remove(row);
  }

  insertLines(lines, atIndex) {
    var lines = this.root.insert(lines, atIndex);
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

  print() {
    return this.root.print(0, 0, "root");
  }

  print2() {
    return printTree(this.root,
      (node) => node.toString(),
      (node) => node.children,
      {padding: [2,1,2,1]});
  }

}
