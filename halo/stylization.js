import { Morph, Text, Ellipse, Polygon, Image, Path} from "../index.js";
import { VerticalLayout, HorizontalLayout, FillLayout,
         TilingLayout, GridLayout} from '../layout.js';
import { Color, pt, rect} from "lively.graphics";
import { Intersection, IntersectionParams } from 'kld-intersections';
import { arr } from "lively.lang";
import { connect, disconnect } from "lively.bindings";
import { ColorPicker, BorderStyleEditor, BodyStyleEditor, LayoutStyleEditor } from "../ide/styling/style-editor.js";
import { Icon } from "../icons.js";

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
    }
    return new styleHaloClass(x, pointerId).openInWorld().update();
}

class StyleHalo extends Morph {

   constructor(target, pointerId) {
       super({
          draggable: false,
          fill: Color.transparent,
          bounds: target.globalBounds().insetBy(-10),
       });
       this.state = {pointerId};
       this.target = target;
       this.submorphs = [{
           position: pt(10,10),
           fill: Color.transparent,
           submorphs: [
             this.borderHalo(),
             this.borderRadiusHalo()
           ]
       }, this.layoutControl()];
       this.focus();
       this.update();
       connect(target, "onChange", this, "alignWithTarget");
   }

   showStyleGuides(show) {
       const br = this.getSubmorphNamed("borderRadiusHalo"),
             bh = this.getSubmorphNamed("borderHalo");
       if (br) br.visible = show;
       if (bh) bh.visible = show;
   }

   get isLayoutHalo() { return true; }
   get isHaloItem() { return true; }
   
   onMouseMove(evt) { this.update(evt) }

   onMouseDown(evt) { 
      !this.get("borderHalo").onMouseDown(evt) && evt.state.clickedOnMorph == this && this.remove();
   }

   remove() {
      this.borderStyler && this.borderStyler.remove();
      this.bodyStyler && this.bodyStyler.remove();
      this.get("layoutStyleEditor") && this.get("layoutStyleEditor").remove();
      disconnect(this.target, "onChange", this, "alignWithTarget");
      super.remove();
   }

   alignWithTarget() {
       this.update();
   }

   update(evt) {
      const [controls, layoutControl] = this.submorphs;
      this.setBounds(this.target.globalBounds().insetBy(-50));
      controls.setTransform(this.target.transformToMorph(this));
      controls.position = this.localizePointFrom(this.target.origin.negated(), this.target);
      controls.submorphs.forEach(s => s.update && s.update(evt));
      layoutControl.update(evt);
      return this;
   }

   mouseCapturer() {
      return {
          bounds: this.target.innerBounds().insetBy(-50),
          fill: Color.transparent,
          onMouseMove: (evt)  => { this.update(evt) }
      }
   }

   // border styling

   isOnMorphBorder(evt) {
      if (!evt) return false;
      const {x,y} = evt.positionIn(this.submorphs[0]),
            brHalo = this.getSubmorphNamed("borderRadiusHalo") || {active: false},
            br = this.target.borderRadius,
            {width, height} = this.target;
            
      return !brHalo.active && Intersection.intersectShapes(  
              IntersectionParams.newRoundRect(0, 0, width, height, br, br), 
              IntersectionParams.newRect(x - 7.5, y - 7.5, 15, 15)).points.length > 0;
   }

   openBorderStyler() {
      this.borderStyler.open();
      connect(this.borderStyler, "close", this, "deselect");
   }

   openBodyStyler() {
      this.bodyStyler.open();
      connect(this.bodyStyler, "close", this, "deselect");
   }

   borderHaloShape(props) {
      const halo = this, target = this.target;
      return {
         draggable: false,
         borderWidth: Math.max(3, this.target.borderWidth), 
         fill: Color.transparent,
         borderColor: Color.orange.withA(0.4),
         borderRadius: this.target.borderRadius,
         isHaloItem: true,
         selectBorder() {
            this.borderColor = Color.orange;
            halo.nativeCursor = this.nativeCursor = "pointer";
            this.borderSelected = true;
            halo.selectBorder();
         },
         deselectBorder(evt) {
            this.borderColor = Color.orange.withA(.4);
            halo.nativeCursor = this.nativeCursor = null;
            this.borderSelected = false;
            if (evt && this.fullContainsPoint(evt.positionIn(this))) {
                  halo.selectBody();
            } else if (evt) {
                  halo.deselect();
            }
         },
         alignWithTarget() {
           const globalBounds = target.globalBounds(), visibleBounds = target.world().visibleBounds(),
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
            if (halo.borderStyler) {
                !halo.borderStyler.active && halo.openBorderStyler();
            } else if (halo.bodyStyler) {
                !halo.bodyStyler.active && halo.openBodyStyler();
            } else {
               return false;
            }
            this.borderColor = Color.transparent;
            return true;
         },
         ...props
      }
   }

   get stylizing() { 
      return (this.borderStyler && this.borderStyler.active) || 
             (this.bodyStyler && this.bodyStyler.active) ||
             (this.get("layoutStyleEditor") && this.get("layoutStyleEditor").active) ||
             (this.get("borderRadiusHalo") && this.get("borderRadiusHalo").active) 
   }

   borderHalo() {
      const target = this.target, halo = this;
      // subscribe to the global mouse move event
      return this.borderHaloShape({
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
      });
   }

