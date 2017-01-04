import { Morph, Text, Ellipse, Polygon, Image, Path, HTMLMorph, morph} from "../index.js";
import { VerticalLayout, HorizontalLayout, FillLayout,
         TilingLayout, GridLayout} from '../layout.js';
import { Color, pt, rect, Line, Rectangle} from "lively.graphics";
import { Intersection, IntersectionParams } from 'kld-intersections';
import { arr, num } from "lively.lang";
import { connect, disconnect } from "lively.bindings";
import { ColorPicker, BorderStyleEditor, BodyStyleEditor, 
         LayoutStyleEditor, HTMLEditor, PathEditor, PolygonEditor,
         ImageEditor, NoEditor } from "../ide/styling/style-editor.js";
import { Icon } from "../icons.js";
import { StyleRules } from "../style-rules.js";
import { Leash } from "../widgets.js";
import { Event } from "../events/Event.js";

/* rms: I tried doing this via polymorphic dispatch
         on the different morphs directly, but
         this causes weird problems with our module system,
         probably due to the circular dependency between morph
         and the style halos themselves. */

function pointOnLine(a, b, pos, bw) {
   var v0 = pt(a.x, a.y), v1 = pt(b.x, b.y), 
       l = v1.subPt(v0), ln = l.scaleBy(1/l.r()),
       dot = v1.subPt(pos).dotProduct(ln);
   return v1.subPt(ln.scaleBy(Math.max(1,Math.min(dot, l.r())))).addXY(bw,bw);
}
         
export function styleHaloFor(x, pointerId) {
    var styleHaloClass = StyleHalo;
    if (x instanceof Ellipse) {
       styleHaloClass = EllipseStyleHalo;
    } else if (x instanceof Image) {
       styleHaloClass = ImageStyleHalo;
    } else if (x instanceof Polygon) {
       styleHaloClass = SvgStyleHalo;
    } else if (x instanceof HTMLMorph) {
       styleHaloClass = HTMLStyleHalo;
    } else if (x instanceof Path) {
       styleHaloClass = PathStyleHalo;
    }
    return new styleHaloClass(x, pointerId).openInWorld().relayout();
}

class StyleHalo extends Morph {

   constructor(target, pointerId) {
       this.target = target;
       super({
          morphClasses: ['formatter'],
          bounds: target.globalBounds().insetBy(-10),
          styleRules: this.styler,
       });
       this.state = {pointerId};
       this.build(); 
   }

   onKeyDown(evt) {
      if (evt.key == "Escape") {
         this.remove();
      }
   }

   build() {
     this.submorphs = [{
         morphClasses: ['formatter'],
         position: pt(10,10),
         submorphs: [
           this.getBorderHalo(),
           this.borderRadiusHalo()
         ]
     }, this.getLayoutControl()];
     this.focus();
     this.showBodyStyler();
     this.showBorderStyler();
     connect(this.target, "onChange", this, "update");
     this.relayout();  
   }

   update() {
      this.relayout();
   }
   
   get isLayoutHalo() { return true; }
   get isHaloItem() { return true; }

   get styler() {
      return new StyleRules({
         formatter: {draggable: false, fill: Color.transparent},
         borderHalo: {
           draggable: false,
           borderWidth: Math.max(3, this.target.borderWidth), 
           fill: Color.transparent,
           borderColor: Color.orange.withA(0.4)},
         borderRadiusHalo: {
            fill: Color.red,
            isHaloItem: true,
            nativeCursor: 'ew-resize',
            borderWidth: 1,
            borderColor: Color.black,
            extent: pt(10,10),
            origin: pt(5,5),
            tooltip: "Change border radius",
            rotation: -this.target.rotation}});
   }

   get targetBounds() { return this.target.globalPosition
                                          .addPt(this.target.origin.negated())
                                          .extent(this.target.extent); }
   
   onMouseMove(evt) { this.relayout(evt) }

   onMouseDown(evt) {
      !this.get("borderHalo").onMouseDown(evt) && evt.state.clickedOnMorph == this && this.remove();
   }

   remove() {
      this.borderStyler.remove();
      this.bodyStyler.remove();
      this.layoutStyleEditor.remove();
      this.leash && this.leash.remove();
      disconnect(this.target, "onChange", this, "update");
      super.remove();
   }

