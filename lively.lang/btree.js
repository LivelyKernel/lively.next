import { arr, tree } from 'lively.lang';
import { printTree } from "./text-graphics.js";


class BTreeElement {

  constructor(value) {
    this.value = value;
  }

  get isValue() { return true; }

  toString() { return `BTreeValue(${this.value})`; }
}

class BTreeNode {

  constructor(maxSize = 2, parent = null, nodes = [], elements = [], isLeaf = true) {
    this.maxSize = maxSize;
    this.parent = parent;
    this.isLeaf = isLeaf;
    this.nodes = nodes;
    this.elements = elements;
    nodes.forEach(ea => ea.parent = this);
  }

  get root() {
    var node = this;
    while (true) {
      if (!node.parent) return node;
      node = node.parent;
    }
  }

  insert(element) {
    // console.log(`[btree] inserting ${element} into ${this}`);
    var sorted = arr.sortBy(this.elements.concat(element), ea => ea.value);

    this.elements = sorted;
    this.rebalance();

    return this.root;
  }

  rebalance() {
    if (this.elements.length <= this.maxSize) return;

    // console.log(String(this.root));

    var elements = this.elements,
        nodes = this.nodes,
        medianIndex = Math.floor(elements.length/2),
        median = elements[medianIndex],
        parent = this.parent;

    // this node becomes the splitted left node
    this.elements = elements.slice(0, medianIndex);
    this.nodes = nodes.slice(0, medianIndex+1);

    var right = new BTreeNode(this.maxSize, parent, nodes.slice(medianIndex+1), elements.slice(medianIndex+1), this.isLeaf);

    // console.log(`[btree] splitting: left ${this} right ${right}`);

    if (!parent) {
      this.parent = new BTreeNode(this.maxSize, null, [this, right], [median], false);
    } else {
      var nodeIndex = parent.nodes.indexOf(this);
      parent.elements.splice(nodeIndex, 0, median);
      parent.nodes.splice(nodeIndex+1, 0, right);
      parent.rebalance();
    }

    // console.log(String(this.root))

    return this.root;
  }

  findNodeForInsertionOf(value) {
    if (this.isLeaf) return this;
    for (var i = 0; i < this.elements.length; i++) {
      var el = this.elements[i];
      if (el.value > value) break;
    }

    var node = this.nodes[i]
    // if (!childNodeForValue) childNodeForValue = arr.last(this.elements);

    return node.findNodeForInsertionOf(value);
  }

  toString() {
    return printTree(this,
      (node) => node.elements.map(ea => ea.value).join(", "),
      (node) => node.nodes,
      {padding: [2,1,2,1]});
  }

}

export class BTree {

  constructor(maxSize = 2) {
    this.maxSize = maxSize;
    this.root = new BTreeNode(maxSize);
  }

  insert(value) {
    var node = this.root.findNodeForInsertionOf(value);
    return this.root = node.insert(new BTreeElement(value));
  }

  toString() { return `BTree(${this.root})`; }
}




// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-



class BPlusTreeNode {

  constructor(maxSize = 2, parent = null, keys = []) {
    this.maxSize = maxSize;
    this.parent = parent;
    this.keys = keys;
  }

  findNodeForInsertionOf(key) {}

  get root() {
    var node = this;
    while (true) {
      if (!node.parent) return node;
      node = node.parent;
    }
  }

  propagateKey() {
    if (!this.keys.length) return;
    var parent = this.parent,
        node = this;
    while (parent) {
      var nodeIndex = parent.nodes.indexOf(node)
      parent.keys[nodeIndex] = node.keys[0];
      node = parent;
      parent = parent.parent;
    }
  }

}

class BPlusTreeInnerNode extends BPlusTreeNode {

  constructor(maxSize = 2, parent = null, keys = [], nodes = []) {
    super(maxSize, parent, keys)
    nodes.forEach(ea => ea.parent = this);
    this.nodes = nodes;
  }

  get isLeaf() { return false; }