   selectBorder() {
      this.bodyStyler && this.bodyStyler.fadeOut(300);
      this.bodyStyler = null;
      if (!this.borderStyler) {
          const visibleBounds = this.world().visibleBounds(),
                globalBounds = this.target.globalBounds().insetByRect(rect(-100, -50, 100, 100)),
                sideInWorld = ["topCenter", ...visibleBounds.sides, ...visibleBounds.corners].find(s => {
                                      return visibleBounds.containsPoint(globalBounds[s]())
                                });
          this.borderStyler = new BorderStyleEditor({
               target: this.target,
               title: "Change Border Style",
          });
          this.borderStyler.openInWorld();
          this.borderStyler.center = this.get("borderHalo").globalBounds().insetByRect(rect(-100, -50, 0, -50))[sideInWorld]();
          this.borderStyler.animate({opacity: 1, duration: 300});
      }
   }

   selectBody() {
      this.borderStyler && this.borderStyler.fadeOut(300);
      this.borderStyler = null;
      if (!this.bodyStyler) {
          this.bodyStyler = new BodyStyleEditor({
               target: this.target,
               title: "Change Body Style",
          });
          this.bodyStyler.openInWorld();
          this.bodyStyler.center = this.get("borderHalo").globalBounds().center();
          this.bodyStyler.animate({opacity: 1, duration: 300});
      }
   }

   deselect() {
       this.borderStyler && this.borderStyler.fadeOut(300);
       this.bodyStyler && this.bodyStyler.fadeOut(300);
       this.get('borderHalo').deselectBorder();
       this.bodyStyler = this.borderStyler = null;
   }

   borderRadiusHalo() {
       const halo = this,
             getPos = () => {
          return pt(halo.target.width - halo.target.borderRadius, 0)
       };
       return {
          name: "borderRadiusHalo",
          type: 'ellipse',
          fill: Color.red,
          isHaloItem: true,
          nativeCursor: 'ew-resize',
          borderWidth: 1,
          borderColor: Color.black,
          extent: pt(10,10),
          origin: pt(5,5),
          center: getPos(),
          tooltip: "Change border radius",
          onHoverIn() { this.active = true; halo.deselect() },
          onHoverOut(evt) { if (evt.state.draggedMorph != this) this.active = false; },
          rotation: -halo.target.rotation,
          update(evt) { this.center = getPos(); },
          onDragStart(evt) { 
             this.active = true; halo.deselect();
             this.targetTransform = halo.target.getGlobalTransform().inverse();
             this.borderRadiusView = this.addMorph(new Text({
                fill: Color.black.withA(.7), borderRadius: 5,
                padding: 5, fontColor: Color.white,
                position: pt(10,10), textString: halo.target.borderRadius + "px"
             }));
          },
          onDrag(evt) {
             var r = halo.target.borderRadius;
             halo.update(evt);
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
          }
       }
   }

   // layout halo
   layoutControl() {
      return new LayoutStyleEditor({
          name: "layoutStyleEditor",
          halo: this, target: this.target, 
          pointerId: this.state.pointerId
      });
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

    isOnMorphBorder(evt) {
      if (!evt) return false;
      const {x,y} = evt.positionIn(this.getSubmorphNamed("borderHalo")),
            {width, height} = this.target;
            
      return Intersection.intersectShapes(  
              IntersectionParams.newEllipse(new Point2D(width / 2, height / 2), width / 2, height / 2), 
              IntersectionParams.newRect(x - 7.5, y - 7.5, 15, 15)).points.length > 0;
   }

}

class SvgStyleHalo extends StyleHalo {

    borderRadiusHalo() {
       return undefined;
    }

    showStyleGuides(show) {
       super.showStyleGuides(show);
       show && this.clearVertexHandles();
    }

    clearVertexHandles() {
       this.vertexHandles && this.vertexHandles.forEach(m => m.remove());
       this.vertexHandles = null;
    }

    initVertexHandles() {
        const halo = this,
              bh = this.get("borderHalo");
        bh.borderColor = Color.transparent;
        this.vertexHandles = this.target.vertices.map((v, i) => {
            return bh.addMorph({
                 extent: pt(10,10), draggable: true,
                 fill: Color.red.withA(.8),
                 borderWidth: 1, borderColor: Color.black,
                 position: v, onDrag(evt) {
                    const vs = halo.target.vertices;
                    vs[i] = vs[i].addPt(evt.state.dragDelta)
                    halo.target.vertices = vs;
                    this.moveBy(evt.state.dragDelta);
                    halo.update();
                 }
             })
          });
     }

    isOnMorphBorder(evt) {
      if (!evt) return false;
      const {x,y} = evt.positionIn(this.getSubmorphNamed("borderHalo")),
            brHalo = this.getSubmorphNamed("borderRadiusHalo") || {active: false},
            vertices = this.target.vertices;
            
      return !brHalo.active && Intersection.intersectShapes(  
              IntersectionParams.newPolygon(vertices.map(v => new Point2D(v.x, v.y))), 
              IntersectionParams.newRect(x - 5, y - 5, 10, 10)).points.length > 0;
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
           alignWithTarget() {
              this.vertices = halo.target.vertices;
           }  
        }
    }
}

class ImageStyleHalo extends StyleHalo {

     // has no fill halo, but instead provides an image change interface

}

class TextStyleHalo extends StyleHalo {

    // basically just displays the rich text styling mode all the time

}