   relayout(evt) {
      const [controls, layoutControl] = this.submorphs;
      this.setBounds(this.target.globalBounds().insetBy(-50));
      controls.setTransform(this.target.transformToMorph(this));
      controls.position = this.localizePointFrom(this.target.origin.negated(), this.target);
      controls.submorphs.forEach(s => s.update && s.update(evt));
      this.layoutStyleEditor.update();
      return this;
   }

   // FIXME: Move this logic to lively.graphics

   intersectionShape() {
      const br = this.target.borderRadius,
            {width, height} = this.target;
      return IntersectionParams.newRoundRect(0, 0, width, height, br, br)
   }

   isOnMorphBorder(evt) {
      if (!evt) return false;
      const {x,y} = evt.positionIn(this.submorphs[0]),
            brHalo = this.getSubmorphNamed("borderRadiusHalo") || {active: false},
            bw = this.target.borderWidth || 1;
            
      return !brHalo.active && Intersection.intersectShapes(  
              this.intersectionShape(),
              IntersectionParams.newRect(x - bw, y - bw, bw * 2, bw * 2)).points.length > 0;
   }

   isInMorphBody(evt) {
      if (!evt) return false;
      if (this.isOnMorphBorder(evt)) return true;
      var  {x,y} = evt.positionIn(this.submorphs[0]),
            pos = pt(num.roundTo(x,1),num.roundTo(y,1)),
            {width, height, origin} = this.target;
      if (!rect(0,0,width,height).containsPoint(pt(x,y))) return false;
      const v = Intersection.intersectShapes(  
              this.intersectionShape(),
              IntersectionParams.newLine(new Point2D(x,0), new Point2D(x,height))),
            vs = v.points.length > 0 && v.points.map(({x,y}) => pt(num.roundTo(x,1), num.roundTo(y,1))),
            lv = vs && Rectangle.unionPts(vs).rightEdge(),
            h = Intersection.intersectShapes(  
              this.intersectionShape(), 
              IntersectionParams.newLine(new Point2D(0,y), new Point2D(width,y))),
            hs = h.points.length > 0 && h.points.map(({x,y}) => pt(num.roundTo(x,1), num.roundTo(y,1))),
            lh = hs && Rectangle.unionPts(hs).topEdge();
      return lh && lv && lh.includesPoint(pos) && lv.includesPoint(pos) 
   }

   openBorderStyler() {
      this.borderColor = Color.transparent;
      if (this.borderStyler.opened) return;
      this.leash = this.world().addMorph(new Leash({start: pt(0,0), end: pt(10,10), opacity: 0}), this);
      this.leash.startPoint.attachTo(this.borderHalo, this.getSideInWorld());
      this.leash.endPoint.attachTo(this.borderStyler, "center");
      this.leash.animate({opacity: .7, duration: 300});
      this.bodyStyler.hide();
      this.borderStyler.open()
      connect(this.borderStyler, "close", this.bodyStyler, "show");
      connect(this.borderStyler, "close", this.leash, "remove");
   }

   openBodyStyler() {
      this.borderStyler.hide();
      if (this.bodyStyler.opened) return;
      this.leash = this.world().addMorph(new Leash({start: pt(0,0), end: pt(10,10), opacity: 0}), this.bodyStyler);
      this.leash.startPoint.attachTo(this.borderHalo, "center");
      this.leash.endPoint.attachTo(this.bodyStyler, "center");
      this.leash.animate({opacity: .7, duration: 300});
      this.bodyStyler.open();
      connect(this.bodyStyler, "close", this.borderStyler, "show");
      connect(this.bodyStyler, "close", this.leash, "remove");
   }