  findNodeForInsertionOf(key) {
    var {keys, nodes} = this;

    var i;
    if (key < keys[1]) i = 0;
    else if (key >= keys[keys.length-1]) i = keys.length-1;
    else
      for (i = 1; i < keys.length; i++)
        if (key >= keys[i] && key < keys[i+1]) break;

    return nodes[i].findNodeForInsertionOf(key);
  }

  insert(key, node) {
    var {keys, nodes} = this;

    var i = 0;
    if (key >= keys[i])
      for (; i < keys.length; i++)
        if (key >= keys[i] && key < keys[i+1]) { i++; break; };

    keys.splice(i, 0, key);
    nodes.splice(i, 0, node);

    if (i === 0) this.propagateKey();

    this.balance();
  }

  balance() {
    var {keys, nodes} = this;

    if (keys.length <= this.maxSize) return;

    var splitIndex = Math.ceil(keys.length/2);

    var newNode = new BPlusTreeInnerNode(
      this.maxSize, this.parent,
      keys.splice(splitIndex, keys.length-splitIndex),
      nodes.splice(splitIndex, nodes.length-splitIndex));

    if (this.parent) this.parent.insert(newNode.keys[0], newNode);
    else new BPlusTreeInnerNode(this.maxSize, null, [this.keys[0], newNode.keys[0]], [this, newNode]);
  }

  removeNode(node) {
    var {nodes, keys, parent} = this,
        index = nodes.indexOf(node);
    if (index < 0) return this.root;
    nodes.splice(index, 1);
    keys.splice(index, 1);
    
    if (this.parent && !keys.length) return parent.removeNode(this);

    if (index === 0 && keys.length) this.propagateKey();

    if (keys.length > Math.floor(this.maxSize/2)) return this.root;

    if (!parent) {
      if (nodes.length === 1) { nodes[0].parent = null; return nodes[0]; }
      else return this;
    }

    var indexInParent = parent.nodes.indexOf(this),
        leftSibling = parent.nodes[indexInParent-1],
        rightSibling = parent.nodes[indexInParent+1];

    if (keys.length === 0) return parent.removeNode(this);

    // merge with left or right sibling?
    if (leftSibling && leftSibling.keys.length <= Math.floor(leftSibling.maxSize/2)) {
      leftSibling.keys.push(...keys);
      leftSibling.nodes.push(...nodes);
      nodes.forEach(n => n.parent = leftSibling);
      parent.removeNode(this);
      return leftSibling.root;
    }

    if (rightSibling && rightSibling.keys.length <= Math.floor(rightSibling.maxSize/2)) {
      keys.push(...rightSibling.keys);
      nodes.push(...rightSibling.nodes);
      rightSibling.nodes.forEach(n => n.parent = this);
      parent.removeNode(rightSibling);
      return this.root;
    }

    // at least try to balance by stealing a value...
    if (leftSibling) {
      var newKey = leftSibling.keys.pop(),
          newNode = leftSibling.nodes.pop();
      keys.unshift(newKey);
      nodes.unshift(newNode);
      newNode.parent = this;
      this.propagateKey();
      return this.root;
    }

    if (rightSibling) {
      var newKey = rightSibling.keys.shift(),
          newNode = rightSibling.nodes.shift();
      keys.push(newKey);
      nodes.push(newNode);
      newNode.parent = this;
      rightSibling.propagateKey();
      return this.root;
    }


    var newParent = parent.parent;
    if (newParent) {
      parent.parent = null;
      newParent.keys = [keys[0]];
      newParent.nodes = [this];
      this.parent = newParent;
      return newParent.root;
    }

  }

  toString() {
    return printTree(this,
      (node) => node.keys.join(", "),
      (node) => node.nodes,
      {padding: [2,1,2,1]})
  }

}

class BPlusTreeLeafNode extends BPlusTreeNode {

  constructor(maxSize = 2, parent = null, keys = [], values = []) {
    super(maxSize, parent, keys);
    this.values = values;
  }

