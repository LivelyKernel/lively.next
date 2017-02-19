import { arr } from "lively.lang";

var defaultOptions = {
  maxLeafSize: 3,
  leafSplit: 0.5,
  maxNodeSize: 10,
  nodeSplit: 0.5
}

class Node {

  constructor(parent = null, children = [], size = 0, options) {
    this.options = options;
    this.parent = parent;
    this.children = children;
    this.size = size;
    this.height = 0;
    this.isLeaf = true;
  }

  get root() { return this.parent ? this.parent.root : this; }

  resize(n) {
    this.size += n;
    this.parent && this.parent.resize(n);
  }

  insert(lines, atIndex = this.size, options = {}) {
    if (this.isLeaf) {
      lines = lines.map(text => new Line(this, text));
      this.children.splice(atIndex, 0, ...lines);
      this.resize(lines.length);
      this.balance();
      return lines;
    }

    if (this.children.length === 0)
      this.children.push(new Node(this, [], 0, this.options));

    var i = 0;
    for (; i < this.children.length; i++) {
      var child = this.children[i], childSize = child.size;
      if (atIndex <= childSize) return child.insert(lines, atIndex, options);
      atIndex -= childSize;
    }

    var last = this.children[i-1];
    return last.insert(lines, last.size, options);
  }

  balance() {
    var {isLeaf, parent, children, options: {maxLeafSize, maxNodeSize}} = this,
        maxChildren = isLeaf ? maxLeafSize : maxNodeSize;

    if (children.length <= maxChildren) return;

    if (!parent) {
      parent = this.parent = new Node(null, [this], this.size, this.options);
    }

    var splitIndex = Math.floor(children.length / 2);
    var i = 0, mySize = 0, otherSize = 0;
    for (; i < splitIndex; i++) mySize += children[i].size;
    for (; i < children.length; i++) otherSize += children[i].size;

    this.children = children.slice(0, splitIndex);
    this.size = mySize;

    var indexInParent = parent.children.indexOf(this);
    parent.children.splice(
      indexInParent + 1, 0,
      new Node(parent, children.slice(splitIndex), otherSize, this.options));

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

}

class Line {

  constructor(parent, text = "") {
    this.parent = parent;
    this.text = text;
    this.height = 0;
  }

  get size() { return 1 }

  get root() { return this.parent ? this.parent.root : null; }

  print(index = 0, depth = 0) {
    var indent = " ".repeat(depth);
    return `${indent}line ${index} (height: ${this.height}, text: ${JSON.stringify(this.text)})`
  }

}

export default class TextTree {

  constructor(lines, options) {
    this.options = {...defaultOptions, ...options};
    this.root = new Node(null, [], 0, this.options);
    if (lines)
      this.insertLines(lines);
  }

  appendLine(text) {
    return this.insertLine(text, this.root.size)[0];
  }

  insertLine(text, atIndex) {
    return this.insertLines([text], atIndex)[0];
  }

  insertLines(lines, atIndex) {
    var lines = this.root.insert(lines, atIndex);
    this.fixRoot();
    return lines;
  }

  balance() {
    this.root.balance();
    this.fixRoot();
  }

  fixRoot() {
    var newRoot = this.root.root;
    if (this.root !== newRoot) this.root = newRoot;
  }

  print() {
    return this.root.print(0, 0, "root");
  }

}