   borderHaloShape(props) {
      const halo = this, target = this.target;
      return {
         borderRadius: this.target.borderRadius,
         isHaloItem: true,
         selectBorder() {
            this.borderColor = Color.orange;
            halo.nativeCursor = this.nativeCursor = "pointer";
            this.borderSelected = true;
            this.bodySelected = false;
            halo.selectBorder();
         },
         deselectBorder(evt) {
            this.borderColor = Color.orange.withA(.4);
            halo.nativeCursor = this.nativeCursor = null;
            this.borderSelected = false;
            if (evt && halo.isInMorphBody(evt)) {
                  this.selectBody();
            } else if (evt) {
                  this.deselect();
            }
         },
         selectBody() {
            this.bodySelected = true;
            halo.selectBody();
         },
         deselect() {
             this.borderSelected = this.bodySelected = false;
             halo.borderStyler.blur();
             halo.bodyStyler.blur()
         },
         alignWithTarget() {
           const globalBounds = halo.targetBounds, 
                 visibleBounds = this.env.world.visibleBounds(),
                 {x, y, width, height} = globalBounds.intersection(visibleBounds),
                 cornersInWorld = ["topLeft", "topRight", "bottomRight", "bottomLeft"].filter(s => 
                      visibleBounds.containsPoint(globalBounds[s]())),
                 b = this.owner.localize(pt(x,y)).extent(pt(width,height));
           this.setBounds(b);
           this.borderWidth = Math.max(3, target.borderWidth);
           this.borderRadius = 0;
           cornersInWorld.forEach(s => {
              switch (s) {
                 case "topLeft":
                    this.borderRadiusTop = this.borderRadiusLeft = target.borderRadius;
                    break;
                 case "topRight":
                    this.borderRadiusTop = this.borderRadiusRight = target.borderRadius;
                    break;
                 case "bottomRight":
                    this.borderRadiusBottom = this.borderRadiusRight = target.borderRadius;
                    break;
                 case "bottomLeft":
                    this.borderRadiusBottom = this.borderRadiusLeft = target.borderRadius;
              }
           })
         },
         onMouseDown(evt) {
            if (evt.state.clickedOnMorph != this) return;
            if (this.borderSelected) {
                halo.openBorderStyler();
            } else if (this.bodySelected) {
                halo.openBodyStyler();
            } else if (!halo.isInMorphBody(evt) && !halo.isOnMorphBorder(evt)) {
               halo.remove();
            }
            return true;
         },
         ...props
      }
   }

   get stylizing() { 
      return (this.borderStyler.opened) || 
             (this.bodyStyler.opened) ||
             (this.layoutStyleEditor.opened) ||
             (this.get("borderRadiusHalo") && this.get("borderRadiusHalo").active) 
   }

   getBorderHalo() {
      const target = this.target, 
            halo = this;
      this.borderHalo = morph(this.borderHaloShape({
         name: "borderHalo",
         update(evt) {
           this.alignWithTarget()
           if (halo.stylizing) return;
           if (halo.isOnMorphBorder(evt) || 
               (evt && halo.borderStyler.fullContainsPoint(evt.position))) {
              this.selectBorder();
           } else {
              this.deselectBorder(evt);
           }
         },
      }));
      return this.borderHalo;
   }

   selectBorder() {
      this.bodyStyler.blur();
      this.showBorderStyler();
   }

   getSideInWorld() {
      const visibleBounds = this.env.world.visibleBounds(),
      globalBounds = this.targetBounds.insetByRect(rect(-100, -50, 100, 100));
      return ["topCenter", ...visibleBounds.sides, ...visibleBounds.corners].find(
                      s => {
                            return visibleBounds.containsPoint(globalBounds[s]())});
   }

   showBorderStyler() {
      if (!this.borderStyler) {
          this.borderStyler = this.getBorderStyler();
      }
      this.borderStyler.show();
      this.borderStyler.center = this.targetBounds.insetByRect(rect(-100, -50, 0, -50))[this.getSideInWorld()]();
   }

   getBorderStyler() {
      const borderStyler = new BorderStyleEditor({
               name: "borderStyler",
               target: this.target,
               title: "Change Border Style",
       });
       connect(borderStyler, "open", this, "openBorderStyler");
       return borderStyler;
   }

   selectBody() {
      this.borderStyler.blur();
      this.showBodyStyler()
   }

   showBodyStyler() {
      if (!this.bodyStyler) {
          this.bodyStyler = this.getBodyStyler();
      }
      this.bodyStyler.openInWorld();
      this.bodyStyler.center = this.targetBounds.center();
      this.bodyStyler.show();
   }

   getBodyStyler() { 
     const bodyStyler = new BodyStyleEditor({
                 name: "bodyStyler",
                 target: this.target,
                 title: "Change Body Style"});
     connect(bodyStyler, "open", this, "openBodyStyler");
     return bodyStyler;
   }

