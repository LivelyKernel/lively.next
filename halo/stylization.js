import { Morph, Text, Ellipse, Polygon, Image, Path} from "../index.js";
import { VerticalLayout, HorizontalLayout, FillLayout,
         TilingLayout, GridLayout} from '../layout.js';
import { Color, pt} from "lively.graphics";
import { Intersection, IntersectionParams } from 'kld-intersections';
import { arr } from "lively.lang";
import { connect } from "lively.bindings";
import { ColorPicker, BorderStyler } from "../ide/style-editor.js";

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
             this.borderRadiusHalo(),
             this.layoutControl()
           ]
       }];
       this.focus();
       this.update();
       connect(target, "onChange", this, "update");
   }

   get isLayoutHalo() { return true; }
   
   onMouseMove(evt) { this.update(evt) }

   remove() {
      this.layoutHalo && this.layoutHalo.remove();
      super.remove();
   }

   update(evt) {
      this.setBounds(this.target.globalBounds().insetBy(-50));
      this.submorphs[0].submorphs.forEach(s => s.update && s.update(evt));
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
            brHalo = this.getSubmorphNamed("borderRadiusHalo"),
            br = this.target.borderRadius,
            {width, height} = this.target.globalBounds();
            
      return !brHalo.active && Intersection.intersectShapes(  
              IntersectionParams.newRoundRect(0, 0, width, height, br, br), 
              IntersectionParams.newRect(x - 5, y - 5, 10, 10)).points.length > 0;
   }

   borderHalo() {
      const target = this.target, halo = this;
      // subscribe to the global mouse move event
      return {
         name: "borderHalo",
         draggable: false,
         borderWidth: Math.max(3, target.borderWidth), 
         fill: Color.transparent,
         borderColor: Color.orange.withA(0.4),
         borderRadius: target.borderRadius,
         bounds: target.globalBounds().withX(0).withY(0),
         isHaloItem: true,
         update(evt) {
           this.setBounds(target.globalBounds().withX(0).withY(0));
           this.borderWidth = Math.max(3, target.borderWidth);
           this.borderRadius = target.borderRadius;
           if (halo.isOnMorphBorder(evt)) {
              this.animate({borderColor: Color.orange});
              halo.nativeCursor = this.nativeCursor = "pointer";
              this.active = true;
           } else {
              this.animate({borderColor: Color.orange.withA(.4)});
              halo.nativeCursor = this.nativeCursor = null;
              this.active = false;
           }
         },
         onMouseDown(evt) {
            if (this.active) {
                const bs = this.borderStyler || new BorderStyler(target);
                bs.openInWorldNearHand();
                bs.adjustOrigin(evt.positionIn(bs));
                bs.scale = 0; bs.opacity = 0;
                bs.animate({opacity: 1, scale: 1, duration: 200});
                this.borderStyler = bs;
            } else {
                const p = this.picker || new ColorPicker({
                    extent: pt(400,310), 
                    color: target.fill})
                p.openInWorldNearHand();
                p.adjustOrigin(evt.positionIn(p));
                p.scale = 0; p.opacity = 0;
                p.animate({opacity: 1, scale: 1, duration: 200});
                connect(p, "color", target, "fill");
                this.picker = p;
            }
         },
      }
   }

   borderRadiusHalo() {
       const halo = this,
             getPos = () => {
          return halo.target.globalBounds()
                     .withX(0).withY(0).topRight()
                     .addXY(-halo.target.borderRadius, 0)
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
          onHoverIn() { this.active = true; },
          onHoverOut() { this.active = false; },
          update(evt) { this.center = getPos(); },
          onDragStart(evt) { 
             this.active = true; 
             this.borderRadiusView = this.addMorph(new Text({
                fill: Color.black.withA(.7), borderRadius: 5,
                padding: 5, fontColor: Color.white,
                position: pt(10,10)
             }));
          },
          onDrag(evt) {
             var r = halo.target.borderRadius;
             halo.update(evt);
             r -= evt.state.dragDelta.x;
             r = Math.min(halo.target.width / 2, Math.max(r, 0));
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
          layoutControl.animate({layout: new VerticalLayout(), 
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

   layoutControl() {
       const halo = this,
             getPos = () => this.target.globalBounds()
                                .withX(0).withY(0)
                                .bottomCenter().addXY(0, 20);
       return {
           name: "layoutControl",
           borderRadius: 15,
           clipMode: "hidden",
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
                padding: 2, readOnly: true, 
                fontWeight: 'bold', nativeCursor: "pointer",
                fontStyle: 'bold', textString: this.getCurrentLayoutName(),
                onMouseDown: (evt) => {
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
                }},
               {styleClasses: ["fa", "fa-th"],
                name: "layoutHaloToggler",
                nativeCursor: "pointer",
                fill: Color.transparent,
                fixedWidth: true,
                origin: pt(0,-2),
                extent: pt(20,20),
                tooltip: "Toggle layout halo",
                onMouseDown: (evt) => {
                   this.target.layout && this.toggleLayoutHalo();
                }}
           ]}]
       }
   }

}

export class EllipseStyleHalo extends StyleHalo {

    borderHalo() {
       // no handle for chaning the border radius, but different
       // circular shape of the border
       return undefined;
    }

}

class ImageStyleHalo extends StyleHalo {

     // has no fill halo, but instead provides an image change interface

}

class TextStyleHalo extends StyleHalo {

    // basically just displays the rich text styling mode all the time

}

class SvgStyleHalo extends StyleHalo {

    // provides a more advances border styler, that besides border stylizer
    // also provides the abilitiy to add/remove anchors, and modify them

}