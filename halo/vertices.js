import {
  Morph,
  Path
} from "../index.js";

import { Color, pt } from "lively.graphics";
import { intersect, shape, bezier } from 'svg-intersections';
import { arr } from "lively.lang";
import { connect } from "lively.bindings";

import { Leash } from "../components/widgets.js";
import { StyleSheet } from "../style-sheets.js";

import { pathAttributes } from "../rendering/morphic-default.js";

/* rms: I tried doing this via polymorphic dispatch
         on the different morphs directly, but
         this causes weird problems with our module system,
         probably due to the circular dependency between morph
         and the style halos themselves. */

intersect.plugin(bezier);

function pointOnLine(a, b, pos, bw) {
   var v0 = pt(a.x, a.y), v1 = pt(b.x, b.y),
       l = v1.subPt(v0), ln = l.scaleBy(1/l.r()),
       dot = v1.subPt(pos).dotProduct(ln);
   return v1.subPt(ln.scaleBy(Math.max(1,Math.min(dot, l.r())))).addXY(bw,bw);
}

class VertexHandle extends Morph {

  constructor({halo, position, index}) {
    const bw = halo.target.borderWidth || 2;
    super({
      halo,
      index,
      styleClasses: ["sharp"],
      center: position.addXY(bw, bw)
    });
    this.initialize();
    this.update();
  }

  initialize() {
    this.submorphs = this.controlPoints();
    this.styleSheets = this.styler;
  }

  update() {
    const bw = this.halo.target.borderWidth || 2,
      {x, y} = this.halo.target.vertices[this.index];
    this.position = pt(x + bw, y + bw);
    
    const [bc, ac] = this.submorphs,
          ppos = this.vertex.controlPoints.previous,
          npos = this.vertex.controlPoints.next;
    for (let [control, point] of [[bc, ppos], [ac, npos]]) {
      if (control.vertices[1].position.equals(point)) continue;
      control.vertices = [pt(0, 0), point];
    }
  }

  get styler() {
    return new StyleSheet({
      '.VertexHandle': {
        nativeCursor: "-webkit-grab",
        extent: pt(10, 10),
        draggable: true,
        origin: pt(5, 5),
        fill: Color.white,
        borderWidth: 1,
        borderColor: Color.rgb(231, 76, 60)
      },
      '.VertexHandle .selected': {fill: Color.red, borderColor: Color.red.darker()},
      '.VertexHandle .sharp': {borderRadius: 0},
      '.VertexHandle .smooth': {borderRadius: 10},
      ".VertexHandle .controlPoint": {
        borderWidth: 1,
        borderColor: Color.gray.darker(),
        draggable: false
      },
      ".VertexHandle .Leash": {
        endpointStyle: {
          end: {
            extent: pt(10, 10),
            borderWidth: 1,
            origin: pt(5, 5),
            fill: Color.white,
            borderColor: Color.gray.darker(),
            nativeCursor: "-webkit-grab",
            submorphs: [
              {
                type: "ellipse",
                extent: pt(4, 4),
                reactsToPointer: false,
                fill: Color.gray.darker(),
                origin: pt(2, 2)
              }
            ]
          },
          start: {
            visible: false
          }
        }
      }
    });
  }

  controlPoints() {
    var prev, next, points = [
      prev = new Leash({
        styleClasses: ["controlPoint"],
        visible: false,
        vertices: [pt(0, 0), this.vertex.controlPoints.previous]
      }),
      next = new Leash({
        styleClasses: ["controlPoint"],
        visible: false,
        vertices: [pt(0, 0), this.vertex.controlPoints.next]
      })
    ];
    connect(prev, 'onEndpointDrag', this, 'update', {updater: ($upd, evt) => {
        let p = evt.state.endpoint;
        if (p.index == 1) {
          vertex.movePreviousControlPoint(
            p.getGlobalTransform().inverse().transformDirection(evt.state.dragDelta)
          );
          $upd();
        }    
    }, varMapping: {vertex: this.vertex}});
    connect(next, 'onEndpointDrag', this, 'update', {updater: ($upd, evt) => {
        let p = evt.state.endpoint;
        if (p.index == 1) {
          vertex.moveNextControlPoint(
            p.getGlobalTransform().inverse().transformDirection(evt.state.dragDelta)
          );
          $upd();
        }    }, varMapping: {vertex: this.vertex}})
    return points;
  }

  onMouseDown(evt) {
    this.halo.deselectVertexHandles();
    this.select();
    switch (this.halo.vertexMode) {
      case "delete": this.removeVertex(); break;
      case "transform":
        if (evt.state.clickCount > 1) this.transformVertex();
        break;
    }
  }

  select() {
    this.styleClasses = ["selected"];
    const {previous, next} = this.vertex.controlPoints;
    if (!previous.equals(pt(0, 0)) || !next.equals(pt(0, 0)))
      this.showControlPoints();
  }

  deselect() {
    this.styleClasses = [];
    this.hideControlPoints();
  }