   borderRadiusHalo() {
       const halo = this,
             getPos = () => pt(halo.target.width - halo.target.borderRadius, 0);
       return {
          name: "borderRadiusHalo",
          center: getPos(),
          type: 'ellipse',
          onHoverIn() { this.active = true; halo.borderHalo.deselectBorder(); },
          onHoverOut(evt) { if (evt.state.draggedMorph != this) this.active = false; },
          update(evt) { this.center = getPos(); },
          onDragStart(evt) { 
             this.active = true; 
             halo.borderStyler.hide();
             halo.bodyStyler.hide();
             this.targetTransform = halo.target.getGlobalTransform().inverse();
             this.borderRadiusView = this.addMorph(new Text({
                fill: Color.black.withA(.7), borderRadius: 5,
                padding: 5, fontColor: Color.white,
                position: pt(10,10), textString: halo.target.borderRadius + "px"
             }));
          },
          onDrag(evt) {
             var r = halo.target.borderRadius;
             halo.relayout(evt);
             r -= this.targetTransform.transformDirection(evt.state.dragDelta).x
             r = Math.round(Math.min(halo.target.width / 2, Math.max(r, 0)));
             halo.target.borderRadius = r;
             this.position = getPos();
             this.active = true;
             this.borderRadiusView.textString = halo.target.borderRadius + "px";
          },
          onDragEnd(evt) {
            this.active = false;
            this.borderRadiusView.remove(); 
            halo.borderStyler.show();
            halo.bodyStyler.show();
          }
       }
   }

   hideStyleEditors() {
      this.bodyStyler.hide();
      this.borderStyler.hide();
      this.borderHalo.visible = false;
   }

   showStyleEditors() {
      this.bodyStyler.show();
      this.borderStyler.show();
      this.borderHalo.visible = true;
   }

   getLayoutControl() {
      this.layoutStyleEditor = new LayoutStyleEditor({
          name: "layoutStyleEditor",
          halo: this, target: this.target, 
          pointerId: this.state.pointerId
      });
      connect(this.layoutStyleEditor, "open", this, "hideStyleEditors");
      connect(this.layoutStyleEditor, "close", this, "showStyleEditors");
      return this.layoutStyleEditor;
   }
   

}

export class EllipseStyleHalo extends StyleHalo {

    borderRadiusHalo() {
       return undefined;
    }

    borderHaloShape(props) {
      const halo = this;
      return {
         ...super.borderHaloShape(props),
         type: "ellipse"
      }
    }

    intersectionShape() {
        const {width, height} = this.target;
        return IntersectionParams.newEllipse(new Point2D(width / 2, height / 2), width / 2, height / 2)
    }

}

class VertexHandle extends Morph {

   constructor({halo, position, index}) {
      const bw = halo.target.borderWidth || 2;
      super({
         halo, index, 
         morphClasses: ['vertexHandles', 'sharp'], 
         center: position.addXY(bw, bw),
         styleRules: this.styler
      });
      this.build()
      this.update();
   }

   build() {
      this.submorphs = this.controlPoints();
   }

   update() {
      const bw = this.halo.target.borderWidth || 2,
            {x,y} = this.halo.target.vertices[this.index];
      this.position = pt(x + bw, y + bw);
      this.submorphs.forEach(controlPoint => controlPoint.update());
   }

   get styler() {
      return new StyleRules({
         vertexHandles: {
                 nativeCursor: "-webkit-grab",
                 extent: pt(10,10), draggable: true, origin: pt(5,5),
                 fill: Color.white,
                 borderWidth: 1, borderColor: Color.rgb(231,76,60),
             },
         selected: {fill: Color.red, borderColor: Color.red.darker()},
         sharp: {borderRadius: 0}, smooth: {borderRadius: 10},
         controlPoint: {
             borderWidth: 1, borderColor: Color.gray.darker(), draggable: false,
             endpointStyle: {
                 extent: pt(10,10), borderWidth: 1, origin: pt(5,5),
                 fill: Color.white, borderColor: Color.gray.darker(),
                 submorphs: [{type: 'ellipse', extent: pt(4,4), reactsToPointer: false,
                              fill:  Color.gray.darker(), origin: pt(2,2)}],
                 start: {visible: false}
             }
         }
      })
   }

