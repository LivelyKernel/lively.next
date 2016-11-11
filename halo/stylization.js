import { Morph, Text, Ellipse, Polygon, Image, Path} from "../index.js";
import { VerticalLayout, HorizontalLayout, FillLayout,
         TilingLayout, GridLayout} from '../layout.js';
import { Color, pt} from "lively.graphics";
import { Intersection, IntersectionParams } from 'kld-intersections';
import { arr } from "lively.lang";
import { connect } from "lively.bindings";
import { ColorPicker, BorderStyler, BodyStyler } from "../ide/style-editor.js";
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

   get isLayoutHalo() { return true; }
   
   onMouseMove(evt) { this.update(evt) }

   remove() {
      this.layoutHalo && this.layoutHalo.remove();
      this.borderStyler && this.borderStyler.remove();
      this.picker && this.picker.remove();
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
                connect(halo.borderStyler.open(), "active", halo, "stylizing");
            } else {
                connect(halo.bodyStyler.open(), "active", halo, "stylizing");
            }
            this.get("borderHalo").borderColor = Color.transparent;
            halo.stylizing = true;
         },
         ...props
      }
   }

   borderHalo() {
      const target = this.target, halo = this;
      // subscribe to the global mouse move event
      return this.borderHaloShape({
         name: "borderHalo",
         update(evt) {
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
              // show instructions
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
           // show instructions if inside the morph
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
          this.borderStyler = this.addMorph(new BorderStyler({
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
          this.bodyStyler = this.addMorph(new BodyStyler({
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
          rotation: -halo.target.rotation,
          onHoverIn() { this.active = true; },
          onHoverOut() { this.active = false; },
          update(evt) { this.center = getPos(); },
          onDragStart(evt) { 
             this.active = true;
             halo.stylizing = true; 
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
            halo.stylizing = false; 
            this.active = false;
            this.borderRadiusView.remove(); 
          }
       }
   }

   // layout halo

   getLayoutObjects() {
       return [null,
               new HorizontalLayout({autoResize: false}), 
               new VerticalLayout({autoResize: false}), 
               new FillLayout(), 
               new TilingLayout(), 
               new GridLayout({grid: [[null], [null], [null]]})];
   }

   toggleLayoutHalo() {
       const layoutControl = this.getSubmorphNamed("layoutControl"),
             layoutHaloToggler = this.getSubmorphNamed("layoutHaloToggler"),
             layoutPicker = this.getSubmorphNamed('layoutPicker'),
             borderHalo = this.getSubmorphNamed("borderHalo"),
             borderRadiusHalo = this.getSubmorphNamed("borderRadiusHalo"),
             controlSubmorphs = layoutControl.submorphs;
       if (this.layoutHalo) {
          layoutControl.layout = null;
          layoutControl.submorphs = [this.getSubmorphNamed("layoutControlPickerWrapper")];
          layoutControl.animate({layout: new HorizontalLayout(),
                                 duration: 300});
          this.layoutHalo.remove(); this.layoutHalo = null;
          borderHalo.visible = true;
          borderRadiusHalo.visible = true;
          layoutHaloToggler.styleClasses = ["fa", "fa-th"];
          layoutHaloToggler.tooltip = "Show layout halo";
          layoutPicker.textString = this.getCurrentLayoutName();
       } else {
          this.layoutHalo = this.world().showLayoutHaloFor(this.target, this.state.pointerId);
          layoutControl.layout = null;
          layoutControl.submorphs = [...controlSubmorphs, ...this.layoutHalo.optionControls()]
          layoutControl.animate({layout: new VerticalLayout({spacing: 3}),
                                 border: {color: Color.gray.darker(), width: 1, style: "solid"},
                                 fill: Color.gray, 
                                 duration: 300});
          borderHalo.visible = false;
          borderRadiusHalo.visible = false;
          this.getSubmorphNamed("layoutHaloToggler").styleClasses = ["fa", "fa-close"];
          layoutHaloToggler.tooltip = "Close layout halo";
          layoutPicker.textString = "Configure Layout"
       }
       this.update();
   }

   getCurrentLayoutName() {
      return this.getLayoutName(this.target.layout);
   }

   getLayoutName(l) {
      return l ? l.name() + " Layout" : "No Layout";
   }

   openLayoutMenu() {
     if (this.layoutHalo) return;
     var menu = this.world().openWorldMenu(
        this.getLayoutObjects().map(l => {
           return [this.getLayoutName(l), 
                   () => {
                       const p = this.getSubmorphNamed("layoutPicker");
                       this.target.animate({layout: l, 
                                            easing: "cubic-bezier(0.075, 0.82, 0.165, 1)"});
                       p.textString = this.getLayoutName(l);
                       p.fitIfNeeded();
                       this.update();
                   }]
        })
     )
     menu.globalPosition = this.getSubmorphNamed("layoutPicker").globalPosition;
     menu.isHaloItem = true;
   }

   layoutControl() {
       const halo = this,
             getPos = () => this.target.globalBounds()
                                .withX(0).withY(0)
                                .bottomCenter().addXY(50, 70);
       return {
           name: "layoutControl",
           border: {radius: 15, color: Color.gray.darker(), width: 1},
           clipMode: "hidden", dropShadow: true,
           extent: pt(120, 75),
           topCenter: getPos(),
           fill: Color.gray.withA(.7),
           layout: new VerticalLayout(),
           isHaloItem: true, 
           update(evt) { 
              this.align(this.topCenter, getPos());
              const inspectButton = this.getSubmorphNamed('layoutHaloToggler');
              if (!halo.target.layout) {
                inspectButton.opacity = .5;
                inspectButton.nativeCursor = null;
              } else {
                inspectButton.opacity = 1;
                inspectButton.nativeCursor = "pointer";
              }
           },
           submorphs: [{
            name: "layoutControlPickerWrapper",
            fill: Color.transparent,
            layout: new HorizontalLayout({spacing: 5}),
            submorphs: [
               {type: 'text', fill: Color.transparent, name: "layoutPicker",
                padding: 2, readOnly: true,  fontColor: Color.black.lighter(),
                fontWeight: 'bold', nativeCursor: "pointer",
                fontStyle: 'bold', textString: this.getCurrentLayoutName(),
                onMouseDown: (evt) => {
                   this.openLayoutMenu();
                }},
               Icon.makeLabel("th", {
                name: "layoutHaloToggler",
                nativeCursor: "pointer",
                fontSize: 15, fontColor: Color.black.lighter(),
                padding: 3,
                tooltip: "Toggle layout halo",
                onMouseDown: (evt) => {
                   this.target.layout && this.toggleLayoutHalo();
                }
               })
           ]}]
       }
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
