import { arr } from "lively.lang";
import { pt, Point, Color, Rectangle } from "lively.graphics";
import { Morph, Polygon } from "lively.morphic";
import { RichTextControl } from "lively.morphic/text/ui.js"
import { Tree, TreeData } from "./tree.js"
import { connect } from "lively.bindings"
import { Leash } from "lively.morphic/components/widgets.js"

class DummyTreeData extends TreeData {
  display(node) { return node.name }
  isCollapsed(node) { return node.isCollapsed }
  collapse(node, bool) { node.isCollapsed = bool; }
  getChildren(node) { return node.isLeaf ? null : node.isCollapsed ? [] : node.children }
  isLeaf(node) { return node.isLeaf }
}

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

  onDrag(evt) {
    var target = lively.lang.arr.intersect(this.submorphs, this.world().morphsContainingPoint(evt.position))[0];
    if (!target) return super.onDrag(evt);

    evt.stop();
    var copy = this.copyPart(target);
    copy.position = evt.positionIn(target).negated();
    evt.hand.grab(copy);
  }

  copyPart(part) {
    var copy = part.copy();
    var name = copy.constructor.name.toLowerCase();
    name = (name[0].match(/[aeiou]/) ? "an " : "a ") + name;
    var i = 1; while (this.world().get(name + " " + i)) i++;
    copy.name = name + " " + i;
    copy.reactsToPointer = true;
    part.init && part.init.call(copy);
    return copy;
  }


  setup() {
    // this.setup();

    this.removeAllMorphs()

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
      init() { this.fill = Color.random(); }
    });


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Rectangle

    pos = arr.last(this.submorphs).topRight.addXY(margin.x, 0);

    this.addMorph({
      position: pos, extent: objExt,
      fill: Color.random(), grabbable: false,
      init() { this.fill = Color.random(); }
    });


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Image

    pos = arr.last(this.submorphs).topRight.addXY(margin.x, 0);

    this.addMorph({
      type: "image",
      position: pos, extent: objExt,
      fill: null, grabbable: false
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
      grabbable: false
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
      init() {
        this.grabbable = false;
        this.readOnly = false;
        connect(this, "selectionChange", RichTextControl, "openDebouncedFor", {converter: sel => sel.textMorph})
      }
    });

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // button

    pos = arr.last(this.submorphs).rightCenter.addXY(margin.x, 0);

    this.addMorph({
      type: "button",
      label: "a button",
      leftCenter: pos, extent: pt(120, 30),
      active: false,
      init() {
        this.grabbable = false;
        this.active = true;
      }
    });


    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // List

    pos = pt(arr.last(this.submorphs).right, 0).addPt(margin);

    var list = this.addMorph({
      type: "list", items: arr.range(0,2000).map(n => "item " + n),
      position: pos, extent: objExt, //pt(110, objExt.y),
      borderWidth: 1, borderColor: Color.gray,
      init() {
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

    var root = new DummyTreeData({
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
      init() {
        this.grabbable = false;
        this.submorphs = [
          {name: "nodeItemContainer", extent: this.extent,
           fill: null, grabbable: false, clipMode: "visible"}]
        this.update()
      }
    }));

    (async () => {
      await tree.whenRendered();
      tree.nodeItemContainer.withAllSubmorphsDo(ea => ea.reactsToPointer = false)
    })();

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // Leash

    pos = pt(arr.last(this.submorphs).right, 0).addPt(pt(10,10));

    this.addMorph(new Leash({
      position: pos, start: pt(0,0), end: pt(100,100),
      init() { this.vertices = [pt(0,0), pt(100,100)] }
    }));

    this.width = arr.last(this.submorphs).right + 10;



    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    this.submorphs.forEach(ea => ea.reactsToPointer = false)
  }
}