   controlPoints() {
      const self = this;
      return [
           new Leash({
               morphClasses: ['controlPoint'], visible: false, 
               vertices: [pt(0,0), this.vertex.controlPoints.previous],
               update() { 
                   const pos = self.vertex.controlPoints.previous;
                   if (this.vertices[1].position.equals(pos)) return;
                   this.vertices =  [pt(0,0), pos]; 
               },
               onEndpointDrag: (endpoint, evt) => {
                  if (endpoint.index == 1) {
                      this.vertex.movePreviousControlPoint(evt.state.dragDelta);
                      this.update();
                  }
               }
             }), 
           new Leash({
               morphClasses: ['controlPoint'], visible: false,
               vertices: [pt(0,0), this.vertex.controlPoints.next],
               update() { 
                   const pos = self.vertex.controlPoints.next;
                   if (this.vertices[1].position.equals(pos)) return;
                   this.vertices = [pt(0,0), pos]; 
               },
               onEndpointDrag: (endpoint, evt) => {
                 if (endpoint.index == 1) {
                    this.vertex.moveNextControlPoint(evt.state.dragDelta);
                    this.update()
                 }
               }})
      ]
   }
                 
   onMouseDown(evt) {
      this.halo.deselectVertexHandles();
      this.select();
      switch (this.halo.vertexMode) {
          case 'delete':
             this.removeVertex();
             break;
          case 'transform':
             if (evt.state.clickCount > 1) {
                this.transformVertex();
             }
             break;
      }
   }

   select() {
      this.morphClasses = ['vertexHandles', 'selected'];
      const {previous, next} = this.vertex.controlPoints;
      if (!previous.equals(pt(0,0)) || !next.equals(pt(0,0))) this.showControlPoints();
   }

   deselect() {
      this.morphClasses = ['vertexHandles'];
      this.hideControlPoints();
   }
   
   transformVertex() {
       this.vertex.isSmooth = !this.vertex.isSmooth;
       this.morphClasses = this.vertex.isSmooth ? 
                                ['vertexHandles','selected','smooth'] : 
                                ['vertexHandles', "selected", 'sharp'],
       this.update();
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
      this.submorphs.forEach(controlPoint => { controlPoint.visible = true })
   }

   hideControlPoints() {
      this.submorphs.forEach(controlPoint => { controlPoint.visible = false })
   }
   
   
   removeVertex() {
      const vs = this.halo.target.vertices;
      if( vs.length > 2) arr.removeAt(vs, this.index);
      this.halo.target.makeDirty();
   }
   
   onDragStart(evt) {
      this.get('handlePlaceholder').visible = false;
   }
   
   onDrag(evt) {
      this.vertex.moveBy(evt.state.dragDelta);
      this.halo.relayout();
   }
}

class SvgStyleHalo extends StyleHalo {

    build() {
       this.vertexHandles = [];
       super.build();
    }

    borderRadiusHalo() {
       return undefined;
    }
    
    getBorderStyler() {
      const borderStyler = new PolygonEditor({target: this.target, title: "Change Border Style"});
      connect(borderStyler, "open", this, 'openBorderStyler');
      connect(borderStyler, "add vertices", this, "startAddingVertices");
      connect(borderStyler, "delete vertices", this, "startDeletingVertices");
      connect(borderStyler, "transform vertices", this, "startTransformingVertices");
      return borderStyler;
   }

   startAddingVertices() {
      this.vertexMode = 'add';
   }

   startDeletingVertices() {
      this.vertexMode = 'delete';
   }

   startTransformingVertices() {
      this.vertexMode = 'transform';
   }

    get svgStyler() {
       return new StyleRules({
           propertyDisplay: {
                fill: Color.black.withA(.7), borderRadius: 5,
                padding: 5, fontColor: Color.white,
                position: pt(10,10),
           },
           handlePlaceholder: {
              origin: pt(5,5), extent: pt(10,10), fill: Color.green, nativeCursor: 'pointer',
              tooltip: "Add Anchor Point"
           }
       })
    }

    clearVertexHandles() {
       this.vertexHandles && this.vertexHandles.forEach(m => m.remove());
       this.vertexHandles = [];
    }

    updateVertexHandles() {
       if (this.vertexHandles.length == this.target.vertices.length) {
          arr.invoke(this.vertexHandles, 'update');
       } else {
          this.initVertexHandles();
       }
    }

