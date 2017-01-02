import { arr } from "lively.lang";
import { pt, Point, Color, Rectangle } from "lively.graphics";
import { Morph, Polygon } from "./index.js";
import { RichTextControl } from "lively.morphic/text/ui.js"
import { Tree, TreeData } from "lively.morphic/tree.js"
import { connect } from "lively.bindings"
import { Leash } from "./widgets.js"


export default class ObjectDrawer extends Morph {

  constructor(props) {
    this.n = 8;
    super({
      name: "object-drawer",
      position: pt(20, 20),
      extent: pt(this.n * (140 + 10) + 15, 140),
      fill: Color.white,
      borderWidth: 1,
      borderColor: Color.gray,
      ...props
    });
    this.setup();
  }

  setup() {
    var n = this.n,
        margin = pt(5,5),
        objExt = pt(((this.width - margin.x) / n) - margin.x, this.height - margin.y*2),
        pos = margin;


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Ellipse

    this.addMorph({
      type: "ellipse",
      position: pos, extent: objExt,
      fill: Color.random(), grabbable: false,
      onDrag: doCopy,
      init() { this.fill = Color.random(); }
    });


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Rectangle

    pos = arr.last(this.submorphs).topRight.addXY(margin.x, 0);

    this.addMorph({
      position: pos, extent: objExt,
      fill: Color.random(), grabbable: false,
      onDrag: doCopy,
      init() { this.fill = Color.random(); }
    });


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Image

    pos = arr.last(this.submorphs).topRight.addXY(margin.x, 0);

    this.addMorph({
      type: "image",
      position: pos, extent: objExt,
      fill: null, grabbable: false,
      onDrag: doCopy
    });


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Star

    pos = arr.last(this.submorphs).topRight.addXY(margin.x, 0);

    function makeStarVertices(nVerts = 10, r = 50, startAngle = 0) {
      var center = pt(r, r);
      return arr.range(0, nVerts).map(n => {
        var a = startAngle + (2*Math.PI/nVerts*n),
            p = Point.polar(r,a);
        if (n % 2 == 0) p = p.scaleBy(0.39);
        return p.addPt(center);
      })
    }

    var r = 65;
    this.addMorph(new Polygon({
      name: "poly", vertices: makeStarVertices(10, r),
      position: pos.addPt(pt(r,r)),
      origin: pt(r,r),
      fill: Color.yellow,
      grabbable: false,
      onDrag: doCopy
    }));


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Text

    pos = arr.last(this.submorphs).topRight.addXY(margin.x, 0);

    this.addMorph({
      type: "text",
      textString: "Lively rocks!",
      center: pos.addPt(objExt.scaleBy(.5)), extent: objExt,
      fill: Color.white, grabbable: false,
      border: {color: Color.gray, width: 1, radius: 3},
      padding: Rectangle.inset(8),
      readOnly: true,
      fontSize: 20,
      fontFamily: "Helvetica Neue, Arial, sans-serif",
      onDrag: doCopy,
      draggable: true,
      init() {
        this.draggable = false;
        this.grabbable = false;
        this.readOnly = false;
        connect(this, "selectionChange", RichTextControl, "openDebouncedFor", {converter: sel => sel.textMorph})
      }
    });


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // List

    pos = pt(arr.last(this.submorphs).right, 0).addPt(margin);

    var list = this.addMorph({
      type: "list", items: arr.range(0,2000).map(n => "item " + n),
      position: pos, extent: objExt, //pt(110, objExt.y),
      borderWidth: 1, borderColor: Color.gray,
      onDrag: doCopy, draggable: true,
      init() {
        this.draggable = false;
        this.grabbable = false;
        this.listItemContainer.withAllSubmorphsDo(ea => ea.reactsToPointer = true);
      }
    });

    (async () => {
      await list.whenRendered();
      list.listItemContainer.withAllSubmorphsDo(ea => ea.reactsToPointer = false)
    })();

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Tree

    pos = pt(arr.last(this.submorphs).right, 0).addPt(margin);

    var root = new (class extends TreeData {
      display(node) { return node.name }
      isCollapsed(node) { return node.isCollapsed }
      collapse(node, bool) { node.isCollapsed = bool; }
      getChildren(node) { return node.isLeaf ? null : node.isCollapsed ? [] : node.children }
      isLeaf(node) { return node.isLeaf }
    })({
      name: "root",
      isCollapsed: false,
      isLeaf: false,
      children: [
        {name: "child 1", isLeaf: true},
        {name: "child 2", isLeaf: false, isCollapsed: true, children: [{name: "child 2 - 1", isLeaf: true}]},
        {name: "child 3", isLeaf: false,
         isCollapsed: false,
         children: [
           {name: "child 3 - 1", isLeaf: true},
           {name: "child 3 - 2", isLeaf: true}
         ]},
        {name: "child 4", isLeaf: true},
      ]
    });

    var tree = this.addMorph(new Tree({
      position: pos, extent: objExt,
      fontFamily: "Arial, sans-serif",
      fontSize: 18,
      fill: Color.white, border: {color: Color.gray, width: 1},
      treeData: root,
      onDrag: doCopy, draggable: true,
      init() {
        this.draggable = false;
        this.grabbable = false;
        this.submorphs = [{name: "nodeItemContainer", extent: this.extent, fill: null, draggable: false, grabbable: false, clipMode: "visible"}]
        this.update()
      }
    }));

    (async () => {
      await tree.whenRendered();
      tree.nodeItemContainer.withAllSubmorphsDo(ea => ea.reactsToPointer = false)
    })();

    // Leash

    pos = pt(arr.last(this.submorphs).right, 0).addPt(pt(10,10));
    
    this.addMorph(new Leash({position: pos, start: pt(0,0), end: pt(100,100), onDrag: doCopy, init() { this.vertices = [pt(0,0), pt(100,100)] }}));

    function doCopy(evt) {
      evt.stop();
      var copy = Object.assign(this.copy(), {position: evt.positionIn(this).negated()});
      var name = copy.constructor.name.toLowerCase();
      name = (name[0].match(/[aeiou]/) ? "an " : "a ") + name;
      var i = 1; while (this.world().get(name + " " + i)) i++
      copy.name = name + " " + i;
      evt.hand.grab(copy);
      delete copy.onDrag;
      copy.init && copy.init();
    }
  }
}
