import { num, string, arr, fun } from "lively.lang";

class CanvasElement {
  get left()             { return this.x; }
  set left(val)          { this.x = val; }
  get top()              { return this.y; }
  set top(val)           { return this.y = val; }
  get centerX()          { return this.x + Math.floor(this.width/2); }
  set centerX(x)         { this.x = x - Math.floor(this.width/2); }
  get centerY()          { return this.y + Math.floor(this.height/2); }
  set centerY(y)         { this.y = y - Math.floor(this.height/2); }
  get center()           { return [this.centerX, this.centerY]; }
  set center([x, y])     { this.centerX = x; this.centerY = y; }
  get right()            { return this.x + this.width; }
  set right(val)         { this.x  = val - this.width; }
  get bottom()           { return this.y + this.height; }
  set bottom(val)        { this.y  = val - this.height; }
  get topLeft()          { return [this.left, this.top]; }
  set topLeft([x,y])     { this.left = x; this.top = y; }
  get topRight()         { return [this.right, this.top]; }
  set topRight([x,y])    { this.right = x; this.top = y; }
  get bottomRight()      { return [this.right, this.bottom]; }
  set bottomRight([x,y]) { this.right = x; this.bottom = y; }
  get bottomLeft()       { return [this.left, this.bottom]; }
  set bottomLeft([x,y])  { this.left = x; this.bottom = y; }
  get extent()           { return [this.width, this.height]; }
  set extent([w,h])      { this.width = w; this.height = h; }

  print() {
    var cvs = new Canvas(), 
        {x,y} = this;
    try {
      this.x = this.y = 0;
      cvs.objects = [this];
      cvs.draw()
      var printed = cvs.print();
    } finally { this.x = x; this.y = y; }
    return printed;
  }
}

class Text extends CanvasElement {

  constructor(x, y, text) {
    this.x = x; this.y = y; this.text = text;
  }

  get width() {
    return Math.max(...arr.pluck(this.text.split("\n"), "length"));
  }

  get height() {
    return this.text.split("\n").length;
  }

  draw(canvas) {
    var {x, y, text} = this;
    text.split("\n").forEach((line, j) =>
      line.split("").forEach((ch, i) => canvas.put(x+i, y+j, ch)));
  }

}

class Rectangle extends CanvasElement {

  constructor(x, y, width, height, borderChar, fillChar) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.borderChar = borderChar;
    this.fillChar = fillChar;
  }

  draw(canvas) {
    var {x, y, width, height, borderChar, fillChar} = this;
    for (var j = y; j <= y + height; j++) {
      for (var i = x; i <= x + width; i++) {
        var onBorder = i === x || i === x + width || j === y || j === y + height;
        var ch = onBorder ? borderChar : fillChar;
        if (ch) canvas.put(i, j, ch);
      }
    }
  }
  
}

class Line extends CanvasElement {

  constructor(x, y, toX, toY, char) {
    this.x = x;
    this.y = y;
    this.toX = toX;
    this.toY = toY;
    this.char = char;
  }

  get width() { return Math.abs(this.toX - this.x); }
  get height() { return Math.abs(this.toY - this.y); }
  
  draw(canvas) {
    var {x: fromX, y: fromY, toX, toY, char} = this;

    var deltaX = toX - fromX,
        deltaY = toY - fromY,
        r = Math.sqrt(deltaX**2 + deltaY**2),
        normX = num.roundTo(deltaX / r, .01),
        normY = num.roundTo(deltaY / r, .01),
        x = fromX, y = fromY;

    var counter = 0;
    var prevDist = Infinity;
    while (true) {
      if (counter++ > 10000) throw "stop";

      var dx = x - toX, dy = y - toY;
      var dist = Math.sqrt(dx * dx + dy * dy);
      // if (dist <= 1) break;
      if (dist > prevDist) break;
      prevDist = dist;
      // console.log(dist)

      // if (num.between(x, toX - 1, toX + 1) || num.between(y, toY - 1, toY + 1))
      //   break;
      canvas.put(Math.round(x), Math.round(y), char);
      x += normX; y += normY;
    }
  }

}