  transformVertex() {
    this.vertex.isSmooth = !this.vertex.isSmooth;
    this.styleClasses = this.vertex.isSmooth
      ? ["vertexHandles", "selected", "smooth"]
      : ["vertexHandles", "selected", "sharp"], this.update();
  }

  get vertices() {
    return this.halo.target.vertices;
  }

  get vertex() {
    return this.vertices[this.index];
  }

   get nextVertex() {
    return this.vertices[this.index < this.vertices.length - 1 ? this.index + 1 : 0];
   }

   get previousVertex() {
    return this.vertices[this.index > 0 ? this.index - 1 : this.vertices.length - 1];
   }

   showControlPoints() {
    this.submorphs.forEach(controlPoint => controlPoint.visible = true)
   }

   hideControlPoints() {
    this.submorphs.forEach(controlPoint => controlPoint.visible = false)
   }

  removeVertex() {
    const vs = this.halo.target.vertices;
    if (vs.length > 2)
      arr.removeAt(vs, this.index);
    this.halo.target.makeDirty();
    this.halo.relayout();
  }

  onDragStart(evt) {
    this.get("handlePlaceholder").visible = false;
  }

  onDrag(evt) {
    this.vertex.moveBy(evt.state.dragDelta);
    this.halo.relayout();
  }
}

export class SvgStyleHalo extends Path {
  
  static get properties() {
    return {
      target: {},
      fill: {defaultValue: Color.transparent},
      draggable: {defaultValue: false},
      styleSheets: {
        initialize() {
          this.styleSheets = new StyleSheet({
            "[name=handlePlaceholder]": {
              origin: pt(5, 5),
              extent: pt(10, 10),
              fill: Color.green,
              nativeCursor: "pointer",
              tooltip: "Add Anchor Point"
            }
          });
        }
      },
      vertices: {
        initialize() {
          this.build();
        }
      }
    };
  }

  build() {
    this.vertexHandles = [];
    this.initShape();
    this.initVertexHandles();
  }

  startAddingVertices() {
    this.vertexMode = "add";
  }

  startDeletingVertices() {
    this.vertexMode = "delete";
  }

  startTransformingVertices() {
    this.vertexMode = "transform";
  }

  clearVertexHandles() {
    this.vertexHandles && this.vertexHandles.forEach(m => m.remove());
    this.vertexHandles = [];
  }

  cleanupHandles() {
    this.clearVertexHandles();
    this.vertexMode = null;
  }

  updateVertexHandles() {
    if (this.vertexHandles.length == this.target.vertices.length) {
      arr.invoke(this.vertexHandles, "update");
    } else {
      this.initVertexHandles();
    }
  }

  initVertexHandles() {
    const halo = this, bw = this.target.borderWidth || 3;
    this.borderColor = Color.transparent;
    this.clearVertexHandles();
    this.vertexHandles = this.target.vertices.map(({x, y}, i) => {
      return this.addMorph(
        new VertexHandle({
          halo,
          position: pt(x, y),
          index: i
        })
      );
    });
  }

  deselectVertexHandles() {
    arr.invoke(this.vertexHandles, "deselect");
  }

  intersectionShape() {
    const bw = this.target.borderWidth, o = this.target.origin;
    return shape("path", {d: pathAttributes(this.target).attributes.d});
  }

  initShape() {
    this.relayout();
    this.submorphs = [
      {
        name: "handlePlaceholder",
        type: "ellipse",
        visible: false
      }
    ];
    connect(this.submorphs[0], "onMouseDown", this, "placeHandle");
  }

  placeHandle() {
    const bw = this.target.borderWidth,
          pos = this.get('handlePlaceholder').position;
    arr.pushAt(this.target.vertices, pos.addXY(-bw, -bw), this.insertionIndex);
    this.target.vertices = this.target.vertices;
    this.relayout();
  }

  onMouseMove(evt) {
    if (this.vertexMode == "add" && this.vertexHandles) {
      this.showHandlePlaceholder(evt.positionIn(this));
    } else {
      this.get("handlePlaceholder").visible = false;
    }
  }
  
  relayout() {
    let target = this.target;
    this.borderWidth = target.borderWidth || 2;
    this.vertices = target.vertices;
    this.rotation = target.rotation;
    this.globalPosition = target.globalPosition;
    if (!target.borderWidth) this.moveBy(pt(-1, -1));
    this.updateVertexHandles();
  }

  showHandlePlaceholder(pos) {
    let target = this.target,
        bw = target.borderWidth || 2,
        ph = this.get("handlePlaceholder"),
        vs = target.vertices,
        [v0, v1] = arr.min(arr.zip(vs, arr.rotate(vs)), ([a, b]) =>
          pos.dist(pointOnLine(a, b, pos, bw))
        ),
        handlePos = pointOnLine(v0, v1, pos, bw);
    ph.position = handlePos;
    ph.visible = true;
    ph.insertionIndex = vs.indexOf(v1);
  }
}