  get isLeaf() { return true; }

  findNodeForInsertionOf(key) { return this }

  insert(key, value) {
    var {keys, values} = this

    var i = 0;
    if (key >= keys[i])
      for (; i < keys.length; i++)
        if (key >= keys[i] && key < keys[i+1]) { i++; break; };

    keys.splice(i, 0, key);
    values.splice(i, 0, value);


    if (i === 0) this.propagateKey();

    if (keys.length <= this.maxSize) return;

    var splitIndex = Math.ceil(keys.length/2);

    var newNode = new BPlusTreeLeafNode(
      this.maxSize, this.parent,
      keys.splice(splitIndex, keys.length-splitIndex),
      values.splice(splitIndex, values.length-splitIndex));

    if (this.parent) this.parent.insert(newNode.keys[0], newNode);
    else new BPlusTreeInnerNode(this.maxSize, null, [this.keys[0], newNode.keys[0]], [this, newNode])
  }

  delete(key) {
    var {keys, values, parent} = this;
    var index = keys.indexOf(key);
    if (index === -1) return this.root;
    keys.splice(index, 1)
    values.splice(index, 1);

    if (parent && !keys.length) return parent.removeNode(this);

    if (index === 0 && keys.length) this.propagateKey();

    if (keys.length > Math.floor(this.maxSize/2) || !parent) return this.root;

    var indexInParent = parent.nodes.indexOf(this),
        leftSibling = parent.nodes[indexInParent-1],
        rightSibling = parent.nodes[indexInParent+1];

    // merge with left or right sibling?
    if (leftSibling && leftSibling.keys.length <= Math.floor(leftSibling.maxSize/2)) {
      leftSibling.keys.push(...keys);
      leftSibling.values.push(...values);
      return parent.removeNode(this);
    }

    if (rightSibling && rightSibling.keys.length <= Math.floor(rightSibling.maxSize/2)) {
      keys.push(...rightSibling.keys);
      values.push(...rightSibling.values);
      return parent.removeNode(rightSibling);
    }

    // at least try to balance by stealing a value...
    if (leftSibling) {
      var newKey = leftSibling.keys.pop(),
          newValue = leftSibling.values.pop();
      keys.unshift(newKey);
      values.unshift(newValue);
      this.propagateKey();
      return this.root;
    }

    if (rightSibling) {
      var newKey = rightSibling.keys.shift(),
          newValue = rightSibling.values.shift();
      keys.push(newKey);
      values.push(newValue);
      rightSibling.propagateKey();
      return this.root;
    }

    var newParent = parent.parent;
    if (newParent) {
      parent.parent = null;
      newParent.keys = [keys[0]];
      newParent.nodes = [this];
      this.parent = newParent;
      return newParent.root;
    }
  }

  toString() { return this.keys.join(", "); }

}


export class BPlusTree {

  constructor(maxSize = 2) {
    this.maxSize = maxSize;
    this.root = new BPlusTreeLeafNode(maxSize);
  }

  checkValidity() {
    var invalid = tree.detect(this.root,
      n => !n.isLeaf && n.nodes.some(subn => subn.parent !== n),
      n => n.isLeaf ? [] : n.nodes);
    if (invalid) {
      console.error(`one of Node(${invalid.keys.join(",")}) sub nodes has wrong parent!`)
      window.invalid = invalid;
    }
  }

  insert(key, value) {
    var node = this.root.findNodeForInsertionOf(key);
    node.insert(key, value);
    this.root = node.root;
    
    // this.checkValidity();
  }

  delete(key) {
    var node = this.root.findNodeForInsertionOf(key);
    this.root = node.delete(key);
    // this.checkValidity();
  }

  leafs() {  
    var leafs = [];
    tree.prewalk(this.root,
      node => node.isLeaf && leafs.push(node),
      node => node.isLeaf ? [] : node.nodes);
    return leafs;
  }

