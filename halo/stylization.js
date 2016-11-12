import { Morph, Text, Ellipse, Polygon, Image, Path} from "../index.js";
import { VerticalLayout, HorizontalLayout, FillLayout,
         TilingLayout, GridLayout} from '../layout.js';
import { Color, pt, rect} from "lively.graphics";
import { Intersection, IntersectionParams } from 'kld-intersections';
import { arr } from "lively.lang";
import { connect, disconnect } from "lively.bindings";
import { ColorPicker, BorderStyleEditor, BodyStyleEditor, LayoutStyleEditor } from "../ide/style-editor.js";
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
    return new styleHaloClass(x, pointerId);
}

class StyleHalo extends Morph {

   constructor(target, pointerId) {
       super({
          draggable: false,
          fill: Color.transparent,
          bounds: target.globalBounds().insetBy(-50),
       });
       this.state = {pointerId};
       this.target = target;
       this.submorphs = [{
           position: pt(50,50),
           fill: Color.transparent,
           submorphs: [
             this.borderHalo(),
             this.borderRadiusHalo()
           ]
       }, this.layoutControl()];
       this.focus();
       this.update();
       connect(target, "onChange", this, "update");
   }

   set showStyleGuides(show) {
       this.get("borderRadiusHalo").visible = show;
       this.get("borderHalo").visible = show;
   }

   get isLayoutHalo() { return true; }
   
   onMouseMove(evt) { this.update(evt) }

   remove() {
      this.get("layoutStyleEditor") && this.get("layoutStyleEditor").remove();
      disconnect(this.target, "onChange", this, "update");
      super.remove();
   }

   update(evt) {
      const [controls, layoutControl] = this.submorphs;
      this.setBounds(this.target.globalBounds().insetBy(-50));
      controls.setTransform(this.target.transformToMorph(this));
      controls.position = this.localizePointFrom(this.target.origin.negated(), this.target);
      controls.submorphs.forEach(s => s.update && s.update(evt));
      layoutControl.update(evt);
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
      const {x,y} = evt.positionIn(this.getSubmorphNamed("borderHalo")),
            brHalo = this.getSubmorphNamed("borderRadiusHalo") || {active: false},
            br = this.target.borderRadius,
            {width, height} = this.target;
            
      return !brHalo.active && Intersection.intersectShapes(  
              IntersectionParams.newRoundRect(0, 0, width, height, br, br), 
              IntersectionParams.newRect(x - 7.5, y - 7.5, 15, 15)).points.length > 0;
   }

   borderHaloShape(props) {
      const halo = this, target = this.target;
      return {
         draggable: false,
         borderWidth: Math.max(3, this.target.borderWidth), 
         fill: Color.transparent,
         borderColor: Color.orange.withA(0.4),
         borderRadius: this.target.borderRadius,
         extent: this.target.extent,
         isHaloItem: true,
         onMouseDown(evt) {
            if (this.borderSelected) {
                halo.borderStyler.open();
            } else {
                halo.bodyStyler.open();
            }
            this.get("borderHalo").borderColor = Color.transparent;
         },
         ...props
      }
   }

   get stylizing() { 
      return (this.borderStyler && this.borderStyler.active) || 
             (this.bodyStyler && this.bodyStyler.active) ||
             (this.get("borderRadiusHalo") && this.get("borderRadiusHalo").active) 
   }

   borderHalo() {
      const target = this.target, halo = this;
      // subscribe to the global mouse move event
      return this.borderHaloShape({
         name: "borderHalo",
         update(evt) {
           // FIXME: refactor to polymorphic dispatch
           this.extent = target.extent;
           this.borderWidth = Math.max(3, target.borderWidth);
           this.borderRadius = target.borderRadius;
           this.vertices = target.vertices;
           if (halo.stylizing) return;
           if (halo.isOnMorphBorder(evt)) {
              this.borderColor = Color.orange;
              halo.nativeCursor = this.nativeCursor = "pointer";
              this.borderSelected = true;
              halo.selectBorder();
           } else {
              if (evt && this.fullContainsPoint(evt.positionIn(this))) {
                  halo.selectBody();
              } else {
                  halo.deselect();
              }
              this.borderColor = Color.orange.withA(.4);
              halo.nativeCursor = this.nativeCursor = null;
              this.borderSelected = false;
           }
         },
      });
   }