class Connector extends CanvasElement {

  constructor(objA, objB, char) {
    this.objA = objA;
    this.objB = objB;
    this.char = char;
  }

  get x() { return this.objA.center[0]; }
  get y() { return this.objA.center[1]; }
  get toX() { return this.objB.center[0]; }
  get toY() { return this.objB.center[1]; }
  get width() { return Math.abs(this.toX - this.x); }
  get height() { return Math.abs(this.toY - this.y); }

  draw(canvas) { Line.prototype.draw.call(this, canvas); }
}

class CanvasTreeNode extends CanvasElement {

  constructor(canvasEl, padding = [1,1,1,1], children = []) {
    [this.paddingLeft, this.paddingTop, this.paddingRight, this.paddingBottom] = padding;
    this.canvasElement = canvasEl;
    this.x = 0;
    this.y = 0;
    this.depth = 0;
    this.children = children;
    this.parent = null;
  }

  get width() {
    return this.canvasElement.width + this.paddingLeft + this.paddingRight;
  }

  get height() {
    return this.canvasElement.height + this.paddingTop + this.paddingBottom;
  }

  draw(canvas) {
    this.children.forEach(ea => new Connector(this, ea, "•").draw(canvas));
    
    var text = "";
    if (this.paddingTop) text += "\n".repeat(this.paddingTop)

    var lines = this.canvasElement.print().split("\n");
    lines.forEach(line => {
      if (this.paddingLeft) text += " ".repeat(this.paddingLeft)
      text += line;
      if (this.paddingRight) text += " ".repeat(this.paddingRight)
      text += "\n"
    });

    if (this.paddingBottom) text += "\n".repeat(this.paddingBottom)
    return new Text(this.x, this.y, text).draw(canvas);
  }

}


class CanvasTree extends CanvasElement {

  constructor(x, y, tree, nodePrinter, childGetter, options = {}) {
    // nodePrinter: (TreeNode) => String|CanvasElement
    // childGetter: (TreeNode) => [TreeNode]|null
    this.x = x;
    this.y = y;
    this.nodePrinter = nodePrinter;
    this.childGetter = childGetter;
    this.tree = tree;
    this.padding = options.padding || [2, 2, 2, 2]; // left, top, right, bottom
  }

  visit(node, iterator, parent = null, depth = 0) {
    iterator(node, parent, depth);
    (node.children || []).forEach(child => this.visit(child, iterator, node, depth+1));
  }