  keys() {
    return this.leafs().reduce((keys, leaf) => {
      keys.push(...leaf.keys); return keys; }, []);
  }

  values() {
    return this.leafs().reduce((values, leaf) => {
      values.push(...leaf.values); return values; }, []);
  }

  toString() { return `BPlusTree(${this.root})`; }
}

var bptree = new BPlusTree(3);

arr.range(1,19).forEach(n => bptree.insert(n, n))
console.log(bptree.toString())

// bptree.delete(arr.last(bptree.keys())); console.log(bptree.toString())
// bptree.delete(bptree.keys()[0]); console.log(bptree.toString())


// bptree.delete(arr.shuffle(bptree.keys())[0]); console.log(bptree.toString())

// bptree.delete(bptree.keys()[Math.ceil(bptree.keys().length/2)]); console.log(bptree.toString())
// debugger; bptree.delete(bptree.keys()[Math.ceil(bptree.keys().length/2)]); console.log(bptree.toString())




// bptree.insert(3,3);
// bptree.insert(4,4);
// bptree.insert(5,5);

function test2() {

  var data = arr.shuffle(arr.range(1, 160101));
  console.group("insertion btree")

  data.length/4

  arr.range(21, 1, 5).forEach(ratio => {
    var n = data.length/ratio;
    var keysAndValues = data.slice(0, n)
    var bptree = new BPlusTree(30);
    console.time(n)
    keysAndValues.forEach(ea => bptree.insert(ea, ea));
    console.timeEnd(n)
  });
  console.groupEnd("insertion btree")

  console.group("insertion array")
  arr.range(21, 1, 5).forEach(ratio => {
    var n = data.length/ratio;
    var keysAndValues = data.slice(0, n)
    var array = [];
    console.time(n)
    keysAndValues.forEach(ea => array[ea] = ea);
    console.timeEnd(n)
  });
  console.groupEnd("insertion array")

  console.group("insertion Map")
  arr.range(21, 1, 5).forEach(ratio => {
    var n = data.length/ratio;
    var keysAndValues = data.slice(0, n)
    var map = new Map;
    console.time(n)
    keysAndValues.forEach(ea => map.set(ea, ea));
    console.timeEnd(n)
  });
  console.groupEnd("insertion Map")


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  
  console.group("deletion btree")
    var keysAndValues = data.slice(0, data.length/4)
    var bptree = new BPlusTree(30);
    keysAndValues.forEach(ea => bptree.insert(ea, ea));
    var n = keysAndValues.length/4;
    console.time()
    arr.range(1, n).forEach(_ => {
      var index = lively.lang.num.random(0, n--)
      bptree.delete(index);
    })
    console.timeEnd()
  console.groupEnd("deletion btree")

  console.group("deletion array")
    var keysAndValues = data.slice(0, data.length/4)
    var array = [];
    keysAndValues.forEach(ea => array[ea] = ea);
    var n = keysAndValues.length/4;
    console.time()
    arr.range(1, n).forEach(_ => {
      var index = lively.lang.num.random(0, n--)
      array.splice(index, 1);
    })
    console.timeEnd()
  console.groupEnd("deletion array")

  console.group("deletion map")
    var keysAndValues = data.slice(0, data.length/4)
    var map = new Map;
    keysAndValues.forEach(ea => map.set(ea, ea));
    var n = keysAndValues.length/4;
    console.time()
    arr.range(1, n).forEach(_ => {
      var index = lively.lang.num.random(0, n--)
      map.delete(index);
    })
    console.timeEnd()
  console.groupEnd("deletion map")


}

// test2()


function profile() {
  var bptree = new BPlusTree(50);
  var keysAndValues = arr.shuffle(arr.range(1, 50000));
  console.profile()
  keysAndValues.forEach(ea => bptree.insert(ea, ea));
  console.profileEnd()
}

// profile();

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function test1() {
  var btree = new BTree(2)
  arr.range(1,9).map(n => btree.insert(n));
  console.log(String(btree))
}

// test1()