    initVertexHandles() {
        const halo = this,
              bw = this.target.borderWidth || 3,
              bh = this.get("borderHalo");
        bh.borderColor = Color.transparent;
        this.clearVertexHandles();
        this.vertexHandles = this.target.vertices.map(({x,y}, i) => {
            return bh.addMorph(new VertexHandle({halo, position: pt(x,y), index: i}))
        });
     }

     deselectVertexHandles() {
        arr.invoke(this.vertexHandles, 'deselect');
     }

   intersectionShape() {
     const bw = this.target.borderWidth, o = this.target.origin;
     return IntersectionParams.newPath(this.target.vertices.map(v => {
          const np = v.controlPoints.next,
                nv = this.target.vertexAfter(v),
                pp = nv.controlPoints.previous;
          return IntersectionParams.newBezier3(
                new Point2D(v.x + o.x, v.y + o.y),
                new Point2D(np.x + v.x + o.x, np.y + v.y + o.y),
                new Point2D(pp.x + nv.x + o.x, pp.y + nv.y + o.y),
                new Point2D(nv.x + o.x, nv.y + o.y)
          )
     }));
   }

   openBorderStyler() {
       this.borderColor = Color.transparent;
       if (this.borderStyler.opened) return;
       super.openBorderStyler();
       connect(this.borderStyler, "close", this, "clearVertexHandles");
       this.initVertexHandles();
   }
    
    borderHaloShape(props) {
        const halo = this;
        return {
           ...super.borderHaloShape(props),
           type: "polygon",
           styleRules: this.svgStyler,
           vertices: halo.target.vertices,
           position: halo.target.origin,
           submorphs: [{
                name: 'handlePlaceholder', 
               type: 'ellipse', visible: false,
               onMouseDown() {
                  const bw = halo.target.borderWidth;
                  arr.pushAt(halo.target.vertices, this.position.addXY(-bw,-bw), this.insertionIndex);
                  halo.target.vertices = halo.target.vertices;
               }}],
           showHandlePlaceholder(pos) {
              const bw = halo.target.borderWidth || 2;
              var vs = halo.target.vertices,
                 [v0, v1] = arr.min(arr.zip(vs, arr.rotate(vs)), ([a,b]) => 
                                pos.dist(pointOnLine(a, b, pos, bw))),
                 handlePos = pointOnLine(v0,v1, pos, bw);
              const ph = this.get("handlePlaceholder")
              ph.position = handlePos;
              ph.visible = true;
              ph.insertionIndex = vs.indexOf(v1)
           },
           onMouseMove(evt) {
              if (halo.vertexMode == "add" && halo.vertexHandles) {
                  this.showHandlePlaceholder(evt.positionIn(this));
              } else {
                  this.get('handlePlaceholder').visible = false;
              }
           },
           alignWithTarget() {
              this.borderWidth = halo.target.borderWidth || 2;
              this.vertices = halo.target.vertices;
              this.position = halo.target.origin;
              if (!halo.target.borderWidth) this.moveBy(pt(-1,-1));
              if (halo.borderStyler.opened) halo.updateVertexHandles();
           }  
        }
    }
}

class PathStyleHalo extends SvgStyleHalo {

   getBodyStyler() {
      return new NoEditor({target: this.target});
   }

   showBorderStyler() {
      super.showBorderStyler();
      this.borderStyler.center = this.target.center;
   }

   openBorderStyler() {
      this.borderColor = Color.transparent;
      if (this.borderStyler.opened) return;
      super.openBorderStyler();
      this.leash.startPoint.attachTo(this.target, "topCenter");
   }

   borderHaloShape(props) {
        return {
           ...super.borderHaloShape(props),
           type: "path" 
        }
    }

   getBorderStyler() {
      const borderStyler = new PathEditor({target: this.target});
      connect(borderStyler, "open", this, 'openBorderStyler');
      return borderStyler;
   }

}

class HTMLStyleHalo extends StyleHalo {

   getBodyStyler() {
      return new HTMLEditor({target: this.target});
   }

}

class ImageStyleHalo extends StyleHalo {

    getBodyStyler() {
       return new ImageEditor({target: this.target});
    }

}

class TextStyleHalo extends StyleHalo {

    getBodyStyler() {
       return new RichTextEditor({target: this.target});
    }

}