  printNodes() {
    var canvasTree = lively.lang.tree.mapTree(this.tree,
      (node, mappedChildren) => {
        var canvasEl = this.nodePrinter(node);

        if (typeof canvasEl === "string") canvasEl = new Text(0, 0, canvasEl);
        if (!(canvasEl instanceof CanvasElement))
          throw new Error(`Cannot convert node ${node} to cavnas element`);;

        var canvasNode = new CanvasTreeNode(canvasEl, this.padding, mappedChildren)
        mappedChildren.forEach(ea => ea.parent = canvasNode);
        return canvasNode;
      },
      this.childGetter);

    var canvasNodes = [];
    this.visit(canvasTree, (ea, _, depth) => { ea.depth = depth; canvasNodes.push(ea) });

    // canvasNodes.map(ea => ea.canvasElement.print())
    // canvasNodes.map(ea => ea.width)
    // canvasNodes[0].canvasElement.width
    // canvasNodes[0].width

    var height = 0;
    arr.groupBy(canvasNodes, ({depth}) => depth).toArray().forEach(treeLevel => {
    
      var width = 0,
          maxHeight = 1;
    
      treeLevel.forEach((treeObj) => {
        var name = treeObj.name;
        var parentX = treeObj.parent ? treeObj.parent.x : 0;
        treeObj.x = Math.max(width, parentX);
        treeObj.y = height;
        width = treeObj.x + treeObj.width;
        maxHeight = Math.max(maxHeight, treeObj.height);
        return treeObj;
      });
    
      height += maxHeight;
    })

    
    // while (true) {
    for (var i = 0; i < 100; i++) {
      var changed = false;

      arr.groupBy(canvasNodes, ({depth}) => depth).toArray().forEach(treeLevel => {

        treeLevel.forEach((canvasNode,i) => {
          var children = canvasNode.children;

          if (!children || !children.length) return;
          var left = children[0].left,
              right = arr.last(children).right,
              centerX = Math.floor(left + (right - left) / 2);

          // var right = arr.last(children).right;
          // console.log(children[0].left)
          if (canvasNode.centerX >= centerX) return;
          var delta = centerX - canvasNode.centerX;
          // if (canvasNode.right >= right) return;
          // var delta = right - canvasNode.right;
          canvasNode.centerX += delta;;
          // canvasNode.right += delta;;
          treeLevel.slice(i+1).forEach(ea => ea.left += delta);
          changed = true;
        });
      })
      if (!changed) break;
    }
    
    
    var cvs = new Canvas()
    cvs.objects = canvasNodes;
    cvs.draw()
    return cvs.print();
  }

  draw(canvas) {
    return new Text(this.x, this.y, this.printNodes()).draw(canvas);
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

export default class Canvas {

  constructor(args) {
    this.objects = [];
    this.clear();
  }

  clear() { this.rows = []; }

  draw() { this.objects.forEach(ea => ea.draw(this)); }

  put(x, y, ch) {
    var row = this.rows[y] || (this.rows[y] = []);
    row[x] = ch;
  }

  print() {
    var maxCol = this.rows.reduce((maxCol, row) => Math.max((row || []).length, maxCol), 0),
        printed = "";
    for (var j = 0; j < this.rows.length; j++) {
      var row = this.rows[j] || (this.rows[j] = []);
      for (var i = 0; i < row.length; i++) row[i] || (row[i] = " ");
      var line = row.join("");
      printed += string.pad(line, maxCol - line.length, false) + "\n";
    }
    return printed;
  }
}

export function printTree(tree, nodePrinter, childGetter, options) {
  return new CanvasTree(0, 0, tree, nodePrinter, childGetter, options).print();
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


// printTree($$world, morph => String(morph), morph => morph.submorphs), {padding: [2,4,2,4]}

var cvs = new Canvas()
cvs.objects = [
  new Rectangle(2, 3, 10,20, "-"),
  ...arr.range(4, 22).map(n => new Text(3, n, " " + n + " fooo"))
  
]
cvs.objects[0].width = 23
cvs.draw()
console.log(cvs.print())


var tree = {name: "foo", children: [
  {name: "zork", children: [{name: "oink"}]},
  {name: new Rectangle(0,0, 10, 4, "x"), children: [
    {name: "zork", children: [{name: "oink"}]},
    {name: "baz", children: [
      {name: " ----\n|zork|\n ----", children: [{name: "oink"}]},
      {name: "baz", children: [
        {name: "zork", children: [{name: "oink"}]},
        {name: "baz", children: [
          {name: "zork", children: [{name: "oink"}]},
          {name: "baz"}
        ]}
      ]}
    ]}
  ]}
]}


console.log(printTree(tree, node => node.name, ({children}) => children || []))

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

var a = new Rectangle(2, 3, 10, 2, "-")
var b = new Rectangle(4, 9, 3, 2, "-")
var c = new Rectangle(30, 4, 3, 2, "-")
var cvs = new Canvas()
cvs.objects = [new Connector(a, b, "+"), new Connector(a, c, "."), new Connector(b, c, "•"), a, b, c];
cvs.draw()
console.log(cvs.print())