   getInstructor(instruction, center=this.innerBounds().center()) {
      return {
         type: "text", borderWidth: 3, opacity: 0,
         borderRadius: 10, borderColor: Color.gray,
         padding: 5,
         fill: Color.black.withA(.7),
         center, fontWeight: "bold",
         fontColor: Color.gray, fontSize: 14,
         textString: instruction
      }
   }

   selectBorder() {
      this.bodyStyler && this.bodyStyler.fadeOut(300);
      this.bodyStyler = null;
      if (!this.borderStyler) {
          this.borderStyler = this.addMorph(new BorderStyleEditor({
               target: this.target,
               title: "Change Border Style",
               center: this.innerBounds().topCenter()
          }));
          this.borderStyler.animate({opacity: 1, duration: 300});
      }
   }

   selectBody() {
      this.borderStyler && this.borderStyler.fadeOut(300);
      this.borderStyler = null;
      if (!this.bodyStyler) {
          this.bodyStyler = this.addMorph(new BodyStyleEditor({
               target: this.target,
               title: "Change Body Style",
               center: this.innerBounds().center()
          })
          );
          this.bodyStyler.animate({opacity: 1, duration: 300});
      }
   }

   deselect() {
       this.borderStyler && this.borderStyler.fadeOut(300);
       this.bodyStyler && this.bodyStyler.fadeOut(300);
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
          // onHoverIn() { halo.deselect(); this.active = true; },
          rotation: -halo.target.rotation,
          update(evt) { this.center = getPos(); },
          onDragStart(evt) { 
             this.active = true; halo.deselect();
             this.borderRadiusView = this.addMorph(new Text({
                fill: Color.black.withA(.7), borderRadius: 5,
                padding: 5, fontColor: Color.white,
                position: pt(10,10), textString: halo.target.borderRadius + "px"
             }));
          },
          onDrag(evt) {
             var r = halo.target.borderRadius;
             halo.update(evt);
             r -= evt.state.dragDelta.x;
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

}

class ImageStyleHalo extends StyleHalo {

     // has no fill halo, but instead provides an image change interface

}

class SvgStyleHalo extends StyleHalo {

    // provides a more advances border styler, that besides border stylizer
    // also provides the abilitiy to add/remove anchors, and modify them

    borderRadiusHalo() {
       return undefined;
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
    
    borderHaloShape(props) {
        const target = this.target, halo = this;
        return new Polygon({
         draggable: false,
         vertices: this.target.vertices,
         borderWidth: Math.max(3, target.borderWidth), 
         fill: Color.transparent,
         borderColor: Color.orange.withA(0.4),
         borderRadius: target.borderRadius,
         extent: target.extent,
         isHaloItem: true,
         onMouseDown(evt) {
             if (this.borderSelected && !this.vertexHandles) {
                this.borderColor = Color.transparent;
                this.vertexHandles = target.vertices.map((v, i) => {
                  this.addMorph({
                       extent: pt(10,10), draggable: true,
                       fill: Color.red.withA(.8),
                       borderWidth: 1, borderColor: Color.black,
                       position: v, onDrag(evt) {
                          const vs = target.vertices;
                          vs[i] = vs[i].addPt(evt.state.dragDelta)
                          target.vertices = vs;
                          this.moveBy(evt.state.dragDelta);
                          halo.update();
                       }
                   })
                });
             } else if (!this.borderSelected) {
                halo.openMorphBodyStyler(evt);
             }
         },
         ...props
      })
    }
}

class TextStyleHalo extends StyleHalo {

    // basically just displays the rich text styling mode all the time

}
