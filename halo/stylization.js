import { Morph, Text, Ellipse, Polygon, Image, Path, HTMLMorph, morph} from "../index.js";
import { VerticalLayout, HorizontalLayout, FillLayout,
         TilingLayout, GridLayout} from '../layout.js';
import { Color, pt, rect, Line, Rectangle} from "lively.graphics";
import { Intersection, IntersectionParams } from 'kld-intersections';
import { arr, num } from "lively.lang";
import { connect, disconnect } from "lively.bindings";
import { ColorPicker, BorderStyleEditor, BodyStyleEditor, 
         LayoutStyleEditor, HTMLEditor,
         ImageEditor } from "../ide/styling/style-editor.js";
import { Icon } from "../icons.js";
import { StyleRules } from "../style-rules.js";
import { Leash } from "../widgets.js";

/* rms: I tried doing this via polymorphic dispatch
         on the different morphs directly, but
         this causes weird problems with our module system,
         probably due to the circular dependency between morph
         and the style halos themselves. */
         
export function styleHaloFor(x, pointerId) {
    var styleHaloClass = StyleHalo;
    if (x instanceof Ellipse) {
       styleHaloClass = EllipseStyleHalo;
    } else if (x instanceof Image) {
       styleHaloClass = ImageStyleHalo;
    } else if (x instanceof Polygon || x instanceof Path) {
       styleHaloClass = SvgStyleHalo;
    } else if (x instanceof HTMLMorph) {
       styleHaloClass = HTMLStyleHalo;
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
     connect(this.target, "onChange", this, "relayout");
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
      disconnect(this.target, "onChange", this, "relayout");
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
      if (this.borderStyler.opened) return;
      this.leash = this.world().addMorph(new Leash({start: pt(0,0), end: pt(10,10), opacity: 0}), this);
      this.leash.startPoint.attachTo(this.borderHalo, this.getSideInWorld());
      this.leash.endPoint.attachTo(this.borderStyler, "center");
      this.leash.animate({opacity: .7, duration: 300});
      this.borderStyler.open()
      this.bodyStyler.hide();
      connect(this.borderStyler, "close", this.bodyStyler, "show");
      connect(this.borderStyler, "close", this.leash, "remove");
   }

   openBodyStyler() {
      if (this.bodyStyler.opened) return;
      this.leash = this.world().addMorph(new Leash({start: pt(0,0), end: pt(10,10), opacity: 0}).openInWorld(), this);
      this.leash.startPoint.attachTo(this.borderHalo, "center");
      this.leash.endPoint.attachTo(this.bodyStyler, "center");
      this.leash.animate({opacity: .7, duration: 300});
      this.bodyStyler.open();
      this.borderStyler.hide();
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
         onHoverOut(evt) {
            console.log(evt.state.hover)
            !this.fullContainsPoint(evt.positionIn(this)) && this.deselect();
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
            } else {
               halo.remove();
            }
            this.borderColor = Color.transparent;
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
           if (halo.isOnMorphBorder(evt)) {
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
      this.borderStyler.openInWorld();
      this.borderStyler.center = this.targetBounds.insetByRect(rect(-100, -50, 0, -50))[this.getSideInWorld()]();
      this.borderStyler.show();
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

class SvgStyleHalo extends StyleHalo {

    borderRadiusHalo() {
       return undefined;
    }

    clearVertexHandles() {
       this.vertexHandles && this.vertexHandles.forEach(m => m.remove());
       this.vertexHandles = null;
    }

    initVertexHandles() {
        const halo = this,
              bw = this.target.borderWidth || 1,
              bh = this.get("borderHalo");
        bh.borderColor = Color.transparent;
        this.clearVertexHandles();
        this.vertexHandles = this.target.vertices.map(({x,y}, i) => {
            return bh.addMorph({
                 extent: pt(10,10), draggable: true,
                 fill: Color.red.withA(.8),
                 borderWidth: 1, borderColor: Color.black,
                 center: pt(x + (2 * bw),y + (2 * bw)), 
                 onDrag(evt) {
                    const vs = halo.target.vertices,
                          {x,y} = vs[i];
                    vs[i] = {...vs[i], ...pt(x,y).addPt(evt.state.dragDelta)}
                    halo.target.vertices = vs;
                    this.moveBy(evt.state.dragDelta);
                    halo.relayout();
                 }
             })
          });
     }

   intersectionShape() {
     const bw = this.target.borderWidth, o = this.target.origin;
     return IntersectionParams.newPolygon(this.target.vertices.map(v => new Point2D(v.x + bw + o.x, v.y + bw + o.y)))
   }

   openBorderStyler() {
       super.openBorderStyler();
       connect(this.borderStyler, "close", this, "clearVertexHandles");
       this.initVertexHandles();
   }
    
    borderHaloShape(props) {
        const halo = this;
        return {
           ...super.borderHaloShape(props),
           type: "polygon",
           vertices: this.target.vertices,
           position: halo.target.origin,
           alignWithTarget() {
              this.borderWidth = halo.target.borderWidth || 2;
              this.vertices = halo.target.vertices;
              this.position = halo.target.origin;
              if (!halo.target.borderWidth) this.moveBy(pt(-2, -2));
              // if (halo.vertexHandles) {
              //    halo.clearVertexHandles();
              //    halo.initVertexHandles();
              // }
           }  
        }
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
